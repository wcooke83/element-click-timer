// content.js - Content script for browser extension to automate web interactions

// Active element removers (persistent delete rules)
let activeRemovers = [];

// Listen for messages from background script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'clickElement') {
    clickElement(message.selector, message.options || {}).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async response
  } else if (message.action === 'enterText') {
    enterText(message.selector, message.text, message.settings).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  } else if (message.action === 'pressKey') {
    pressKey(message.selector, message.keyPress).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  } else if (message.action === 'checkElement') {
    const result = checkElementExists(message.selector);
    sendResponse(result);
    return true;
  } else if (message.action === 'scrollDown') {
    scrollDown(message.amount || 500);
    sendResponse({ success: true });
    return true;
  } else if (message.action === 'startElementRemover') {
    startElementRemover(message.remover);
    sendResponse({ success: true });
    return true;
  } else if (message.action === 'stopElementRemover') {
    stopElementRemover(message.removerId);
    sendResponse({ success: true });
    return true;
  } else if (message.action === 'updateElementRemovers') {
    activeRemovers = message.removers || [];
    initializeElementRemovers();
    sendResponse({ success: true });
    return true;
  }
});

// Check if element exists
function checkElementExists(selector) {
  try {
    const elements = document.querySelectorAll(selector);
    return {
      success: true,
      exists: elements.length > 0,
      count: elements.length
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Scroll down the page
function scrollDown(amount) {
  window.scrollBy({ top: amount, behavior: 'smooth' });
}

// Click element with retry logic
async function clickElement(selector, options = {}) {
  const {
    maxRetries = 0,
    scrollOnFail = false,
    scrollDelay = 5000,
    refreshOnFail = false
  } = options;

  try {
    let elements = document.querySelectorAll(selector);

    // Initial check
    if (elements.length === 0) {
      if (!scrollOnFail && !refreshOnFail) {
        console.log(`No elements found matching selector: ${selector}`);
        return { success: false, error: 'Element not found' };
      }
      
      // Try scrolling
      if (scrollOnFail) {
        scrollDown(500);
        await sleep(scrollDelay);
        elements = document.querySelectorAll(selector);
      }
      
      // If still not found and refresh is enabled
      if (elements.length === 0 && refreshOnFail) {
        return { success: false, error: 'Element not found', shouldRefresh: true };
      }
      
      // Try scrolling again after refresh (handled by background.js)
      if (elements.length === 0 && scrollOnFail) {
        scrollDown(500);
        await sleep(scrollDelay);
        elements = document.querySelectorAll(selector);
      }
      
      if (elements.length === 0) {
        return { success: false, error: 'Element not found after retries' };
      }
    }

    const element = elements[0];

    // Check if element is visible and clickable
    if (!isElementClickable(element)) {
      console.log(`Element found but not clickable: ${selector}`);
    }

    // Scroll element into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Wait a moment for scroll, then click
    await sleep(300);

    try {
      // Try multiple click methods for better compatibility

      // Method 1: Direct click
      element.click();

      // Method 2: MouseEvent (if direct click doesn't work)
      const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
      });
      element.dispatchEvent(clickEvent);

      console.log(`Successfully clicked element: ${selector}`);
      return { success: true };
    } catch (clickError) {
      console.error(`Error during click: ${clickError}`);
      return { success: false, error: clickError.message };
    }

  } catch (error) {
    console.error(`Error clicking element: ${error}`);
    return { success: false, error: error.message };
  }
}

// Press key on element
async function pressKey(selector, keyPress) {
  try {
    const elements = document.querySelectorAll(selector);
    
    if (elements.length === 0) {
      console.log(`No elements found matching selector: ${selector}`);
      return { success: false, error: 'Element not found' };
    }
    
    const element = elements[0];
    
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(300);
    
    // Focus the element
    element.focus();
    
    // Parse key press (format: "Ctrl+Shift+A" or just "Enter")
    const parts = keyPress.split('+').map(p => p.trim());
    const modifiers = {
      ctrl: false,
      alt: false,
      shift: false,
      meta: false
    };
    
    let key = '';
    
    for (const part of parts) {
      const lower = part.toLowerCase();
      if (lower === 'ctrl' || lower === 'control') {
        modifiers.ctrl = true;
      } else if (lower === 'alt') {
        modifiers.alt = true;
      } else if (lower === 'shift') {
        modifiers.shift = true;
      } else if (lower === 'meta' || lower === 'cmd' || lower === 'command') {
        modifiers.meta = true;
      } else {
        key = part;
      }
    }
    
    // Map common key names
    const keyMap = {
      'enter': 'Enter',
      'return': 'Enter',
      'tab': 'Tab',
      'escape': 'Escape',
      'esc': 'Escape',
      'space': ' ',
      'spacebar': ' ',
      'backspace': 'Backspace',
      'delete': 'Delete',
      'del': 'Delete',
      'arrowup': 'ArrowUp',
      'arrowdown': 'ArrowDown',
      'arrowleft': 'ArrowLeft',
      'arrowright': 'ArrowRight',
      'up': 'ArrowUp',
      'down': 'ArrowDown',
      'left': 'ArrowLeft',
      'right': 'ArrowRight',
      'home': 'Home',
      'end': 'End',
      'pageup': 'PageUp',
      'pagedown': 'PageDown'
    };
    
    const mappedKey = keyMap[key.toLowerCase()] || key;
    
    // Create and dispatch key events
    const keydownEvent = new KeyboardEvent('keydown', {
      key: mappedKey,
      code: mappedKey,
      ctrlKey: modifiers.ctrl,
      altKey: modifiers.alt,
      shiftKey: modifiers.shift,
      metaKey: modifiers.meta,
      bubbles: true,
      cancelable: true
    });
    
    const keypressEvent = new KeyboardEvent('keypress', {
      key: mappedKey,
      code: mappedKey,
      ctrlKey: modifiers.ctrl,
      altKey: modifiers.alt,
      shiftKey: modifiers.shift,
      metaKey: modifiers.meta,
      bubbles: true,
      cancelable: true
    });
    
    const keyupEvent = new KeyboardEvent('keyup', {
      key: mappedKey,
      code: mappedKey,
      ctrlKey: modifiers.ctrl,
      altKey: modifiers.alt,
      shiftKey: modifiers.shift,
      metaKey: modifiers.meta,
      bubbles: true,
      cancelable: true
    });
    
    element.dispatchEvent(keydownEvent);
    element.dispatchEvent(keypressEvent);
    element.dispatchEvent(keyupEvent);
    
    console.log(`Successfully pressed key: ${keyPress} on ${selector}`);
    return { success: true };
    
  } catch (error) {
    console.error(`Error pressing key: ${error}`);
    return { success: false, error: error.message };
  }
}

// Enter text into an input/textarea element
async function enterText(selector, text, settings) {
  try {
    const elements = document.querySelectorAll(selector);
    
    if (elements.length === 0) {
      console.log(`No elements found matching selector: ${selector}`);
      return { success: false, error: 'Element not found' };
    }
    
    const element = elements[0];
    const method = settings.textEntryMethod || 'keystroke';
    
    if (!isTextInputElement(element)) {
      console.log(`Element is not a text input: ${selector}`);
      return { success: false, error: 'Element is not a text input field' };
    }
    
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(300);
    
    if (method === 'keystroke') {
      return await enterTextViaKeystroke(element, text, settings);
    } else if (method === 'setValue') {
      return await enterTextViaSetValue(element, text, settings);
    } else if (method === 'setInnerHTML') {
      return await enterTextViaSetInnerHTML(element, text, settings);
    }

    return { success: false, error: 'Unknown text entry method' };

  } catch (error) {
    console.error(`Error entering text: ${error}`);
    return { success: false, error: error.message };
  }
}

// Enter text via keystroke emulation
async function enterTextViaKeystroke(element, text, settings) {
  if (settings.triggerFocusBlur) {
    element.focus();
    const focusEvent = new FocusEvent('focus', { bubbles: true });
    element.dispatchEvent(focusEvent);
    await sleep(100);
  }
  
  if (settings.clearBeforeTyping) {
    element.value = '';
    const inputEvent = new Event('input', { bubbles: true });
    element.dispatchEvent(inputEvent);
  }
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    element.value += char;
    
    const inputEvent = new Event('input', { bubbles: true });
    element.dispatchEvent(inputEvent);
    
    const keydownEvent = new KeyboardEvent('keydown', {
      key: char,
      bubbles: true,
      cancelable: true
    });
    element.dispatchEvent(keydownEvent);
    
    const keypressEvent = new KeyboardEvent('keypress', {
      key: char,
      bubbles: true,
      cancelable: true
    });
    element.dispatchEvent(keypressEvent);
    
    const keyupEvent = new KeyboardEvent('keyup', {
      key: char,
      bubbles: true,
      cancelable: true
    });
    element.dispatchEvent(keyupEvent);
    
    await sleep(settings.typingSpeed);
  }
  
  const finalInputEvent = new Event('input', { bubbles: true });
  element.dispatchEvent(finalInputEvent);
  
  const changeEvent = new Event('change', { bubbles: true });
  element.dispatchEvent(changeEvent);
  
  if (settings.postTextEntryDelay > 0) {
    await sleep(settings.postTextEntryDelay);
  }
  
  if (settings.triggerFocusBlur) {
    element.blur();
    const blurEvent = new FocusEvent('blur', { bubbles: true });
    element.dispatchEvent(blurEvent);
  }
  
  console.log(`Successfully entered text via keystroke: ${text.substring(0, 20)}...`);
  return { success: true };
}

// Enter text via .value property
async function enterTextViaSetValue(element, text, settings) {
  if (settings.triggerFocusBlur) {
    element.focus();
    const focusEvent = new FocusEvent('focus', { bubbles: true });
    element.dispatchEvent(focusEvent);
    await sleep(100);
  }
  
  if (settings.clearBeforeTyping) {
    element.value = text;
  } else {
    element.value += text;
  }
  
  if (settings.triggerEvents) {
    const inputEvent = new Event('input', { bubbles: true });
    element.dispatchEvent(inputEvent);
    
    const changeEvent = new Event('change', { bubbles: true });
    element.dispatchEvent(changeEvent);
  }
  
  if (settings.postTextEntryDelay > 0) {
    await sleep(settings.postTextEntryDelay);
  }
  
  if (settings.triggerFocusBlur) {
    element.blur();
    const blurEvent = new FocusEvent('blur', { bubbles: true });
    element.dispatchEvent(blurEvent);
  }
  
  console.log(`Successfully set value: ${text.substring(0, 20)}...`);
  return { success: true };
}

// Enter text via .innerHTML property
async function enterTextViaSetInnerHTML(element, text, settings) {
  if (settings.triggerFocusBlur) {
    element.focus();
    const focusEvent = new FocusEvent('focus', { bubbles: true });
    element.dispatchEvent(focusEvent);
    await sleep(100);
  }
  
  if (settings.clearBeforeTyping) {
    element.innerHTML = text;
  } else {
    element.innerHTML += text;
  }
  
  if (settings.triggerEvents) {
    const inputEvent = new Event('input', { bubbles: true });
    element.dispatchEvent(inputEvent);
    
    const changeEvent = new Event('change', { bubbles: true });
    element.dispatchEvent(changeEvent);
  }
  
  if (settings.postTextEntryDelay > 0) {
    await sleep(settings.postTextEntryDelay);
  }
  
  if (settings.triggerFocusBlur) {
    element.blur();
    const blurEvent = new FocusEvent('blur', { bubbles: true });
    element.dispatchEvent(blurEvent);
  }
  
  console.log(`Successfully set innerHTML: ${text.substring(0, 20)}...`);
  return { success: true };
}

// Element Remover functionality
function startElementRemover(remover) {
  // Stop existing remover with same ID if any
  stopElementRemover(remover.id);
  
  if (!activeRemovers.find(r => r.id === remover.id)) {
    activeRemovers.push(remover);
  }
  
  processElementRemover(remover);
}

function stopElementRemover(removerId) {
  const remover = activeRemovers.find(r => r.id === removerId);
  if (remover && remover.observer) {
    remover.observer.disconnect();
  }
  activeRemovers = activeRemovers.filter(r => r.id !== removerId);
}

function initializeElementRemovers() {
  activeRemovers.forEach(remover => {
    processElementRemover(remover);
  });
}

function processElementRemover(remover) {
  // Disconnect existing observer if any
  if (remover.observer) {
    remover.observer.disconnect();
  }
  
  // Create new MutationObserver to watch for DOM changes
  const observer = new MutationObserver((mutations) => {
    // Check and remove elements when DOM changes
    removeElements(remover.cssSelector, remover.id);
  });
  
  // Start observing the entire document for changes
  observer.observe(document.body, {
    childList: true,      // Watch for added/removed nodes
    subtree: true,        // Watch all descendants
    attributes: false,    // Don't watch attribute changes (performance)
    characterData: false  // Don't watch text content changes (performance)
  });
  
  // Initial removal of any existing elements
  removeElements(remover.cssSelector, remover.id);
  
  // Store observer reference
  remover.observer = observer;
  
  console.log(`Element remover initialized for selector: ${remover.cssSelector}`);
}

function removeElements(selector, removerId) {
  try {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      let removed = 0;
      elements.forEach(el => {
        el.remove();
        removed++;
      });
      
      console.log(`Removed ${removed} element(s) matching: ${selector}`);
      
      // Notify background script
      browser.runtime.sendMessage({
        action: 'elementRemoved',
        removerId: removerId,
        count: removed
      }).catch(() => {
        // Extension context may be invalidated
      });
    }
  } catch (error) {
    console.error(`Error removing elements: ${error}`);
  }
}

// Check if element is visible and clickable
function isElementClickable(element) {
  if (!element) return false;
  
  const style = window.getComputedStyle(element);
  
  if (style.display === 'none' || 
      style.visibility === 'hidden' || 
      style.opacity === '0') {
    return false;
  }
  
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return false;
  }
  
  return true;
}

// Check if element is a text input field
function isTextInputElement(element) {
  if (!element) return false;
  
  const tagName = element.tagName.toLowerCase();
  
  if (tagName === 'textarea') {
    return true;
  }
  
  if (tagName === 'input') {
    const type = (element.type || 'text').toLowerCase();
    const textTypes = [
      'text', 'password', 'email', 'search', 'tel', 
      'url', 'number', 'date', 'datetime-local', 
      'month', 'time', 'week'
    ];
    return textTypes.includes(type);
  }
  
  if (element.isContentEditable) {
    return true;
  }
  
  return false;
}

// Helper function to sleep/wait
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Initialize on page load
(async () => {
  try {
    const response = await browser.runtime.sendMessage({ action: 'getActiveRemovers' });
    if (response && response.removers) {
      activeRemovers = response.removers;
      initializeElementRemovers();
    }
  } catch (error) {
    // Extension context may not be available
  }
})();

// ==================== RECORDING MODE ====================

let recordingMode = false;
let recordingOverlay = null;
let recordingHighlight = null;
let recordingSelectorPreview = null;
let lastHighlightedElement = null;

// Start recording mode
function startRecordingMode() {
  if (recordingMode) return;

  recordingMode = true;
  createRecordingOverlay();
  createRecordingHighlight();
  createSelectorPreview();

  // Add event listeners
  document.addEventListener('mousemove', handleRecordingMouseMove, true);
  document.addEventListener('click', handleRecordingClick, true);
  document.addEventListener('keydown', handleRecordingKeydown, true);

  console.log('Recording mode started');
}

// Stop recording mode
function stopRecordingMode() {
  if (!recordingMode) return;

  recordingMode = false;

  // Remove overlay, highlight, and selector preview
  if (recordingOverlay && recordingOverlay.parentNode) {
    recordingOverlay.parentNode.removeChild(recordingOverlay);
  }
  if (recordingHighlight && recordingHighlight.parentNode) {
    recordingHighlight.parentNode.removeChild(recordingHighlight);
  }
  if (recordingSelectorPreview && recordingSelectorPreview.parentNode) {
    recordingSelectorPreview.parentNode.removeChild(recordingSelectorPreview);
  }

  recordingOverlay = null;
  recordingHighlight = null;
  recordingSelectorPreview = null;
  lastHighlightedElement = null;

  // Remove event listeners
  document.removeEventListener('mousemove', handleRecordingMouseMove, true);
  document.removeEventListener('click', handleRecordingClick, true);
  document.removeEventListener('keydown', handleRecordingKeydown, true);

  console.log('Recording mode stopped');
}

// Create overlay
function createRecordingOverlay() {
  recordingOverlay = document.createElement('div');
  recordingOverlay.id = 'element-click-timer-overlay';
  recordingOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
    z-index: 999998;
    cursor: crosshair;
    pointer-events: none;
  `;

  const message = document.createElement('div');
  message.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #4CAF50;
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 999999;
    pointer-events: none;
  `;
  message.textContent = '🎯 Recording Mode: Click on an element to select it (Press ESC to cancel)';

  recordingOverlay.appendChild(message);
  document.body.appendChild(recordingOverlay);
}

// Create highlight element
function createRecordingHighlight() {
  recordingHighlight = document.createElement('div');
  recordingHighlight.id = 'element-click-timer-highlight';
  recordingHighlight.style.cssText = `
    position: absolute;
    border: 3px solid #4CAF50;
    pointer-events: none;
    z-index: 999999;
    transition: all 0.1s ease;
  `;
  recordingHighlight.style.display = 'none';
  document.body.appendChild(recordingHighlight);
}

// Create selector preview tooltip
function createSelectorPreview() {
  recordingSelectorPreview = document.createElement('div');
  recordingSelectorPreview.id = 'element-click-timer-selector-preview';
  recordingSelectorPreview.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #2C3E50;
    color: #ECF0F1;
    padding: 8px 12px;
    border-radius: 6px;
    font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
    font-size: 12px;
    pointer-events: auto;
    z-index: 1000000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    max-width: 400px;
    word-wrap: break-word;
    white-space: pre-wrap;
    line-height: 1.4;
  `;
  recordingSelectorPreview.style.display = 'none';
  document.body.appendChild(recordingSelectorPreview);
}

// Handle mouse move during recording
function handleRecordingMouseMove(e) {
  const element = document.elementFromPoint(e.clientX, e.clientY);

  // Skip our own overlay and highlight elements
  if (!element ||
      element.id === 'element-click-timer-overlay' ||
      element.id === 'element-click-timer-highlight' ||
      element.closest('#element-click-timer-overlay')) {
    return;
  }

  highlightElement(element);
  lastHighlightedElement = element;
}

// Highlight an element
function highlightElement(element) {
  if (!recordingHighlight) return;

  const rect = element.getBoundingClientRect();
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;

  recordingHighlight.style.display = 'block';
  recordingHighlight.style.left = (rect.left + scrollX) + 'px';
  recordingHighlight.style.top = (rect.top + scrollY) + 'px';
  recordingHighlight.style.width = rect.width + 'px';
  recordingHighlight.style.height = rect.height + 'px';

  // Update selector preview
  if (recordingSelectorPreview) {
    const selector = generateOptimalSelector(element);
    const tagName = element.tagName.toLowerCase();

    // Create info display
    recordingSelectorPreview.innerHTML = `<div style="margin-bottom: 4px; color: #3498DB; font-weight: bold;">CSS Selector:</div><div style="color: #2ECC71;">${escapeHtmlContent(selector)}</div><div style="margin-top: 6px; font-size: 10px; color: #95A5A6;">Tag: &lt;${tagName}&gt;</div>`;

    recordingSelectorPreview.style.display = 'block';
  }
}

// Escape HTML for safe display in tooltip
function escapeHtmlContent(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Show selected selector preview with copy functionality
function showSelectedSelectorPreview(selector) {
  if (!recordingSelectorPreview) return;

  const tagName = lastHighlightedElement ? lastHighlightedElement.tagName.toLowerCase() : '';

  recordingSelectorPreview.innerHTML = `
    <div style="margin-bottom: 8px; color: #2ECC71; font-weight: bold; font-size: 14px;">✓ Element Selected</div>
    <div style="margin-bottom: 4px; color: #3498DB; font-weight: bold;">CSS Selector:</div>
    <div style="color: #2ECC71; margin-bottom: 10px; padding: 6px; background: rgba(255,255,255,0.1); border-radius: 4px; user-select: all;">${escapeHtmlContent(selector)}</div>
    ${tagName ? `<div style="margin-bottom: 10px; font-size: 10px; color: #95A5A6;">Tag: &lt;${tagName}&gt;</div>` : ''}
    <div style="display: flex; gap: 8px; margin-top: 10px;">
      <button id="copy-selector-btn" style="flex: 1; padding: 6px 12px; background: #3498DB; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">📋 Copy</button>
      <button id="close-preview-btn" style="flex: 1; padding: 6px 12px; background: #E74C3C; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">✕ Close</button>
    </div>
  `;

  recordingSelectorPreview.style.display = 'block';

  // Add event listeners for buttons
  const copyBtn = document.getElementById('copy-selector-btn');
  const closeBtn = document.getElementById('close-preview-btn');

  if (copyBtn) {
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Copy to clipboard
      navigator.clipboard.writeText(selector).then(() => {
        copyBtn.textContent = '✓ Copied!';
        copyBtn.style.background = '#2ECC71';
        setTimeout(() => {
          copyBtn.textContent = '📋 Copy';
          copyBtn.style.background = '#3498DB';
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy:', err);
        // Fallback: create a temporary textarea
        const textarea = document.createElement('textarea');
        textarea.value = selector;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        copyBtn.textContent = '✓ Copied!';
        copyBtn.style.background = '#2ECC71';
        setTimeout(() => {
          copyBtn.textContent = '📋 Copy';
          copyBtn.style.background = '#3498DB';
        }, 2000);
      });
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      stopRecordingMode();
    });
  }
}

// Handle click during recording
function handleRecordingClick(e) {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  if (!lastHighlightedElement) return;

  const selector = generateOptimalSelector(lastHighlightedElement);

  // Store selector in session storage for popup to retrieve
  browser.storage.session.set({ selectedSelector: selector }).catch(() => {
    // Fallback to local storage if session storage is not available
    browser.storage.local.set({ selectedSelector: selector });
  });

  // Send selector back to popup (in case it's still open)
  browser.runtime.sendMessage({
    action: 'elementSelected',
    selector: selector
  }).catch(err => {
    // Ignore error if popup is closed
  });

  // Update the selector preview to show it's been selected with copy functionality
  showSelectedSelectorPreview(selector);

  // Remove the overlay and highlight, but keep the selector preview
  if (recordingOverlay && recordingOverlay.parentNode) {
    recordingOverlay.parentNode.removeChild(recordingOverlay);
  }
  if (recordingHighlight && recordingHighlight.parentNode) {
    recordingHighlight.parentNode.removeChild(recordingHighlight);
  }

  recordingOverlay = null;
  recordingHighlight = null;

  // Remove mouse move listener but keep keydown for ESC
  document.removeEventListener('mousemove', handleRecordingMouseMove, true);
  document.removeEventListener('click', handleRecordingClick, true);
}

// Handle keydown during recording (ESC to cancel)
function handleRecordingKeydown(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();

    browser.runtime.sendMessage({
      action: 'recordingCancelled'
    }).catch(err => console.error('Error sending cancellation:', err));

    stopRecordingMode();
  }
}

// Generate optimal CSS selector for an element
function generateOptimalSelector(element) {
  // Try ID first (if it's unique and looks stable)
  if (element.id && isStableId(element.id)) {
    const idSelector = `#${CSS.escape(element.id)}`;
    if (isUniqueSelector(idSelector)) {
      return idSelector;
    }
  }

  // Try data attributes
  const dataSelector = getDataAttributeSelector(element);
  if (dataSelector && isUniqueSelector(dataSelector)) {
    return dataSelector;
  }

  // Try name attribute for inputs
  if (element.name) {
    const nameSelector = `${element.tagName.toLowerCase()}[name="${CSS.escape(element.name)}"]`;
    if (isUniqueSelector(nameSelector)) {
      return nameSelector;
    }
  }

  // Try combination of tag and classes
  const classSelector = getClassSelector(element);
  if (classSelector && isUniqueSelector(classSelector)) {
    return classSelector;
  }

  // Try aria-label
  if (element.getAttribute('aria-label')) {
    const ariaSelector = `${element.tagName.toLowerCase()}[aria-label="${CSS.escape(element.getAttribute('aria-label'))}"]`;
    if (isUniqueSelector(ariaSelector)) {
      return ariaSelector;
    }
  }

  // Fall back to nth-child path
  return getNthChildPath(element);
}

// Check if ID looks stable (not auto-generated)
function isStableId(id) {
  // Avoid IDs that look like they're auto-generated
  const autoGenPatterns = [
    /^[a-f0-9]{8,}$/i,  // Long hex strings
    /^react-/,          // React auto-generated
    /^ember\d+$/,       // Ember auto-generated
    /^_\d+$/,           // Underscore + numbers
    /^uuid-/,           // UUID-based
  ];

  return !autoGenPatterns.some(pattern => pattern.test(id));
}

// Get selector using data attributes
function getDataAttributeSelector(element) {
  const dataAttrs = Array.from(element.attributes)
    .filter(attr => attr.name.startsWith('data-'))
    .filter(attr => attr.value && attr.value.length < 50); // Avoid huge data attributes

  if (dataAttrs.length === 0) return null;

  // Prefer certain data attributes
  const preferred = ['data-testid', 'data-test', 'data-cy', 'data-test-id', 'data-id'];
  for (const name of preferred) {
    const attr = dataAttrs.find(a => a.name === name);
    if (attr) {
      return `[${name}="${CSS.escape(attr.value)}"]`;
    }
  }

  // Use first data attribute
  const firstData = dataAttrs[0];
  return `[${firstData.name}="${CSS.escape(firstData.value)}"]`;
}

// Get selector using classes
function getClassSelector(element) {
  if (!element.className || typeof element.className !== 'string') return null;

  const classes = element.className.trim().split(/\s+/)
    .filter(cls => cls && !cls.match(/^(active|hover|focus|selected|open)$/i)); // Skip state classes

  if (classes.length === 0) return null;

  const tag = element.tagName.toLowerCase();
  const classSelector = classes.slice(0, 3).map(cls => `.${CSS.escape(cls)}`).join('');

  return `${tag}${classSelector}`;
}

// Get nth-child path selector
function getNthChildPath(element) {
  const path = [];
  let current = element;

  while (current && current !== document.body && current !== document.documentElement) {
    const tag = current.tagName.toLowerCase();
    const parent = current.parentElement;

    if (parent) {
      const siblings = Array.from(parent.children).filter(child => child.tagName === current.tagName);
      const index = siblings.indexOf(current) + 1;

      if (siblings.length > 1) {
        path.unshift(`${tag}:nth-of-type(${index})`);
      } else {
        path.unshift(tag);
      }
    } else {
      path.unshift(tag);
    }

    current = parent;
  }

  return path.join(' > ');
}

// Check if selector is unique
function isUniqueSelector(selector) {
  try {
    const elements = document.querySelectorAll(selector);
    return elements.length === 1;
  } catch (e) {
    return false;
  }
}

// Add message handler for recording mode
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startRecording') {
    startRecordingMode();
    sendResponse({ success: true });
    return true;
  } else if (message.action === 'stopRecording') {
    stopRecordingMode();
    sendResponse({ success: true });
    return true;
  }
});
