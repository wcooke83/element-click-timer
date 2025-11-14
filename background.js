// background.js - Background script for browser extension to manage timers and element removers

// Storage
let timers = [];
let removers = [];
let timerLog = [];
let checkInterval = null;
let autoDeleteInterval = null;
let settings = {};
let isInitialized = false;
let executingTimers = new Set(); // Track timers currently being executed

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

// Initialize on startup
browser.runtime.onStartup.addListener(async () => {
  await init();
});

browser.runtime.onInstalled.addListener(async () => {
  await init();
});

// Initialize immediately
(async () => {
  await init();
})();

async function init() {
  await loadSettings();
  await loadTimersFromStorage();
  await loadRemoversFromStorage();
  await loadLogFromStorage();
  startTimerChecker();
  startAutoDeleteChecker();
  startLogCleanupChecker();
  await initializeContentScriptRemovers();
}

// Load settings
async function loadSettings() {
  try {
    const data = await browser.storage.local.get('settings');
    settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  } catch (error) {
    console.error('Error loading settings:', error);
    settings = { ...DEFAULT_SETTINGS };
  }
}

// Load log
async function loadLogFromStorage() {
  try {
    const data = await browser.storage.local.get('timerLog');
    timerLog = data.timerLog || [];
    await cleanupLog();
  } catch (error) {
    console.error('Error loading log:', error);
    timerLog = [];
  }
}

// Save log
async function saveLogToStorage() {
  try {
    await browser.storage.local.set({ timerLog });
  } catch (error) {
    console.error('Error saving log:', error);
  }
}

// Add log entry
async function addLogEntry(entry) {
  timerLog.push(entry);
  await cleanupLog();
  await saveLogToStorage();
  notifyPopups('logUpdated');
}

// Cleanup log
async function cleanupLog() {
  let modified = false;
  
  if (settings.logRetentionTime !== 'never') {
    const now = Date.now();
    const retentionMs = {
      '1day': 24 * 60 * 60 * 1000,
      '1week': 7 * 24 * 60 * 60 * 1000,
      '1month': 30 * 24 * 60 * 60 * 1000
    }[settings.logRetentionTime];
    
    const initialLength = timerLog.length;
    timerLog = timerLog.filter(entry => (now - entry.timestamp) < retentionMs);
    if (timerLog.length !== initialLength) modified = true;
  }
  
  if (timerLog.length > settings.logRetentionCount) {
    timerLog.sort((a, b) => b.timestamp - a.timestamp);
    timerLog = timerLog.slice(0, settings.logRetentionCount);
    modified = true;
  }
  
  if (modified) {
    await saveLogToStorage();
  }
}

// Start log cleanup checker
function startLogCleanupChecker() {
  setInterval(async () => {
    await cleanupLog();
  }, 60000);
}

// Load timers
async function loadTimersFromStorage() {
  try {
    const localData = await browser.storage.local.get('timers');
    const persistentTimers = localData.timers || [];

    const sessionData = await browser.storage.session?.get('timers') || { timers: [] };
    const sessionTimers = sessionData.timers || [];

    timers = [...persistentTimers, ...sessionTimers];
    
    timers = timers.filter(timer => {
      if (timer.status === 'pending') {
        return true;
      }
      
      if (timer.status !== 'pending') {
        return !shouldAutoDelete(timer);
      }
      
      return true;
    });
    
    for (const timer of timers) {
      if (timer.persistence === 'tab' || timer.persistence === 'session') {
        try {
          await browser.tabs.get(timer.tabId);
        } catch (error) {
          timer.toRemove = true;
        }
      }
    }
    
    timers = timers.filter(t => !t.toRemove);
    
    await saveTimersToStorage();
  } catch (error) {
    console.error('Error loading timers:', error);
    timers = [];
  }
}

// Load removers
async function loadRemoversFromStorage() {
  try {
    const localData = await browser.storage.local.get('removers');
    const persistentRemovers = localData.removers || [];
    
    const sessionData = await browser.storage.session?.get('removers') || { removers: [] };
    const sessionRemovers = sessionData.removers || [];
    
    removers = [...persistentRemovers, ...sessionRemovers];
    
    for (const remover of removers) {
      if (remover.scope === 'current' && remover.tabId) {
        try {
          await browser.tabs.get(remover.tabId);
        } catch (error) {
          remover.toRemove = true;
        }
      }
    }
    
    removers = removers.filter(r => !r.toRemove);
    
    await saveRemoversToStorage();
  } catch (error) {
    console.error('Error loading removers:', error);
    removers = [];
  }
}

// Check if timer should be auto-deleted
function shouldAutoDelete(timer) {
  if (!timer.executedAt) {
    timer.executedAt = timer.targetTime;
  }

  const now = Date.now();
  const timeSinceExecution = now - timer.executedAt;

  switch (settings.autoDeleteExecuted) {
    case '5min':
      return timeSinceExecution > 5 * 60 * 1000;
    case '30min':
      return timeSinceExecution > 30 * 60 * 1000;
    case '1hour':
      return timeSinceExecution > 60 * 60 * 1000;
    case '24hours':
      return timeSinceExecution > 24 * 60 * 60 * 1000;
    case 'never':
    default:
      return false;
  }
}

// Start auto-delete checker
function startAutoDeleteChecker() {
  setInterval(async () => {
    const initialLength = timers.length;
    timers = timers.filter(timer => {
      if (timer.status !== 'pending') {
        return !shouldAutoDelete(timer);
      }
      return true;
    });

    if (timers.length !== initialLength) {
      await saveTimersToStorage();
      notifyPopups('timerUpdated');
    }
  }, 60000);
}

// Save timers
async function saveTimersToStorage() {
  try {
    const browserPersistentTimers = timers.filter(t => t.persistence === 'browser');
    const tabPersistentTimers = timers.filter(t => t.persistence === 'tab');
    const sessionTimers = timers.filter(t => t.persistence === 'session');
    
    await browser.storage.local.set({
      timers: [...browserPersistentTimers, ...tabPersistentTimers]
    });
    
    if (browser.storage.session) {
      await browser.storage.session.set({ timers: sessionTimers });
    }
  } catch (error) {
    console.error('Error saving timers:', error);
  }
}

// Save removers
async function saveRemoversToStorage() {
  try {
    const browserPersistentRemovers = removers.filter(r => r.persistence === 'browser');
    const tabPersistentRemovers = removers.filter(r => r.persistence === 'tab');
    const sessionRemovers = removers.filter(r => r.persistence === 'session');
    
    await browser.storage.local.set({
      removers: [...browserPersistentRemovers, ...tabPersistentRemovers]
    });
    
    if (browser.storage.session) {
      await browser.storage.session.set({ removers: sessionRemovers });
    }
  } catch (error) {
    console.error('Error saving removers:', error);
  }
}

// Initialize content script removers
async function initializeContentScriptRemovers() {
  const tabs = await browser.tabs.query({});
  
  for (const tab of tabs) {
    const applicableRemovers = removers.filter(r => {
      if (r.scope === 'all') return true;
      if (r.scope === 'current' && r.tabId === tab.id) return true;
      return false;
    });
    
    if (applicableRemovers.length > 0) {
      try {
        await browser.tabs.sendMessage(tab.id, {
          action: 'updateElementRemovers',
          removers: applicableRemovers
        });
      } catch (error) {
        // Tab may not have content script loaded yet
      }
    }
  }
}

// Message handler
browser.runtime.onMessage.addListener(async (message, sender) => {
  switch (message.action) {
    case 'addTimer':
      return await addTimer(message.timer);
    case 'updateTimer':
      return await updateTimer(message.timer);
    case 'cancelTimer':
      return await cancelTimer(message.timerId, 'user');
    case 'getTimers':
      return { timers: timers };
    case 'addRemover':
      return await addRemover(message.remover);
    case 'updateRemover':
      return await updateRemover(message.remover);
    case 'deleteRemover':
      return await deleteRemover(message.removerId);
    case 'getRemovers':
      return { removers: removers };
    case 'getActiveRemovers':
      if (sender.tab) {
        const applicable = removers.filter(r => {
          if (r.scope === 'all') return true;
          if (r.scope === 'current' && r.tabId === sender.tab.id) return true;
          return false;
        });
        return { removers: applicable };
      }
      return { removers: [] };
    case 'elementRemoved':
      return await handleElementRemoved(message.removerId, message.count);
    case 'getLog':
      return { log: timerLog };
    case 'clearLog':
      return await clearLog();
    case 'settingsUpdated':
      settings = message.settings;
      await loadSettings();
      return { success: true };
    default:
      return { success: false, error: 'Unknown action' };
  }
});

// Add timer
async function addTimer(timerData) {
  timers.push(timerData);
  await saveTimersToStorage();
  
  await addLogEntry({
    timerId: timerData.id,
    type: 'scheduled',
    timestamp: Date.now(),
    scheduledTime: timerData.targetTime,
    tabTitle: timerData.tabTitle,
    eventType: timerData.eventType,
    cssSelector: timerData.cssSelector,
    scheduleType: timerData.scheduleType,
    logType: 'timed-event'
  });
  
  notifyPopups('timerUpdated');
  return { success: true };
}

// Update timer
async function updateTimer(timerData) {
  const index = timers.findIndex(t => t.id === timerData.id);
  if (index !== -1) {
    timers[index] = timerData;
    await saveTimersToStorage();
    
    await addLogEntry({
      timerId: timerData.id,
      type: 'updated',
      timestamp: Date.now(),
      tabTitle: timerData.tabTitle,
      logType: 'timed-event'
    });
    
    notifyPopups('timerUpdated');
    return { success: true };
  }
  return { success: false, error: 'Timer not found' };
}

// Cancel timer
async function cancelTimer(timerId, reason) {
  const timer = timers.find(t => t.id === timerId);
  if (timer) {
    await addLogEntry({
      timerId: timerId,
      type: 'cancelled',
      timestamp: Date.now(),
      reason: reason,
      tabTitle: timer.tabTitle,
      logType: 'timed-event'
    });
  }
  
  timers = timers.filter(t => t.id !== timerId);
  await saveTimersToStorage();
  notifyPopups('timerUpdated');
  return { success: true };
}

// Add remover
async function addRemover(removerData) {
  removers.push(removerData);
  await saveRemoversToStorage();
  
  await addLogEntry({
    removerId: removerData.id,
    type: 'remover-created',
    timestamp: Date.now(),
    tabTitle: removerData.tabTitle,
    cssSelector: removerData.cssSelector,
    scope: removerData.scope,
    logType: 'element-removal'
  });
  
  await activateRemover(removerData);
  
  notifyPopups('removerUpdated');
  return { success: true };
}

// Update remover
async function updateRemover(removerData) {
  const index = removers.findIndex(r => r.id === removerData.id);
  if (index !== -1) {
    removers[index] = removerData;
    await saveRemoversToStorage();
    
    await addLogEntry({
      removerId: removerData.id,
      type: 'remover-updated',
      timestamp: Date.now(),
      tabTitle: removerData.tabTitle,
      logType: 'element-removal'
    });
    
    await activateRemover(removerData);
    
    notifyPopups('removerUpdated');
    return { success: true };
  }
  return { success: false, error: 'Remover not found' };
}

// Delete remover
async function deleteRemover(removerId) {
  const remover = removers.find(r => r.id === removerId);
  if (remover) {
    await addLogEntry({
      removerId: removerId,
      type: 'remover-deleted',
      timestamp: Date.now(),
      tabTitle: remover.tabTitle,
      logType: 'element-removal'
    });
    
    await deactivateRemover(remover);
  }
  
  removers = removers.filter(r => r.id !== removerId);
  await saveRemoversToStorage();
  notifyPopups('removerUpdated');
  return { success: true };
}

// Activate remover in content scripts
async function activateRemover(remover) {
  const tabs = await browser.tabs.query({});
  
  for (const tab of tabs) {
    if (remover.scope === 'all' || (remover.scope === 'current' && remover.tabId === tab.id)) {
      try {
        await browser.tabs.sendMessage(tab.id, {
          action: 'startElementRemover',
          remover: remover
        });
      } catch (error) {
        // Tab may not have content script
      }
    }
  }
}

// Deactivate remover in content scripts
async function deactivateRemover(remover) {
  const tabs = await browser.tabs.query({});
  
  for (const tab of tabs) {
    try {
      await browser.tabs.sendMessage(tab.id, {
        action: 'stopElementRemover',
        removerId: remover.id
      });
    } catch (error) {
      // Ignore
    }
  }
}

// Handle element removed notification
async function handleElementRemoved(removerId, count) {
  const remover = removers.find(r => r.id === removerId);
  if (remover) {
    remover.removedCount = (remover.removedCount || 0) + count;
    await saveRemoversToStorage();
    
    await addLogEntry({
      removerId: removerId,
      type: 'removed',
      timestamp: Date.now(),
      count: count,
      tabTitle: remover.tabTitle,
      cssSelector: remover.cssSelector,
      logType: 'element-removal'
    });
    
    notifyPopups('removerUpdated');
  }
  return { success: true };
}

// Clear log
async function clearLog() {
  timerLog = [];
  await saveLogToStorage();
  notifyPopups('logUpdated');
  return { success: true };
}

// Start timer checker
function startTimerChecker() {
  if (checkInterval) {
    clearInterval(checkInterval);
  }
  
  checkInterval = setInterval(async () => {
    await checkAndExecuteTimers();
  }, 1000);
}

// Check and execute timers
async function checkAndExecuteTimers() {
  const now = Date.now();

  for (const timer of timers) {
    // Skip if already executing (prevent concurrent execution)
    if (executingTimers.has(timer.id)) {
      continue;
    }

    if (timer.status === 'pending' && timer.targetTime <= now) {
      // Mark as executing
      executingTimers.add(timer.id);

      // Execute timer (don't await to allow parallel execution of different timers)
      executeTimer(timer).finally(() => {
        // Remove from executing set when done
        executingTimers.delete(timer.id);
      });
    }
  }
}

// Calculate next execution time for recurring timers
function calculateNextExecution(timer) {
  const now = Date.now();
  
  if (timer.scheduleType === 'once-off') {
    return null; // No next execution
  }
  
  if (timer.timingMethod === 'daily') {
    // Daily at specific time
    const nextDate = new Date(timer.lastExecuted || now);
    nextDate.setDate(nextDate.getDate() + 1);
    
    const [hours, minutes, seconds] = timer.dailyTime.split(':').map(Number);
    nextDate.setHours(hours, minutes, seconds, 0);
    
    return nextDate.getTime();
  }
  
  if (timer.timingMethod === 'interval') {
    // Every X hours/minutes/seconds
    const intervalMs = timer.intervalMs;
    return (timer.lastExecuted || timer.targetTime) + intervalMs;
  }
  
  return null;
}

// Check if recurring timer should continue
function shouldContinueRecurring(timer) {
  if (timer.scheduleType !== 'recurring') {
    return false;
  }
  
  // Check execution count limit
  if (timer.repeatLimit === 'times') {
    const executionCount = timer.executionCount || 0;
    if (executionCount >= timer.repeatTimes) {
      return false;
    }
  }
  
  // Check until date limit
  if (timer.repeatLimit === 'until') {
    const now = Date.now();
    if (now > timer.repeatUntilDate) {
      return false;
    }
  }
  
  return true;
}

// Execute timer
async function executeTimer(timer) {
  try {
    let tab;
    try {
      tab = await browser.tabs.get(timer.tabId);
    } catch (error) {
      timer.status = 'executed-failure';
      timer.executedAt = Date.now();
      await saveTimersToStorage();
      
      await addLogEntry({
        timerId: timer.id,
        type: 'executed',
        timestamp: Date.now(),
        status: 'failure',
        reason: 'Tab was closed',
        tabTitle: timer.tabTitle,
        logType: 'timed-event'
      });
      
      if (settings.notifyFailure) {
        await showNotification(
          'Timer Cancelled',
          `Timer cancelled - tab was closed: ${timer.tabTitle}`
        );
      }
      notifyPopups('timerExecuted');
      return;
    }
    
    // Switch to the tab
    await browser.tabs.update(timer.tabId, { active: true });
    await browser.windows.update(tab.windowId, { focused: true });
    
    const urlChanged = tab.url !== timer.originalUrl;
    
    if (urlChanged && timer.urlBehavior === 'cancel') {
      timer.status = 'executed-failure';
      timer.executedAt = Date.now();
      await saveTimersToStorage();
      
      await addLogEntry({
        timerId: timer.id,
        type: 'cancelled',
        timestamp: Date.now(),
        reason: 'URL changed',
        tabTitle: timer.tabTitle,
        logType: 'timed-event'
      });
      
      if (settings.notifyFailure) {
        await showNotification(
          'Timer Cancelled',
          `Timer cancelled - URL changed on: ${timer.tabTitle}`
        );
      }
      notifyPopups('timerExecuted');
      return;
    }
    
    let targetTab = tab;
    
    if (urlChanged && timer.urlBehavior === 'new-tab') {
      targetTab = await browser.tabs.create({
        url: timer.originalUrl,
        active: true
      });
      await waitForTabLoad(targetTab.id);
    } else if (urlChanged && timer.urlBehavior === 'navigate') {
      await browser.tabs.update(timer.tabId, { url: timer.originalUrl });
      await waitForTabLoad(timer.tabId);
      targetTab = await browser.tabs.get(timer.tabId);
    }
    
    // Wait a moment for tab to be active
    await sleep(500);
    
    let success = false;
    
    if (timer.eventType === 'click') {
      success = await clickElementWithRetry(targetTab.id, timer.cssSelector);
    } else if (timer.eventType === 'enterText') {
      success = await enterTextInElement(targetTab.id, timer.cssSelector, timer.textToEnter, {
        textEntryMethod: timer.textEntryMethod || 'keystroke',
        clearBeforeTyping: timer.clearBeforeTyping,
        triggerEvents: timer.triggerEvents !== false,
        typingSpeed: settings.typingSpeed,
        postTextEntryDelay: settings.postTextEntryDelay,
        triggerFocusBlur: settings.triggerFocusBlur
      });
    } else if (timer.eventType === 'keyPress') {
      success = await pressKeyOnElement(targetTab.id, timer.cssSelector, timer.keyPress);
    }
    
    if (success) {
      // Update execution tracking
      timer.lastExecuted = Date.now();
      timer.executionCount = (timer.executionCount || 0) + 1;
      
      // Check if this is a recurring timer
      if (timer.scheduleType === 'recurring' && shouldContinueRecurring(timer)) {
        // Schedule next execution
        const nextTime = calculateNextExecution(timer);
        if (nextTime) {
          timer.targetTime = nextTime;
          timer.status = 'pending';
        } else {
          timer.status = 'executed-success';
        }
      } else {
        timer.status = 'executed-success';
        timer.executedAt = Date.now();
      }
      
      await addLogEntry({
        timerId: timer.id,
        type: 'executed',
        timestamp: Date.now(),
        status: 'success',
        tabTitle: timer.tabTitle,
        eventType: timer.eventType,
        logType: 'timed-event'
      });
      
      if (settings.notifySuccess) {
        const actionText = timer.eventType === 'enterText' ? 'Entered text on' : 
                          timer.eventType === 'keyPress' ? 'Pressed key on' : 'Clicked element on';
        await showNotification(
          'Timer Executed Successfully',
          `${actionText}: ${timer.tabTitle}`
        );
      }
    } else {
      timer.status = 'executed-failure';
      timer.executedAt = Date.now();
      
      await addLogEntry({
        timerId: timer.id,
        type: 'executed',
        timestamp: Date.now(),
        status: 'failure',
        reason: 'Element not found after retries',
        tabTitle: timer.tabTitle,
        logType: 'timed-event'
      });
      
      if (settings.notifyFailure) {
        const actionText = timer.eventType === 'enterText' ? 'input field' : 'element';
        await showNotification(
          'Element Not Found',
          `Could not find ${actionText} on: ${timer.tabTitle}`
        );
      }
    }
    
    await saveTimersToStorage();
    notifyPopups('timerExecuted');
    
  } catch (error) {
    console.error('Error executing timer:', error);
    timer.status = 'executed-failure';
    timer.executedAt = Date.now();
    await saveTimersToStorage();
    
    await addLogEntry({
      timerId: timer.id,
      type: 'executed',
      timestamp: Date.now(),
      status: 'failure',
      reason: 'Execution error',
      tabTitle: timer.tabTitle,
      logType: 'timed-event'
    });
    
    if (settings.notifyFailure) {
      await showNotification(
        'Timer Execution Failed',
        `Error executing timer on: ${timer.tabTitle}`
      );
    }
    notifyPopups('timerExecuted');
  }
}

// Click element with retry logic
async function clickElementWithRetry(tabId, cssSelector) {
  const scrollDelay = settings.scrollDelay * 1000;
  const refreshOnFail = settings.refreshOnElementNotFound;

  // First attempt - check if element exists
  let checkResult = await checkElement(tabId, cssSelector);

  if (!checkResult.exists) {
    // Scroll down and wait
    await scrollDown(tabId);
    await sleep(scrollDelay);

    // Check again
    checkResult = await checkElement(tabId, cssSelector);

    if (!checkResult.exists && refreshOnFail) {
      // Refresh the page
      await browser.tabs.reload(tabId);
      await waitForTabLoad(tabId);

      // Check after refresh
      checkResult = await checkElement(tabId, cssSelector);

      if (!checkResult.exists) {
        // Scroll down again and wait
        await scrollDown(tabId);
        await sleep(scrollDelay);

        // Final check
        checkResult = await checkElement(tabId, cssSelector);
      }
    }
  }

  if (!checkResult.exists) {
    return false;
  }

  // Element found, now click it
  try {
    const response = await browser.tabs.sendMessage(tabId, {
      action: 'clickElement',
      selector: cssSelector,
      options: {}
    });

    return response && response.success;
  } catch (error) {
    console.error('Error clicking element:', error);
    // Check if error is due to content script not being injected
    if (error.message && error.message.includes('Could not establish connection')) {
      console.error('Content script may not be injected yet. Trying to wait...');
      // Wait a bit and retry once
      await new Promise(resolve => setTimeout(resolve, 2000));
      try {
        const retryResponse = await browser.tabs.sendMessage(tabId, {
          action: 'clickElement',
          selector: cssSelector
        });
        return retryResponse && retryResponse.success;
      } catch (retryError) {
        console.error('Retry also failed:', retryError);
        return false;
      }
    }
    return false;
  }
}

// Check if element exists
async function checkElement(tabId, cssSelector) {
  try {
    const response = await browser.tabs.sendMessage(tabId, {
      action: 'checkElement',
      selector: cssSelector
    });
    
    return response;
  } catch (error) {
    console.error('Error checking element:', error);
    return { success: false, exists: false };
  }
}

// Scroll down
async function scrollDown(tabId) {
  try {
    await browser.tabs.sendMessage(tabId, {
      action: 'scrollDown',
      amount: 500
    });
  } catch (error) {
    console.error('Error scrolling:', error);
  }
}

// Enter text in element
async function enterTextInElement(tabId, cssSelector, text, settings) {
  try {
    const response = await browser.tabs.sendMessage(tabId, {
      action: 'enterText',
      selector: cssSelector,
      text: text,
      settings: settings
    });

    return response && response.success;
  } catch (error) {
    console.error('Error entering text:', error);
    // Check if error is due to content script not being injected
    if (error.message && error.message.includes('Could not establish connection')) {
      console.error('Content script may not be injected yet. Trying to wait...');
      // Wait a bit and retry once
      await new Promise(resolve => setTimeout(resolve, 2000));
      try {
        const retryResponse = await browser.tabs.sendMessage(tabId, {
          action: 'enterText',
          selector: cssSelector,
          text: text,
          settings: settings
        });
        return retryResponse && retryResponse.success;
      } catch (retryError) {
        console.error('Retry also failed:', retryError);
        return false;
      }
    }
    return false;
  }
}

// Press key on element
async function pressKeyOnElement(tabId, cssSelector, keyPress) {
  try {
    const response = await browser.tabs.sendMessage(tabId, {
      action: 'pressKey',
      selector: cssSelector,
      keyPress: keyPress
    });
    
    return response && response.success;
  } catch (error) {
    console.error('Error pressing key:', error);
    return false;
  }
}

// Wait for tab to load
function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        browser.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 1000);
      }
    };
    
    browser.tabs.onUpdated.addListener(listener);
    
    setTimeout(() => {
      browser.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 30000);
  });
}

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Show notification
async function showNotification(title, message) {
  try {
    await browser.notifications.create({
      type: 'basic',
      iconUrl: browser.runtime.getURL('icons/icon-48.png'),
      title: title,
      message: message
    });
  } catch (error) {
    console.error('Error showing notification:', error);
  }
}

// Notify popups
function notifyPopups(action) {
  browser.runtime.sendMessage({ action: action }).catch(() => {});
}

// Handle tab closure
browser.tabs.onRemoved.addListener(async (tabId) => {
  const removedTimers = timers.filter(timer => timer.tabId === tabId);
  
  for (const timer of removedTimers) {
    if (timer.status === 'pending') {
      await addLogEntry({
        timerId: timer.id,
        type: 'cancelled',
        timestamp: Date.now(),
        reason: 'Tab closed',
        tabTitle: timer.tabTitle,
        logType: 'timed-event'
      });
    }
  }
  
  const initialTimerLength = timers.length;
  timers = timers.filter(timer => {
    if (timer.tabId === tabId && timer.persistence === 'session') {
      return false;
    }
    return true;
  });
  
  const initialRemoverLength = removers.length;
  removers = removers.filter(remover => {
    if (remover.scope === 'current' && remover.tabId === tabId && remover.persistence === 'session') {
      return false;
    }
    return true;
  });
  
  if (timers.length !== initialTimerLength) {
    await saveTimersToStorage();
    notifyPopups('timerUpdated');
  }
  
  if (removers.length !== initialRemoverLength) {
    await saveRemoversToStorage();
    notifyPopups('removerUpdated');
  }
});

// Handle tab URL changes
browser.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.url) {
    notifyPopups('timerUpdated');
  }
  
  if (changeInfo.status === 'complete') {
    // Reinitialize removers for this tab
    const applicableRemovers = removers.filter(r => {
      if (r.scope === 'all') return true;
      if (r.scope === 'current' && r.tabId === tabId) return true;
      return false;
    });
    
    if (applicableRemovers.length > 0) {
      try {
        await browser.tabs.sendMessage(tabId, {
          action: 'updateElementRemovers',
          removers: applicableRemovers
        });
      } catch (error) {
        // Content script may not be ready yet
      }
    }
  }
});

// Handle new tabs for "all tabs" removers
browser.tabs.onCreated.addListener(async (tab) => {
  const allTabsRemovers = removers.filter(r => r.scope === 'all');
  
  if (allTabsRemovers.length > 0) {
    // Wait for tab to load
    setTimeout(async () => {
      try {
        await browser.tabs.sendMessage(tab.id, {
          action: 'updateElementRemovers',
          removers: allTabsRemovers
        });
      } catch (error) {
        // Content script may not be loaded yet
      }
    }, 2000);
  }
});

// Clean up on browser shutdown
browser.runtime.onSuspend?.addListener(async () => {
  timers = timers.filter(t => t.persistence !== 'session');
  removers = removers.filter(r => r.persistence !== 'session');
  await saveTimersToStorage();
  await saveRemoversToStorage();
});