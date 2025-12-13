// (removed legacy message listener)

const PROTECTED_KEY = "protectedTabs";
const UNDO_KEY = "undoStack";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "closeDuplicates") {
    closeDuplicateTabs();
    return;
  }

  if (msg.action === "closeInactive") {
    closeInactiveTabs(msg.limit);
    return;
  }

  if (msg.action === "group") {
    groupFunc();
    return;
  }

  if (msg.action === "ungroup") {
    ungroupFunc();
    return;
  }

  if (msg.action === "control-z") {
    controlZFunc();
    return;
  }

  if (msg.action === "bookmark") {
    toggleProtectedForActiveTab().then(async (added) => {
      const set = await getProtectedTabs();
      const arr = Array.from(set);
      console.log("Protected set:", arr);
      sendResponse({ added, protected: arr });
      chrome.runtime.sendMessage({
        action: "bookmarkStatus",
        added,
        protected: arr,
      });
    });
    return true; // keep channel open for async sendResponse
  }

  if (msg.action === "getBookmarkStatus") {
    isActiveTabProtected().then(async (added) => {
      const set = await getProtectedTabs();
      const arr = Array.from(set);
      console.log("Protected set:", arr);
      sendResponse({ added, protected: arr });
    });
    return true;
  }
});

// =========================== //
async function controlZFunc() {
  // First try our internal undo stack (pop last batch). If empty, fall back to Sessions API.
  try {
    const batch = await popUndoBatch();
    if (batch && batch.entries && batch.entries.length) {
      // Restore entries in original order
      for (let i = 0; i < batch.entries.length; i++) {
        const e = batch.entries[i];
        try {
          // Create tab in the original window if possible
          await new Promise((res) => {
            chrome.tabs.create(
              {
                windowId: e.windowId,
                url: e.url,
                index: e.index,
                active: false,
              },
              () => res()
            );
          });
        } catch (err) {
          console.warn("Failed to recreate tab from undo stack", e, err);
        }
      }
      return;
    }

    // fallback: Sessions API
    if (!chrome.sessions || !chrome.sessions.getRecentlyClosed) {
      console.error(
        'No undo entries and Sessions API not available (add "sessions" permission)'
      );
      return;
    }

    chrome.sessions.getRecentlyClosed(async (items) => {
      if (!items || !items.length) {
        console.log("No recently closed sessions available");
        return;
      }

      const newest = items[0].lastModified || Date.now();
      const WINDOW_MS = 5000;
      const cutoff = newest - WINDOW_MS;

      const toRestore = [];
      for (const it of items) {
        const lm = it.lastModified || 0;
        if (lm >= cutoff) toRestore.push(it);
        else break;
      }

      if (!toRestore.length) {
        console.log(
          "No recently-closed entries within the time window to restore"
        );
        return;
      }

      for (let i = toRestore.length - 1; i >= 0; i--) {
        const entry = toRestore[i];
        const sid =
          entry.tab?.sessionId || entry.window?.sessionId || entry.sessionId;
        if (!sid) continue;
        try {
          chrome.sessions.restore(sid, (restored) => {
            console.log(
              "restored session",
              sid,
              restored && restored.tab && restored.tab.id
            );
          });
        } catch (e) {
          console.warn("Failed to restore session", sid, e);
        }
      }
    });
  } catch (e) {
    console.error("controlZFunc error", e);
  }
}

// =========================== //
async function groupFunc() {
  try {
    const tabs = await chrome.tabs.query({});

    // Group tabs by hostname so different paths on same site group together
    const groups = new Map();
    for (const tab of tabs) {
      const raw = tab.url || "";
      let host;
      try {
        host = new URL(raw).hostname.replace(/^www\./, "");
      } catch (e) {
        // fallback to raw URL for chrome://, about:blank, etc.
        host = raw;
      }

      if (!groups.has(host)) groups.set(host, []);
      groups.get(host).push(tab);
    }

    for (const [host, group] of groups) {
      if (group.length <= 1) continue; // unique site, nothing to group

      const tabIds = group.map((t) => t.id);

      try {
        const groupId = await chrome.tabs.group({ tabIds });

        // Use hostname as group title when possible
        const title = host && host.length ? host : undefined;
        if (typeof chrome.tabGroups !== "undefined") {
          try {
            await chrome.tabGroups.update(groupId, { title, color: "blue" });
          } catch (e) {
            console.error("tabGroups.update failed", e);
          }
        }
      } catch (err) {
        console.error("Failed to group tabs for host", host, err);
      }
    }
  } catch (e) {
    console.error("groupFunc error", e);
  }
}

// Ungroup all tabs that belong to any tab group
// ============================ //
async function ungroupFunc() {
  try {
    const tabs = await chrome.tabs.query({});
    const grouped = tabs.filter(
      (t) => typeof t.groupId !== "undefined" && t.groupId !== -1
    );
    if (!grouped.length) return;

    const tabIds = grouped.map((t) => t.id);

    try {
      await chrome.tabs.ungroup(tabIds);
    } catch (e) {
      // fallback: try ungrouping one by one
      for (const id of tabIds) {
        try {
          await chrome.tabs.ungroup(id);
        } catch (err) {}
      }
    }
  } catch (e) {
    console.error("ungroupFunc error", e);
  }
}

// ============================ //
async function closeDuplicateTabs() {
  const tabs = await chrome.tabs.query({});
  const protectedTabs = await getProtectedTabs();

  console.log(
    "closeDuplicateTabs: total tabs=",
    tabs.length,
    "protected count=",
    protectedTabs.size
  );

  // Group tabs by normalized URL (strip query/hash and trailing slash)
  const groups = new Map();
  for (const tab of tabs) {
    let url = (tab.url || "").split("#")[0].split("?")[0];
    // remove trailing slash
    if (url.endsWith("/")) url = url.replace(/\/+$/, "");
    url = url.trim();
    if (!groups.has(url)) groups.set(url, []);
    groups.get(url).push(tab);
  }

  // Debug: log groups with more than one tab
  for (const [u, g] of groups) {
    if (g.length > 1)
      console.log(
        "duplicate group:",
        u,
        "count=",
        g.length,
        "tabIds=",
        g.map((t) => t.id)
      );
  }
  // For each group of duplicates, if any tab is protected, remove only unprotected ones.
  // Otherwise remove all but the first tab.
  const removedEntries = [];
  for (const [url, group] of groups) {
    if (group.length <= 1) continue;

    const hasProtected = group.some((t) => protectedTabs.has(t.id));

    if (hasProtected) {
      for (const t of group) {
        if (!protectedTabs.has(t.id)) {
          try {
            console.log("closing unprotected duplicate tab", t.id, t.url);
            removedEntries.push({
              id: t.id,
              url: t.url,
              title: t.title,
              index: t.index,
              windowId: t.windowId,
              time: Date.now(),
            });
            chrome.tabs.remove(t.id);
          } catch (e) {
            console.warn(e);
          }
        } else {
          console.log("preserving protected tab", t.id, t.url);
        }
      }
    } else {
      // keep the first, close the rest
      for (let i = 1; i < group.length; i++) {
        try {
          console.log("closing duplicate tab", group[i].id, group[i].url);
          removedEntries.push({
            id: group[i].id,
            url: group[i].url,
            title: group[i].title,
            index: group[i].index,
            windowId: group[i].windowId,
            time: Date.now(),
          });
          chrome.tabs.remove(group[i].id);
        } catch (e) {
          console.warn(e);
        }
      }
    }
  }

  if (removedEntries.length) await pushUndoBatch(removedEntries);
}

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    chrome.storage.local.set({ [tab.id]: Date.now() });
  });
});

// ============================ //
async function closeInactiveTabs(limit) {
  const now = Date.now();
  const tabs = await chrome.tabs.query({});
  const stored = await chrome.storage.local.get(null);
  const protectedTabs = await getProtectedTabs();

  const active = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTabId = active[0]?.id;

  const removedEntries = [];
  for (let tab of tabs) {
    if (protectedTabs.has(tab.id)) continue; // skip protected
    if (tab.id === activeTabId) continue;

    const lastActive = stored[tab.id];
    if (!lastActive) continue;

    if (now - lastActive > limit) {
      try {
        removedEntries.push({
          id: tab.id,
          url: tab.url,
          title: tab.title,
          index: tab.index,
          windowId: tab.windowId,
          time: Date.now(),
        });
        chrome.tabs.remove(tab.id);
      } catch (e) {
        console.warn(e);
      }
    }
  }

  if (removedEntries.length) await pushUndoBatch(removedEntries);
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await removeProtectedTab(tabId);
});

// ============================ //
async function getProtectedTabs() {
  const data = await chrome.storage.local.get(PROTECTED_KEY);
  return new Set(data[PROTECTED_KEY] || []);
}

// ============================ //
async function setProtectedTabsSet(set) {
  await chrome.storage.local.set({ [PROTECTED_KEY]: Array.from(set) });
}

// ============================ //
async function addProtectedTab(tabId) {
  const set = await getProtectedTabs();
  if (set.has(tabId)) return false;
  set.add(tabId);
  await setProtectedTabsSet(set);
  return true;
}

// ============================ //
async function removeProtectedTab(tabId) {
  const set = await getProtectedTabs();
  if (!set.has(tabId)) return false;
  set.delete(tabId);
  await setProtectedTabsSet(set);
  return true;
}

// ============================ //
async function toggleProtectedForActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return false;

  const set = await getProtectedTabs();
  const wasProtected = set.has(tab.id);
  if (wasProtected) {
    set.delete(tab.id);
  } else {
    set.add(tab.id);
  }

  await setProtectedTabsSet(set);
  return !wasProtected;
}

// ============================ //
async function isActiveTabProtected() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return false;
  const set = await getProtectedTabs();
  return set.has(tab.id);
}

// ============================ //
async function pushUndoBatch(entries) {
  try {
    const data = await chrome.storage.local.get(UNDO_KEY);
    const stack = data[UNDO_KEY] || [];
    stack.push({ time: Date.now(), entries });
    const MAX = 30;
    while (stack.length > MAX) stack.shift();
    await chrome.storage.local.set({ [UNDO_KEY]: stack });
  } catch (e) {
    console.error("pushUndoBatch error", e);
  }
}

async function popUndoBatch() {
  try {
    const data = await chrome.storage.local.get(UNDO_KEY);
    const stack = data[UNDO_KEY] || [];
    if (!stack.length) return null;
    const batch = stack.pop();
    await chrome.storage.local.set({ [UNDO_KEY]: stack });
    return batch;
  } catch (e) {
    console.error("popUndoBatch error", e);
    return null;
  }
}
