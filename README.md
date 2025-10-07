# Element Click Timer

A Chrome extension that allows you to schedule automatic clicks on specific web page elements at predefined times. Perfect for automating repetitive tasks like form submissions, button clicks, or interactions on websites without manual intervention.

![Extension Preview](preview.png)  
*(Screenshot of the popup interface showing timer management)*

## Features

- **Precise Scheduling**: Set a target time for clicks, with an automatic 5-minute buffer to ensure the element is ready.
- **CSS Selector Targeting**: Click any element on a page using standard CSS selectors (e.g., `button[aria-label="Continue"]`).
- **Persistence Options**:
  - Session only (clears on tab close).
  - Persist on tab close (survives tab reloads/closes).
  - Persist on browser close (fully persistent across sessions).
- **URL Change Handling**:
  - Don't run (cancel if URL changes).
  - Open in a new tab (loads original URL fresh).
  - Navigate existing tab (redirects back to original URL).
- **Real-Time Monitoring**: Live countdown timers, status badges (success/failure), and notifications for executions.
- **Tab-Aware**: Timers are tied to specific tabs, with visual highlighting for the active tab.
- **Error Handling**: Graceful failures with notifications (e.g., element not found, tab closed).
- **Lightweight**: Runs in the background with minimal resource usage; cleans up expired timers automatically.

## Installation

1. **Prerequisites**: This is a Chrome extension. Ensure you have Google Chrome (or a Chromium-based browser like Edge) installed.

2. **Load the Extension**:
   - Download or clone this repository to a local folder.
   - Open Chrome and go to `chrome://extensions/`.
   - Enable **Developer mode** (toggle in the top-right corner).
   - Click **Load unpacked** and select the folder containing the extension files (e.g., where `manifest.json` is located).
   - The extension icon should appear in your toolbar.

3. **Permissions**: The extension requests:
   - `tabs`, `storage`, `notifications`, `activeTab`, `<all_urls>` for tab management, data persistence, and cross-site functionality.

4. **Updates**: To update, click **Load unpacked** again after modifying files. Chrome will reload the extension.

## Usage

### Adding a Timer
1. Navigate to the webpage where you want to automate a click.
2. Click the extension icon in your toolbar to open the popup.
3. In the **Add Timer** section:
   - **CSS Selector**: Enter a CSS selector for the element to click (e.g., `#submit-button` or `.continue-btn`). Use browser dev tools (F12) to inspect and copy selectors.
   - **Target Time**: Select hours and minutes. The timer will fire **5 minutes after** this time to allow page loading.
   - **Persistence**: Choose how long the timer survives (session, tab, or browser).
   - **If URL Changes**: Decide behavior if the page URL changes before firing.
4. Click **Add Timer**. It will appear in the **Active Timers** list with a live countdown.

### Managing Timers
- **View Timers**: The popup shows all active timers, sorted by active tab and target time.
  - Active tab timers are highlighted in green.
  - Countdowns update every second (e.g., `02:34:15`).
  - URL change warnings/info are displayed if applicable.
- **Edit**: Click the pencil (✏️) icon to modify a pending timer.
- **Cancel**: Click the X (❌) icon and confirm to remove a timer.
- **Status Updates**:
  - Pending: Shows countdown and fire time.
  - Success: Green badge (✓ Clicked successfully).
  - Failure: Red badge (✗ Element not found or other error).

### Notifications
- Browser notifications alert you when a timer fires (success, failure, or cancellation).
- Example: "Timer Executed Successfully: Clicked element on Example Page".

### Example Workflow
- On a shopping site, set a timer to click the "Add to Cart" button (`button.add-to-cart`) at 14:30 (fires at 14:35).
- If the tab URL changes (e.g., you navigate away), choose to re-navigate back automatically.
- Monitor progress in the popup; get notified when it clicks.

## Development

### File Structure
- `manifest.json`: Extension configuration (v2 manifest for broad compatibility).
- `popup.html` / `popup.css` / `popup.js`: UI for adding/managing timers.
- `background.js`: Handles timer storage, scheduling, and execution logic.
- `content.js`: Injects into pages to perform actual clicks.
- `icons/`: Extension icons (16x16, 32x32, 48x48, 96x96 PNGs – add your own if needed).
- `preview.html`: Static preview of the popup (for documentation).

### Customization
- **Default Selector**: Edit `popup.js` line ~280 to change the pre-filled CSS selector.
- **Buffer Time**: Modify the 5-minute addition in `popup.js` (line ~90).
- **Check Interval**: Background checks run every 1 second; adjust in `background.js`.
- **Testing**: Use `console.log` in scripts and check the extension's background page console (via `chrome://extensions/` > Inspect views).

### Building for Release
- For Chrome Web Store submission, zip the files and ensure icons are included.
- Update `version` in `manifest.json` for releases.

## Troubleshooting

- **Timer Not Firing**: Check console (F12 > Console) for errors. Ensure the CSS selector matches exactly.
- **No Notifications**: Verify browser notification permissions (chrome://settings/content/notifications).
- **Storage Issues**: Clear extension data via `chrome://extensions/` and reload.
- **Compatibility**: Tested on Chrome 88+. Manifest v2 may deprecate soon; consider migrating to v3.

## Contributing

Contributions welcome! Fork the repo, make changes, and submit a pull request. Focus areas:
- Add more click methods (e.g., keyboard events).
- Support for multiple clicks or sequences.
- Theme support (dark mode).

## License

MIT License – feel free to use, modify, and distribute. See [LICENSE](LICENSE) for details (create one if needed).

---
