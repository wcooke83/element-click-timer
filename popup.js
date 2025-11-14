// popup.js - Popup script for browser extension to manage timers and settings

// Global state
let currentEditingTimerId = null;
let currentEditingRemoverId = null;
let currentTabId = null;
let updateInterval = null;
let settings = {};
let textVisibilityState = {};
let advancedSettings = {};

// Default settings
const DEFAULT_SETTINGS = {
  typingSpeed: 50,
  postTextEntryDelay: 10,
  scrollDelay: 5,
  triggerFocusBlur: true,
  refreshOnElementNotFound: true,
  autoDeleteExecuted: 'never',
  notifySuccess: true,
  notifyFailure: true,
  defaultEventType: 'enterText',
  defaultPersistence: 'session',
  defaultUrlBehavior: 'cancel',
  defaultTextMode: 'clear',
  removalDefaultPersistence: 'session',
  timerListView: 'detailed',
  theme: 'light',
  defaultTextEntryMethod: 'keystroke',
  logRetentionTime: 'never',
  logRetentionCount: 1000
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadAdvancedSettings();
  await applyTheme();
  await initializeTimeSelectors();
  await initializeDailyTimeSelectors();
  await initializeDateSelector();
  await loadCurrentTab();
  await loadTimers();
  await loadRemovers();
  await loadLog();
  setupEventListeners();
  startTimerUpdates();
  applyDefaultSettings();
  updateFormVisibility();
  updateTextEntryMethodVisibility();
  updateScheduleTypeVisibility();
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

// Load advanced settings
async function loadAdvancedSettings() {
  try {
    const data = await browser.storage.local.get('advancedSettings');
    advancedSettings = data.advancedSettings || {
      markSensitive: false,
      textMode: settings.defaultTextMode || 'clear',
      persistence: settings.defaultPersistence,
      urlBehavior: settings.defaultUrlBehavior
    };
    populateAdvancedForm();
  } catch (error) {
    console.error('Error loading advanced settings:', error);
    advancedSettings = {
      markSensitive: false,
      textMode: settings.defaultTextMode || 'clear',
      persistence: settings.defaultPersistence,
      urlBehavior: settings.defaultUrlBehavior
    };
  }
}

// Save advanced settings
async function saveAdvancedSettings() {
  try {
    await browser.storage.local.set({ advancedSettings });
    showSaveConfirmation('save-advanced-btn');
  } catch (error) {
    console.error('Error saving advanced settings:', error);
  }
}

// Populate advanced form
function populateAdvancedForm() {
  document.getElementById('adv-mark-sensitive').checked = advancedSettings.markSensitive;
  document.querySelector(`input[name="adv-text-mode"][value="${advancedSettings.textMode}"]`).checked = true;
  document.querySelector(`input[name="adv-persistence"][value="${advancedSettings.persistence}"]`).checked = true;
  document.querySelector(`input[name="adv-url-behavior"][value="${advancedSettings.urlBehavior}"]`).checked = true;
}

// Save settings
async function saveSettings() {
  try {
    await browser.storage.local.set({ settings });
    
    await browser.runtime.sendMessage({
      action: 'settingsUpdated',
      settings: settings
    });
    
    await applyTheme();
    applyTimerListView();
    
    showSaveConfirmation('save-settings-btn');
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

// Apply timer list view
function applyTimerListView() {
  const timerList = document.getElementById('timer-list');
  if (settings.timerListView === 'compact') {
    timerList.classList.add('compact');
  } else {
    timerList.classList.remove('compact');
  }
}

// Populate settings form
function populateSettingsForm() {
  document.getElementById('typing-speed').value = settings.typingSpeed;
  document.getElementById('post-entry-delay').value = settings.postTextEntryDelay;
  document.getElementById('scroll-delay').value = settings.scrollDelay;
  document.getElementById('trigger-focus-blur').checked = settings.triggerFocusBlur;
  document.getElementById('refresh-on-element-not-found').checked = settings.refreshOnElementNotFound;
  document.getElementById('auto-delete').value = settings.autoDeleteExecuted;
  document.getElementById('notify-success').checked = settings.notifySuccess;
  document.getElementById('notify-failure').checked = settings.notifyFailure;
  document.getElementById('default-event-type').value = settings.defaultEventType;
  document.getElementById('default-text-entry-method').value = settings.defaultTextEntryMethod;
  document.querySelector(`input[name="default-persistence"][value="${settings.defaultPersistence}"]`).checked = true;
  document.querySelector(`input[name="default-url-behavior"][value="${settings.defaultUrlBehavior}"]`).checked = true;
  document.querySelector(`input[name="default-text-mode"][value="${settings.defaultTextMode}"]`).checked = true;
  document.querySelector(`input[name="removal-default-persistence"][value="${settings.removalDefaultPersistence}"]`).checked = true;
  document.getElementById('timer-list-view').value = settings.timerListView;
  document.getElementById('theme').value = settings.theme;
  document.getElementById('log-retention-time').value = settings.logRetentionTime;
  document.getElementById('log-retention-count').value = settings.logRetentionCount;
}

// Show save confirmation
function showSaveConfirmation(btnId) {
  const btn = document.getElementById(btnId);
  const originalText = btn.textContent;
  btn.textContent = '✓ Saved!';
  btn.style.background = '#4CAF50';
  
  setTimeout(() => {
    btn.textContent = originalText;
    btn.style.background = '';
  }, 2000);
}

// Apply default settings
function applyDefaultSettings() {
  document.querySelector(`input[name="event-type"][value="${settings.defaultEventType}"]`).checked = true;
  document.querySelector(`input[name="text-entry-method"][value="${settings.defaultTextEntryMethod}"]`).checked = true;
  updateFormVisibility();
}

// Update form visibility based on action type
function updateFormVisibility() {
  const eventType = document.querySelector('input[name="event-type"]:checked').value;
  const textEntryFields = document.getElementById('text-entry-fields');
  const textEntryInputGroup = document.getElementById('text-entry-input-group');
  const keyPressInputGroup = document.getElementById('key-press-input-group');
  const cssSelector = document.getElementById('css-selector');
  
  if (eventType === 'enterText') {
    textEntryFields.style.display = 'block';
    textEntryInputGroup.style.display = 'block';
    keyPressInputGroup.style.display = 'none';
    cssSelector.placeholder = 'input#username';
    if (cssSelector.value === 'button[aria-label="Continue"]') {
      cssSelector.value = 'input#username';
    }
  } else if (eventType === 'click') {
    textEntryFields.style.display = 'none';
    textEntryInputGroup.style.display = 'none';
    keyPressInputGroup.style.display = 'none';
    cssSelector.placeholder = 'button[aria-label="Continue"]';
    if (cssSelector.value === 'input#username') {
      cssSelector.value = 'button[aria-label="Continue"]';
    }
  } else if (eventType === 'keyPress') {
    textEntryFields.style.display = 'none';
    textEntryInputGroup.style.display = 'none';
    keyPressInputGroup.style.display = 'block';
    cssSelector.placeholder = 'input#search';
  }
}

// Update text entry method visibility
function updateTextEntryMethodVisibility() {
  const method = document.querySelector('input[name="text-entry-method"]:checked').value;
  const triggerEventsGroup = document.getElementById('trigger-events-group');
  
  if (method === 'keystroke') {
    triggerEventsGroup.style.display = 'none';
  } else {
    triggerEventsGroup.style.display = 'block';
  }
}

// Update schedule type visibility
function updateScheduleTypeVisibility() {
  const scheduleType = document.querySelector('input[name="schedule-type"]:checked').value;
  const timingMethod = document.querySelector('input[name="timing-method"]:checked').value;
  
  const dateInputGroup = document.getElementById('date-input-group');
  const dailyTimeGroup = document.getElementById('daily-time-group');
  const repeatLimitGroup = document.getElementById('repeat-limit-group');
  const delayHelpText = document.getElementById('delay-help-text');
  
  const atTimeFields = document.getElementById('at-time-fields');
  const afterDelayFields = document.getElementById('after-delay-fields');
  
  if (scheduleType === 'once-off') {
    // Once-off event
    repeatLimitGroup.style.display = 'none';
    dailyTimeGroup.style.display = 'none';
    
    if (timingMethod === 'at-time') {
      atTimeFields.style.display = 'block';
      afterDelayFields.style.display = 'none';
      dateInputGroup.style.display = 'block';
      delayHelpText.textContent = 'Event will fire once after the specified delay';
    } else {
      atTimeFields.style.display = 'none';
      afterDelayFields.style.display = 'block';
      dateInputGroup.style.display = 'none';
      delayHelpText.textContent = 'Event will fire once after the specified delay';
    }
  } else {
    // Recurring event
    repeatLimitGroup.style.display = 'block';
    
    if (timingMethod === 'at-time') {
      // Daily at time
      atTimeFields.style.display = 'block';
      afterDelayFields.style.display = 'none';
      dateInputGroup.style.display = 'none';
      dailyTimeGroup.style.display = 'block';
      delayHelpText.textContent = 'Event will fire repeatedly at the specified interval';
    } else {
      // Every X interval
      atTimeFields.style.display = 'none';
      afterDelayFields.style.display = 'block';
      dateInputGroup.style.display = 'none';
      dailyTimeGroup.style.display = 'none';
      delayHelpText.textContent = 'Event will fire repeatedly at the specified interval';
    }
  }
  
  // Update repeat limit fields visibility
  updateRepeatLimitVisibility();
}

// Update repeat limit visibility
function updateRepeatLimitVisibility() {
  const repeatLimit = document.querySelector('input[name="repeat-limit"]:checked').value;
  const repeatTimesGroup = document.getElementById('repeat-times-group');
  const repeatUntilGroup = document.getElementById('repeat-until-group');
  
  if (repeatLimit === 'times') {
    repeatTimesGroup.style.display = 'block';
    repeatUntilGroup.style.display = 'none';
  } else if (repeatLimit === 'until') {
    repeatTimesGroup.style.display = 'none';
    repeatUntilGroup.style.display = 'block';
  } else {
    repeatTimesGroup.style.display = 'none';
    repeatUntilGroup.style.display = 'none';
  }
}

// Initialize time selectors
function initializeTimeSelectors() {
  const hoursSelect = document.getElementById('hours');
  const minutesSelect = document.getElementById('minutes');
  const secondsSelect = document.getElementById('seconds');
  
  for (let i = 0; i < 24; i++) {
    const option = document.createElement('option');
    option.value = i.toString().padStart(2, '0');
    option.textContent = i.toString().padStart(2, '0');
    hoursSelect.appendChild(option);
  }
  
  for (let i = 0; i < 60; i++) {
    const option = document.createElement('option');
    option.value = i.toString().padStart(2, '0');
    option.textContent = i.toString().padStart(2, '0');
    minutesSelect.appendChild(option);
  }
  
  for (let i = 0; i < 60; i++) {
    const option = document.createElement('option');
    option.value = i.toString().padStart(2, '0');
    option.textContent = i.toString().padStart(2, '0');
    secondsSelect.appendChild(option);
  }
  
  const now = new Date();
  hoursSelect.value = now.getHours().toString().padStart(2, '0');
  minutesSelect.value = now.getMinutes().toString().padStart(2, '0');
  secondsSelect.value = now.getSeconds().toString().padStart(2, '0');
}

// Initialize daily time selectors
function initializeDailyTimeSelectors() {
  const hoursSelect = document.getElementById('daily-hours');
  const minutesSelect = document.getElementById('daily-minutes');
  const secondsSelect = document.getElementById('daily-seconds');
  
  for (let i = 0; i < 24; i++) {
    const option = document.createElement('option');
    option.value = i.toString().padStart(2, '0');
    option.textContent = i.toString().padStart(2, '0');
    hoursSelect.appendChild(option);
  }
  
  for (let i = 0; i < 60; i++) {
    const option = document.createElement('option');
    option.value = i.toString().padStart(2, '0');
    option.textContent = i.toString().padStart(2, '0');
    minutesSelect.appendChild(option);
  }
  
  for (let i = 0; i < 60; i++) {
    const option = document.createElement('option');
    option.value = i.toString().padStart(2, '0');
    option.textContent = i.toString().padStart(2, '0');
    secondsSelect.appendChild(option);
  }
  
  const now = new Date();
  hoursSelect.value = now.getHours().toString().padStart(2, '0');
  minutesSelect.value = now.getMinutes().toString().padStart(2, '0');
  secondsSelect.value = now.getSeconds().toString().padStart(2, '0');
}

// Initialize date selector
function initializeDateSelector() {
  const dateInput = document.getElementById('target-date');
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  dateInput.value = `${year}-${month}-${day}`;
  
  // Initialize repeat until date
  const repeatUntilDate = document.getElementById('repeat-until-date');
  const futureDate = new Date(today);
  futureDate.setMonth(futureDate.getMonth() + 1);
  const futureYear = futureDate.getFullYear();
  const futureMonth = String(futureDate.getMonth() + 1).padStart(2, '0');
  const futureDay = String(futureDate.getDate()).padStart(2, '0');
  repeatUntilDate.value = `${futureYear}-${futureMonth}-${futureDay}`;
}

// Get current tab
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
  
  // Timed events form
  document.getElementById('submit-btn').addEventListener('click', handleSubmit);
  document.getElementById('cancel-edit-btn').addEventListener('click', cancelEdit);
  
  // Element removal form
  document.getElementById('submit-removal-btn').addEventListener('click', handleSubmitRemoval);
  document.getElementById('cancel-removal-edit-btn').addEventListener('click', cancelRemovalEdit);
  
  // Event type change
  document.querySelectorAll('input[name="event-type"]').forEach(radio => {
    radio.addEventListener('change', updateFormVisibility);
  });
  
  // Text entry method change
  document.querySelectorAll('input[name="text-entry-method"]').forEach(radio => {
    radio.addEventListener('change', updateTextEntryMethodVisibility);
  });
  
  // Schedule type change
  document.querySelectorAll('input[name="schedule-type"]').forEach(radio => {
    radio.addEventListener('change', updateScheduleTypeVisibility);
  });
  
  // Timing method change
  document.querySelectorAll('input[name="timing-method"]').forEach(radio => {
    radio.addEventListener('change', updateScheduleTypeVisibility);
  });
  
  // Repeat limit change
  document.querySelectorAll('input[name="repeat-limit"]').forEach(radio => {
    radio.addEventListener('change', updateRepeatLimitVisibility);
  });
  
  // Settings
  document.getElementById('save-settings-btn').addEventListener('click', handleSaveSettings);
  document.getElementById('reset-settings-btn').addEventListener('click', handleResetSettings);
  
  // Advanced settings
  document.getElementById('save-advanced-btn').addEventListener('click', handleSaveAdvanced);
  document.getElementById('reset-advanced-btn').addEventListener('click', handleResetAdvanced);
  
  // Log
  document.getElementById('clear-log-btn').addEventListener('click', handleClearLog);
  document.querySelectorAll('input[name="log-filter"]').forEach(radio => {
    radio.addEventListener('change', loadLog);
  });
}

// Switch tabs
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`${tabName}-tab`).classList.add('active');
  
  if (tabName === 'log') {
    loadLog();
  } else if (tabName === 'active') {
    loadTimers();
    loadRemovers();
  }
}

// Handle settings save
async function handleSaveSettings() {
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
  
  settings.typingSpeed = typingSpeed;
  settings.postTextEntryDelay = postEntryDelay;
  settings.scrollDelay = parseInt(document.getElementById('scroll-delay').value);
  settings.triggerFocusBlur = document.getElementById('trigger-focus-blur').checked;
  settings.refreshOnElementNotFound = document.getElementById('refresh-on-element-not-found').checked;
  settings.autoDeleteExecuted = document.getElementById('auto-delete').value;
  settings.notifySuccess = document.getElementById('notify-success').checked;
  settings.notifyFailure = document.getElementById('notify-failure').checked;
  settings.defaultEventType = document.getElementById('default-event-type').value;
  settings.defaultTextEntryMethod = document.getElementById('default-text-entry-method').value;
  settings.defaultPersistence = document.querySelector('input[name="default-persistence"]:checked').value;
  settings.defaultUrlBehavior = document.querySelector('input[name="default-url-behavior"]:checked').value;
  settings.defaultTextMode = document.querySelector('input[name="default-text-mode"]:checked').value;
  settings.removalDefaultPersistence = document.querySelector('input[name="removal-default-persistence"]:checked').value;
  settings.timerListView = document.getElementById('timer-list-view').value;
  settings.theme = document.getElementById('theme').value;
  settings.logRetentionTime = document.getElementById('log-retention-time').value;
  settings.logRetentionCount = parseInt(document.getElementById('log-retention-count').value);
  
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

// Handle advanced save
async function handleSaveAdvanced() {
  advancedSettings.markSensitive = document.getElementById('adv-mark-sensitive').checked;
  advancedSettings.textMode = document.querySelector('input[name="adv-text-mode"]:checked').value;
  advancedSettings.persistence = document.querySelector('input[name="adv-persistence"]:checked').value;
  advancedSettings.urlBehavior = document.querySelector('input[name="adv-url-behavior"]:checked').value;
  
  await saveAdvancedSettings();
}

// Handle advanced reset
async function handleResetAdvanced() {
  if (confirm('Reset advanced settings to defaults from Settings tab?')) {
    advancedSettings = {
      markSensitive: false,
      textMode: settings.defaultTextMode,
      persistence: settings.defaultPersistence,
      urlBehavior: settings.defaultUrlBehavior
    };
    populateAdvancedForm();
    await saveAdvancedSettings();
  }
}

// Handle clear log
async function handleClearLog() {
  if (confirm('Clear all log entries?')) {
    await browser.runtime.sendMessage({ action: 'clearLog' });
    await loadLog();
  }
}

// Handle timed event submit
async function handleSubmit() {
  const eventType = document.querySelector('input[name="event-type"]:checked').value;
  const cssSelector = document.getElementById('css-selector').value.trim();
  const scheduleType = document.querySelector('input[name="schedule-type"]:checked').value;
  const timingMethod = document.querySelector('input[name="timing-method"]:checked').value;
  
  if (!cssSelector) {
    alert('Please enter a CSS selector');
    return;
  }
  
  let textToEnter = '';
  let keyPress = '';
  let textEntryMethod = 'keystroke';
  let clearBeforeTyping = true;
  let isSensitive = false;
  let triggerEvents = true;
  
  if (eventType === 'enterText') {
    textToEnter = document.getElementById('text-to-enter').value;
    if (!textToEnter) {
      alert('Please enter text to type');
      return;
    }
    textEntryMethod = document.querySelector('input[name="text-entry-method"]:checked').value;
    clearBeforeTyping = advancedSettings.textMode === 'clear';
    isSensitive = advancedSettings.markSensitive || isSelectorSensitive(cssSelector);
    
    if (textEntryMethod !== 'keystroke') {
      triggerEvents = document.getElementById('trigger-events').checked;
    }
  } else if (eventType === 'keyPress') {
    keyPress = document.getElementById('key-press').value.trim();
    if (!keyPress) {
      alert('Please enter a key to press');
      return;
    }
  }
  
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];
  
  if (!currentTab) {
    alert('No active tab found');
    return;
  }
  
  // Calculate target time based on schedule type and timing method
  let targetTime;
  let dailyTime = null;
  let intervalMs = null;
  
  if (scheduleType === 'once-off') {
    if (timingMethod === 'at-time') {
      // At specific date/time
      const targetDate = document.getElementById('target-date').value;
      const hours = document.getElementById('hours').value;
      const minutes = document.getElementById('minutes').value;
      const seconds = document.getElementById('seconds').value;
      
      if (!targetDate) {
        alert('Please select a target date');
        return;
      }
      
      const [year, month, day] = targetDate.split('-').map(Number);
      targetTime = new Date(year, month - 1, day, parseInt(hours), parseInt(minutes), parseInt(seconds), 0).getTime();
    } else {
      // After delay
      const delayHours = parseInt(document.getElementById('delay-hours').value) || 0;
      const delayMinutes = parseInt(document.getElementById('delay-minutes').value) || 0;
      const delaySeconds = parseInt(document.getElementById('delay-seconds').value) || 0;
      
      if (delayHours === 0 && delayMinutes === 0 && delaySeconds === 0) {
        alert('Please specify a delay greater than 0');
        return;
      }
      
      const delayMs = (delayHours * 3600 + delayMinutes * 60 + delaySeconds) * 1000;
      targetTime = Date.now() + delayMs;
    }
  } else {
    // Recurring event
    if (timingMethod === 'at-time') {
      // Daily at time
      const dailyHours = document.getElementById('daily-hours').value;
      const dailyMinutes = document.getElementById('daily-minutes').value;
      const dailySeconds = document.getElementById('daily-seconds').value;
      
      dailyTime = `${dailyHours}:${dailyMinutes}:${dailySeconds}`;
      
      // Calculate first execution time (today or tomorrow)
      const now = new Date();
      const todayExecution = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 
                                       parseInt(dailyHours), parseInt(dailyMinutes), parseInt(dailySeconds), 0);
      
      if (todayExecution.getTime() > now.getTime()) {
        targetTime = todayExecution.getTime();
      } else {
        // If time has passed today, schedule for tomorrow
        todayExecution.setDate(todayExecution.getDate() + 1);
        targetTime = todayExecution.getTime();
      }
    } else {
      // Every X interval
      const delayHours = parseInt(document.getElementById('delay-hours').value) || 0;
      const delayMinutes = parseInt(document.getElementById('delay-minutes').value) || 0;
      const delaySeconds = parseInt(document.getElementById('delay-seconds').value) || 0;
      
      if (delayHours === 0 && delayMinutes === 0 && delaySeconds === 0) {
        alert('Please specify an interval greater than 0');
        return;
      }
      
      intervalMs = (delayHours * 3600 + delayMinutes * 60 + delaySeconds) * 1000;
      targetTime = Date.now() + intervalMs;
    }
  }
  
  // Get repeat limit settings for recurring events
  let repeatLimit = 'indefinitely';
  let repeatTimes = null;
  let repeatUntilDate = null;
  
  if (scheduleType === 'recurring') {
    repeatLimit = document.querySelector('input[name="repeat-limit"]:checked').value;
    
    if (repeatLimit === 'times') {
      repeatTimes = parseInt(document.getElementById('repeat-times').value);
      if (!repeatTimes || repeatTimes < 1) {
        alert('Please enter a valid number of times');
        return;
      }
    } else if (repeatLimit === 'until') {
      const untilDateStr = document.getElementById('repeat-until-date').value;
      if (!untilDateStr) {
        alert('Please select an end date');
        return;
      }
      repeatUntilDate = new Date(untilDateStr).getTime();
      
      if (repeatUntilDate <= Date.now()) {
        alert('End date must be in the future');
        return;
      }
    }
  }
  
  const timerData = {
    id: currentEditingTimerId || generateTimerId(),
    eventType: eventType,
    textToEnter: textToEnter,
    keyPress: keyPress,
    textEntryMethod: textEntryMethod,
    clearBeforeTyping: clearBeforeTyping,
    triggerEvents: triggerEvents,
    isSensitive: isSensitive,
    tabId: currentTab.id,
    tabTitle: currentTab.title,
    originalUrl: currentTab.url,
    cssSelector: cssSelector,
    targetTime: targetTime,
    scheduleType: scheduleType,
    timingMethod: timingMethod,
    dailyTime: dailyTime,
    intervalMs: intervalMs,
    repeatLimit: repeatLimit,
    repeatTimes: repeatTimes,
    repeatUntilDate: repeatUntilDate,
    executionCount: 0,
    persistence: advancedSettings.persistence,
    urlBehavior: advancedSettings.urlBehavior,
    status: 'pending',
    createdAt: Date.now()
  };
  
  await browser.runtime.sendMessage({
    action: currentEditingTimerId ? 'updateTimer' : 'addTimer',
    timer: timerData
  });
  
  resetForm();
  switchTab('active');
  await loadTimers();
}

// Handle removal submit
async function handleSubmitRemoval() {
  const cssSelector = document.getElementById('removal-css-selector').value.trim();
  const scope = document.querySelector('input[name="removal-scope"]:checked').value;
  
  if (!cssSelector) {
    alert('Please enter a CSS selector');
    return;
  }
  
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];
  
  if (!currentTab) {
    alert('No active tab found');
    return;
  }
  
  const removerData = {
    id: currentEditingRemoverId || generateRemoverId(),
    cssSelector: cssSelector,
    scope: scope,
    tabId: scope === 'current' ? currentTab.id : null,
    tabTitle: currentTab.title,
    originalUrl: currentTab.url,
    persistence: settings.removalDefaultPersistence,
    createdAt: Date.now(),
    removedCount: 0
  };
  
  await browser.runtime.sendMessage({
    action: currentEditingRemoverId ? 'updateRemover' : 'addRemover',
    remover: removerData
  });
  
  resetRemovalForm();
  switchTab('active');
  await loadRemovers();
}

// Check if selector is sensitive
function isSelectorSensitive(selector) {
  const lowerSelector = selector.toLowerCase();
  return lowerSelector.includes('password') || 
         lowerSelector.includes('pass') || 
         lowerSelector.includes('pwd');
}

// Generate unique IDs
function generateTimerId() {
  return 'timer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateRemoverId() {
  return 'remover_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Load timers
async function loadTimers() {
  const response = await browser.runtime.sendMessage({ action: 'getTimers' });
  const timers = response.timers || [];
  
  const timerList = document.getElementById('timer-list');
  
  if (timers.length === 0) {
    timerList.innerHTML = '<p class="empty-state">No active timers</p>';
    return;
  }
  
  timerList.innerHTML = '';
  
  timers.sort((a, b) => {
    if (a.tabId === currentTabId && b.tabId !== currentTabId) return -1;
    if (a.tabId !== currentTabId && b.tabId === currentTabId) return 1;
    return a.targetTime - b.targetTime;
  });
  
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
  
  if (timer.tabId === currentTabId) {
    div.classList.add('active-tab');
  }
  
  const header = document.createElement('div');
  header.className = 'timer-header';
  
  const titleDiv = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'timer-title';
  
  const eventIcon = timer.eventType === 'enterText' ? '⌨️' : 
                    timer.eventType === 'keyPress' ? '⌨️' : '🖱️';
  const eventLabel = timer.eventType === 'enterText' ? 'Type' : 
                     timer.eventType === 'keyPress' ? 'Key' : 'Click';
  
  // Create clickable tab title
  const tabLink = document.createElement('a');
  tabLink.href = '#';
  tabLink.className = 'tab-link';
  tabLink.textContent = escapeHtml(timer.tabTitle || 'Unknown Tab');
  tabLink.title = 'Switch to this tab';
  tabLink.addEventListener('click', (e) => {
    e.preventDefault();
    switchToTimerTab(timer.tabId);
  });
  
  title.innerHTML = `${eventIcon} `;
  title.appendChild(tabLink);
  title.innerHTML += ` <span class="timer-event-type">${eventLabel}</span>`;
  
  // Add recurring badge if applicable
  if (timer.scheduleType === 'recurring') {
    const recurringBadge = document.createElement('span');
    recurringBadge.className = 'recurring-badge';
    recurringBadge.textContent = '🔁 Recurring';
    title.appendChild(recurringBadge);
  }
  
  titleDiv.appendChild(title);
  
  const actions = document.createElement('div');
  actions.className = 'timer-actions';
  
  // Duplicate button (always available)
  const duplicateBtn = document.createElement('button');
  duplicateBtn.className = 'icon-btn';
  duplicateBtn.textContent = '📋';
  duplicateBtn.title = 'Duplicate timer';
  duplicateBtn.addEventListener('click', () => duplicateTimer(timer));
  actions.appendChild(duplicateBtn);
  
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
  
  if (timer.status === 'pending') {
    const countdown = document.createElement('div');
    countdown.className = 'timer-countdown';
    countdown.dataset.targetTime = timer.targetTime;
    updateCountdown(countdown, timer.targetTime);
    details.appendChild(countdown);
    
    const firesAt = document.createElement('div');
    firesAt.className = 'timer-fires-at';
    const targetDate = new Date(timer.targetTime);
    firesAt.textContent = `Fires at ${formatDateTime(targetDate)}`;
    details.appendChild(firesAt);
    
    // Add schedule info for recurring events
    if (timer.scheduleType === 'recurring') {
      const scheduleInfo = document.createElement('div');
      scheduleInfo.className = 'schedule-info';
      
      if (timer.timingMethod === 'at-time') {
        scheduleInfo.textContent = `Daily at ${timer.dailyTime}`;
      } else {
        const intervalSec = timer.intervalMs / 1000;
        const hours = Math.floor(intervalSec / 3600);
        const minutes = Math.floor((intervalSec % 3600) / 60);
        const seconds = intervalSec % 60;
        
        let intervalStr = [];
        if (hours > 0) intervalStr.push(`${hours}h`);
        if (minutes > 0) intervalStr.push(`${minutes}m`);
        if (seconds > 0) intervalStr.push(`${seconds}s`);
        
        scheduleInfo.textContent = `Every ${intervalStr.join(' ')}`;
      }
      
      // Add repeat limit info
      if (timer.repeatLimit === 'times') {
        scheduleInfo.textContent += ` • ${timer.repeatTimes - timer.executionCount} times left`;
      } else if (timer.repeatLimit === 'until') {
        const untilDate = new Date(timer.repeatUntilDate);
        scheduleInfo.textContent += ` • Until ${formatDate(untilDate)}`;
      } else {
        scheduleInfo.textContent += ' • Indefinitely';
      }
      
      details.appendChild(scheduleInfo);
    }
  } else if (timer.status === 'executed-success') {
    const badge = document.createElement('div');
    badge.className = 'status-badge success';
    const actionText = timer.eventType === 'enterText' ? 'Text entered successfully' : 
                       timer.eventType === 'keyPress' ? 'Key pressed successfully' : 
                       'Clicked successfully';
    badge.textContent = '✓ ' + actionText;
    details.appendChild(badge);
    
    // Add execution timestamp
    if (timer.executedAt) {
      const executedTime = document.createElement('div');
      executedTime.className = 'execution-time';
      executedTime.textContent = `Executed at ${formatDateTime(new Date(timer.executedAt))}`;
      details.appendChild(executedTime);
    }
  } else if (timer.status === 'executed-failure') {
    const badge = document.createElement('div');
    badge.className = 'status-badge error';
    badge.textContent = '✗ Element not found or execution failed';
    details.appendChild(badge);
    
    // Add execution timestamp
    if (timer.executedAt) {
      const executedTime = document.createElement('div');
      executedTime.className = 'execution-time';
      executedTime.textContent = `Failed at ${formatDateTime(new Date(timer.executedAt))}`;
      details.appendChild(executedTime);
    }
  }
  
  const selector = document.createElement('div');
  selector.innerHTML = `Selector: <span class="timer-selector">${escapeHtml(timer.cssSelector)}</span>`;
  details.appendChild(selector);
  
  if (timer.eventType === 'enterText' && timer.textToEnter) {
    const textContent = document.createElement('div');
    
    if (timer.isSensitive) {
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
      const displayText = timer.textToEnter.length > 50 
        ? timer.textToEnter.substring(0, 50) + '...' 
        : timer.textToEnter;
      textContent.innerHTML = `Text: <span class="timer-text-content">${escapeHtml(displayText)}</span>`;
      details.appendChild(textContent);
    }
    
    const methodText = document.createElement('div');
    const methodLabel = timer.textEntryMethod === 'keystroke' ? 'Keystroke' : 
                       timer.textEntryMethod === 'setValue' ? 'Set Value' : 'Set innerHTML';
    methodText.textContent = `Method: ${methodLabel} | Mode: ${timer.clearBeforeTyping ? 'Clear' : 'Append'}`;
    methodText.style.fontSize = '11px';
    methodText.style.color = 'var(--text-tertiary)';
    details.appendChild(methodText);
  } else if (timer.eventType === 'keyPress' && timer.keyPress) {
    const keyContent = document.createElement('div');
    keyContent.innerHTML = `Key: <span class="timer-text-content">${escapeHtml(timer.keyPress)}</span>`;
    details.appendChild(keyContent);
  }
  
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

// Load removers
async function loadRemovers() {
  const response = await browser.runtime.sendMessage({ action: 'getRemovers' });
  const removers = response.removers || [];
  
  const removerList = document.getElementById('remover-list');
  
  if (removers.length === 0) {
    removerList.innerHTML = '<p class="empty-state">No active removal rules</p>';
    return;
  }
  
  removerList.innerHTML = '';
  
  removers.sort((a, b) => {
    if (a.tabId === currentTabId && b.tabId !== currentTabId) return -1;
    if (a.tabId !== currentTabId && b.tabId === currentTabId) return 1;
    return b.createdAt - a.createdAt;
  });
  
  for (const remover of removers) {
    const removerElement = createRemoverElement(remover);
    removerList.appendChild(removerElement);
  }
}

// Create remover element
function createRemoverElement(remover) {
  const div = document.createElement('div');
  div.className = 'remover-item';
  div.dataset.removerId = remover.id;
  
  if (remover.scope === 'current' && remover.tabId === currentTabId) {
    div.classList.add('active-tab');
  }
  
  const header = document.createElement('div');
  header.className = 'remover-header';
  
  const titleDiv = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'remover-title';
  
  const scopeLabel = remover.scope === 'current' ? 'Current Tab' : 'All Tabs';
  
  // Create clickable tab title if scope is current
  if (remover.scope === 'current' && remover.tabId) {
    const tabLink = document.createElement('a');
    tabLink.href = '#';
    tabLink.className = 'tab-link';
    tabLink.textContent = escapeHtml(remover.tabTitle || 'Unknown Tab');
    tabLink.title = 'Switch to this tab';
    tabLink.addEventListener('click', (e) => {
      e.preventDefault();
      switchToTimerTab(remover.tabId);
    });
    
    title.innerHTML = `🗑️ `;
    title.appendChild(tabLink);
    title.innerHTML += ` <span class="remover-scope-badge">${scopeLabel}</span>`;
  } else {
    title.innerHTML = `🗑️ ${escapeHtml(remover.tabTitle || 'All Tabs')} <span class="remover-scope-badge">${scopeLabel}</span>`;
  }
  
  titleDiv.appendChild(title);
  
  const actions = document.createElement('div');
  actions.className = 'remover-actions';
  
  // Duplicate button (always available)
  const duplicateBtn = document.createElement('button');
  duplicateBtn.className = 'icon-btn';
  duplicateBtn.textContent = '📋';
  duplicateBtn.title = 'Duplicate remover';
  duplicateBtn.addEventListener('click', () => duplicateRemover(remover));
  actions.appendChild(duplicateBtn);
  
  const editBtn = document.createElement('button');
  editBtn.className = 'icon-btn';
  editBtn.textContent = '✏️';
  editBtn.title = 'Edit remover';
  editBtn.addEventListener('click', () => editRemover(remover));
  
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'icon-btn';
  deleteBtn.textContent = '❌';
  deleteBtn.title = 'Delete remover';
  deleteBtn.addEventListener('click', () => deleteRemover(remover.id));
  
  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);
  
  header.appendChild(titleDiv);
  header.appendChild(actions);
  
  const details = document.createElement('div');
  details.className = 'remover-details';
  
  const selector = document.createElement('div');
  selector.innerHTML = `Selector: <span class="remover-selector">${escapeHtml(remover.cssSelector)}</span>`;
  details.appendChild(selector);
  
  const stats = document.createElement('div');
  stats.textContent = `Removed: ${remover.removedCount || 0} element(s)`;
  stats.style.fontSize = '11px';
  stats.style.color = 'var(--text-tertiary)';
  details.appendChild(stats);
  
  div.appendChild(header);
  div.appendChild(details);
  
  return div;
}

// Load log
async function loadLog() {
  const response = await browser.runtime.sendMessage({ action: 'getLog' });
  const allLogs = response.log || [];
  const timersResponse = await browser.runtime.sendMessage({ action: 'getTimers' });
  const timers = timersResponse.timers || [];
  
  const filter = document.querySelector('input[name="log-filter"]:checked').value;
  const logList = document.getElementById('log-list');
  
  const logCount = document.getElementById('log-count');
  const logRetentionInfo = document.getElementById('log-retention-info');
  
  logCount.textContent = `${allLogs.length} entries`;
  
  let retentionText = '';
  if (settings.logRetentionTime !== 'never') {
    retentionText = `Auto-clear: ${settings.logRetentionTime}`;
  }
  if (settings.logRetentionCount < 10000) {
    if (retentionText) retentionText += ' | ';
    retentionText += `Max: ${settings.logRetentionCount}`;
  }
  logRetentionInfo.textContent = retentionText;
  
  let filteredLogs = [];
  
  if (filter === 'timed-events') {
    filteredLogs = allLogs.filter(log => log.logType === 'timed-event' || !log.logType);
  } else if (filter === 'element-removal') {
    filteredLogs = allLogs.filter(log => log.logType === 'element-removal');
  } else if (filter === 'pending') {
    const pendingTimers = timers.filter(t => t.status === 'pending');
    filteredLogs = pendingTimers.map(timer => ({
      timerId: timer.id,
      type: 'scheduled',
      timestamp: timer.createdAt,
      scheduledTime: timer.targetTime,
      tabTitle: timer.tabTitle,
      eventType: timer.eventType,
      cssSelector: timer.cssSelector,
      isPending: true,
      scheduleType: timer.scheduleType,
      logType: 'timed-event'
    }));
  } else if (filter === 'executed') {
    filteredLogs = allLogs.filter(log => 
      log.type === 'executed' || log.type === 'cancelled' || log.type === 'removed'
    );
  } else {
    const pendingTimers = timers.filter(t => t.status === 'pending');
    filteredLogs = [
      ...allLogs,
      ...pendingTimers.map(timer => ({
        timerId: timer.id,
        type: 'scheduled',
        timestamp: timer.createdAt,
        scheduledTime: timer.targetTime,
        tabTitle: timer.tabTitle,
        eventType: timer.eventType,
        cssSelector: timer.cssSelector,
        isPending: true,
        scheduleType: timer.scheduleType,
        logType: 'timed-event'
      }))
    ];
  }
  
  if (filteredLogs.length === 0) {
    logList.innerHTML = '<p class="empty-state">No log entries</p>';
    return;
  }
  
  filteredLogs.sort((a, b) => {
    if (a.isPending && !b.isPending) return 1;
    if (!a.isPending && b.isPending) return -1;
    
    if (a.isPending && b.isPending) {
      return a.scheduledTime - b.scheduledTime;
    }
    
    return b.timestamp - a.timestamp;
  });
  
  logList.innerHTML = '';
  
  for (const log of filteredLogs) {
    const logElement = createLogElement(log);
    logList.appendChild(logElement);
  }
}

// Create log element
function createLogElement(log) {
  const div = document.createElement('div');
  div.className = 'log-entry';
  
  if (log.type === 'scheduled' || log.isPending) {
    div.classList.add('pending');
  } else if (log.type === 'executed' && log.status === 'success') {
    div.classList.add('success');
  } else if (log.type === 'executed' && log.status === 'failure') {
    div.classList.add('failure');
  } else if (log.type === 'cancelled') {
    div.classList.add('cancelled');
  } else if (log.type === 'updated') {
    div.classList.add('updated');
  } else if (log.type === 'removed') {
    div.classList.add('removal');
  }
  
  const header = document.createElement('div');
  header.className = 'log-entry-header';
  
  const titleDiv = document.createElement('div');
  const icon = document.createElement('span');
  icon.className = 'log-entry-icon';
  
  const title = document.createElement('span');
  title.className = 'log-entry-title';
  
  if (log.type === 'scheduled' || log.isPending) {
    icon.textContent = '📅';
    const scheduledDate = new Date(log.scheduledTime);
    const scheduleTypeText = log.scheduleType === 'recurring' ? ' (Recurring)' : '';
    title.textContent = `Scheduled to fire at ${formatDateTime(scheduledDate)}${scheduleTypeText}`;
  } else if (log.type === 'executed') {
    if (log.status === 'success') {
      icon.textContent = '✓';
      const actionText = log.eventType === 'enterText' ? 'Text entered' : 
                         log.eventType === 'keyPress' ? 'Key pressed' : 'Element clicked';
      title.textContent = `Fired at ${formatDateTime(new Date(log.timestamp))} - ${actionText}`;
    } else {
      icon.textContent = '✗';
      title.textContent = `Fired at ${formatDateTime(new Date(log.timestamp))} - Failed: ${log.reason}`;
    }
  } else if (log.type === 'cancelled') {
    icon.textContent = '🚫';
    title.textContent = `Cancelled at ${formatDateTime(new Date(log.timestamp))} - ${log.reason}`;
  } else if (log.type === 'updated') {
    icon.textContent = '📝';
    title.textContent = `Timer updated at ${formatDateTime(new Date(log.timestamp))}`;
  } else if (log.type === 'removed') {
    icon.textContent = '🗑️';
    title.textContent = `Removed ${log.count || 1} element(s) at ${formatDateTime(new Date(log.timestamp))}`;
  }
  
  titleDiv.appendChild(icon);
  titleDiv.appendChild(title);
  
  const timeDiv = document.createElement('div');
  timeDiv.className = 'log-entry-time';
  timeDiv.textContent = getRelativeTime(log.timestamp);
  
  header.appendChild(titleDiv);
  header.appendChild(timeDiv);
  
  const details = document.createElement('div');
  details.className = 'log-entry-details';
  details.textContent = `Page: ${escapeHtml(log.tabTitle || 'Unknown')}`;
  
  div.appendChild(header);
  div.appendChild(details);
  
  return div;
}

// Toggle sensitive text
function toggleSensitiveText(timerId) {
  textVisibilityState[timerId] = !textVisibilityState[timerId];
  loadTimers();
}

// Check URL status
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

// Update countdown
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

// Start timer updates
function startTimerUpdates() {
  updateInterval = setInterval(() => {
    const countdowns = document.querySelectorAll('.timer-countdown');
    countdowns.forEach(countdown => {
      const targetTime = parseInt(countdown.dataset.targetTime);
      updateCountdown(countdown, targetTime);
    });
  }, 1000);
}

// Format date time
function formatDateTime(date) {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

// Format date only
function formatDate(date) {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
}

// Get relative time
function getRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (seconds > 0) return `${seconds} second${seconds > 1 ? 's' : ''} ago`;
  return 'just now';
}

// Edit timer
function editTimer(timer) {
  currentEditingTimerId = timer.id;
  
  // Switch to the tab where the timer was created
  switchToTimerTab(timer.tabId).then(() => {
    switchTab('timed-events');
    populateTimerForm(timer);
    
    document.getElementById('form-title').textContent = 'Edit Timed Event';
    document.getElementById('submit-btn').textContent = 'Update Event';
    document.getElementById('cancel-edit-btn').style.display = 'block';
    
    window.scrollTo(0, 0);
  });
}

// Duplicate timer
function duplicateTimer(timer) {
  // Switch to the tab where the timer was created
  switchToTimerTab(timer.tabId).then(() => {
    switchTab('timed-events');
    populateTimerForm(timer);
    
    // Reset to add mode (not edit)
    currentEditingTimerId = null;
    document.getElementById('form-title').textContent = 'Add Timed Event';
    document.getElementById('submit-btn').textContent = 'Add Timed Event';
    document.getElementById('cancel-edit-btn').style.display = 'none';
    
    window.scrollTo(0, 0);
  });
}

// Populate timer form
function populateTimerForm(timer) {
  document.querySelector(`input[name="event-type"][value="${timer.eventType}"]`).checked = true;
  updateFormVisibility();
  
  document.getElementById('css-selector').value = timer.cssSelector;
  
  if (timer.eventType === 'enterText') {
    document.getElementById('text-to-enter').value = timer.textToEnter;
    document.querySelector(`input[name="text-entry-method"][value="${timer.textEntryMethod || 'keystroke'}"]`).checked = true;
    updateTextEntryMethodVisibility();
    
    if (timer.textEntryMethod !== 'keystroke' && timer.triggerEvents !== undefined) {
      document.getElementById('trigger-events').checked = timer.triggerEvents;
    }
  } else if (timer.eventType === 'keyPress') {
    document.getElementById('key-press').value = timer.keyPress;
  }
  
  // Set schedule type
  document.querySelector(`input[name="schedule-type"][value="${timer.scheduleType}"]`).checked = true;
  
  // Set timing method
  if (timer.scheduleType === 'once-off') {
    if (timer.dailyTime || timer.intervalMs) {
      document.querySelector('input[name="timing-method"][value="after-delay"]').checked = true;
    } else {
      document.querySelector('input[name="timing-method"][value="at-time"]').checked = true;
    }
  } else {
    if (timer.dailyTime) {
      document.querySelector('input[name="timing-method"][value="at-time"]').checked = true;
    } else {
      document.querySelector('input[name="timing-method"][value="after-delay"]').checked = true;
    }
  }
  
  updateScheduleTypeVisibility();
  
  // Populate time fields based on timer type
  if (timer.scheduleType === 'once-off') {
    if (timer.intervalMs) {
      // After delay
      const totalSeconds = Math.floor(timer.intervalMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      document.getElementById('delay-hours').value = hours;
      document.getElementById('delay-minutes').value = minutes;
      document.getElementById('delay-seconds').value = seconds;
    } else {
      // At specific time
      const targetTime = new Date(timer.targetTime);
      const year = targetTime.getFullYear();
      const month = String(targetTime.getMonth() + 1).padStart(2, '0');
      const day = String(targetTime.getDate()).padStart(2, '0');
      document.getElementById('target-date').value = `${year}-${month}-${day}`;
      document.getElementById('hours').value = targetTime.getHours().toString().padStart(2, '0');
      document.getElementById('minutes').value = targetTime.getMinutes().toString().padStart(2, '0');
      document.getElementById('seconds').value = targetTime.getSeconds().toString().padStart(2, '0');
    }
  } else {
    // Recurring
    if (timer.dailyTime) {
      // Daily at time
      const [hours, minutes, seconds] = timer.dailyTime.split(':');
      document.getElementById('daily-hours').value = hours;
      document.getElementById('daily-minutes').value = minutes;
      document.getElementById('daily-seconds').value = seconds;
    } else {
      // Every X interval
      const totalSeconds = Math.floor(timer.intervalMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      document.getElementById('delay-hours').value = hours;
      document.getElementById('delay-minutes').value = minutes;
      document.getElementById('delay-seconds').value = seconds;
    }
    
    // Set repeat limit
    document.querySelector(`input[name="repeat-limit"][value="${timer.repeatLimit}"]`).checked = true;
    updateRepeatLimitVisibility();
    
    if (timer.repeatLimit === 'times') {
      document.getElementById('repeat-times').value = timer.repeatTimes;
    } else if (timer.repeatLimit === 'until') {
      const untilDate = new Date(timer.repeatUntilDate);
      const year = untilDate.getFullYear();
      const month = String(untilDate.getMonth() + 1).padStart(2, '0');
      const day = String(untilDate.getDate()).padStart(2, '0');
      document.getElementById('repeat-until-date').value = `${year}-${month}-${day}`;
    }
  }
  
  advancedSettings.markSensitive = timer.isSensitive;
  advancedSettings.textMode = timer.clearBeforeTyping ? 'clear' : 'append';
  advancedSettings.persistence = timer.persistence;
  advancedSettings.urlBehavior = timer.urlBehavior;
  populateAdvancedForm();
}

// Edit remover
function editRemover(remover) {
  currentEditingRemoverId = remover.id;
  
  // Switch to the tab where the remover was created
  const tabToSwitch = remover.scope === 'current' ? remover.tabId : null;
  switchToTimerTab(tabToSwitch).then(() => {
    switchTab('element-removal');
    populateRemoverForm(remover);
    
    document.getElementById('removal-form-title').textContent = 'Edit Removal Rule';
    document.getElementById('submit-removal-btn').textContent = 'Update Rule';
    document.getElementById('cancel-removal-edit-btn').style.display = 'block';
    
    window.scrollTo(0, 0);
  });
}

// Duplicate remover
function duplicateRemover(remover) {
  // Switch to the tab where the remover was created
  const tabToSwitch = remover.scope === 'current' ? remover.tabId : null;
  switchToTimerTab(tabToSwitch).then(() => {
    switchTab('element-removal');
    populateRemoverForm(remover);
    
    // Reset to add mode (not edit)
    currentEditingRemoverId = null;
    document.getElementById('removal-form-title').textContent = 'Add Element Removal Rule';
    document.getElementById('submit-removal-btn').textContent = 'Add Removal Rule';
    document.getElementById('cancel-removal-edit-btn').style.display = 'none';
    
    window.scrollTo(0, 0);
  });
}

// Populate remover form
function populateRemoverForm(remover) {
  document.getElementById('removal-css-selector').value = remover.cssSelector;
  document.querySelector(`input[name="removal-scope"][value="${remover.scope}"]`).checked = true;
}

// Switch to timer's tab
async function switchToTimerTab(tabId) {
  if (!tabId) return;
  
  try {
    const tab = await browser.tabs.get(tabId);
    await browser.tabs.update(tabId, { active: true });
    await browser.windows.update(tab.windowId, { focused: true });
    // Wait a moment for tab to become active
    await new Promise(resolve => setTimeout(resolve, 300));
  } catch (error) {
    console.log('Could not switch to tab:', error);
  }
}

// Cancel edit
function cancelEdit() {
  resetForm();
}

// Cancel removal edit
function cancelRemovalEdit() {
  resetRemovalForm();
}

// Reset form
function resetForm() {
  currentEditingTimerId = null;
  document.getElementById('form-title').textContent = 'Add Timed Event';
  document.getElementById('submit-btn').textContent = 'Add Timed Event';
  document.getElementById('cancel-edit-btn').style.display = 'none';
  
  document.querySelector(`input[name="event-type"][value="${settings.defaultEventType}"]`).checked = true;
  updateFormVisibility();
  
  document.querySelector(`input[name="text-entry-method"][value="${settings.defaultTextEntryMethod}"]`).checked = true;
  updateTextEntryMethodVisibility();
  
  document.getElementById('css-selector').value = settings.defaultEventType === 'enterText' ? 'input#username' : 
                                                   settings.defaultEventType === 'keyPress' ? 'input#search' : 
                                                   'button[aria-label="Continue"]';
  document.getElementById('text-to-enter').value = '';
  document.getElementById('key-press').value = '';
  document.getElementById('trigger-events').checked = true;
  
  // Reset schedule type
  document.querySelector('input[name="schedule-type"][value="once-off"]').checked = true;
  document.querySelector('input[name="timing-method"][value="at-time"]').checked = true;
  updateScheduleTypeVisibility();
  
  // Reset delay fields
  document.getElementById('delay-hours').value = 0;
  document.getElementById('delay-minutes').value = 0;
  document.getElementById('delay-seconds').value = 30;
  
  // Reset repeat limit
  document.querySelector('input[name="repeat-limit"][value="indefinitely"]').checked = true;
  document.getElementById('repeat-times').value = 10;
  updateRepeatLimitVisibility();
  
  initializeDateSelector();
  
  const now = new Date();
  document.getElementById('hours').value = now.getHours().toString().padStart(2, '0');
  document.getElementById('minutes').value = now.getMinutes().toString().padStart(2, '0');
  document.getElementById('seconds').value = now.getSeconds().toString().padStart(2, '0');
  
  document.getElementById('daily-hours').value = now.getHours().toString().padStart(2, '0');
  document.getElementById('daily-minutes').value = now.getMinutes().toString().padStart(2, '0');
  document.getElementById('daily-seconds').value = now.getSeconds().toString().padStart(2, '0');
  
  loadAdvancedSettings();
}

// Reset removal form
function resetRemovalForm() {
  currentEditingRemoverId = null;
  document.getElementById('removal-form-title').textContent = 'Add Element Removal Rule';
  document.getElementById('submit-removal-btn').textContent = 'Add Removal Rule';
  document.getElementById('cancel-removal-edit-btn').style.display = 'none';
  
  document.getElementById('removal-css-selector').value = '';
  document.querySelector('input[name="removal-scope"][value="current"]').checked = true;
}

// Cancel timer
async function cancelTimer(timerId) {
  if (confirm('Are you sure you want to cancel this timer?')) {
    await browser.runtime.sendMessage({
      action: 'cancelTimer',
      timerId: timerId
    });
    await loadTimers();
  }
}

// Delete remover
async function deleteRemover(removerId) {
  if (confirm('Are you sure you want to delete this removal rule?')) {
    await browser.runtime.sendMessage({
      action: 'deleteRemover',
      removerId: removerId
    });
    await loadRemovers();
  }
}

// Escape HTML
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

// Listen for updates from background
browser.runtime.onMessage.addListener((message) => {
  if (message.action === 'timerUpdated' || message.action === 'timerExecuted') {
    loadTimers();
    loadLog();
  } else if (message.action === 'removerUpdated') {
    loadRemovers();
    loadLog();
  } else if (message.action === 'logUpdated') {
    loadLog();
  }
});

// Cleanup on unload
window.addEventListener('unload', () => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});