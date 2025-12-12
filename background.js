chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "closeDuplicates") closeDuplicateTabs();
    if (msg.action === "closeInactive") closeInactiveTabs(msg.limit);
    if (msg.action === "bookmark") bookmarkFunc();
});


async function closeDuplicateTabs() {
    const tabs = await chrome.tabs.query({});
    const protectedTabs = await getProtectedTabs();
    const seen = new Set();

    for (let tab of tabs) {
        if (protectedTabs.has(tab.id)) continue;

        const url = tab.url.split('#')[0].split('?')[0];
        if (seen.has(url)) {
            chrome.tabs.remove(tab.id);
        } else {
            seen.add(url);
        }
    }
}


chrome.tabs.onActivated.addListener(activeInfo => {
    chrome.tabs.get(activeInfo.tabId, tab => {
        chrome.storage.local.set({ [tab.id]: Date.now() });
    });
});



async function closeInactiveTabs(limit) {
    const now = Date.now();
    const tabs = await chrome.tabs.query({});
    const stored = await chrome.storage.local.get(null);
    const protectedTabs = await getProtectedTabs();

    const active = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTabId = active[0]?.id;

    for (let tab of tabs) {
        if (protectedTabs.has(tab.id)) continue; // 🚫 skip protected
        if (tab.id === activeTabId) continue;

        const lastActive = stored[tab.id];
        if (!lastActive) continue;

        if (now - lastActive > limit) {
            chrome.tabs.remove(tab.id);
        }
    }
}


chrome.tabs.onRemoved.addListener(async (tabId) => {
    await removeProtectedTab(tabId);
});


const PROTECTED_KEY = "protectedTabs";

async function getProtectedTabs() {
    const data = await chrome.storage.local.get(PROTECTED_KEY);
    return new Set(data[PROTECTED_KEY] || []);


async function addProtectedTab(tabId) {
    const set = await getProtectedTabs();

    if (set.has(tabId)) {
        return false; // already protected
    }

    set.add(tabId);

    await chrome.storage.local.set({
        [PROTECTED_KEY]: Array.from(set)
    });

    return true; // newly protected
}


async function removeProtectedTab(tabId) {
    const set = await getProtectedTabs();
    set.delete(tabId);
    await chrome.storage.local.set({
        [PROTECTED_KEY]: Array.from(set)
    });
}


async function bookmarkFunc(sender) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    await chrome.bookmarks.create({
        title: tab.title,
        url: tab.url
    });

    const added = await addProtectedTab(tab.id);

    // respond back to popup
    chrome.runtime.sendMessage({
        action: "bookmarkStatus",
        added
    });
}

