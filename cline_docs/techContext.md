# Tech Context

## Technologies Used
1. **Chrome Extension**: Built using the Chrome Extension API.
2. **JavaScript**: Used for all scripting.
3. **HTML/CSS**: Used for the popup interface.
4. **Telegram Bot API**: Used to send messages to Telegram.

## Development Setup
1. **Manifest**: Defined in `manifest.json`.
2. **Scripts**: `background.js`, `content.js`, `popup.js`.
3. **HTML**: `popup.html`.
4. **Icons**: `icon16.jpeg`, `icon32.jpeg`, `icon48.jpeg`, `icon128.jpeg`.

## Technical Constraints
1. **Facebook DOM Structure**: The content script relies on Facebook's DOM structure, which may change over time.
2. **Telegram API Limits**: The Telegram Bot API has rate limits that must be respected.
3. **Chrome Permissions**: The extension requires permissions to access Facebook and use storage and alarms.
