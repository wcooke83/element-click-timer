// Listen for messages from background script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'clickElement') {
    const result = clickElement(message.selector);
    sendResponse(result);
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