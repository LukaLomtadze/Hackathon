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



// Custom number input controls
document.getElementById("timeUp").onclick = () => {
    const input = document.getElementById("customTime");
    const currentValue = parseFloat(input.value) || 0;
    input.value = currentValue + 1;
};

document.getElementById("timeDown").onclick = () => {
    const input = document.getElementById("customTime");
    const currentValue = parseFloat(input.value) || 0;
    if (currentValue >= 1) {
        input.value = currentValue - 1;
    }
};

// Custom dropdown functionality
const customSelect = document.getElementById("customUnitSelect");
const customSelectTrigger = customSelect.querySelector(".custom-select-trigger");
const customSelectOptions = document.getElementById("customUnitOptions");
const customSelectText = document.getElementById("customUnitText");
const hiddenSelect = document.getElementById("customUnit");

// Toggle dropdown
customSelectTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    customSelect.classList.toggle("active");
});

// Select option
customSelectOptions.querySelectorAll(".custom-select-option").forEach(option => {
    option.addEventListener("click", () => {
        const value = option.getAttribute("data-value");
        const text = option.textContent;
        
        customSelectText.textContent = text;
        hiddenSelect.value = value;
        
        // Update selected state
        customSelectOptions.querySelectorAll(".custom-select-option").forEach(opt => {
            opt.classList.remove("selected");
        });
        option.classList.add("selected");
        
        customSelect.classList.remove("active");
    });
});

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
    if (!customSelect.contains(e.target)) {
        customSelect.classList.remove("active");
    }
});

// Initialize selected option
customSelectOptions.querySelectorAll(".custom-select-option").forEach(option => {
    if (option.getAttribute("data-value") === hiddenSelect.value) {
        option.classList.add("selected");
        customSelectText.textContent = option.textContent;
    }
});

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

  