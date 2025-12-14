document.addEventListener('DOMContentLoaded', async function() {
  // DOM Elements
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

        // Clear form for next capture (but keep current tab title)
        notesInput.value = '';
        selectedTags = [];
        renderTags(commonTags);
        
        // Refresh title from current tab
        try {
          const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (currentTab && currentTab.title) {
            titleInput.value = currentTab.title;
          }
        } catch (error) {
          console.log('Could not refresh title:', error);
        }
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
          // Open the captures.html file which has full Chrome API access
          await chrome.tabs.create({ url: chrome.runtime.getURL('captures.html') });
        } catch (error) {
          console.error('Error opening captures page:', error);
          alert('Error opening captures page: ' + error.message);
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

  // Back button handler
  const backBtn = document.getElementById('back');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.location.href = 'maintabs.html';
    });
  }
  
// Lofi Particle Animation
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;
    const particleCount = 15;
    const width = 280;
    const height = 600;
    
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

// Initialize particles when page loads
createParticles();

// Global mouse interaction - particles react to mouse movement
let mouseX = 0;
let mouseY = 0;

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

// Reset particles when mouse leaves
  document.addEventListener('mouseleave', () => {
    const particles = document.querySelectorAll('.particle');
    particles.forEach((particle) => {
      particle.style.transform = '';
      particle.style.opacity = '';
    });
    });
});
  