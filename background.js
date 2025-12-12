chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "closeDuplicates") closeDuplicateTabs();
    if (msg.action === "closeInactive") closeInactiveTabs(msg.limit);
    if (msg.action === "bookmark") bookmarkFunc();
});


async function closeDuplicateTabs() {
    const tabs = await chrome.tabs.query({});
    const seen = new Set();

    for (let tab of tabs) {
        const url = tab.url.split('#')[0].split('?')[0];
        if (seen.has(url)) chrome.tabs.remove(tab.id);
        else seen.add(url);
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

    const active = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTabId = active[0]?.id;

    for (let tab of tabs) {
        const lastActive = stored[tab.id];
        if (!lastActive) continue;

        if (tab.id === activeTabId) continue;

        if (now - lastActive > limit) {
            chrome.tabs.remove(tab.id);
        }
    }
}



const PROTECTED_KEY = "protectedTabs";

async function getProtectedTabs() {
    const data = await chrome.storage.local.get(PROTECTED_KEY);
    return new Set(data[PROTECTED_KEY] || []);
}

async function addProtectedTab(tabId) {
    const set = await getProtectedTabs();
    set.add(tabId);
    await chrome.storage.local.set({
        [PROTECTED_KEY]: Array.from(set)
    });
}

async function removeProtectedTab(tabId) {
    const set = await getProtectedTabs();
    set.delete(tabId);
    await chrome.storage.local.set({
        [PROTECTED_KEY]: Array.from(set)
    });
}


async function bookmarkFunc() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    // create bookmark
    await chrome.bookmarks.create({
        title: tab.title,
        url: tab.url
    });

    // store protected tab
    await addProtectedTab(tab.id);

    // visually mark tab (⭐ prefix)
    chrome.tabs.update(tab.id, {
        title: "⭐ " + tab.title
    });

    // group tab
    const groupId = await chrome.tabGroups.create({
        tabIds: [tab.id],
        title: "Protected",
        color: "yellow"
    });
}
