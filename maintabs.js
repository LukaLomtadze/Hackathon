document.getElementById("goTabs").onclick = () => window.location.href = "tabs.html";
document.getElementById("goMessages").onclick = () => window.location.href = "popup.html";

function createParticles() {
    const container = document.getElementById("particles");
    if (!container) return;
    const width = 280, height = 380;
    for (let i = 0; i < 15; i++) {
        const p = document.createElement("div");
        p.className = "particle";
        const size = Math.random();
        if (size < 0.33) p.classList.add("particle-small");
        else if (size < 0.66) p.classList.add("particle-medium");
        else p.classList.add("particle-large");
        p.style.left = Math.random() * width + "px";
        p.style.top = Math.random() * height + "px";
        p.style.animationDelay = Math.random() * 5 + "s";
        p.addEventListener("mouseenter", function() {
            this.style.transform = "scale(2.5)";
            this.style.opacity = "1";
            this.style.boxShadow = "0 0 25px rgba(167, 139, 250, 0.9), 0 0 50px rgba(167, 139, 250, 0.7)";
        });
        p.addEventListener("mouseleave", function() {
            this.style.transform = "";
            this.style.opacity = "";
            this.style.boxShadow = "";
        });
        container.appendChild(p);
    }
}
createParticles();

let mouseX = 0, mouseY = 0;
document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    document.querySelectorAll(".particle").forEach((p) => {
        const rect = p.getBoundingClientRect();
        const px = rect.left + rect.width / 2;
        const py = rect.top + rect.height / 2;
        const dx = mouseX - px, dy = mouseY - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 80) {
            const force = (80 - dist) / 80;
            const angle = Math.atan2(dy, dx);
            const push = force * 15;
            p.style.transform = `translate(${Math.cos(angle) * push}px, ${Math.sin(angle) * push}px) scale(${1 + force * 0.5})`;
            p.style.opacity = 0.6 + force * 0.4;
        }
    });
});
document.addEventListener("mouseleave", () => {
    document.querySelectorAll(".particle").forEach((p) => {
        p.style.transform = "";
        p.style.opacity = "";
    });
});
