### Popup Design Specification

#### Title

- **Title**: "Facebook Post Tracker"

#### Description

- **Description**: "Track your Facebook group posts and send them to your Telegram bot."

#### Fields

1. **Field 1**: Input for Facebook post link.
2. **Field 2**: Input for Telegram bot token.
3. **Field 3**: Input for Telegram chat ID.
4. **Field 4**: Input for refresh interval in seconds.
5. **Field 5**: Input for filtering posts by time (e.g., posts created within the last X minutes).

#### Button

- **Button**: "Save Settings"

#### Icon

- **Icon**: Use `icon.jpeg` located at the root directory.

---

### Functional Requirements

1. **Save Settings**:

   - Save the input data (fields 1–5) to local storage when the "Save Settings" button is clicked.

2. **Background Function**:

   - Create a background script that refreshes the Facebook tab URL at the interval specified in **Field 4**.
   - Do a scroll to the bottom of the page to load more posts.

3. **Utils**:

   - Create a function to get all posts from the Facebook group after refreshing the page.

   - Create a function to send message to telegram bot.

4. **Notification**:

   - Create a notification function that sends a message to the Telegram bot with the new posts.
