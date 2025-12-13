document.getElementById("closeDuplicates").onclick = () => {
  chrome.runtime.sendMessage({ action: "closeDuplicates" });
  window.close();
};

document.getElementById("ungroup").onclick = () => {
  chrome.runtime.sendMessage({ action: "ungroup" });
  window.close();
};

document.getElementById("control-z").onclick = () => {
  chrome.runtime.sendMessage({ action: "control-z" });
  window.close();
};

document.getElementById("group").onclick = () => {
  chrome.runtime.sendMessage({ action: "group" });
  window.close();
};

document.getElementById("inactive30min").onclick = () => {
  chrome.runtime.sendMessage({
    action: "closeInactive",
    limit: 30 * 60 * 1000,
  });
  window.close();
};

document.getElementById("inactive1hr").onclick = () => {
  chrome.runtime.sendMessage({
    action: "closeInactive",
    limit: 60 * 60 * 1000,
  });
  window.close();
};

document.getElementById("back").onclick = () => {
  window.location.href = "maintabs.html";
};

function updateBookmarkButton(added, protectedList) {
  const btn = document.getElementById("bookmark");
  btn.innerHTML = added ? "Bookmarked" : "Bookmark";
  console.log("Protected set:", protectedList);
}

// Listen for status broadcasts from the background script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "bookmarkStatus") {
    updateBookmarkButton(Boolean(msg.added), msg.protected);
  }
});

// Request current status on popup open
chrome.runtime.sendMessage({ action: "getBookmarkStatus" }, (resp) => {
  if (resp && typeof resp.added !== "undefined")
    updateBookmarkButton(Boolean(resp.added), resp.protected);
});

document.getElementById("bookmark").onclick = () => {
  chrome.runtime.sendMessage({ action: "bookmark" }, (resp) => {
    if (resp && typeof resp.added !== "undefined")
      updateBookmarkButton(Boolean(resp.added), resp.protected);
  });
};

document.getElementById("customClose").onclick = () => {
  const value = parseFloat(document.getElementById("customTime").value);
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
    limit,
  });

  window.close();
};