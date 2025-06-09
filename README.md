# Facebook Group Tracker

This Chrome extension tracks new posts in a Facebook group and sends them to a Telegram bot.

## Features

- **Track New Posts**: The extension monitors a specified Facebook group for new posts.
- **Send to Telegram**: New posts are sent to a specified Telegram chat using a bot.
- **Configurable Refresh Interval**: The interval at which the extension checks for new posts can be configured.
- **Filter by Time**: Only posts newer than a specified time are sent to Telegram.

## Installation

1. Clone this repository or download the source code.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable "Developer mode" in the top right corner.
4. Click "Load unpacked" and select the directory containing the extension files.

## Usage

1. Click the extension icon in the Chrome toolbar to open the popup.
2. Enter the following information:
   - **Facebook Post Link**: The URL of the Facebook group to monitor.
   - **Telegram Bot Token**: The token of your Telegram bot.
   - **Telegram Chat ID**: The ID of the chat where you want to receive notifications.
   - **Refresh Interval (seconds)**: The interval at which the extension checks for new posts.
   - **Filter Posts Newer Than (seconds)**: Only posts newer than this time will be sent to Telegram.
3. Click "Save Settings" to save your configuration.
4. The extension will start monitoring the specified Facebook group and send new posts to the specified Telegram chat.

## Modules

- **`background.js`**: The background script that handles alarms and communication between the content script and the popup.
- **`content.js`**: The content script that runs on Facebook pages to extract new posts.
- **`popup.html`**: The HTML for the extension's popup.
- **`popup.js`**: The JavaScript for the extension's popup.
- **`telegramSender.js`**: A module that handles sending messages to Telegram.
- **`storageManager.js`**: A module that handles loading and saving configuration settings.

## Dependencies

This extension uses the following Chrome APIs:
- `chrome.alarms`
- `chrome.storage`
- `chrome.tabs`
- `chrome.runtime`
- `chrome.scripting`

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
