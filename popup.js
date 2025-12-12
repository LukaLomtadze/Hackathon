document.getElementById("closeDuplicates").onclick = () => {
    chrome.runtime.sendMessage({ action: "closeDuplicates" });
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

document.getElementById("back").onclick = () => {
  window.location.href = "maintabs.html";
};

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "bookmarkStatus") {
      const btn = document.getElementById("bookmark");
      btn.textContent = msg.added ? "Bookmark" : "Bookmarked";
  }
});

document.getElementById("bookmark").onclick = () => {
  chrome.runtime.sendMessage({ action: "bookmark" });
};




document.getElementById("customClose").onclick = () => {
    const value = parseFloat(
      document.getElementById("customTime").value
    );
    const unit = document.getElementById("customUnit").value;
  
    if (!value || value <= 0) {
      alert("Enter a valid time value");
      return;
    }
  
    let limit;
  
    if (unit === "minutes") {
      limit = value * 60 * 1000;
    } else {
      limit = value * 60 * 60 * 1000;
    }
  
    chrome.runtime.sendMessage({
      action: "closeInactive",
      limit
    });
  
    window.close();
};
  

  