// Listen for messages from background script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'clickElement') {
    const result = clickElement(message.selector);
    sendResponse(result);
    return true; // Keep channel open for async response
  } else if (message.action === 'enterText') {
    enterText(message.selector, message.text, message.settings).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async response
  }
});

// Click element matching the CSS selector
function clickElement(selector) {
  try {
    // Query for all elements matching the selector
    const elements = document.querySelectorAll(selector);
    
    if (elements.length === 0) {
      console.log(`No elements found matching selector: ${selector}`);
      return { success: false, error: 'Element not found' };
    }
    
    // Click the first matching element
    const element = elements[0];
    
    // Check if element is visible and clickable
    if (!isElementClickable(element)) {
      console.log(`Element found but not clickable: ${selector}`);
      // Try to click anyway
    }
    
    // Scroll element into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Wait a moment for scroll, then click
    setTimeout(() => {
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
      } catch (clickError) {
        console.error(`Error during click: ${clickError}`);
      }
    }, 300);
    
    return { success: true };
    
  } catch (error) {
    console.error(`Error clicking element: ${error}`);
    return { success: false, error: error.message };
  }
}

// Enter text into an input/textarea element
async function enterText(selector, text, settings) {
  try {
    // Query for all elements matching the selector
    const elements = document.querySelectorAll(selector);
    
    if (elements.length === 0) {
      console.log(`No elements found matching selector: ${selector}`);
      return { success: false, error: 'Element not found' };
    }
    
    // Get the first matching element
    const element = elements[0];
    
    // Check if element is an input or textarea
    if (!isTextInputElement(element)) {
      console.log(`Element is not a text input: ${selector}`);
      return { success: false, error: 'Element is not a text input field' };
    }
    
    // Scroll element into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Wait for scroll
    await sleep(300);
    
    // Trigger focus event if enabled
    if (settings.triggerFocusBlur) {
      element.focus();
      const focusEvent = new FocusEvent('focus', { bubbles: true });
      element.dispatchEvent(focusEvent);
      await sleep(100);
    }
    
    // Clear existing text if needed
    if (settings.clearBeforeTyping) {
      element.value = '';
      // Trigger input event for frameworks that listen to it
      const inputEvent = new Event('input', { bubbles: true });
      element.dispatchEvent(inputEvent);
    }
    
    // Type text character by character
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      // Add character to value
      element.value += char;
      
      // Trigger input event (for React, Vue, etc.)
      const inputEvent = new Event('input', { bubbles: true });
      element.dispatchEvent(inputEvent);
      
      // Trigger keydown event
      const keydownEvent = new KeyboardEvent('keydown', {
        key: char,
        bubbles: true,
        cancelable: true
      });
      element.dispatchEvent(keydownEvent);
      
      // Trigger keypress event
      const keypressEvent = new KeyboardEvent('keypress', {
        key: char,
        bubbles: true,
        cancelable: true
      });
      element.dispatchEvent(keypressEvent);
      
      // Trigger keyup event
      const keyupEvent = new KeyboardEvent('keyup', {
        key: char,
        bubbles: true,
        cancelable: true
      });
      element.dispatchEvent(keyupEvent);
      
      // Wait between characters (typing speed)
      await sleep(settings.typingSpeed);
    }
    
    // Final input event after all text is entered
    const finalInputEvent = new Event('input', { bubbles: true });
    element.dispatchEvent(finalInputEvent);
    
    // Trigger change event
    const changeEvent = new Event('change', { bubbles: true });
    element.dispatchEvent(changeEvent);
    
    // Wait post-entry delay
    if (settings.postTextEntryDelay > 0) {
      await sleep(settings.postTextEntryDelay);
    }
    
    // Trigger blur event if enabled
    if (settings.triggerFocusBlur) {
      element.blur();
      const blurEvent = new FocusEvent('blur', { bubbles: true });
      element.dispatchEvent(blurEvent);
    }
    
    console.log(`Successfully entered text into element: ${selector}`);
    return { success: true };
    
  } catch (error) {
    console.error(`Error entering text: ${error}`);
    return { success: false, error: error.message };
  }
}

// Check if element is visible and clickable
function isElementClickable(element) {
  if (!element) return false;
  
  const style = window.getComputedStyle(element);
  
  // Check if element is visible
  if (style.display === 'none' || 
      style.visibility === 'hidden' || 
      style.opacity === '0') {
    return false;
  }
  
  // Check if element has dimensions
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
  
  // Check for textarea
  if (tagName === 'textarea') {
    return true;
  }
  
  // Check for input elements with text-like types
  if (tagName === 'input') {
    const type = (element.type || 'text').toLowerCase();
    const textTypes = [
      'text', 'password', 'email', 'search', 'tel', 
      'url', 'number', 'date', 'datetime-local', 
      'month', 'time', 'week'
    ];
    return textTypes.includes(type);
  }
  
  // Check for contenteditable elements
  if (element.isContentEditable) {
    return true;
  }
  
  return false;
}

// Helper function to sleep/wait
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to wait for element to appear (not used but useful for future)
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    
    if (element) {
      resolve(element);
      return;
    }
    
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    setTimeout(() => {
      observer.disconnect();
      reject(new Error('Element not found within timeout'));
    }, timeout);
  });
}