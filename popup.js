document.addEventListener('DOMContentLoaded', async function() {
  // DOM Elements
  const titleInput = document.getElementById('title');
  const notesInput = document.getElementById('notes');
  const categorySelect = document.getElementById('category');
  const prioritySelect = document.getElementById('priority');
  const tagsContainer = document.getElementById('tagsContainer');
  const newTagInput = document.getElementById('newTag');
  const screenshotImg = document.getElementById('screenshot');
  const captureBtn = document.getElementById('captureBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const statusDiv = document.getElementById('status');
  const viewCapturesBtn = document.getElementById('viewCapturesBtn');

  // Common tags
  const commonTags = ['important', 'read-later', 'work', 'personal', 'tutorial', 'article'];
  let selectedTags = [];

  // Initialize
  await initPopup();

  // Functions
  async function initPopup() {
    // Get current tab info
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Set title
    titleInput.value = tab.title;
    
    // Capture screenshot
    try {
      const screenshot = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
      screenshotImg.src = screenshot;
    } catch (error) {
      console.log('Could not capture screenshot:', error);
    }
    
    // Load saved tags
    const savedTags = await getSavedTags();
    commonTags.push(...savedTags.filter(tag => !commonTags.includes(tag)));
    
    // Render common tags
    renderTags(commonTags);
    
    // Set up event listeners
    setupEventListeners();
  }

  function renderTags(tags) {
    tagsContainer.innerHTML = '';
    tags.forEach(tag => {
      const tagElement = document.createElement('span');
      tagElement.className = 'tag';
      tagElement.textContent = tag;
      tagElement.dataset.tag = tag;
      if (selectedTags.includes(tag)) {
        tagElement.style.background = '#1976d2';
        tagElement.style.color = 'white';
      }
      tagElement.addEventListener('click', (e) => toggleTag(tag, e.target));
      tagsContainer.appendChild(tagElement);
    });
  }

  function toggleTag(tag, tagElement) {
    const index = selectedTags.indexOf(tag);
    if (index === -1) {
      selectedTags.push(tag);
      tagElement.style.background = '#1976d2';
      tagElement.style.color = 'white';
    } else {
      selectedTags.splice(index, 1);
      tagElement.style.background = '#e3f2fd';
      tagElement.style.color = '#1976d2';
    }
  }

  function showStatus(message, type = 'success') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }

  async function getSavedTags() {
    const data = await chrome.storage.local.get(['tags']);
    return data.tags || [];
  }

  async function saveNewTag(tag) {
    const tags = await getSavedTags();
    if (!tags.includes(tag)) {
      tags.push(tag);
      await chrome.storage.local.set({ tags });
    }
  }

  function setupEventListeners() {
    // Add tag on Enter
    newTagInput.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter' && newTagInput.value.trim()) {
        const tag = newTagInput.value.trim();
        if (!selectedTags.includes(tag)) {
          selectedTags.push(tag);
          await saveNewTag(tag);
          commonTags.push(tag);
          renderTags(commonTags);
        }
        newTagInput.value = '';
      }
    });

    // Capture button
    captureBtn.addEventListener('click', async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab || !tab.id) {
          showStatus('Error: Could not get current tab', 'error');
          return;
        }

        let scrollPosition = 0;
        let highlightedText = '';

        // Get scroll position
        try {
          const scrollResult = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => ({ 
              x: window.scrollX, 
              y: window.scrollY,
              viewport: { width: window.innerWidth, height: window.innerHeight }
            })
          });
          if (scrollResult && scrollResult[0] && scrollResult[0].result) {
            scrollPosition = scrollResult[0].result.y || 0;
          }
        } catch (error) {
          console.log('Could not get scroll position:', error);
        }

        // Get selected text
        try {
          const selectionResult = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => window.getSelection().toString()
          });
          if (selectionResult && selectionResult[0] && selectionResult[0].result) {
            highlightedText = selectionResult[0].result || '';
          }
        } catch (error) {
          console.log('Could not get selected text:', error);
        }

        // Create capture object
        const capture = {
          id: 'ctx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          url: tab.url || '',
          title: titleInput.value || tab.title || 'Untitled',
          notes: notesInput.value || '',
          category: categorySelect.value || 'reference',
          priority: prioritySelect.value || 'medium',
          tags: Array.isArray(selectedTags) ? selectedTags : [],
          screenshot: screenshotImg.src || '',
          scrollPosition: scrollPosition,
          highlightedText: highlightedText,
          timestamp: Date.now(),
          tabId: tab.id,
          windowId: tab.windowId
        };

        // Save to storage
        await saveCapture(capture);
        
        // Show success
        showStatus('✅ Context captured successfully!');
        
        // Close popup after delay
        setTimeout(() => window.close(), 1000);
      } catch (error) {
        console.error('Capture error:', error);
        showStatus('Error capturing context: ' + error.message, 'error');
      }
    });

    // Cancel button
    cancelBtn.addEventListener('click', () => {
      window.close();
    });

    // View All Captures button
    if (viewCapturesBtn) {
      viewCapturesBtn.addEventListener('click', async () => {
        try {
          const data = await chrome.storage.local.get(['captures']);
          const captures = data.captures || [];
          
          if (!Array.isArray(captures)) {
            alert('No captures found or invalid data format');
            return;
          }
          
          // Helper function to escape HTML
          function escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
          }
          
          // Build HTML for captures display
          let capturesHTML = '';
          if (captures.length === 0) {
            capturesHTML = '<p>No captures yet. Start capturing pages to see them here!</p>';
          } else {
            capturesHTML = captures.map(capture => {
              if (!capture) return '';
              const tags = Array.isArray(capture.tags) ? capture.tags.join(', ') : 'No tags';
              const notes = capture.notes || 'No notes';
              const title = capture.title || 'Untitled';
              const url = capture.url || '#';
              const screenshot = capture.screenshot || '';
              const date = capture.timestamp ? new Date(capture.timestamp).toLocaleDateString() : 'Unknown date';
              
              return `
                <div class="capture">
                  <h3><a href="${escapeHtml(url)}" target="_blank">${escapeHtml(title)}</a></h3>
                  <p><strong>Notes:</strong> ${escapeHtml(notes)}</p>
                  <p><strong>Tags:</strong> ${escapeHtml(tags)} | <strong>Date:</strong> ${escapeHtml(date)}</p>
                  ${screenshot ? `<img src="${escapeHtml(screenshot)}" alt="Screenshot" width="200">` : ''}
                </div>
              `;
            }).join('');
          }
          
          // Open new tab with captures
          const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Captured Contexts</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    .capture { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 4px; }
    .capture h3 { margin-top: 0; }
    .capture img { max-width: 200px; border: 1px solid #ccc; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Captured Contexts (${captures.length})</h1>
  ${capturesHTML}
</body>
</html>`;
          
          const blob = new Blob([html], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          await chrome.tabs.create({ url: url });
        } catch (error) {
          console.error('Error viewing captures:', error);
          alert('Error loading captures: ' + error.message);
        }
      });
    }
  }

  async function saveCapture(capture) {
    // Get existing captures
    const data = await chrome.storage.local.get(['captures']);
    const captures = data.captures || [];
    
    // Add new capture
    captures.unshift(capture); // Add to beginning
    
    // Save back
    await chrome.storage.local.set({ captures });
    
    // Update recent captures (limit to 20)
    const recent = captures.slice(0, 20);
    await chrome.storage.local.set({ recentCaptures: recent });
    
    return capture.id;
  }
});
