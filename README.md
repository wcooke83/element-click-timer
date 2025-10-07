# Element Click Timer

A **cross-browser extension** (compatible with Chrome, Edge, and Firefox) that allows you to schedule automatic actions on specific web page elements at predefined times. Automate clicks, text entry, and more without manual intervention.

![Extension Preview](preview.png)  
*(Screenshot of the popup interface showing timer management)*

## Features

### Action Types
- **🖱️ Click Element**: Automatically click buttons, links, or any clickable element
- **⌨️ Enter Text**: Simulate human-like typing into input fields and textareas
  - Character-by-character typing simulation
  - Configurable typing speed (1-1000ms per character)
  - Clear existing text or append to it
  - Automatic focus/blur event triggering
  - Post-entry delay for page processing

### Scheduling & Timing
- **Precise Scheduling**: Set a target time for actions, with an automatic 5-minute buffer
- **CSS Selector Targeting**: Target any element using standard CSS selectors
- **Real-Time Monitoring**: Live countdown timers show exactly when actions will fire
- **Tab-Aware**: Timers are tied to specific tabs with visual highlighting

### Persistence Options
- **Session only**: Clears when tab closes
- **Persist on tab close**: Survives tab reloads/closes
- **Persist on browser close**: Fully persistent across sessions

### URL Change Handling
- **Don't run**: Cancel if URL changes
- **Open in a new tab**: Loads original URL fresh
- **Navigate existing tab**: Redirects back to original URL

### Privacy & Security
- **Sensitive Data Protection**: Automatically detects password fields
- **Text Masking**: Mask sensitive text in timer list with toggle to show/hide
- **Manual Sensitivity Marking**: Mark any data as sensitive

### Customization & Settings
Access comprehensive settings through the dedicated Settings tab:

**Text Entry Settings:**
- Typing speed control (1-1000ms between characters, default 50ms)
- Post-text-entry delay (0-5000ms, default 10ms)
- Focus/blur event triggering toggle

**Timer Management:**
- Auto-delete executed timers (Never, 5 min, 30 min, 1 hour, 24 hours)

**Notification Preferences:**
- Toggle success notifications
- Toggle failure notifications

**Default Values:**
- Default action type (Enter Text or Click Element)
- Default persistence level
- Default URL behavior

**UI Preferences:**
- Timer list view (Detailed or Compact)
- Theme selection (Light, Dark, or System)

### Additional Features
- **Status Badges**: Visual feedback for success/failure
- **Browser Notifications**: Alerts for executions
- **Auto-cleanup**: Automatically remove old executed timers
- **Error Handling**: Graceful failures with detailed notifications
- **Lightweight**: Minimal resource usage with automatic cleanup

## Installation

This extension uses Manifest V2 for broad compatibility across browsers. Follow the steps below to load it as an unpacked/temporary extension for development or testing.

### For Chrome (or Chromium-based browsers like Edge)
1. **Prerequisites**: Ensure you have Google Chrome (version 88+) or Microsoft Edge installed.
2. **Load the Extension**:
   - Download or clone this repository to a local folder.
   - Open Chrome/Edge and go to `chrome://extensions/` (or `edge://extensions/`).
   - Enable **Developer mode** (toggle in the top-right corner).
   - Click **Load unpacked** and select the folder containing the extension files (e.g., where `manifest.json` is located).
   - The extension icon should appear in your toolbar.
3. **Permissions**: The extension requests `tabs`, `storage`, `notifications`, `activeTab`, and `<all_urls>` for tab management, data persistence, and cross-site functionality.
4. **Updates**: To update, click **Load unpacked** again after modifying files. The browser will reload the extension.

### For Firefox
1. **Prerequisites**: Ensure you have Mozilla Firefox (version 78+) installed.
2. **Load the Extension**:
   - Download or clone this repository to a local folder.
   - Open Firefox and go to `about:debugging#/runtime/this-firefox`.
   - Click **Load Temporary Add-on**.
   - Select `manifest.json` from your extension folder.
   - The extension will load temporarily (persists until browser restart).
3. **Permissions**: Same as Chrome—Firefox will prompt for permissions on first use.
4. **Updates**: Reload by clicking **Load Temporary Add-on** again after changes. For permanent installation, package as a .xpi (via `about:debugging` > "Package Extension") and sign via Mozilla's Add-ons Developer Hub.

**Note**: In both browsers, test by pinning the extension icon and opening the popup on a webpage.

## Usage

### Adding a Timer

#### For Text Entry
1. Navigate to the webpage with the input field you want to automate.
2. Click the extension icon to open the popup.
3. In the **Add Timer** section:
   - **Action Type**: Select "⌨️ Enter Text" (default)
   - **CSS Selector**: Enter the CSS selector for the input field (e.g., `input#username`, `textarea.comment-box`)
     - Use browser dev tools (F12) to inspect and copy selectors
   - **Text to Enter**: Type the text you want to enter
   - **Mark as sensitive data**: Check this to mask the text in the timer list
   - **Text Entry Mode**: Choose "Clear existing text before typing" (default) or "Append to existing text"
   - **Target Time**: Select hours and minutes (timer fires 5 minutes after this time)
   - **Persistence**: Choose how long the timer survives
   - **If URL Changes**: Decide behavior if the page URL changes before firing
4. Click **Add Timer**

#### For Clicking Elements
1. Navigate to the webpage with the element you want to click.
2. Click the extension icon to open the popup.
3. In the **Add Timer** section:
   - **Action Type**: Select "🖱️ Click Element"
   - **CSS Selector**: Enter the CSS selector for the element (e.g., `#submit-button`, `.continue-btn`)
   - **Target Time**: Select hours and minutes
   - **Persistence**: Choose how long the timer survives
   - **If URL Changes**: Decide URL change behavior
4. Click **Add Timer**

### Managing Timers
- **View Timers**: The "Timers" tab shows all active timers
  - Active tab timers are highlighted in green
  - Event type icon shows whether it's a click (🖱️) or text entry (⌨️) action
  - Countdowns update every second (e.g., `02:34:15`)
  - For text entry: Shows the text (masked if sensitive, truncated if long)
  - URL change warnings/info displayed if applicable
- **Edit**: Click the pencil (✏️) icon to modify a pending timer
- **Cancel**: Click the X (❌) icon and confirm to remove a timer
- **Toggle Sensitive Text**: Click the eye icon (👁️) to show/hide masked text
- **Status Updates**:
  - **Pending**: Shows countdown and fire time
  - **Success**: Green badge (✓ Text entered successfully / Clicked successfully)
  - **Failure**: Red badge (✗ Element not found or execution failed)

### Customizing Settings
1. Click the extension icon to open the popup
2. Navigate to the **Settings** tab
3. Adjust settings in these categories:
   - **Text Entry Settings**: Control typing behavior
   - **Timer Management**: Auto-delete old timers
   - **Notification Preferences**: Control which notifications appear
   - **Default Values for New Timers**: Set defaults for new timers
   - **UI Preferences**: Customize appearance and theme
4. Click **Save Settings** to apply changes
5. Click **Reset to Defaults** to restore default settings

### Notifications
- Browser notifications alert you when a timer fires:
  - Success: "Timer Executed Successfully: [Action] on [Page]"
  - Failure: "Element Not Found: Could not find [element type] on [Page]"
  - Cancelled: "Timer Cancelled: [Reason]"
- Configure notification preferences in Settings

### Example Workflows

#### Automated Form Filling
- On a login page, create two timers:
  1. Enter text into `input#username` at 14:30 (fires at 14:35)
  2. Enter text into `input#password` at 14:30 (fires at 14:35)
  3. Mark password as sensitive data
  4. Set typing speed to 100ms for realistic typing

#### Automated Button Clicking
- On a shopping site, set a timer to click "Add to Cart" (`button.add-to-cart`) at 14:30
- If you navigate away, choose to re-navigate back automatically
- Monitor progress in the popup; get notified when it clicks

#### Bulk Text Entry
- Create multiple timers with different selectors
- Use the "Append" mode to add text without clearing existing content
- Set different target times to stagger the entries

## Development

### File Structure
- `manifest.json`: Extension configuration (Manifest V2)
- `popup.html`: Tabbed UI with Timers and Settings sections
- `popup.css`: Styling with light/dark theme support
- `popup.js`: Timer and settings management, form handling
- `background.js`: Timer scheduling, execution logic, settings persistence
- `content.js`: Element interaction (clicking, text entry)
- `icons/`: Extension icons (16x16, 32x32, 48x48, 96x96 PNGs)
- `README.md`: This documentation file

### Data Structures

#### Timer Object
```javascript
{
  id: string,
  eventType: "click" | "enterText",
  textToEnter: string,              // Empty for click events
  clearBeforeTyping: boolean,       // For enterText only
  isSensitive: boolean,             // Auto-detected or manually marked
  tabId: number,
  tabTitle: string,
  originalUrl: string,
  cssSelector: string,
  targetTime: number,
  selectedTime: number,
  persistence: "session" | "tab" | "browser",
  urlBehavior: "cancel" | "new-tab" | "navigate",
  status: "pending" | "executed-success" | "executed-failure",
  createdAt: number,
  executedAt: number                // Timestamp of execution
}
```

#### Settings Object
```javascript
{
  typingSpeed: number,              // 1-1000ms
  postTextEntryDelay: number,       // 0-5000ms
  triggerFocusBlur: boolean,
  autoDeleteExecuted: string,       // "never", "5min", "30min", "1hour", "24hours"
  notifySuccess: boolean,
  notifyFailure: boolean,
  defaultEventType: string,         // "enterText" or "click"
  defaultPersistence: string,       // "session", "tab", or "browser"
  defaultUrlBehavior: string,       // "cancel", "new-tab", or "navigate"
  timerListView: string,            // "detailed" or "compact"
  theme: string                     // "light", "dark", or "system"
}
```

### Customization
- **Typing Speed**: Adjust in Settings tab (1-1000ms per character)
- **Buffer Time**: Currently hardcoded to 5 minutes in `popup.js` line ~290
- **Check Interval**: Background checks run every 1 second
- **Auto-Delete Frequency**: Checks every minute for timers to delete
- **Testing**: Use browser console (F12) to view logs from all scripts

### Building for Release
- For Chrome Web Store: Zip the files and ensure icons are included
- For Firefox Add-ons: Package as .xpi and submit via Mozilla's Developer Hub
- Update `version` in `manifest.json` for releases
- Ensure all dependencies and permissions are documented

## Troubleshooting

### Timer Not Firing
- Check browser console (F12 > Console) for errors
- Ensure the CSS selector matches exactly (test with `document.querySelector()` in console)
- Verify the element exists when the timer fires
- Check if the page dynamically loads content after initial page load

### Text Not Entering Correctly
- Verify the selector targets an input, textarea, or contenteditable element
- Check typing speed isn't too fast for the page to handle (increase in Settings)
- Ensure the element accepts text input (not disabled or readonly)
- Some frameworks need focus/blur events (ensure enabled in Settings)
- Try increasing post-text-entry delay if page needs time to process

### No Notifications
- Verify browser notification permissions:
  - Chrome: `chrome://settings/content/notifications`
  - Firefox: `about:preferences#privacy`
- Check notification preferences in Settings tab
- Some browsers block notifications in certain contexts

### Storage Issues
- Clear extension data via `chrome://extensions/` or `about:debugging`
- Reload the extension
- Check if browser storage quota is exceeded

### URL Change Issues
- Verify URL behavior setting matches your needs
- Some sites use hash routing (URL changes without page reload)
- Single-page apps may require "Navigate existing tab" option

### Theme Not Applying
- Save settings after changing theme
- Reload the popup window
- Check if system dark mode preference is enabled (for "System" theme)

### Performance Issues
- Use "Compact" view for many timers
- Enable auto-delete to remove old executed timers
- Reduce typing speed if system is slow
- Limit number of concurrent timers

## Privacy & Security

### Data Storage
- All timers and settings stored locally in browser storage
- No data sent to external servers
- Sensitive text is stored unencrypted but masked in UI
- Session-only timers are cleared when tab closes

### Permissions Explained
- **tabs**: Access to tab information for timer execution
- **storage**: Local storage for timers and settings
- **notifications**: Show execution status notifications
- **activeTab**: Interact with active tab content
- **<all_urls>**: Required to inject content scripts on any page

### Security Recommendations
- Use "Mark as sensitive data" for passwords and personal information
- Clear old timers regularly
- Use session-only persistence for sensitive tasks
- Review timers before they execute

## Compatibility

### Browsers
- Chrome 88+
- Microsoft Edge 88+
- Firefox 78+
- Other Chromium-based browsers (Opera, Brave, Vivaldi)

### Manifest Version
- Currently uses Manifest V2 for maximum compatibility
- Manifest V3 migration planned for future releases

### Known Limitations
- Cannot interact with pages requiring authentication to load
- Some dynamic content may load after timer fires
- Shadow DOM elements may not be accessible via standard CSS selectors
- Browser extension pages (chrome://, about:) are not accessible

## Contributing

Contributions welcome! Fork the repo, make changes, and submit a pull request.

### Priority Areas
- Add more action types (select dropdown, check checkbox, keyboard shortcuts)
- Support for multiple actions in sequence
- Import/export timer configurations
- Conditional execution based on page state
- Recording mode to capture selectors automatically

### Code Style
- Use descriptive variable names
- Add comments for complex logic
- Follow existing code structure
- Test in both Chrome and Firefox

### Testing Checklist
Before submitting:
- ✅ Test with both action types (click and enterText)
- ✅ Verify all settings persist correctly
- ✅ Test theme switching
- ✅ Verify sensitive data masking
- ✅ Test in both Chrome and Firefox
- ✅ Check error handling edge cases

## Changelog

### Version 2.0.0 (Current)
- **NEW**: Text entry action type with character-by-character typing
- **NEW**: Comprehensive settings system with dedicated tab
- **NEW**: Sensitive data detection and masking
- **NEW**: Dark theme support
- **NEW**: Auto-delete executed timers
- **NEW**: Configurable notification preferences
- **NEW**: Compact timer list view
- **NEW**: Default values for new timers
- **IMPROVED**: Enhanced UI with tabbed interface
- **IMPROVED**: Better error handling and notifications

### Version 1.0.0
- Initial release
- Click element scheduling
- Basic timer management
- Persistence options
- URL change handling

## FAQ

**Q: Can I schedule multiple actions on different pages?**  
A: Yes! Create separate timers for each page/tab. Each timer is tab-specific.

**Q: What happens if I close the tab before the timer fires?**  
A: Depends on persistence setting. "Session only" cancels, "Tab" and "Browser" persist and can reopen/navigate to the page.

**Q: Can I schedule recurring timers?**  
A: Not currently. Each timer fires once. Create a new timer for recurring tasks.

**Q: How accurate is the timing?**  
A: Very accurate (within 1 second). The 5-minute buffer ensures the page is fully loaded.

**Q: Can I see what text will be entered before it executes?**  
A: Yes, hover over or click the eye icon for sensitive text. Non-sensitive text is shown truncated.

**Q: Does this work on all websites?**  
A: Most websites work, but some with strict CSP policies may block content script injection.

**Q: Can I export/import timer configurations?**  
A: Not in current version. Planned for future release.

**Q: What's the difference between the persistence options?**  
A:
- **Session only**: Timer deleted when tab closes
- **Persist on tab close**: Survives tab close/reload but cleared on browser restart
- **Persist on browser close**: Fully persistent until executed or manually deleted

## Support

For issues, feature requests, or questions:
1. Check this README and troubleshooting section
2. Review browser console for error messages
3. Submit an issue on GitHub with:
   - Browser and version
   - Extension version
   - Steps to reproduce
   - Console errors (if any)

## License

MIT License – feel free to use, modify, and distribute. See [LICENSE](LICENSE) for details.
