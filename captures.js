// Helper function to escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Load captures from storage
async function loadCaptures() {
  try {
    const data = await chrome.storage.local.get(['captures']);
    const captures = data.captures || [];
    renderCaptures(captures);
  } catch (error) {
    console.error('Error loading captures:', error);
    showMessage('Error loading captures', 'error');
  }
}

// Render captures to the page
function renderCaptures(captures) {
  const container = document.getElementById('capturesContainer');
  const title = document.getElementById('title');
  const deleteAllBtn = document.getElementById('deleteAllBtn');
  
  if (!container || !title) return;
  
  title.textContent = `Captured Contexts (${captures.length})`;
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
    const screenshot = capture.screenshot || '';
    const date = capture.timestamp ? new Date(capture.timestamp).toLocaleDateString() : 'Unknown date';
    const captureId = capture.id || '';
    
    return `
      <div class="capture" data-capture-id="${escapeHtml(captureId)}">
        <div class="capture-header">
          <h3><a href="${escapeHtml(url)}" target="_blank">${escapeHtml(title)}</a></h3>
          <button class="delete-btn" data-capture-id="${escapeHtml(captureId)}" title="Delete capture">🗑️</button>
        </div>
        <p><strong>Notes:</strong> ${escapeHtml(notes)}</p>
        <p><strong>Tags:</strong> ${escapeHtml(tags)} | <strong>Date:</strong> ${escapeHtml(date)}</p>
        ${screenshot ? `<img src="${escapeHtml(screenshot)}" alt="Screenshot" width="200">` : ''}
      </div>
    `;
  }).join('');
  
  // Re-attach event listeners after rendering
  attachDeleteListeners();
}

// Attach delete button listeners
function attachDeleteListeners() {
  const deleteButtons = document.querySelectorAll('.delete-btn');
  deleteButtons.forEach(btn => {
    // Remove existing listeners by cloning
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const captureId = newBtn.getAttribute('data-capture-id');
      if (captureId) {
        deleteCapture(captureId);
      }
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
    console.error('Delete all error:', error);
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

// Load captures on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadCaptures);
} else {
  loadCaptures();
}

