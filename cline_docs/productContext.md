# Product Context

## Why This Project Exists
This project exists to help users track new posts in a Facebook group and automatically send them to a Telegram chat. This is useful for users who want to stay updated on group activity without constantly checking Facebook.

## What Problems It Solves
1. **Automation**: Automatically tracks new posts in a Facebook group.
2. **Notification**: Sends new posts to a Telegram chat for easy access.
3. **Customization**: Allows users to configure the refresh interval and filter time.

## How It Should Work
1. The user configures the extension with the Facebook post link, Telegram bot token, Telegram chat ID, refresh interval, and filter time.
2. The extension periodically checks the Facebook post for new posts.
3. New posts are extracted and sent to the configured Telegram chat.
4. The extension avoids sending duplicate posts by tracking processed post IDs.
