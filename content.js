// Listen for messages from background script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'clickElement') {
    clickElement(message.selector).then(result => {
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
    return true; // Keep channel open for async response
  }
});

// Click element matching the CSS selector
async function clickElement(selector) {
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
      if (element.isContentEditable) {
        element.textContent = '';
      } else {
        element.value = '';
      }
      // Trigger input event for frameworks that listen to it
      const inputEvent = new Event('input', { bubbles: true });
      element.dispatchEvent(inputEvent);
    }

    // Type text character by character
    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Add character to value or textContent depending on element type
      if (element.isContentEditable) {
        element.textContent += char;
      } else {
        element.value += char;
      }
      
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

// ==================== RECORDING MODE ====================

let recordingMode = false;
let recordingOverlay = null;
let recordingHighlight = null;
let lastHighlightedElement = null;

// Start recording mode
function startRecordingMode() {
  if (recordingMode) return;

  recordingMode = true;
  createRecordingOverlay();
  createRecordingHighlight();

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

  // Remove overlay and highlight
  if (recordingOverlay && recordingOverlay.parentNode) {
    recordingOverlay.parentNode.removeChild(recordingOverlay);
  }
  if (recordingHighlight && recordingHighlight.parentNode) {
    recordingHighlight.parentNode.removeChild(recordingHighlight);
  }

  recordingOverlay = null;
  recordingHighlight = null;
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
    background: rgba(76, 175, 80, 0.1);
    pointer-events: none;
    z-index: 999999;
    box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.3);
    transition: all 0.1s ease;
  `;
  recordingHighlight.style.display = 'none';
  document.body.appendChild(recordingHighlight);
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
}

// Handle click during recording
function handleRecordingClick(e) {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  if (!lastHighlightedElement) return;

  const selector = generateOptimalSelector(lastHighlightedElement);

  // Send selector back to popup
  browser.runtime.sendMessage({
    action: 'elementSelected',
    selector: selector
  }).catch(err => console.error('Error sending selector:', err));

  stopRecordingMode();
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