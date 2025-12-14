document.addEventListener('DOMContentLoaded', async function() {
  const titleInput = document.getElementById('title');
  const notesInput = document.getElementById('notes');
  const categorySelect = document.getElementById('category');
  const prioritySelect = document.getElementById('priority');
  const tagsContainer = document.getElementById('tagsContainer');
  const newTagInput = document.getElementById('newTag');
  const captureBtn = document.getElementById('captureBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const statusDiv = document.getElementById('status');
  const viewCapturesBtn = document.getElementById('viewCapturesBtn');

  const commonTags = ['important', 'read-later', 'work', 'personal', 'tutorial', 'article'];
  let selectedTags = [];

  await initPopup();

  async function initPopup() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    titleInput.value = tab.title;
    const savedTags = await getSavedTags();
    commonTags.push(...savedTags.filter(tag => !commonTags.includes(tag)));
    renderTags(commonTags);
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
        tagElement.classList.add('selected');
      }
      tagElement.addEventListener('click', (e) => toggleTag(tag, e.target));
      tagsContainer.appendChild(tagElement);
    });
  }

  function toggleTag(tag, tagElement) {
    const index = selectedTags.indexOf(tag);
    if (index === -1) {
      selectedTags.push(tag);
      tagElement.classList.add('selected');
    } else {
      selectedTags.splice(index, 1);
      tagElement.classList.remove('selected');
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

    captureBtn.addEventListener('click', async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
          showStatus('Error: Could not get current tab', 'error');
          return;
        }
        let scrollPosition = 0;
        let highlightedText = '';
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
        } catch (error) {}

        try {
          const selectionResult = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => window.getSelection().toString()
          });
          if (selectionResult?.[0]?.result) highlightedText = selectionResult[0].result || '';
        } catch (error) {}
        
        // Create capture object
        const capture = {
          id: 'ctx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          url: tab.url || '',
          title: titleInput.value || tab.title || 'Untitled',
          notes: notesInput.value || '',
          category: categorySelect.value || 'reference',
          priority: prioritySelect.value || 'medium',
          tags: Array.isArray(selectedTags) ? selectedTags : [],
          scrollPosition: scrollPosition,
          highlightedText: highlightedText,
          timestamp: Date.now(),
          tabId: tab.id,
          windowId: tab.windowId
        };

    await saveCapture(capture);
    showStatus('✅ Context captured successfully!');
    notesInput.value = '';
    selectedTags = [];
    renderTags(commonTags);
    try {
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (currentTab?.title) titleInput.value = currentTab.title;
    } catch (error) {}
      } catch (error) {
        console.error('Capture error:', error);
        showStatus('Error capturing context: ' + error.message, 'error');
      }
    });

    cancelBtn.addEventListener('click', () => window.close());

    if (viewCapturesBtn) {
      viewCapturesBtn.addEventListener('click', async () => {
        try {
          await chrome.tabs.create({ url: chrome.runtime.getURL('captures.html') });
        } catch (error) {
          alert('Error opening captures page: ' + error.message);
        }
      });
    }
  }

  async function saveCapture(capture) {
    const data = await chrome.storage.local.get(['captures']);
    const captures = data.captures || [];
    captures.unshift(capture);
    await chrome.storage.local.set({ captures, recentCaptures: captures.slice(0, 20) });
    return capture.id;
  }

  const backBtn = document.getElementById('back');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.location.href = 'maintabs.html';
    });
  }

  function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    const width = 280, height = 600;
    for (let i = 0; i < 15; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const size = Math.random();
      if (size < 0.33) p.classList.add('particle-small');
      else if (size < 0.66) p.classList.add('particle-medium');
      else p.classList.add('particle-large');
      p.style.left = Math.random() * width + 'px';
      p.style.top = Math.random() * height + 'px';
      p.style.animationDelay = Math.random() * 5 + 's';
      p.addEventListener('mouseenter', function() {
        this.style.transform = 'scale(2.5)';
        this.style.opacity = '1';
        this.style.boxShadow = '0 0 25px rgba(167, 139, 250, 0.9), 0 0 50px rgba(167, 139, 250, 0.7)';
      });
      p.addEventListener('mouseleave', function() {
        this.style.transform = '';
        this.style.opacity = '';
        this.style.boxShadow = '';
      });
      container.appendChild(p);
    }
  }
  createParticles();

  let mouseX = 0, mouseY = 0;
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    document.querySelectorAll('.particle').forEach((p) => {
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
  document.addEventListener('mouseleave', () => {
    document.querySelectorAll('.particle').forEach((p) => {
      p.style.transform = '';
      p.style.opacity = '';
    });
  });
});
  