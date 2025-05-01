let refreshInterval = 60; // Default interval in seconds
let postLink = "";
const alarmName = "facebookRefreshAlarm";

// Function to get settings and update local variables
function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ["refreshInterval", "postLink"],
      function (result) {
        if (result.refreshInterval) {
          // Convert minutes from popup (if it was minutes) to seconds for alarm
          // Assuming the input is already in seconds as per todo.md
          const intervalSeconds = parseInt(result.refreshInterval, 10);
          if (!isNaN(intervalSeconds) && intervalSeconds > 0) {
            // chrome.alarms API uses minutes for periodInMinutes
            refreshInterval = intervalSeconds / 60;
          } else {
            console.warn(
              "Invalid refresh interval found in storage, using default."
            );
            refreshInterval = 1; // Default to 1 minute if invalid
          }
        } else {
          refreshInterval = 1; // Default to 1 minute if not set
        }

        if (result.postLink) {
          postLink = result.postLink;
        } else {
          postLink = ""; // Clear postLink if not set
        }
        console.log(
          `Settings loaded: Interval ${refreshInterval} minutes, Link: ${postLink}`
        );
        resolve();
      }
    );
  });
}

// Function to set up or clear the alarm based on settings
async function setupAlarm() {
  await loadSettings(); // Ensure latest settings are loaded

  // Clear any existing alarm first
  chrome.alarms.clear(alarmName, (wasCleared) => {
    console.log(`Previous alarm cleared: ${wasCleared}`);

    // Only set a new alarm if we have a valid interval and post link
    if (refreshInterval > 0 && postLink) {
      chrome.alarms.create(alarmName, {
        // delayInMinutes: 0.1, // Start after a short delay (e.g., 6 seconds)
        periodInMinutes: refreshInterval,
      });
      console.log(
        `Alarm '${alarmName}' created with interval: ${refreshInterval} minutes for link: ${postLink}`
      );
    } else {
      console.log(
        `Alarm not set. Interval: ${refreshInterval}, Post Link: ${postLink}`
      );
    }
  });
}

// Listener for when the alarm goes off
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === alarmName) {
    console.log("Alarm triggered:", alarmName);
    await loadSettings(); // Load latest settings before acting

    if (!postLink) {
      console.log("No post link configured. Skipping refresh.");
      return;
    }

    // Find the tab with the matching URL
    chrome.tabs.query({ url: postLink }, (tabs) => {
      if (tabs && tabs.length > 0) {
        const tabId = tabs[0].id;
        console.log(`Found tab ${tabId} with URL ${postLink}. Refreshing...`);
        chrome.tabs.reload(tabId, () => {
          if (chrome.runtime.lastError) {
            console.log(
              `Error reloading tab ${tabId}:`,
              chrome.runtime.lastError.message
            );
          } else {
            console.log(`Tab ${tabId} reloaded successfully.`);
            // After reload, wait a bit then trigger content script
            setTimeout(() => {
              chrome.tabs.sendMessage(
                tabId,
                { type: "SCROLL_AND_EXTRACT" },
                (response) => {
                  if (chrome.runtime.lastError) {
                    console.log(
                      "Error sending message to content script:",
                      chrome.runtime.lastError.message
                    );
                  } else if (response) {
                    console.log("Content script response:", response);
                  }
                }
              );
            }, 5000); // Wait 5 seconds for page to load
          }
        });
      } else {
        console.log(`No open tab found with URL: ${postLink}`);
      }
    });
  }
});

// Function to send post to Telegram
async function sendToTelegram(post) {
  const settings = await chrome.storage.local.get(["botToken", "chatId"]);
  if (!settings.botToken || !settings.chatId) {
    console.log("Telegram bot token or chat ID not configured");
    return;
  }

  const message = `New Facebook post:\n\n${post.text}\n\nView post: ${post.url}`;
  const apiUrl = `https://api.telegram.org/bot${settings.botToken}/sendMessage`;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: settings.chatId,
        text: message,
        disable_web_page_preview: false,
      }),
    });

    const data = await response.json();
    if (!data.ok) {
      console.log("Telegram API error:", data.description);
    } else {
      console.log("Message sent to Telegram successfully");
    }
  } catch (error) {
    console.log("Error sending to Telegram:", error);
  }
}

// Listen for new posts from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "NEW_POSTS" && request.posts) {
    console.log(
      `Received ${request.posts.length} new posts from content script`
    );

    // Process all posts in parallel
    Promise.all(
      request.posts.map((post) =>
        sendToTelegram(post).catch((error) => {
          console.log(`Error processing post ${post.id}:`, error);
          return { id: post.id, status: "failed", error };
        })
      )
    ).then((results) => {
      const successCount = results.filter((r) => r && !r.error).length;
      const failCount = results.length - successCount;
      console.log(
        `Processed ${successCount} posts successfully, ${failCount} failed`
      );
      sendResponse({
        status: "processed",
        successCount,
        failCount,
      });
    });

    return true; // Keep message channel open for async response
  }
});

// Listener for changes in storage (e.g., when settings are saved in the popup)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local") {
    let settingsChanged = false;
    for (let key in changes) {
      if (key === "refreshInterval" || key === "postLink") {
        settingsChanged = true;
        break;
      }
    }
    if (settingsChanged) {
      console.log("Settings changed in storage. Re-evaluating alarm setup.");
      setupAlarm(); // Reload settings and reset the alarm
    }
  }
});

// Initial setup when the extension starts
console.log("Background script started. Setting up initial alarm.");
setupAlarm();
