# System Patterns

## How the System Is Built
The system is built as a Chrome extension with the following components:
1. **Background Script (`background.js`)**: Manages alarms, sends posts to Telegram, and stores processed post IDs.
2. **Content Script (`content.js`)**: Extracts posts from Facebook, filters them, and sends new posts to the background script.
3. **Popup (`popup.html` and `popup.js`)**: Provides a user interface for configuring settings.

## Key Technical Decisions
1. **Manifest V3**: Uses the latest Chrome extension manifest version.
2. **Alarms**: Uses `chrome.alarms` to schedule periodic checks.
3. **Storage**: Uses `chrome.storage.local` to store settings and processed post IDs.
4. **Telegram Bot API**: Uses the Telegram Bot API to send messages.

## Architecture Patterns
1. **Event-Driven**: Uses event listeners to handle messages and alarms.
2. **Modular**: Separates concerns into background, content, and popup scripts.
3. **Configurable**: Allows users to customize settings via the popup.
