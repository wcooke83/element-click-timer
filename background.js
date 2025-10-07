// Timer storage
let timers = [];
let checkInterval = null;

// Initialize on startup
browser.runtime.onStartup.addListener(async () => {
  await loadTimersFromStorage();
  startTimerChecker();
});

// Initialize on install
browser.runtime.onInstalled.addListener(async () => {
  await loadTimersFromStorage();
  startTimerChecker();
});

// Load timers from storage on script load
(async () => {
  await loadTimersFromStorage();
  startTimerChecker();
})();

// Load timers from browser storage
async function loadTimersFromStorage() {
  try {
    // Load from local storage (persistent)
    const localData = await browser.storage.local.get('timers');
    const persistentTimers = localData.timers || [];
    
    // Load from session storage (session only)
    const sessionData = await browser.storage.session?.get('timers') || { timers: [] };
    const sessionTimers = sessionData.timers || [];
    
    // Combine timers
    timers = [...persistentTimers, ...sessionTimers];
    
    // Clean up expired or invalid timers
    timers = timers.filter(timer => {
      // Remove executed timers older than 1 hour
      if (timer.status !== 'pending' && Date.now() - timer.targetTime > 3600000) {
        return false;
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
    case 'cancelTimer':
      return await cancelTimer(message.timerId);
    case 'getTimers':
      return { timers: timers };
    case 'clickResult':
      return await handleClickResult(message.timerId, message.success);
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
    if (timer.status === 'pending' && timer.targetTime <= now) {
      await executeTimer(timer);
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
      await saveTimersToStorage();
      await showNotification(
        'Timer Cancelled',
        `Timer cancelled - tab was closed: ${timer.tabTitle}`
      );
      notifyPopups('timerExecuted');
      return;
    }
    
    // Check URL change behavior
    const urlChanged = tab.url !== timer.originalUrl;
    
    if (urlChanged && timer.urlBehavior === 'cancel') {
      // Cancel timer if URL changed and behavior is "don't run"
      timer.status = 'executed-failure';
      await saveTimersToStorage();
      await showNotification(
        'Timer Cancelled',
        `Timer cancelled - URL changed on: ${timer.tabTitle}`
      );
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
    
    // Execute click on the target tab
    const success = await clickElement(targetTab.id, timer.cssSelector);
    
    if (success) {
      timer.status = 'executed-success';
      await showNotification(
        'Timer Executed Successfully',
        `Clicked element on: ${timer.tabTitle}`
      );
    } else {
      timer.status = 'executed-failure';
      await showNotification(
        'Element Not Found',
        `Could not find element on: ${timer.tabTitle}`
      );
    }
    
    await saveTimersToStorage();
    notifyPopups('timerExecuted');
    
  } catch (error) {
    console.error('Error executing timer:', error);
    timer.status = 'executed-failure';
    await saveTimersToStorage();
    await showNotification(
      'Timer Execution Failed',
      `Error executing timer on: ${timer.tabTitle}`
    );
    notifyPopups('timerExecuted');
  }
}

// Wait for tab to finish loading
function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        browser.tabs.onUpdated.removeListener(listener);
        // Add extra delay to ensure page is fully ready
        setTimeout(resolve, 1000);
      }
    };
    
    browser.tabs.onUpdated.addListener(listener);
    
    // Timeout after 30 seconds
    setTimeout(() => {
      browser.tabs.onUpdated.removeListener(listener);
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