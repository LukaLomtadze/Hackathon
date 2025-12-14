function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function loadCaptures() {
  try {
    const data = await chrome.storage.local.get(['captures']);
    const captures = data.captures || [];
    renderCaptures(captures);
  } catch (error) {
    showMessage('Error loading captures', 'error');
  }
}

function renderCaptures(captures) {
  const container = document.getElementById('capturesContainer');
  const titleElement = document.querySelector('#title');
  const deleteAllBtn = document.getElementById('deleteAllBtn');
  
  if (!container) return;
  
  if (titleElement) {
    titleElement.textContent = `Captured Contexts (${captures.length})`;
  }
  if (deleteAllBtn) {
    deleteAllBtn.style.display = captures.length > 0 ? 'inline-block' : 'none';
  }
  
  if (captures.length === 0) {
    container.innerHTML = '<p>No captures yet. Start capturing pages to see them here!</p>';
    return;
  }
  
  container.innerHTML = captures.map(capture => {
    if (!capture) return '';
    const tags = Array.isArray(capture.tags) ? capture.tags.join(', ') : 'No tags';
    const notes = capture.notes || 'No notes';
    const title = capture.title || 'Untitled';
    const url = capture.url || '#';
    const date = capture.timestamp ? new Date(capture.timestamp).toLocaleDateString() : 'Unknown date';
    const captureId = capture.id || '';
    
    return `
      <div class="capture" data-capture-id="${escapeHtml(captureId)}">
        <div class="capture-header">
          <h3><a href="${escapeHtml(url)}" target="_blank">${escapeHtml(title)}</a></h3>
          <button class="delete-btn" data-capture-id="${escapeHtml(captureId)}" title="Delete capture">🗑️</button>
        </div>
        <p><strong>Notes:</strong> ${escapeHtml(notes)}</p>
        <p><strong>Tags:</strong> ${escapeHtml(tags)}</p>
        <p><strong>Date:</strong> ${escapeHtml(date)}</p>
      </div>
    `;
  }).join('');
  
  attachDeleteListeners();
}

function attachDeleteListeners() {
  document.querySelectorAll('.delete-btn').forEach(btn => {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = newBtn.getAttribute('data-capture-id');
      if (id) deleteCapture(id);
    });
  });
  const deleteAllBtn = document.getElementById('deleteAllBtn');
  if (deleteAllBtn) {
    const newBtn = deleteAllBtn.cloneNode(true);
    deleteAllBtn.parentNode.replaceChild(newBtn, deleteAllBtn);
    newBtn.id = 'deleteAllBtn';
    newBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      deleteAllCaptures();
    });
  }
}

async function deleteCapture(captureId) {
  try {
    const data = await chrome.storage.local.get(['captures']);
    let captures = data.captures || [];
    
    const beforeCount = captures.length;
    captures = captures.filter(c => {
      if (!c || !c.id) return true;
      return String(c.id) !== String(captureId);
    });
    const afterCount = captures.length;
    
    if (beforeCount === afterCount) {
      showMessage('Capture not found', 'error');
      await loadCaptures();
      return;
    }
    
    await chrome.storage.local.set({ captures: captures });
    
    // Reload and render
    renderCaptures(captures);
    showMessage('Capture deleted successfully!', 'success');
  } catch (error) {
    console.error('Delete error:', error);
    showMessage('Error deleting capture: ' + error.message, 'error');
  }
}

async function deleteAllCaptures() {
  if (!confirm('Are you sure you want to delete ALL captures? This cannot be undone.')) {
    return;
  }
  
  try {
    await chrome.storage.local.set({ captures: [] });
    renderCaptures([]);
    showMessage('All captures deleted successfully!', 'success');
  } catch (error) {
    showMessage('Error deleting captures: ' + error.message, 'error');
  }
}

function showMessage(text, type) {
  const messageDiv = document.getElementById('message');
  if (!messageDiv) return;
  messageDiv.textContent = text;
  messageDiv.className = `message ${type}`;
  messageDiv.style.display = 'block';
  setTimeout(() => {
    messageDiv.style.display = 'none';
  }, 3000);
}

const backBtn = document.getElementById('back');
if (backBtn) {
  backBtn.addEventListener('click', () => {
    window.location.href = 'popup.html';
  });
}

function createParticles() {
  const particlesContainer = document.getElementById('particles');
  if (!particlesContainer) return;
  const particleCount = 15;
  const width = 280;
  const height = 380;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';

    // Random size
    const size = Math.random();
    if (size < 0.33) {
      particle.classList.add('particle-small');
    } else if (size < 0.66) {
      particle.classList.add('particle-medium');
    } else {
      particle.classList.add('particle-large');
    }

    // Random position
    particle.style.left = Math.random() * width + 'px';
    particle.style.top = Math.random() * height + 'px';

    // Random animation delay
    particle.style.animationDelay = Math.random() * 5 + 's';

    // Mouse interaction
    particle.addEventListener('mouseenter', function () {
      this.style.transform = 'scale(2.5)';
      this.style.opacity = '1';
      this.style.boxShadow = '0 0 25px rgba(167, 139, 250, 0.9), 0 0 50px rgba(167, 139, 250, 0.7)';
    });

    particle.addEventListener('mouseleave', function () {
      this.style.transform = '';
      this.style.opacity = '';
      this.style.boxShadow = '';
    });

    particlesContainer.appendChild(particle);
  }
}

createParticles();

let mouseX = 0, mouseY = 0;

document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;

  const particles = document.querySelectorAll('.particle');
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

      particle.style.transform = `translate(${
        Math.cos(angle) * pushDistance
      }px, ${Math.sin(angle) * pushDistance}px) scale(${1 + force * 0.5})`;
      particle.style.opacity = 0.6 + force * 0.4;
    }
  });
});

document.addEventListener('mouseleave', () => {
  const particles = document.querySelectorAll('.particle');
  particles.forEach((particle) => {
    particle.style.transform = '';
    particle.style.opacity = '';
  });
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadCaptures);
} else {
  loadCaptures();
}

