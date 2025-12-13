// snapshots.js - handles listing, saving, opening, and deleting snapshots
(function () {
  // storage helpers
  function storageGet(key) {
    return new Promise((res) => chrome.storage.local.get(key, res));
  }
  function storageSet(obj) {
    return new Promise((res) => chrome.storage.local.set(obj, res));
  }

  async function getSnapshots() {
    const data = await storageGet(["snapshots"]);
    return data.snapshots || [];
  }

  async function saveSnapshots(list) {
    await storageSet({ snapshots: list });
  }

  function escapeHtml(text) {
    return String(text || "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[c])
    );
  }

  async function createSnapshot(name) {
    try {
      const tabs = await new Promise((res) => chrome.tabs.query({}, res));
      const entries = tabs.map((t) => ({
        url: t.url,
        title: t.title,
        windowId: t.windowId,
        index: t.index,
      }));
      const snap = {
        id: "s_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
        name,
        time: Date.now(),
        entries,
      };
      const snaps = await getSnapshots();
      snaps.unshift(snap);
      await saveSnapshots(snaps);
      return snap;
    } catch (e) {
      console.error("createSnapshot error", e);
      return null;
    }
  }

  async function deleteSnapshot(id) {
    const snaps = await getSnapshots();
    const filtered = snaps.filter((s) => s.id !== id);
    await saveSnapshots(filtered);
  }

  async function openSnapshot(id) {
    const snaps = await getSnapshots();
    const snap = snaps.find((s) => s.id === id);
    if (!snap) return;
    const urls = snap.entries.map((e) => e.url).filter(Boolean);
    if (!urls.length) return;
    chrome.windows.create({ url: urls }, (w) => {
      console.log("opened snapshot", snap.name, w && w.id);
    });
  }

  // Modal for naming snapshot
  function showSaveModal(defaultName) {
    return new Promise((res) => {
      const overlay = document.createElement("div");
      overlay.style.position = "fixed";
      overlay.style.left = 0;
      overlay.style.top = 0;
      overlay.style.right = 0;
      overlay.style.bottom = 0;
      overlay.style.background = "rgba(0,0,0,0.6)";
      overlay.style.display = "flex";
      overlay.style.alignItems = "center";
      overlay.style.justifyContent = "center";
      overlay.style.zIndex = 9999;
      const box = document.createElement("div");
      box.style.background = "#1e1e1e";
      box.style.padding = "14px";
      box.style.borderRadius = "10px";
      box.style.width = "360px";
      box.style.boxSizing = "border-box";
      box.style.color = "#e0e0e0";
      box.innerHTML = `<h3 style="margin:0 0 8px 0;font-size:16px">Save snapshot</h3>
        <input id="snapshotNameInput" placeholder="Snapshot name" style="width:100%;padding:8px;border-radius:8px;border:1px solid #333;background:#121212;color:#eee;margin-bottom:8px;" />
        <div style="display:flex;justify-content:flex-end;gap:8px"><button id="snapshotCancel" class="btn btn-back">Cancel</button><button id="snapshotSave" class="btn btn-save">Save</button></div>`;
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      const input = document.getElementById("snapshotNameInput");
      input.value = defaultName || `Snapshot ${new Date().toLocaleString()}`;
      document
        .getElementById("snapshotCancel")
        .addEventListener("click", () => {
          overlay.remove();
          res(null);
        });
      document
        .getElementById("snapshotSave")
        .addEventListener("click", async () => {
          const name = input.value.trim() || `Snapshot ${Date.now()}`;
          overlay.remove();
          const s = await createSnapshot(name);
          res(s);
        });
    });
  }

  async function render() {
    const container = document.getElementById("snapshotsList");
    if (!container) return;
    const snaps = await getSnapshots();
    container.innerHTML = "";
    if (!snaps.length) {
      container.innerHTML =
        '<div style="color:#bdbdbd">No snapshots saved.</div>';
      return;
    }
    for (const snap of snaps) {
      const row = document.createElement("div");
      row.className = "snap-row";
      const left = document.createElement("div");
      left.className = "snap-left";
      left.innerHTML = `<strong>${escapeHtml(
        snap.name
      )}</strong><div style="font-size:12px;color:#bdbdbd">${
        snap.entries.length
      } tabs • ${new Date(snap.time).toLocaleString()}</div>`;
      left.addEventListener("click", () => openSnapshot(snap.id));
      const actions = document.createElement("div");
      actions.className = "snap-actions";
      const openBtn = document.createElement("button");
      openBtn.className = "btn btn-open";
      openBtn.textContent = "Open";
      openBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openSnapshot(snap.id);
      });
      const delBtn = document.createElement("button");
      delBtn.className = "btn btn-del";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteSnapshot(snap.id).then(render);
      });
      actions.appendChild(openBtn);
      actions.appendChild(delBtn);
      row.appendChild(left);
      row.appendChild(actions);
      container.appendChild(row);
    }
  }

  // Wire buttons
  document.addEventListener("DOMContentLoaded", () => {
    const createBtn = document.getElementById("createSnapshotBtn");
    const backBtn = document.getElementById("backBtn");
    if (createBtn)
      createBtn.addEventListener("click", async () => {
        const s = await showSaveModal();
        if (s) render();
      });
    if (backBtn)
      backBtn.addEventListener("click", () => {
        window.location.href = "tabs.html";
      });
    render();
  });
})();
