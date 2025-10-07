// Global state
let currentEditingTimerId = null;
let currentTabId = null;
let updateInterval = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await initializeTimeSelectors();
  await loadCurrentTab();
  await loadTimers();
  setupEventListeners();
  startTimerUpdates();
});

// Populate hour and minute dropdowns
function initializeTimeSelectors() {
  const hoursSelect = document.getElementById('hours');
  const minutesSelect = document.getElementById('minutes');
  
  // Populate hours (00-23)
  for (let i = 0; i < 24; i++) {
    const option = document.createElement('option');
    option.value = i.toString().padStart(2, '0');
    option.textContent = i.toString().padStart(2, '0');
    hoursSelect.appendChild(option);
  }
  
  // Populate minutes (00-59)
  for (let i = 0; i < 60; i++) {
    const option = document.createElement('option');
    option.value = i.toString().padStart(2, '0');
    option.textContent = i.toString().padStart(2, '0');
    minutesSelect.appendChild(option);
  }
  
  // Set to current time
  const now = new Date();
  hoursSelect.value = now.getHours().toString().padStart(2, '0');
  minutesSelect.value = now.getMinutes().toString().padStart(2, '0');
}

// Get current active tab
async function loadCurrentTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) {
    currentTabId = tabs[0].id;
  }
}

// Setup event listeners
function setupEventListeners() {
  document.getElementById('submit-btn').addEventListener('click', handleSubmit);
  document.getElementById('cancel-edit-btn').addEventListener('click', cancelEdit);
}

// Handle form submission
async function handleSubmit() {
  const cssSelector = document.getElementById('css-selector').value.trim();
  const hours = document.getElementById('hours').value;
  const minutes = document.getElementById('minutes').value;
  const persistence = document.querySelector('input[name="persistence"]:checked').value;
  const urlBehavior = document.querySelector('input[name="url-behavior"]:checked').value;
  
  if (!cssSelector) {
    alert('Please enter a CSS selector');
    return;
  }
  
  // Get current tab info
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];
  
  if (!currentTab) {
    alert('No active tab found');
    return;
  }
  
  // Calculate target time (add 5 minutes to selected time)
  const selectedTime = new Date();
  selectedTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  
  const targetTime = new Date(selectedTime.getTime() + 5 * 60 * 1000);
  
  // If target time has passed today, schedule for tomorrow
  const now = new Date();
  if (targetTime <= now) {
    targetTime.setDate(targetTime.getDate() + 1);
  }
  
  const timerData = {
    id: currentEditingTimerId || generateTimerId(),
    tabId: currentTab.id,
    tabTitle: currentTab.title,
    originalUrl: currentTab.url,
    cssSelector: cssSelector,
    targetTime: targetTime.getTime(),
    selectedTime: selectedTime.getTime(),
    persistence: persistence,
    urlBehavior: urlBehavior,
    status: 'pending',
    createdAt: Date.now()
  };
  
  // Send to background script
  await browser.runtime.sendMessage({
    action: currentEditingTimerId ? 'updateTimer' : 'addTimer',
    timer: timerData
  });
  
  // Reset form
  resetForm();
  await loadTimers();
}

// Generate unique timer ID
function generateTimerId() {
  return 'timer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Load and display all timers
async function loadTimers() {
  const response = await browser.runtime.sendMessage({ action: 'getTimers' });
  const timers = response.timers || [];
  
  const timerList = document.getElementById('timer-list');
  
  if (timers.length === 0) {
    timerList.innerHTML = '<p class="empty-state">No active timers</p>';
    return;
  }
  
  timerList.innerHTML = '';
  
  // Sort timers: active tab first, then by target time
  timers.sort((a, b) => {
    if (a.tabId === currentTabId && b.tabId !== currentTabId) return -1;
    if (a.tabId !== currentTabId && b.tabId === currentTabId) return 1;
    return a.targetTime - b.targetTime;
  });
  
  for (const timer of timers) {
    const timerElement = createTimerElement(timer);
    timerList.appendChild(timerElement);
  }
}

// Create timer element
function createTimerElement(timer) {
  const div = document.createElement('div');
  div.className = 'timer-item';
  div.dataset.timerId = timer.id;
  
  // Mark if this is for the active tab
  if (timer.tabId === currentTabId) {
    div.classList.add('active-tab');
  }
  
  const header = document.createElement('div');
  header.className = 'timer-header';
  
  const titleDiv = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'timer-title';
  title.textContent = timer.tabTitle || 'Unknown Tab';
  titleDiv.appendChild(title);
  
  const actions = document.createElement('div');
  actions.className = 'timer-actions';
  
  if (timer.status === 'pending') {
    const editBtn = document.createElement('button');
    editBtn.className = 'icon-btn';
    editBtn.textContent = '✏️';
    editBtn.title = 'Edit timer';
    editBtn.addEventListener('click', () => editTimer(timer));
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'icon-btn';
    cancelBtn.textContent = '❌';
    cancelBtn.title = 'Cancel timer';
    cancelBtn.addEventListener('click', () => cancelTimer(timer.id));
    
    actions.appendChild(editBtn);
    actions.appendChild(cancelBtn);
  }
  
  header.appendChild(titleDiv);
  header.appendChild(actions);
  
  const details = document.createElement('div');
  details.className = 'timer-details';
  
  // Countdown or status
  if (timer.status === 'pending') {
    const countdown = document.createElement('div');
    countdown.className = 'timer-countdown';
    countdown.dataset.targetTime = timer.targetTime;
    updateCountdown(countdown, timer.targetTime);
    details.appendChild(countdown);
    
    const firesAt = document.createElement('div');
    firesAt.className = 'timer-fires-at';
    const targetDate = new Date(timer.targetTime);
    firesAt.textContent = `Fires at ${formatTime(targetDate)}`;
    details.appendChild(firesAt);
  } else if (timer.status === 'executed-success') {
    const badge = document.createElement('div');
    badge.className = 'status-badge success';
    badge.textContent = '✓ Clicked successfully';
    details.appendChild(badge);
  } else if (timer.status === 'executed-failure') {
    const badge = document.createElement('div');
    badge.className = 'status-badge error';
    badge.textContent = '✗ Element not found';
    details.appendChild(badge);
  }
  
  const selector = document.createElement('div');
  selector.innerHTML = `Selector: <span class="timer-selector">${escapeHtml(timer.cssSelector)}</span>`;
  details.appendChild(selector);
  
  // Check if URL has changed
  if (timer.status === 'pending') {
    checkUrlStatus(timer).then(urlStatus => {
      if (urlStatus.changed) {
        const urlStatusDiv = document.createElement('div');
        urlStatusDiv.className = 'url-status warning';
        
        if (timer.urlBehavior === 'cancel') {
          urlStatusDiv.textContent = '⚠️ URL changed - will not run';
        } else if (timer.urlBehavior === 'new-tab') {
          urlStatusDiv.className = 'url-status info';
          urlStatusDiv.textContent = '🔗 Will open in new tab';
        } else if (timer.urlBehavior === 'navigate') {
          urlStatusDiv.className = 'url-status info';
          urlStatusDiv.textContent = '🔄 Will navigate to original URL';
        }
        
        details.appendChild(urlStatusDiv);
      }
    });
  }
  
  div.appendChild(header);
  div.appendChild(details);
  
  return div;
}

// Check if URL has changed for a timer
async function checkUrlStatus(timer) {
  try {
    const tab = await browser.tabs.get(timer.tabId);
    return {
      changed: tab.url !== timer.originalUrl,
      currentUrl: tab.url
    };
  } catch (error) {
    return { changed: true, currentUrl: null };
  }
}

// Update countdown display
function updateCountdown(element, targetTime) {
  const now = Date.now();
  const remaining = targetTime - now;
  
  if (remaining <= 0) {
    element.textContent = '00:00:00';
    return;
  }
  
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
  
  element.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Start updating all countdowns every second
function startTimerUpdates() {
  updateInterval = setInterval(() => {
    const countdowns = document.querySelectorAll('.timer-countdown');
    countdowns.forEach(countdown => {
      const targetTime = parseInt(countdown.dataset.targetTime);
      updateCountdown(countdown, targetTime);
    });
  }, 1000);
}

// Format time for display
function formatTime(date) {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Edit timer
function editTimer(timer) {
  currentEditingTimerId = timer.id;
  
  // Populate form with timer data
  document.getElementById('css-selector').value = timer.cssSelector;
  
  // Convert back to selected time (target time - 5 minutes)
  const selectedTime = new Date(timer.selectedTime);
  document.getElementById('hours').value = selectedTime.getHours().toString().padStart(2, '0');
  document.getElementById('minutes').value = selectedTime.getMinutes().toString().padStart(2, '0');
  
  document.querySelector(`input[name="persistence"][value="${timer.persistence}"]`).checked = true;
  document.querySelector(`input[name="url-behavior"][value="${timer.urlBehavior}"]`).checked = true;
  
  // Update UI
  document.getElementById('form-title').textContent = 'Edit Timer';
  document.getElementById('submit-btn').textContent = 'Update Timer';
  document.getElementById('cancel-edit-btn').style.display = 'block';
  
  // Scroll to top
  window.scrollTo(0, 0);
}

// Cancel edit mode
function cancelEdit() {
  resetForm();
}

// Reset form to add mode
function resetForm() {
  currentEditingTimerId = null;
  document.getElementById('form-title').textContent = 'Add Timer';
  document.getElementById('submit-btn').textContent = 'Add Timer';
  document.getElementById('cancel-edit-btn').style.display = 'none';
  document.getElementById('css-selector').value = 'button[aria-label="Continue"]';
  
  const now = new Date();
  document.getElementById('hours').value = now.getHours().toString().padStart(2, '0');
  document.getElementById('minutes').value = now.getMinutes().toString().padStart(2, '0');
  
  document.querySelector('input[name="persistence"][value="session"]').checked = true;
  document.querySelector('input[name="url-behavior"][value="cancel"]').checked = true;
}

// Cancel/remove timer
async function cancelTimer(timerId) {
  if (confirm('Are you sure you want to cancel this timer?')) {
    await browser.runtime.sendMessage({
      action: 'cancelTimer',
      timerId: timerId
    });
    await loadTimers();
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Listen for timer updates from background
browser.runtime.onMessage.addListener((message) => {
  if (message.action === 'timerUpdated' || message.action === 'timerExecuted') {
    loadTimers();
  }
});

// Cleanup on unload
window.addEventListener('unload', () => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});