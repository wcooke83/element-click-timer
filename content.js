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
    return true;
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
    
    if (!isElementClickable(element)) {
      console.log(`Element found but not clickable: ${selector}`);
    }
    
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    await sleep(300);
    
    try {
      element.click();
      
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