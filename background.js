// Timer storage
let timers = [];
let checkInterval = null;
let autoDeleteInterval = null;
let settings = {};
let isInitialized = false;
let executingTimers = new Set(); // Track timers currently being executed

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

// Initialize extension (called once)
async function initialize() {
  if (isInitialized) {
    console.log('Extension already initialized, skipping...');
    return;
  }

  isInitialized = true;
  console.log('Initializing extension...');

  await loadSettings();
  await loadTimersFromStorage();
  startTimerChecker();
  startAutoDeleteChecker();
}

// Initialize on startup
browser.runtime.onStartup.addListener(async () => {
  await initialize();
});

// Initialize on install
browser.runtime.onInstalled.addListener(async () => {
  await initialize();
});

// Load on script load
(async () => {
  await initialize();
})();

// Load settings from storage
async function loadSettings() {
  try {
    const data = await browser.storage.local.get('settings');
    settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  } catch (error) {
    console.error('Error loading settings:', error);
    settings = { ...DEFAULT_SETTINGS };
  }
}

// Load timers from browser storage
async function loadTimersFromStorage() {
  try {
    // Load from local storage (persistent)
    const localData = await browser.storage.local.get('timers');
    const persistentTimers = localData.timers || [];

    // Load from session storage (session only)
    let sessionTimers = [];
    if (browser.storage.session) {
      const sessionData = await browser.storage.session.get('timers');
      sessionTimers = sessionData?.timers || [];
    }

    // Combine timers
    timers = [...persistentTimers, ...sessionTimers];
    
    // Clean up expired or invalid timers
    timers = timers.filter(timer => {
      // Keep pending timers
      if (timer.status === 'pending') {
        return true;
      }
      
      // Remove old executed timers based on auto-delete setting
      if (timer.status !== 'pending') {
        return !shouldAutoDelete(timer);
      }
      
      return true;
    });
    
    // Check if tabs still exist for 'tab' persistence timers
    for (const timer of timers) {
      if (timer.persistence === 'tab' || timer.persistence === 'session') {
        try {
          await browser.tabs.get(timer.tabId);
        } catch (error) {
          // Tab doesn't exist, mark for removal
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

// Check if a timer should be auto-deleted
function shouldAutoDelete(timer) {
  // Use executedAt if exists, otherwise use targetTime as fallback (without modifying timer)
  const executionTime = timer.executedAt || timer.targetTime;

  const now = Date.now();
  const timeSinceExecution = now - executionTime;

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
  // Clear existing interval if any
  if (autoDeleteInterval) {
    clearInterval(autoDeleteInterval);
  }

  // Check every minute for timers to auto-delete
  autoDeleteInterval = setInterval(async () => {
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
  }, 60000); // Check every minute
}

// Save timers to storage based on persistence level
async function saveTimersToStorage() {
  try {
    // Separate timers by persistence level
    const browserPersistentTimers = timers.filter(t => t.persistence === 'browser');
    const tabPersistentTimers = timers.filter(t => t.persistence === 'tab');
    const sessionTimers = timers.filter(t => t.persistence === 'session');
    
    // Save browser-persistent and tab-persistent timers to local storage
    await browser.storage.local.set({
      timers: [...browserPersistentTimers, ...tabPersistentTimers]
    });
    
    // Save session-only timers to session storage if available
    if (browser.storage.session) {
      await browser.storage.session.set({ timers: sessionTimers });
    }
  } catch (error) {
    console.error('Error saving timers:', error);
  }
}

// Message handler
browser.runtime.onMessage.addListener(async (message, sender) => {
  switch (message.action) {
    case 'addTimer':
      return await addTimer(message.timer);
    case 'updateTimer':
      return await updateTimer(message.timer);
    case 'updateAllTimers':
      return await updateAllTimers(message.timers);
    case 'cancelTimer':
      return await cancelTimer(message.timerId);
    case 'getTimers':
      return { timers: timers };
    case 'settingsUpdated':
      settings = message.settings;
      await loadSettings(); // Reload to ensure consistency
      return { success: true };
    default:
      return { success: false, error: 'Unknown action' };
  }
});

// Add new timer
async function addTimer(timerData) {
  timers.push(timerData);
  await saveTimersToStorage();
  notifyPopups('timerUpdated');
  return { success: true };
}

// Update existing timer
async function updateTimer(timerData) {
  const index = timers.findIndex(t => t.id === timerData.id);
  if (index !== -1) {
    timers[index] = timerData;
    await saveTimersToStorage();
    notifyPopups('timerUpdated');
    return { success: true };
  }
  return { success: false, error: 'Timer not found' };
}

// Update all timers (for applying default settings)
async function updateAllTimers(updatedTimers) {
  timers = updatedTimers;
  await saveTimersToStorage();
  notifyPopups('timerUpdated');
  return { success: true };
}

// Cancel timer
async function cancelTimer(timerId) {
  timers = timers.filter(t => t.id !== timerId);
  await saveTimersToStorage();
  notifyPopups('timerUpdated');
  return { success: true };
}

// Start checking timers periodically
function startTimerChecker() {
  if (checkInterval) {
    clearInterval(checkInterval);
  }
  
  // Check every 1 second
  checkInterval = setInterval(async () => {
    await checkAndExecuteTimers();
  }, 1000);
}

// Check if any timers should fire and execute them
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

// Execute a timer
async function executeTimer(timer) {
  try {
    // Check if tab still exists
    let tab;
    try {
      tab = await browser.tabs.get(timer.tabId);
    } catch (error) {
      // Tab doesn't exist
      timer.status = 'executed-failure';
      timer.executedAt = Date.now();
      await saveTimersToStorage();
      
      if (settings.notifyFailure) {
        await showNotification(
          'Timer Cancelled',
          `Timer cancelled - tab was closed: ${timer.tabTitle}`
        );
      }
      notifyPopups('timerExecuted');
      return;
    }
    
    // Check URL change behavior
    const urlChanged = tab.url !== timer.originalUrl;
    
    if (urlChanged && timer.urlBehavior === 'cancel') {
      // Cancel timer if URL changed and behavior is "don't run"
      timer.status = 'executed-failure';
      timer.executedAt = Date.now();
      await saveTimersToStorage();
      
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
      // Open original URL in new tab
      targetTab = await browser.tabs.create({
        url: timer.originalUrl,
        active: false
      });
      
      // Wait for page to load
      await waitForTabLoad(targetTab.id);
    } else if (urlChanged && timer.urlBehavior === 'navigate') {
      // Navigate existing tab to original URL
      await browser.tabs.update(timer.tabId, { url: timer.originalUrl });
      
      // Wait for page to load
      await waitForTabLoad(timer.tabId);
      targetTab = await browser.tabs.get(timer.tabId);
    }
    
    // Execute action based on event type
    let success = false;
    
    if (timer.eventType === 'click') {
      success = await clickElement(targetTab.id, timer.cssSelector);
    } else if (timer.eventType === 'enterText') {
      success = await enterTextInElement(targetTab.id, timer.cssSelector, timer.textToEnter, {
        clearBeforeTyping: timer.clearBeforeTyping,
        typingSpeed: settings.typingSpeed,
        postTextEntryDelay: settings.postTextEntryDelay,
        triggerFocusBlur: settings.triggerFocusBlur
      });
    }
    
    if (success) {
      timer.status = 'executed-success';
      timer.executedAt = Date.now();
      
      if (settings.notifySuccess) {
        const actionText = timer.eventType === 'enterText' ? 'Entered text on' : 'Clicked element on';
        await showNotification(
          'Timer Executed Successfully',
          `${actionText}: ${timer.tabTitle}`
        );
      }
    } else {
      timer.status = 'executed-failure';
      timer.executedAt = Date.now();
      
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
    
    if (settings.notifyFailure) {
      await showNotification(
        'Timer Execution Failed',
        `Error executing timer on: ${timer.tabTitle}`
      );
    }
    notifyPopups('timerExecuted');
  }
}

// Wait for tab to finish loading
function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    let timeoutId = null;
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        browser.tabs.onUpdated.removeListener(listener);
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    };

    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        cleanup();
        // Add extra delay to ensure page is fully ready
        setTimeout(resolve, 1000);
      }
    };

    browser.tabs.onUpdated.addListener(listener);

    // Timeout after 30 seconds
    timeoutId = setTimeout(() => {
      cleanup();
      resolve();
    }, 30000);
  });
}

// Click element via content script
async function clickElement(tabId, cssSelector) {
  try {
    const response = await browser.tabs.sendMessage(tabId, {
      action: 'clickElement',
      selector: cssSelector
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

// Enter text into element via content script
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

// Show browser notification
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

// Notify all open popups
function notifyPopups(action) {
  browser.runtime.sendMessage({ action: action }).catch(() => {
    // Ignore errors if no popup is open
  });
}

// Handle tab closure
browser.tabs.onRemoved.addListener(async (tabId) => {
  // Remove session-only timers for this tab
  const initialLength = timers.length;
  timers = timers.filter(timer => {
    if (timer.tabId === tabId && timer.persistence === 'session') {
      return false;
    }
    return true;
  });
  
  if (timers.length !== initialLength) {
    await saveTimersToStorage();
    notifyPopups('timerUpdated');
  }
});

// Handle tab URL changes for monitoring
browser.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.url) {
    // Notify popups that URL may have changed
    notifyPopups('timerUpdated');
  }
});

// Clean up on browser shutdown
browser.runtime.onSuspend?.addListener(async () => {
  // Remove session-only timers
  timers = timers.filter(t => t.persistence !== 'session');
  await saveTimersToStorage();
});