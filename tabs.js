document.addEventListener("DOMContentLoaded", () => {
  // Simple helper
  const byId = (id) => document.getElementById(id);

  const sendAndClose = (action, payload = {}) => {
    chrome.runtime.sendMessage(Object.assign({ action }, payload));
    window.close();
  };

  const closeDuplicates = byId("closeDuplicates");
  if (closeDuplicates)
    closeDuplicates.addEventListener("click", () =>
      sendAndClose("closeDuplicates")
    );

  const groupBtn = byId("group");
  if (groupBtn) groupBtn.addEventListener("click", () => sendAndClose("group"));

  const ungroupBtn = byId("ungroup");
  if (ungroupBtn)
    ungroupBtn.addEventListener("click", () => sendAndClose("ungroup"));

  const controlZ = byId("control-z");
  if (controlZ)
    controlZ.addEventListener("click", () => sendAndClose("control-z"));

  const inactive30 = byId("inactive30min");
  if (inactive30)
    inactive30.addEventListener("click", () =>
      sendAndClose("closeInactive", { limit: 30 * 60 * 1000 })
    );

  const inactive1hr = byId("inactive1hr");
  if (inactive1hr)
    inactive1hr.addEventListener("click", () =>
      sendAndClose("closeInactive", { limit: 60 * 60 * 1000 })
    );

  const customClose = byId("customClose");
  if (customClose)
    customClose.addEventListener("click", () => {
      const value = parseFloat(byId("customTime").value);
      const unit = byId("customUnit").value;
      if (!value || value <= 0) {
        alert("Enter a valid time value");
        return;
      }
      const limit =
        unit === "minutes" ? value * 60 * 1000 : value * 60 * 60 * 1000;
      sendAndClose("closeInactive", { limit });
    });

  // Snapshot redirect to standalone page
  const snapshotBtn = byId("snapshot");
  if (snapshotBtn)
    snapshotBtn.addEventListener("click", () => {
      window.location.href = "snapshots.html";
    });

  // Back button
  const back = byId("back");
  if (back)
    back.addEventListener("click", () => {
      window.location.href = "maintabs.html";
    });

  // Bookmark button UI helpers
  function updateBookmarkButton(added, protectedList) {
    const btn = byId("bookmark");
    if (!btn) return;
    btn.textContent = added ? "Bookmarked" : "Bookmark";
    console.log("Protected set:", protectedList);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.action === "bookmarkStatus")
      updateBookmarkButton(Boolean(msg.added), msg.protected);
  });

  // Request initial status
  chrome.runtime.sendMessage({ action: "getBookmarkStatus" }, (resp) => {
    if (resp && typeof resp.added !== "undefined")
      updateBookmarkButton(Boolean(resp.added), resp.protected);
  });

  const bookmarkBtn = byId("bookmark");
  if (bookmarkBtn)
    bookmarkBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "bookmark" }, (resp) => {
        if (resp && typeof resp.added !== "undefined")
          updateBookmarkButton(Boolean(resp.added), resp.protected);
      });
    });

  // Number input controls
  const timeUp = byId("timeUp");
  if (timeUp)
    timeUp.addEventListener("click", () => {
      const i = byId("customTime");
      i.value = (parseFloat(i.value) || 0) + 1;
    });
  const timeDown = byId("timeDown");
  if (timeDown)
    timeDown.addEventListener("click", () => {
      const i = byId("customTime");
      const v = parseFloat(i.value) || 0;
      if (v >= 1) i.value = v - 1;
    });

  // Custom select
  const customSelect = byId("customUnitSelect");
  if (customSelect) {
    const trigger = customSelect.querySelector(".custom-select-trigger");
    const options = byId("customUnitOptions");
    const text = byId("customUnitText");
    const hidden = byId("customUnit");
    if (trigger && options && text && hidden) {
      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        customSelect.classList.toggle("active");
      });
      options.querySelectorAll(".custom-select-option").forEach((opt) =>
        opt.addEventListener("click", () => {
          const value = opt.getAttribute("data-value");
          text.textContent = opt.textContent;
          hidden.value = value;
          options
            .querySelectorAll(".custom-select-option")
            .forEach((o) => o.classList.remove("selected"));
          opt.classList.add("selected");
          customSelect.classList.remove("active");
        })
      );
      document.addEventListener("click", (e) => {
        if (!customSelect.contains(e.target))
          customSelect.classList.remove("active");
      });
      // init selected
      options.querySelectorAll(".custom-select-option").forEach((opt) => {
        if (opt.getAttribute("data-value") === hidden.value) {
          opt.classList.add("selected");
          text.textContent = opt.textContent;
        }
      });
    }
  }

  // Particles (visual only)
  function createParticles() {
    const particlesContainer = byId("particles");
    if (!particlesContainer) return;
    const particleCount = 15;
    const width = 280;
    const height = 380;
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement("div");
      particle.className = "particle";
      const size = Math.random();
      if (size < 0.33) particle.classList.add("particle-small");
      else if (size < 0.66) particle.classList.add("particle-medium");
      else particle.classList.add("particle-large");
      particle.style.left = Math.random() * width + "px";
      particle.style.top = Math.random() * height + "px";
      particle.style.animationDelay = Math.random() * 5 + "s";
      particle.addEventListener("mouseenter", function () {
        this.style.transform = "scale(2.5)";
        this.style.opacity = "1";
        this.style.boxShadow =
          "0 0 25px rgba(167, 139, 250, 0.9), 0 0 50px rgba(167, 139, 250, 0.7)";
      });
      particle.addEventListener("mouseleave", function () {
        this.style.transform = "";
        this.style.opacity = "";
        this.style.boxShadow = "";
      });
      particlesContainer.appendChild(particle);
    }
  }
  createParticles();

  // Particle mouse effects
  document.addEventListener("mousemove", (e) => {
    const particles = document.querySelectorAll(".particle");
    particles.forEach((particle) => {
      const rect = particle.getBoundingClientRect();
      const particleX = rect.left + rect.width / 2;
      const particleY = rect.top + rect.height / 2;
      const dx = e.clientX - particleX;
      const dy = e.clientY - particleY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 80) {
        const force = (80 - distance) / 80;
        const angle = Math.atan2(dy, dx);
        const pushDistance = force * 15;
        particle.style.transform = `translate(${
          Math.cos(angle) * pushDistance
        }px, ${Math.sin(angle) * pushDistance}px) scale(${1 + force * 0.5})`;
        particle.style.opacity = 0.6 + force * 0.4;
      }
    });
  });
  document.addEventListener("mouseleave", () => {
    document.querySelectorAll(".particle").forEach((p) => {
      p.style.transform = "";
      p.style.opacity = "";
    });
  });
});
