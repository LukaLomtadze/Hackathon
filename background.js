const PROTECTED_KEY = "protectedTabs";
const UNDO_KEY = "undoStack";

if (chrome.commands?.onCommand) {
  chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'capture-context') {
      try {
        await chrome.action.openPopup();
      } catch (e) {}
    }
  });
}

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
      sendResponse({ added, protected: Array.from(set) });
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
      sendResponse({ added, protected: Array.from(set) });
    });
    return true;
  }

  if (msg.action === "exportCaptures") {
    chrome.storage.local.get(['captures'], (data) => {
      try {
        const captures = data.captures || [];
        const json = JSON.stringify(captures, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        if (chrome.downloads && chrome.downloads.download) {
          chrome.downloads.download({
            url: url,
            filename: `context-captures-${Date.now()}.json`,
            saveAs: true
          });
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, message: 'Downloads API not available' });
        }
      } catch (e) {
        console.error('Export error:', e);
        sendResponse({ success: false, message: e.message });
      }
    });
    return true; // Keep message channel open for async response
  }
  
  if (msg.action === "importCaptures") {
    sendResponse({ success: false, message: 'Import not implemented' });
    return true;
  }

  if (msg.action === "deleteCapture") {
    chrome.storage.local.get(['captures'], (data) => {
      try {
        let captures = data.captures || [];
        const beforeCount = captures.length;
        captures = captures.filter(c => {
          if (!c || !c.id) return true;
          return String(c.id) !== String(msg.captureId);
        });
        const afterCount = captures.length;
        
        if (beforeCount === afterCount) {
          sendResponse({ success: false, message: 'Capture not found' });
          return;
        }
        
        chrome.storage.local.set({ captures: captures }, () => {
          sendResponse({ success: true, count: captures.length });
        });
      } catch (e) {
        console.error('Delete capture error:', e);
        sendResponse({ success: false, message: e.message });
      }
    });
    return true; // Keep message channel open for async response
  }

  if (msg.action === "deleteAllCaptures") {
    chrome.storage.local.set({ captures: [] }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

async function controlZFunc() {
  try {
    const batch = await popUndoBatch();
    if (batch && batch.entries && Array.isArray(batch.entries) && batch.entries.length) {
      // Restore entries in original order
      for (let i = 0; i < batch.entries.length; i++) {
        const e = batch.entries[i];
        if (!e?.url) continue;
        try {
          await new Promise((res) => {
            chrome.tabs.create(
              {
                windowId: e.windowId || undefined,
                url: e.url,
                index: e.index || undefined,
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
      if (!items?.length) return;
      const newest = items[0].lastModified || Date.now();
      const cutoff = newest - 5000;
      const toRestore = [];
      for (const it of items) {
        const lm = it.lastModified || 0;
        if (lm >= cutoff) toRestore.push(it);
        else break;
      }
      if (!toRestore.length) return;
      for (let i = toRestore.length - 1; i >= 0; i--) {
        const sid = toRestore[i].tab?.sessionId || toRestore[i].window?.sessionId || toRestore[i].sessionId;
        if (sid) {
          try {
            chrome.sessions.restore(sid);
          } catch (e) {}
        }
      }
    });
  } catch (e) {}
}

async function groupFunc() {
  try {
    const tabs = await chrome.tabs.query({});

    const groups = new Map();
    for (const tab of tabs) {
      const raw = tab.url || "";
      let host;
      try {
        host = new URL(raw).hostname.replace(/^www\./, "");
      } catch (e) {
        host = raw;
      }

      if (!groups.has(host)) groups.set(host, []);
      groups.get(host).push(tab);
    }

    for (const [host, group] of groups) {
      if (group.length <= 1) continue;

      const tabIds = group.map((t) => t.id);

      try {
        const groupId = await chrome.tabs.group({ tabIds });

        const title = host && host.length ? host : undefined;
        if (typeof chrome.tabGroups !== "undefined") {
          try {
            await chrome.tabGroups.update(groupId, { title, color: "blue" });
          } catch (e) {}
        }
      } catch (err) {}
    }
  } catch (e) {}
}

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
      for (const id of tabIds) {
        try {
          await chrome.tabs.ungroup(id);
        } catch (err) {}
      }
    }
  } catch (e) {}
}

async function closeDuplicateTabs() {
    const tabs = await chrome.tabs.query({});
  const protectedTabs = await getProtectedTabs();

  const groups = new Map();
  for (const tab of tabs) {
    let url = (tab.url || "").split("#")[0].split("?")[0];
    if (url.endsWith("/")) url = url.replace(/\/+$/, "");
    url = url.trim();
    if (!groups.has(url)) groups.set(url, []);
    groups.get(url).push(tab);
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
            removedEntries.push({
              id: t.id,
              url: t.url,
              title: t.title,
              index: t.index,
              windowId: t.windowId,
              time: Date.now(),
            });
            chrome.tabs.remove(t.id);
          } catch (e) {}
        }
      }
    } else {
      for (let i = 1; i < group.length; i++) {
        try {
          removedEntries.push({
            id: group[i].id,
            url: group[i].url,
            title: group[i].title,
            index: group[i].index,
            windowId: group[i].windowId,
            time: Date.now(),
          });
          chrome.tabs.remove(group[i].id);
        } catch (e) {}
      }
    }
  }

  if (removedEntries.length) await pushUndoBatch(removedEntries);
}

chrome.tabs.onActivated.addListener((activeInfo) => {
  if (activeInfo?.tabId) {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
      if (tab?.id) chrome.storage.local.set({ [tab.id]: Date.now() });
    });
  }
});

async function closeInactiveTabs(limit) {
    const now = Date.now();
    const tabs = await chrome.tabs.query({});
    const stored = await chrome.storage.local.get(null);
  const protectedTabs = await getProtectedTabs();

    const active = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTabId = active && active.length > 0 ? active[0].id : null;

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
        } catch (e) {}
    }
}

  if (removedEntries.length) await pushUndoBatch(removedEntries);
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (tabId) {
    await removeProtectedTab(tabId);
  }
});

async function getProtectedTabs() {
    const data = await chrome.storage.local.get(PROTECTED_KEY);
    return new Set(data[PROTECTED_KEY] || []);
}

async function setProtectedTabsSet(set) {
  await chrome.storage.local.set({ [PROTECTED_KEY]: Array.from(set) });
}

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
    while (stack.length > 30) stack.shift();
    await chrome.storage.local.set({ [UNDO_KEY]: stack });
  } catch (e) {}
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

setInterval(async () => {
  try {
    const data = await chrome.storage.local.get(['captures']);
    const captures = data.captures || [];
    if (!Array.isArray(captures)) return;
    const cutoff = Date.now() - (90 * 24 * 60 * 60 * 1000);
    const filtered = captures.filter(c => c?.timestamp > cutoff);
    if (filtered.length < captures.length) {
      await chrome.storage.local.set({ captures: filtered });
    }
  } catch (e) {}
}, 24 * 60 * 60 * 1000);
