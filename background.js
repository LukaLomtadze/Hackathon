chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "closeDuplicates") closeDuplicateTabs();
    if (msg.action === "closeInactive") closeInactiveTabs(msg.limit);
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

