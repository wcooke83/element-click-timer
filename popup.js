// Global state
let currentEditingTimerId = null;
let currentTabId = null;
let updateInterval = null;
let settings = {};
let textVisibilityState = {}; // Track which sensitive texts are visible

// Default settings
const DEFAULT_SETTINGS = {
  typingSpeed: 50,
  postTextEntryDelay: 10,
  triggerFocusBlur: true,
  autoDeleteExecuted: 'never',
  notifySuccess: true,
  notifyFailure: true,
  defaultEventType: 'enterText',
  defaultPersistence: 'session',
  defaultUrlBehavior: 'cancel',
  timerListView: 'detailed',
  theme: 'light'
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await applyTheme();
  await initializeTimeSelectors();
  await loadCurrentTab();
  await loadTimers();
  setupEventListeners();
  startTimerUpdates();
  applyDefaultSettings();
  updateFormVisibility();
});

// Load settings from storage
async function loadSettings() {
  try {
    const data = await browser.storage.local.get('settings');
    settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
    populateSettingsForm();
  } catch (error) {
    console.error('Error loading settings:', error);
    settings = { ...DEFAULT_SETTINGS };
  }
}

// Save settings to storage
async function saveSettings() {
  try {
    await browser.storage.local.set({ settings });
    
    // Notify background script of settings change
    await browser.runtime.sendMessage({
      action: 'settingsUpdated',
      settings: settings
    });
    
    // Apply theme immediately
    await applyTheme();
    
    // Apply timer list view
    applyTimerListView();
    
    // Apply defaults to existing timers
    await applyDefaultsToExistingTimers();
    
    // Show success feedback
    showSaveConfirmation();
  } catch (error) {
    console.error('Error saving settings:', error);
    alert('Error saving settings');
  }
}

// Apply theme
async function applyTheme() {
  const theme = settings.theme || 'light';
  const body = document.body;
  
  if (theme === 'dark') {
    body.classList.add('dark-theme');
  } else if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      body.classList.add('dark-theme');
    } else {
      body.classList.remove('dark-theme');
    }
  } else {
    body.classList.remove('dark-theme');
  }
}

// Apply timer list view setting
function applyTimerListView() {
  const timerList = document.getElementById('timer-list');
  if (settings.timerListView === 'compact') {
    timerList.classList.add('compact');
  } else {
    timerList.classList.remove('compact');
  }
}

// Apply defaults to existing pending timers
async function applyDefaultsToExistingTimers() {
  const response = await browser.runtime.sendMessage({ action: 'getTimers' });
  const timers = response.timers || [];
  
  let updated = false;
  for (const timer of timers) {
    if (timer.status === 'pending') {
      if (timer.persistence !== settings.defaultPersistence) {
        timer.persistence = settings.defaultPersistence;
        updated = true;
      }
      if (timer.urlBehavior !== settings.defaultUrlBehavior) {
        timer.urlBehavior = settings.defaultUrlBehavior;
        updated = true;
      }
    }
  }
  
  if (updated) {
    await browser.runtime.sendMessage({
      action: 'updateAllTimers',
      timers: timers
    });
    await loadTimers();
  }
}

// Populate settings form with current values
function populateSettingsForm() {
  document.getElementById('typing-speed').value = settings.typingSpeed;
  document.getElementById('post-entry-delay').value = settings.postTextEntryDelay;
  document.getElementById('trigger-focus-blur').checked = settings.triggerFocusBlur;
  document.getElementById('auto-delete').value = settings.autoDeleteExecuted;
  document.getElementById('notify-success').checked = settings.notifySuccess;
  document.getElementById('notify-failure').checked = settings.notifyFailure;
  document.getElementById('default-event-type').value = settings.defaultEventType;
  document.getElementById('default-persistence').value = settings.defaultPersistence;
  document.getElementById('default-url-behavior').value = settings.defaultUrlBehavior;
  document.getElementById('timer-list-view').value = settings.timerListView;
  document.getElementById('theme').value = settings.theme;
}

// Show save confirmation
function showSaveConfirmation() {
  const btn = document.getElementById('save-settings-btn');
  const originalText = btn.textContent;
  btn.textContent = '✓ Saved!';
  btn.style.background = '#4CAF50';
  
  setTimeout(() => {
    btn.textContent = originalText;
    btn.style.background = '';
  }, 2000);
}

// Apply default settings to form
function applyDefaultSettings() {
  document.querySelector(`input[name="event-type"][value="${settings.defaultEventType}"]`).checked = true;
  document.querySelector(`input[name="persistence"][value="${settings.defaultPersistence}"]`).checked = true;
  document.querySelector(`input[name="url-behavior"][value="${settings.defaultUrlBehavior}"]`).checked = true;
  
  // Update form visibility based on default event type
  updateFormVisibility();
}

// Update form field visibility based on event type
function updateFormVisibility() {
  const eventType = document.querySelector('input[name="event-type"]:checked').value;
  const textEntryFields = document.getElementById('text-entry-fields');
  const cssSelector = document.getElementById('css-selector');
  
  if (eventType === 'enterText') {
    textEntryFields.style.display = 'block';
    cssSelector.placeholder = 'input#username';
    if (cssSelector.value === 'button[aria-label="Continue"]') {
      cssSelector.value = 'input#username';
    }
  } else {
    textEntryFields.style.display = 'none';
    cssSelector.placeholder = 'button[aria-label="Continue"]';
    if (cssSelector.value === 'input#username') {
      cssSelector.value = 'button[aria-label="Continue"]';
    }
  }
}

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
  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  
  // Form submission
  document.getElementById('submit-btn').addEventListener('click', handleSubmit);
  document.getElementById('cancel-edit-btn').addEventListener('click', cancelEdit);
  
  // Event type change
  document.querySelectorAll('input[name="event-type"]').forEach(radio => {
    radio.addEventListener('change', updateFormVisibility);
  });
  
  // Settings
  document.getElementById('save-settings-btn').addEventListener('click', handleSaveSettings);
  document.getElementById('reset-settings-btn').addEventListener('click', handleResetSettings);
}

// Switch between tabs
function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`${tabName}-tab`).classList.add('active');
}

// Handle settings save
async function handleSaveSettings() {
  // Validate inputs
  const typingSpeed = parseInt(document.getElementById('typing-speed').value);
  const postEntryDelay = parseInt(document.getElementById('post-entry-delay').value);
  
  if (typingSpeed < 1 || typingSpeed > 1000) {
    alert('Typing speed must be between 1 and 1000ms');
    return;
  }
  
  if (postEntryDelay < 0 || postEntryDelay > 5000) {
    alert('Post-text-entry delay must be between 0 and 5000ms');
    return;
  }
  
  // Update settings object
  settings.typingSpeed = typingSpeed;
  settings.postTextEntryDelay = postEntryDelay;
  settings.triggerFocusBlur = document.getElementById('trigger-focus-blur').checked;
  settings.autoDeleteExecuted = document.getElementById('auto-delete').value;
  settings.notifySuccess = document.getElementById('notify-success').checked;
  settings.notifyFailure = document.getElementById('notify-failure').checked;
  settings.defaultEventType = document.getElementById('default-event-type').value;
  settings.defaultPersistence = document.getElementById('default-persistence').value;
  settings.defaultUrlBehavior = document.getElementById('default-url-behavior').value;
  settings.timerListView = document.getElementById('timer-list-view').value;
  settings.theme = document.getElementById('theme').value;
  
  await saveSettings();
}

// Handle settings reset
async function handleResetSettings() {
  if (confirm('Reset all settings to defaults?')) {
    settings = { ...DEFAULT_SETTINGS };
    populateSettingsForm();
    await saveSettings();
  }
}

// Handle form submission
async function handleSubmit() {
  const eventType = document.querySelector('input[name="event-type"]:checked').value;
  const cssSelector = document.getElementById('css-selector').value.trim();
  const hours = document.getElementById('hours').value;
  const minutes = document.getElementById('minutes').value;
  const persistence = document.querySelector('input[name="persistence"]:checked').value;
  const urlBehavior = document.querySelector('input[name="url-behavior"]:checked').value;
  
  if (!cssSelector) {
    alert('Please enter a CSS selector');
    return;
  }
  
  // Get text entry specific fields
  let textToEnter = '';
  let clearBeforeTyping = true;
  let isSensitive = false;
  
  if (eventType === 'enterText') {
    textToEnter = document.getElementById('text-to-enter').value;
    if (!textToEnter) {
      alert('Please enter text to type');
      return;
    }
    clearBeforeTyping = document.querySelector('input[name="text-mode"]:checked').value === 'clear';
    isSensitive = document.getElementById('mark-sensitive').checked;
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
    eventType: eventType,
    textToEnter: textToEnter,
    clearBeforeTyping: clearBeforeTyping,
    isSensitive: isSensitive || isSelectorSensitive(cssSelector),
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

// Check if selector contains sensitive keywords
function isSelectorSensitive(selector) {
  const lowerSelector = selector.toLowerCase();
  return lowerSelector.includes('password') || 
         lowerSelector.includes('pass') || 
         lowerSelector.includes('pwd');
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
  
  // Apply timer list view setting
  applyTimerListView();
  
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
  
  // Add event type indicator
  const eventIcon = timer.eventType === 'enterText' ? '⌨️' : '🖱️';
  const eventLabel = timer.eventType === 'enterText' ? 'Type' : 'Click';
  title.innerHTML = `${eventIcon} ${escapeHtml(timer.tabTitle || 'Unknown Tab')} <span class="timer-event-type">${eventLabel}</span>`;
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
    badge.textContent = '✓ ' + (timer.eventType === 'enterText' ? 'Text entered successfully' : 'Clicked successfully');
    details.appendChild(badge);
  } else if (timer.status === 'executed-failure') {
    const badge = document.createElement('div');
    badge.className = 'status-badge error';
    badge.textContent = '✗ Element not found or execution failed';
    details.appendChild(badge);
  }
  
  const selector = document.createElement('div');
  selector.innerHTML = `Selector: <span class="timer-selector">${escapeHtml(timer.cssSelector)}</span>`;
  details.appendChild(selector);
  
  // Show text content for enterText type
  if (timer.eventType === 'enterText' && timer.textToEnter) {
    const textContent = document.createElement('div');
    
    if (timer.isSensitive) {
      // Show masked with toggle
      const container = document.createElement('div');
      container.className = 'sensitive-text-container';
      container.innerHTML = `Text: `;
      
      const sensitiveSpan = document.createElement('span');
      sensitiveSpan.className = 'sensitive-text';
      sensitiveSpan.dataset.timerId = timer.id;
      sensitiveSpan.textContent = textVisibilityState[timer.id] ? timer.textToEnter : '••••••••';
      
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'toggle-sensitive-btn';
      toggleBtn.textContent = textVisibilityState[timer.id] ? '🙈' : '👁️';
      toggleBtn.title = textVisibilityState[timer.id] ? 'Hide' : 'Show';
      toggleBtn.addEventListener('click', () => toggleSensitiveText(timer.id));
      
      container.appendChild(sensitiveSpan);
      container.appendChild(toggleBtn);
      details.appendChild(container);
    } else {
      // Show truncated text
      const displayText = timer.textToEnter.length > 50 
        ? timer.textToEnter.substring(0, 50) + '...' 
        : timer.textToEnter;
      textContent.innerHTML = `Text: <span class="timer-text-content">${escapeHtml(displayText)}</span>`;
      details.appendChild(textContent);
    }
    
    // Show clear/append mode
    const modeText = document.createElement('div');
    modeText.textContent = `Mode: ${timer.clearBeforeTyping ? 'Clear then type' : 'Append to existing'}`;
    modeText.style.fontSize = '11px';
    modeText.style.color = 'var(--text-tertiary)';
    details.appendChild(modeText);
  }
  
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

// Toggle sensitive text visibility
function toggleSensitiveText(timerId) {
  textVisibilityState[timerId] = !textVisibilityState[timerId];
  loadTimers();
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
  
  // Switch to timers tab
  switchTab('timers');
  
  // Populate form with timer data
  document.querySelector(`input[name="event-type"][value="${timer.eventType}"]`).checked = true;
  updateFormVisibility();
  
  document.getElementById('css-selector').value = timer.cssSelector;
  
  if (timer.eventType === 'enterText') {
    document.getElementById('text-to-enter').value = timer.textToEnter;
    document.getElementById('mark-sensitive').checked = timer.isSensitive;
    document.querySelector(`input[name="text-mode"][value="${timer.clearBeforeTyping ? 'clear' : 'append'}"]`).checked = true;
  }
  
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
  
  // Reset to defaults
  document.querySelector(`input[name="event-type"][value="${settings.defaultEventType}"]`).checked = true;
  updateFormVisibility();
  
  document.getElementById('css-selector').value = settings.defaultEventType === 'enterText' ? 'input#username' : 'button[aria-label="Continue"]';
  document.getElementById('text-to-enter').value = '';
  document.getElementById('mark-sensitive').checked = false;
  document.querySelector('input[name="text-mode"][value="clear"]').checked = true;
  
  const now = new Date();
  document.getElementById('hours').value = now.getHours().toString().padStart(2, '0');
  document.getElementById('minutes').value = now.getMinutes().toString().padStart(2, '0');
  
  document.querySelector(`input[name="persistence"][value="${settings.defaultPersistence}"]`).checked = true;
  document.querySelector(`input[name="url-behavior"][value="${settings.defaultUrlBehavior}"]`).checked = true;
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