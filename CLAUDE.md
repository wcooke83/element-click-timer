# CLAUDE.md - Element Click Timer Extension

This document provides a comprehensive guide to the Element Click Timer codebase for AI assistants working on this project.

## Table of Contents
1. [Project Overview](#project-overview)
2. [Codebase Structure](#codebase-structure)
3. [Architecture](#architecture)
4. [Data Flow](#data-flow)
5. [Key Data Structures](#key-data-structures)
6. [Development Conventions](#development-conventions)
7. [Common Development Tasks](#common-development-tasks)
8. [Testing and Debugging](#testing-and-debugging)
9. [Important Notes for AI Assistants](#important-notes-for-ai-assistants)

---

## Project Overview

**Element Click Timer** is a cross-browser extension (Chrome, Edge, Firefox) built on Manifest V2 that allows users to schedule automated actions on web page elements at specific times. The extension supports two primary action types:

1. **Click Element**: Automatically click buttons, links, or any clickable element
2. **Enter Text**: Simulate human-like typing into input fields with configurable typing speed

### Key Features
- Precise time-based scheduling with 5-minute buffer
- CSS selector-based element targeting
- Multiple persistence modes (session, tab, browser)
- URL change handling strategies
- Sensitive data detection and masking
- Dark/light theme support
- Configurable settings for typing speed, notifications, and auto-cleanup

---

## Codebase Structure

```
element-click-timer/
├── manifest.json           # Extension manifest (Manifest V2)
├── background.js           # Background script - timer orchestration
├── popup.html              # Extension popup UI structure
├── popup.js                # Popup logic and UI interactions
├── popup.css               # Styling with theme support
├── content.js              # Content script - element interaction
├── icons/                  # Extension icons (16, 32, 48, 96 px)
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-96.png
├── icons.py                # Icon generation script
├── docs/                   # Documentation resources
│   └── preview.html
├── README.md               # User-facing documentation
└── CLAUDE.md               # This file - AI assistant guide
```

### File Responsibilities

#### `manifest.json`
- Defines extension metadata, permissions, and configuration
- Uses Manifest V2 for broad browser compatibility
- Permissions: tabs, storage, notifications, activeTab, <all_urls>
- Registers background script and content scripts

#### `background.js` (13,182 bytes)
**Primary Responsibilities:**
- Timer lifecycle management (add, update, cancel, execute)
- Settings persistence and loading
- Timer execution orchestration
- Storage management (local and session)
- Tab monitoring and URL change detection
- Auto-delete functionality for executed timers
- Browser notification dispatch

**Key Functions:**
- `loadSettings()`: Load settings from browser.storage.local
- `loadTimersFromStorage()`: Load timers from both local and session storage
- `saveTimersToStorage()`: Persist timers based on persistence level
- `checkAndExecuteTimers()`: Runs every 1 second to check pending timers
- `executeTimer()`: Orchestrates timer execution with URL checking
- `clickElement()`: Sends message to content script to click element
- `enterTextInElement()`: Sends message to content script to enter text

**Event Listeners:**
- `runtime.onStartup`: Initialize on browser startup
- `runtime.onInstalled`: Initialize on extension install/update
- `runtime.onMessage`: Handle messages from popup
- `tabs.onRemoved`: Clean up session-only timers
- `tabs.onUpdated`: Monitor URL changes
- `runtime.onSuspend`: Clean up on shutdown

#### `popup.js` (24,529 bytes)
**Primary Responsibilities:**
- User interface logic for popup window
- Form management for timer creation/editing
- Settings form and persistence
- Timer list rendering and updates
- Real-time countdown display
- Theme application
- Sensitive text visibility toggling

**Key Functions:**
- `loadSettings()`: Load settings on popup open
- `applyTheme()`: Apply light/dark/system theme
- `updateFormVisibility()`: Show/hide fields based on action type
- `handleSubmit()`: Create or update timer
- `loadTimers()`: Fetch and render all timers
- `createTimerElement()`: Build DOM for individual timer
- `updateCountdown()`: Update countdown displays
- `editTimer()`: Populate form for editing
- `toggleSensitiveText()`: Show/hide sensitive text

**State Management:**
- `currentEditingTimerId`: Tracks timer being edited
- `currentTabId`: Active tab for highlighting
- `settings`: Local copy of settings
- `textVisibilityState`: Tracks which sensitive texts are visible

#### `content.js` (7,644 bytes)
**Primary Responsibilities:**
- Direct DOM manipulation on web pages
- Element clicking with multiple compatibility methods
- Text entry simulation with keyboard events
- Element visibility and accessibility checking

**Key Functions:**
- `clickElement(selector)`: Find and click element by CSS selector
- `enterText(selector, text, settings)`: Simulate typing into input fields
- `isElementClickable(element)`: Verify element visibility and clickability
- `isTextInputElement(element)`: Validate text input compatibility
- `sleep(ms)`: Promise-based delay helper

**Text Entry Process:**
1. Find element by selector
2. Scroll into view
3. Trigger focus event (if enabled)
4. Clear existing text (if clearBeforeTyping)
5. Type character-by-character with configurable speed
6. Dispatch input, keydown, keypress, keyup events per character
7. Trigger change event after completion
8. Wait post-entry delay
9. Trigger blur event (if enabled)

#### `popup.html` (9,645 bytes)
**Structure:**
- Tabbed interface (Timers tab, Settings tab)
- Timer creation form with conditional fields
- Timer list display area
- Comprehensive settings panel

**Key Sections:**
- Event type selector (Enter Text / Click Element)
- CSS selector input
- Text entry fields (conditional)
- Time picker (hours/minutes dropdowns)
- Persistence options (radio buttons)
- URL behavior options (radio buttons)
- Settings categories:
  - Text Entry Settings
  - Timer Management
  - Notification Preferences
  - Default Values
  - UI Preferences

#### `popup.css` (9,494 bytes)
**Features:**
- CSS variables for theming
- Dark theme support via `.dark-theme` class
- Responsive layout with flexbox
- Compact timer list view option
- Status badges (success/error/warning)
- Radio button and checkbox custom styling

---

## Architecture

### Communication Flow

```
┌─────────────────────┐
│   Popup Window      │
│   (popup.js)        │
│                     │
│  - User Interface   │
│  - Form Management  │
│  - Timer Display    │
└──────────┬──────────┘
           │
           │ browser.runtime.sendMessage()
           │
           ▼
┌─────────────────────┐
│  Background Script  │
│  (background.js)    │
│                     │
│  - Timer Storage    │
│  - Execution Logic  │
│  - Settings Manager │
└──────────┬──────────┘
           │
           │ browser.tabs.sendMessage()
           │
           ▼
┌─────────────────────┐
│   Content Script    │
│   (content.js)      │
│                     │
│  - DOM Interaction  │
│  - Element Clicking │
│  - Text Entry       │
└─────────────────────┘
```

### Storage Architecture

**Local Storage** (`browser.storage.local`):
- Persistent timers (persistence: 'browser' or 'tab')
- Settings object
- Survives browser restart

**Session Storage** (`browser.storage.session`):
- Session-only timers (persistence: 'session')
- Cleared on browser restart
- Falls back to local storage if unavailable

### Timer Lifecycle

```
1. User Creates Timer
   ↓
2. Timer Added to Storage (background.js)
   ↓
3. Background Checker Runs (every 1 second)
   ↓
4. When targetTime <= now:
   ├─ Check tab exists
   ├─ Check URL change behavior
   ├─ Handle URL navigation if needed
   ├─ Execute action (click or enterText)
   ├─ Update timer status (success/failure)
   ├─ Send notification
   └─ Save to storage
   ↓
5. Auto-delete Checker (every 1 minute)
   └─ Remove old executed timers based on setting
```

---

## Data Flow

### Adding a Timer

1. **User Input** (popup.html)
   - User fills form and clicks "Add Timer"

2. **Form Processing** (popup.js)
   - `handleSubmit()` validates input
   - Calculates targetTime (selectedTime + 5 minutes)
   - Creates timer object with unique ID
   - Sends `addTimer` message to background

3. **Storage** (background.js)
   - `addTimer()` receives message
   - Adds timer to `timers` array
   - `saveTimersToStorage()` persists based on persistence level
   - Sends `timerUpdated` message to popup

4. **UI Update** (popup.js)
   - Receives `timerUpdated` message
   - Calls `loadTimers()` to refresh display
   - Creates timer element with countdown

### Executing a Timer

1. **Timer Check** (background.js)
   - `checkAndExecuteTimers()` runs every 1 second
   - Finds timers where `targetTime <= now` and `status === 'pending'`

2. **Pre-execution Validation** (background.js)
   - Check if tab still exists
   - Check if URL changed
   - Handle URL behavior (cancel, new-tab, navigate)
   - Wait for page load if navigating

3. **Action Execution** (background.js → content.js)
   - Send message to content script with action type
   - For click: `clickElement(selector)`
   - For enterText: `enterText(selector, text, settings)`

4. **Content Script Processing** (content.js)
   - Find element by selector
   - Scroll into view
   - Perform action with event simulation
   - Return success/failure to background

5. **Post-execution** (background.js)
   - Update timer status
   - Set executedAt timestamp
   - Send notification
   - Save to storage
   - Notify popup to refresh

### Settings Management

1. **Load Settings** (popup.js on DOMContentLoaded)
   - Fetch from `browser.storage.local`
   - Merge with DEFAULT_SETTINGS
   - Populate settings form
   - Apply theme

2. **Save Settings** (popup.js)
   - Validate input ranges
   - Update settings object
   - Save to `browser.storage.local`
   - Send `settingsUpdated` message to background
   - Apply theme immediately
   - Update timer list view

3. **Background Sync** (background.js)
   - Receive `settingsUpdated` message
   - Reload settings from storage
   - Use updated settings for future timer executions

---

## Key Data Structures

### Timer Object

```javascript
{
  id: string,                    // Unique identifier: "timer_" + timestamp + random
  eventType: "click" | "enterText",
  textToEnter: string,           // Empty for click events
  clearBeforeTyping: boolean,    // For enterText only
  isSensitive: boolean,          // Auto-detected or manually marked
  tabId: number,                 // Browser tab ID
  tabTitle: string,              // Tab title for display
  originalUrl: string,           // URL when timer was created
  cssSelector: string,           // CSS selector for target element
  targetTime: number,            // Unix timestamp when timer fires
  selectedTime: number,          // Unix timestamp of user-selected time
  persistence: "session" | "tab" | "browser",
  urlBehavior: "cancel" | "new-tab" | "navigate",
  status: "pending" | "executed-success" | "executed-failure",
  createdAt: number,             // Unix timestamp of creation
  executedAt: number             // Unix timestamp of execution (if executed)
}
```

### Settings Object

```javascript
{
  // Text Entry Settings
  typingSpeed: number,           // 1-1000ms per character (default: 50)
  postTextEntryDelay: number,    // 0-5000ms (default: 10)
  triggerFocusBlur: boolean,     // Default: true

  // Timer Management
  autoDeleteExecuted: string,    // "never" | "5min" | "30min" | "1hour" | "24hours"

  // Notification Preferences
  notifySuccess: boolean,        // Default: true
  notifyFailure: boolean,        // Default: true

  // Default Values for New Timers
  defaultEventType: string,      // "enterText" | "click" (default: "enterText")
  defaultPersistence: string,    // "session" | "tab" | "browser" (default: "session")
  defaultUrlBehavior: string,    // "cancel" | "new-tab" | "navigate" (default: "cancel")

  // UI Preferences
  timerListView: string,         // "detailed" | "compact" (default: "detailed")
  theme: string                  // "light" | "dark" | "system" (default: "light")
}
```

### Message Protocol

**Popup → Background:**
```javascript
// Add Timer
{ action: 'addTimer', timer: TimerObject }

// Update Timer
{ action: 'updateTimer', timer: TimerObject }

// Cancel Timer
{ action: 'cancelTimer', timerId: string }

// Get All Timers
{ action: 'getTimers' }

// Settings Updated
{ action: 'settingsUpdated', settings: SettingsObject }
```

**Background → Popup:**
```javascript
// Timer Updated (added, modified, deleted)
{ action: 'timerUpdated' }

// Timer Executed
{ action: 'timerExecuted' }
```

**Background → Content Script:**
```javascript
// Click Element
{ action: 'clickElement', selector: string }

// Enter Text
{
  action: 'enterText',
  selector: string,
  text: string,
  settings: {
    clearBeforeTyping: boolean,
    typingSpeed: number,
    postTextEntryDelay: number,
    triggerFocusBlur: boolean
  }
}
```

**Content Script → Background (Responses):**
```javascript
// Success
{ success: true }

// Failure
{ success: false, error: string }
```

---

## Development Conventions

### Code Style

1. **Variable Naming**
   - Use camelCase for variables and functions
   - Use UPPER_SNAKE_CASE for constants
   - Prefix boolean variables with `is`, `has`, `should`
   - Example: `isElementClickable`, `hasChanged`, `shouldAutoDelete`

2. **Function Organization**
   - Define helper functions near their usage
   - Group related functions together
   - Add comments for complex logic

3. **Async/Await Pattern**
   - Prefer async/await over promises for readability
   - Always use try/catch for error handling
   - Example:
   ```javascript
   async function loadTimers() {
     try {
       const data = await browser.storage.local.get('timers');
       // Process data
     } catch (error) {
       console.error('Error loading timers:', error);
     }
   }
   ```

4. **Event Listeners**
   - Use arrow functions for inline handlers
   - Define named functions for reusable handlers
   - Always clean up listeners when appropriate

5. **DOM Manipulation**
   - Cache DOM queries in variables when used multiple times
   - Use `querySelector` for single elements
   - Use `querySelectorAll` for multiple elements
   - Prefer `classList` over direct `className` manipulation

### Browser Compatibility

1. **WebExtension API**
   - Use `browser` namespace (works in both Chrome and Firefox)
   - Chrome auto-aliases `chrome` to `browser`
   - Avoid Chrome-specific APIs

2. **Storage API**
   - Always check if `browser.storage.session` exists before using
   - Fall back to local storage if session storage unavailable
   - Example from background.js:63:
   ```javascript
   const sessionData = await browser.storage.session?.get('timers') || { timers: [] };
   ```

3. **Optional Chaining**
   - Use `?.` for potentially undefined properties
   - Example: `browser.runtime.onSuspend?.addListener()`

### Security Considerations

1. **XSS Prevention**
   - Always use `escapeHtml()` when inserting user content into DOM
   - Example from popup.js:704:
   ```javascript
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
   ```

2. **Sensitive Data**
   - Auto-detect password fields by selector keywords
   - Allow manual sensitivity marking
   - Mask sensitive text in UI (but not in storage)
   - Example from popup.js:383:
   ```javascript
   function isSelectorSensitive(selector) {
     const lowerSelector = selector.toLowerCase();
     return lowerSelector.includes('password') ||
            lowerSelector.includes('pass') ||
            lowerSelector.includes('pwd');
   }
   ```

3. **Input Validation**
   - Validate all user inputs in popup.js
   - Check ranges for numeric inputs
   - Verify required fields are filled

### Performance Optimization

1. **Timer Checking**
   - Background checker runs every 1 second (reasonable interval)
   - Auto-delete checker runs every 1 minute (less frequent)
   - Consider increasing intervals if many timers exist

2. **DOM Updates**
   - Use document fragments for multiple insertions
   - Batch DOM updates when possible
   - Debounce frequent updates

3. **Storage Operations**
   - Batch storage writes when possible
   - Avoid unnecessary reads by caching data
   - Clean up old data with auto-delete feature

### Error Handling

1. **Try-Catch Blocks**
   - Wrap all async operations in try-catch
   - Log errors to console for debugging
   - Provide user feedback for critical errors

2. **Message Passing**
   - Handle errors when no popup is open
   - Example from background.js:439:
   ```javascript
   function notifyPopups(action) {
     browser.runtime.sendMessage({ action: action }).catch(() => {
       // Ignore errors if no popup is open
     });
   }
   ```

3. **Tab Access**
   - Always check if tab exists before accessing
   - Example from background.js:258:
   ```javascript
   try {
     tab = await browser.tabs.get(timer.tabId);
   } catch (error) {
     // Tab doesn't exist, handle gracefully
   }
   ```

---

## Common Development Tasks

### Adding a New Action Type

1. **Update Timer Object** (background.js)
   - Add new event type constant
   - Update timer object structure if needed

2. **Update Form UI** (popup.html)
   - Add radio button for new action type
   - Add conditional fields if needed

3. **Update Form Logic** (popup.js)
   - Update `updateFormVisibility()` to handle new type
   - Update `handleSubmit()` to process new fields

4. **Implement Execution Logic** (content.js)
   - Add new function for the action
   - Handle message in onMessage listener

5. **Update Background Script** (background.js)
   - Add execution handler in `executeTimer()`

### Adding a New Setting

1. **Update DEFAULT_SETTINGS** (both background.js and popup.js)
   ```javascript
   const DEFAULT_SETTINGS = {
     // ... existing settings
     newSetting: defaultValue
   };
   ```

2. **Add Form Field** (popup.html)
   - Add input element in settings tab
   - Use appropriate ID

3. **Update Settings Form Logic** (popup.js)
   - Add to `populateSettingsForm()` to load value
   - Add to `handleSaveSettings()` to save value
   - Add validation if needed

4. **Use Setting** (wherever needed)
   - Access via `settings.newSetting`

### Modifying Time Buffer

Current: 5 minutes hardcoded in popup.js:346
```javascript
const targetTime = new Date(selectedTime.getTime() + 5 * 60 * 1000);
```

To change:
1. Update the calculation in `handleSubmit()`
2. Update help text in popup.html:83
3. Update README.md documentation

### Adding Theme Support to New Components

1. **Define CSS Variables** (popup.css)
   ```css
   :root {
     --new-color: #value;
   }

   .dark-theme {
     --new-color: #dark-value;
   }
   ```

2. **Use Variables in Styles**
   ```css
   .new-component {
     color: var(--new-color);
   }
   ```

### Implementing Export/Import Feature

This is listed as a priority area in README.md:397. Here's how to implement:

1. **Add Export Function** (popup.js)
   ```javascript
   async function exportTimers() {
     const response = await browser.runtime.sendMessage({ action: 'getTimers' });
     const timers = response.timers || [];
     const dataStr = JSON.stringify(timers, null, 2);
     // Create download link
   }
   ```

2. **Add Import Function** (popup.js)
   ```javascript
   async function importTimers(file) {
     const timers = JSON.parse(await file.text());
     // Validate and import
   }
   ```

3. **Add UI Elements** (popup.html)
   - Add export/import buttons in settings tab

---

## Testing and Debugging

### Manual Testing Workflow

1. **Load Extension**
   - Chrome: `chrome://extensions/` → Load unpacked
   - Firefox: `about:debugging` → Load Temporary Add-on

2. **Test in Console**
   ```javascript
   // Test selector in page console (F12)
   document.querySelector('input#username')

   // Test typing speed
   // Create timer with 100ms speed and observe
   ```

3. **Check Background Console**
   - Chrome: Extensions page → Details → Inspect background page
   - Firefox: about:debugging → Inspect
   - Look for execution logs

4. **Monitor Storage**
   - Chrome DevTools → Application → Storage → Extension Storage
   - Firefox DevTools → Storage → Extension Storage

### Common Issues and Solutions

#### Timer Not Firing

**Symptoms:**
- Countdown reaches 00:00:00 but nothing happens
- No notification appears

**Debugging:**
1. Check background console for errors
2. Verify timer status in storage
3. Check if tab still exists
4. Verify URL hasn't changed (if behavior is "cancel")

**Solution:**
- Ensure `checkAndExecuteTimers()` is running (check interval active)
- Verify content script is injected (check manifest matches)

#### Element Not Found

**Symptoms:**
- Timer executes but shows failure status
- Notification: "Element Not Found"

**Debugging:**
1. Test selector in page console:
   ```javascript
   document.querySelector('your-selector')
   ```
2. Check if element exists when timer fires
3. Verify element isn't in shadow DOM
4. Check if page dynamically loads content

**Solution:**
- Use correct selector (inspect element → Copy selector)
- Increase buffer time if page loads slowly
- Use `waitForElement()` helper (content.js:238) if needed

#### Text Not Entering

**Symptoms:**
- Timer succeeds but text not visible in field
- Text partially entered

**Debugging:**
1. Check typing speed setting
2. Verify element is text input
3. Check browser console for event errors
4. Test manually with shorter text

**Solution:**
- Increase typing speed (50ms → 100ms)
- Enable focus/blur events in settings
- Increase post-text-entry delay
- Check if site uses React/Vue (may need specific event sequence)

#### Theme Not Applying

**Symptoms:**
- Dark theme selected but interface still light

**Debugging:**
1. Check if `dark-theme` class applied to body
2. Verify CSS variables defined
3. Check browser theme preference (for "system" theme)

**Solution:**
- Reload popup after saving settings
- Clear extension storage and reset
- Check CSS specificity conflicts

### Performance Testing

**Many Timers:**
1. Create 50+ timers
2. Monitor background page CPU usage
3. Check if UI remains responsive
4. Test compact view performance

**Long Running:**
1. Create timer for 24 hours in future
2. Restart browser (test persistence)
3. Verify timer still executes

### Browser Compatibility Testing

**Test Matrix:**
| Browser | Version | Test Status |
|---------|---------|-------------|
| Chrome  | 88+     | ✓           |
| Edge    | 88+     | ✓           |
| Firefox | 78+     | ✓           |

**Key Differences:**
- Firefox requires temporary add-on reload on browser restart
- Session storage may not be available in older browsers
- Notification permissions differ slightly

---

## Important Notes for AI Assistants

### Critical Files - Handle with Care

1. **background.js**
   - Core timer execution logic
   - Changes here affect all timers
   - Always test timer lifecycle after modifications
   - Don't change check intervals without performance testing

2. **Storage Logic**
   - Multiple storage types (local, session)
   - Persistence levels must be maintained
   - Breaking changes can lose user data
   - Always migrate data structures carefully

3. **Content Script Injection**
   - Must match manifest permissions
   - Changes to content.js require extension reload
   - Shadow DOM limitations can't be easily fixed

### Common Pitfalls

1. **Async Message Handling**
   - Must return `true` to keep channel open
   - Example from content.js:6:
   ```javascript
   return true; // Keep channel open for async response
   ```

2. **Timer ID Generation**
   - Must be unique across browser sessions
   - Current implementation: timestamp + random
   - Don't use sequential IDs (collision risk)

3. **Time Calculations**
   - Always use Unix timestamps (milliseconds)
   - Account for timezone differences
   - Handle date rollovers (midnight crossing)

4. **Storage Quota**
   - Chrome: ~5MB for local storage
   - Don't store large amounts of data
   - Auto-delete helps manage storage

5. **URL Matching**
   - Exact match used for URL change detection
   - Hash changes count as URL changes
   - Consider using URL.origin for looser matching

### When Adding Features

**Before Coding:**
1. Check if feature exists in README.md priority areas
2. Review existing code for similar patterns
3. Consider browser compatibility
4. Plan data migration if changing structures

**While Coding:**
1. Follow existing code style
2. Add error handling for all async operations
3. Update DEFAULT_SETTINGS if adding settings
4. Consider performance impact

**After Coding:**
1. Test in both Chrome and Firefox
2. Test all persistence modes
3. Test URL change behaviors
4. Update README.md if user-facing
5. Update this CLAUDE.md if architecture changes

### Security Reminders

1. **Never store unencrypted sensitive data**
   - Current implementation stores text unencrypted
   - Only masks in UI, not in storage
   - Consider encryption for future versions

2. **Validate all inputs**
   - CSS selectors can be malicious
   - Text input can contain scripts
   - Always escape before DOM insertion

3. **Limit permissions**
   - Currently uses `<all_urls>` (required for functionality)
   - Can't reduce without breaking core features
   - Document why each permission is needed

### Manifest V3 Migration Notes

Current version uses Manifest V2. For future V3 migration:

1. **Service Workers**
   - Replace `background.scripts` with `background.service_worker`
   - Persistent: false by default (handle timer state differently)
   - Use alarms API for periodic checks

2. **Script Injection**
   - Use `scripting.executeScript` instead of content_scripts
   - Dynamic injection on demand

3. **Storage**
   - Session storage fully supported
   - No major changes needed

4. **Permissions**
   - Host permissions declared separately
   - Update manifest structure

### Git Workflow

**Current Branch:** `claude/claude-md-mhy6b1lmo63cecgi-017rBbth8X7RApktdYLiyRh5`

**Recent Commits:**
- `e706fbb`: added text input on timer and settings tab
- `6b06aee`: first commit

**Commit Best Practices:**
1. Use descriptive commit messages
2. Group related changes
3. Test before committing
4. Don't commit sensitive data

### Testing Checklist Before Committing

- [ ] Test with both action types (click and enterText)
- [ ] Verify all settings persist correctly
- [ ] Test theme switching (light/dark/system)
- [ ] Verify sensitive data masking works
- [ ] Test in both Chrome and Firefox
- [ ] Check error handling edge cases
- [ ] Test all persistence modes (session/tab/browser)
- [ ] Test all URL behaviors (cancel/new-tab/navigate)
- [ ] Verify auto-delete works
- [ ] Check notifications appear correctly

---

## Quick Reference

### Key File Locations

| Need to... | Edit File | Line(s) |
|------------|-----------|---------|
| Change time buffer | popup.js | 346 |
| Add new action type | content.js, popup.js, background.js | Multiple |
| Modify settings | background.js, popup.js | DEFAULT_SETTINGS |
| Update theme colors | popup.css | :root and .dark-theme |
| Add form field | popup.html | Settings tab section |
| Change check interval | background.js | 238 (timer check), 133 (auto-delete) |
| Modify text entry simulation | content.js | 71-178 |
| Update click logic | content.js | 18-68 |
| Change storage logic | background.js | 150-169 |

### Default Values

| Setting | Default | Range/Options |
|---------|---------|---------------|
| Typing Speed | 50ms | 1-1000ms |
| Post-Entry Delay | 10ms | 0-5000ms |
| Trigger Focus/Blur | true | boolean |
| Auto-Delete | never | never, 5min, 30min, 1hour, 24hours |
| Notify Success | true | boolean |
| Notify Failure | true | boolean |
| Default Event Type | enterText | enterText, click |
| Default Persistence | session | session, tab, browser |
| Default URL Behavior | cancel | cancel, new-tab, navigate |
| Timer List View | detailed | detailed, compact |
| Theme | light | light, dark, system |
| Time Buffer | 5 minutes | Hardcoded |

### Browser API Quick Reference

```javascript
// Storage
await browser.storage.local.get('key')
await browser.storage.local.set({key: value})
await browser.storage.session.get('key') // May not exist

// Tabs
await browser.tabs.query({active: true, currentWindow: true})
await browser.tabs.get(tabId)
await browser.tabs.create({url: 'https://...'})
await browser.tabs.update(tabId, {url: 'https://...'})

// Messaging
await browser.runtime.sendMessage({action: 'name', data: value})
browser.runtime.onMessage.addListener((msg, sender) => {})
await browser.tabs.sendMessage(tabId, {action: 'name'})

// Notifications
await browser.notifications.create({
  type: 'basic',
  iconUrl: 'path/to/icon.png',
  title: 'Title',
  message: 'Message'
})
```

---

## Conclusion

This document should serve as your primary reference when working on the Element Click Timer extension. Always consult it before making significant changes to ensure consistency with the existing architecture and conventions.

For questions not covered here:
1. Check the README.md for user-facing documentation
2. Review the actual code implementation
3. Test in both Chrome and Firefox
4. Consider browser compatibility implications

**Last Updated:** 2025-11-14
**Version:** 1.0.0
**Manifest Version:** V2
