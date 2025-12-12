document.getElementById("closeDuplicates").onclick = () => {
    chrome.runtime.sendMessage({ action: "closeDuplicates" });
    window.close();
};

document.getElementById("inactive10sec").onclick = () => {
    chrome.runtime.sendMessage({ action: "closeInactive", limit: 10 * 1000 });
    window.close();
};

document.getElementById("inactive30min").onclick = () => {
    chrome.runtime.sendMessage({ action: "closeInactive", limit: 30 * 60 * 1000 });
    window.close();
};

document.getElementById("inactive1hr").onclick = () => {
    chrome.runtime.sendMessage({ action: "closeInactive", limit: 60 * 60 * 1000 });
    window.close();
};

document.getElementById("inactive2hr").onclick = () => {
    chrome.runtime.sendMessage({ action: "closeInactive", limit: 2 * 60 * 60 * 1000 });
    window.close();
};

document.getElementById("customClose").onclick = () => {
    const hours = parseFloat(document.getElementById("customHours").value);

    if (!hours || hours <= 0) {
        alert("Enter a valid number of hours");
        return;
    }

    const limit = hours * 60 * 60 * 1000; // convert hours to ms

    chrome.runtime.sendMessage({ action: "closeInactive", limit });
    window.close();
};