document.getElementById("goTabs").onclick = () => {
    window.location.href = "tabs.html";
};

document.getElementById("goMessages").onclick = () => {
    window.location.href = "popup.html";
};

// Lofi Particle Animation
function createParticles() {
    const particlesContainer = document.getElementById("particles");
    const particleCount = 15;
    const width = 280;
    const height = 380;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement("div");
        particle.className = "particle";
        
        // Random size
        const size = Math.random();
        if (size < 0.33) {
            particle.classList.add("particle-small");
        } else if (size < 0.66) {
            particle.classList.add("particle-medium");
        } else {
            particle.classList.add("particle-large");
        }
        
        // Random position
        particle.style.left = Math.random() * width + "px";
        particle.style.top = Math.random() * height + "px";
        
        // Random animation delay
        particle.style.animationDelay = Math.random() * 5 + "s";
        
        // Mouse interaction
        particle.addEventListener("mouseenter", function() {
            this.style.transform = "scale(2.5)";
            this.style.opacity = "1";
            this.style.boxShadow = "0 0 25px rgba(167, 139, 250, 0.9), 0 0 50px rgba(167, 139, 250, 0.7)";
        });
        
        particle.addEventListener("mouseleave", function() {
            this.style.transform = "";
            this.style.opacity = "";
            this.style.boxShadow = "";
        });
        
        particlesContainer.appendChild(particle);
    }
}

// Initialize particles when page loads
createParticles();

// Global mouse interaction - particles react to mouse movement
let mouseX = 0;
let mouseY = 0;

document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    
    const particles = document.querySelectorAll(".particle");
    particles.forEach((particle) => {
        const rect = particle.getBoundingClientRect();
        const particleX = rect.left + rect.width / 2;
        const particleY = rect.top + rect.height / 2;
        
        const dx = mouseX - particleX;
        const dy = mouseY - particleY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // React when mouse is within 80px
        if (distance < 80) {
            const force = (80 - distance) / 80;
            const angle = Math.atan2(dy, dx);
            const pushDistance = force * 15;
            
            particle.style.transform = `translate(${Math.cos(angle) * pushDistance}px, ${Math.sin(angle) * pushDistance}px) scale(${1 + force * 0.5})`;
            particle.style.opacity = 0.6 + force * 0.4;
        }
    });
});

// Reset particles when mouse leaves
document.addEventListener("mouseleave", () => {
    const particles = document.querySelectorAll(".particle");
    particles.forEach((particle) => {
        particle.style.transform = "";
        particle.style.opacity = "";
    });
});
