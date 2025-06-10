// trackingSettings:
//
let trackingSettings = {};
let isTracking = false;
let trackingInterval = null;
let currentTabId = null;
const set10 = new Set([
  "10m",
  "9m",
  "8m",
  "7m",
  "6m",
  "5m",
  "4m",
  "3m",
  "2m",
  "1m",
]);
const set5 = new Set(["5m", "4m", "3m", "2m", "1m"]);
// Restore state on service worker startup
restoreTrackingState();

// Enable side panel to open when action icon is clicked
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Open the side panel when the extension icon is clicked (Chrome 114+)
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.setOptions({
    tabId: tab.id,
    path: "sidebar.html",
    enabled: true,
  });
  await chrome.sidePanel.open({ tabId: tab.id });
});

// Listen for messages from sidebar
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "updateSettings":
      trackingSettings = request.settings;
      saveTrackingState();
      break;
    case "startTracking":
      startTracking(request.settings, sendResponse);
      break;
    case "stopTracking":
      stopTracking(sendResponse);
      break;
    case "getStatus":
      getStatus(sendResponse);
      break;
    case "clearSentList":
      clearSentList(sendResponse);
      break;
  }
  return true; // Keep message channel open for async response
});

/**
 * Initiates the Facebook post tracking process with the specified settings.
 *
 * Updates the tracking configuration, marks tracking as active, persists the state, and begins monitoring posts according to the provided settings.
 */
function startTracking(settings, sendResponse) {
  trackingSettings = settings;
  isTracking = true;
  saveTrackingState();

  // Start the tracking process
  startTrackingProcess();

  sendResponse({ success: true });
}

/**
 * Stops the active tracking process, clears tracking state, and closes the tracking tab if open.
 *
 * @param {function} sendResponse - Callback to send the operation result.
 */
function stopTracking(sendResponse) {
  isTracking = false;
  trackingSettings = {};
  saveTrackingState();

  // Clear the tracking interval
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }

  // Close the tracking tab if it exists
  if (currentTabId) {
    chrome.tabs.remove(currentTabId).catch(() => {});
    currentTabId = null;
  }

  sendResponse({ success: true });
}

/**
 * Sends the current tracking status and settings in the response.
 *
 * @param {function} sendResponse - Callback to send the status and settings.
 */
function getStatus(sendResponse) {
  sendResponse({ isTracking, settings: trackingSettings });
}

/**
 * Removes the stored list of sent posts from local storage.
 *
 * @param {function} sendResponse - Callback to send the operation result.
 */
function clearSentList(sendResponse) {
  // Clear the sent_list in storage
  // remove sent_list from storage
  chrome.storage.local.remove("sent_list", () => {
    console.log("Sent list cleared");
    sendResponse({ success: true });
  });
}

// Inject scroll to bottom after every reload to fetch more data
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    tabId === currentTabId &&
    changeInfo.status === "complete" &&
    isTracking
  ) {
    chrome.scripting
      .executeScript({
        target: { tabId: tabId },
        func: () => {
          return new Promise((resolve) => {
            const handle = () => {
              // Check if we're at the bottom
              if (
                window.scrollY + window.innerHeight >=
                document.body.scrollHeight
              ) {
                window.removeEventListener("scroll", handle);
                resolve("scrolled");
              }
            };
            window.scrollTo({
              top: document.body.scrollHeight,
              behavior: "smooth",
            });
            window.addEventListener("scroll", handle);
            // Fallback: resolve after 2s in case scroll event doesn't fire
            setTimeout(() => {
              window.removeEventListener("scroll", handle);
              resolve("timeout");
            }, 10000);
          });
        },
      })
      .then((results) => {
        // results[0].result will be "scrolled" or "timeout"
        console.log("Scroll finished:", results[0]?.result);

        // Ask the content script to extract posts after scrolling
        chrome.tabs.sendMessage(
          tabId,
          { action: "extractPosts" },
          async (posts) => {
            sendNotification(await filterPosts(posts));
          }
        );
      })
      .catch((error) => console.error("Auto-scroll injection failed:", error));
  }
});

/**
 * Persists the current tracking state, including status, settings, and active tab ID, to local storage.
 *
 * @remark
 * Errors during the save operation are logged but do not interrupt execution.
 */
async function saveTrackingState() {
  try {
    await chrome.storage.local.set({
      trackingState: {
        isTracking,
        trackingSettings,
        currentTabId,
      },
    });
  } catch (error) {
    console.error("Error saving tracking state:", error);
  }
}

/**
 * Restores the previous tracking state from local storage and resumes tracking if it was active.
 *
 * If tracking was previously active, attempts to validate and reuse the saved tracking tab. If the tab is invalid or missing, restarts the tracking process.
 */
async function restoreTrackingState() {
  try {
    const result = await chrome.storage.local.get(["trackingState"]);
    if (result.trackingState) {
      const {
        isTracking: wasTracking,
        trackingSettings: savedSettings,
        currentTabId: savedTabId,
      } = result.trackingState;

      if (wasTracking && savedSettings) {
        console.log("Restoring tracking state...");
        trackingSettings = savedSettings;
        currentTabId = savedTabId;
        isTracking = true;

        // Validate the restored tab and restart tracking if valid
        const isValidTab = await validateTab(currentTabId);
        if (isValidTab) {
          startRefreshCycle();
        } else {
          // Tab is invalid, restart the tracking process
          startTrackingProcess();
        }
      }
    }
  } catch (error) {
    console.error("Error restoring tracking state:", error);
  }
}

/**
 * Initiates the tracking process by locating or creating a browser tab with the specified tracking URL and starting the periodic refresh cycle.
 *
 * @remark If a tab with the tracking URL already exists, it is reused; otherwise, a new inactive tab is created. The current tab ID is saved for future reference.
 */
async function startTrackingProcess() {
  if (!isTracking || !trackingSettings.trackingUrl) {
    return;
  }

  try {
    // Find or create tab with tracking URL
    const tabs = await chrome.tabs.query({ url: trackingSettings.trackingUrl });
    let targetTab;

    if (tabs.length > 0) {
      targetTab = tabs[0];
      console.log("Found existing tab:", targetTab.id);
    } else {
      // Create new tab with tracking URL
      targetTab = await chrome.tabs.create({
        url: trackingSettings.trackingUrl,
        active: false,
      });
      console.log("Created new tab:", targetTab.id);
    }

    currentTabId = targetTab.id;
    saveTrackingState();

    // Start the refresh cycle immediately
    startRefreshCycle();
  } catch (error) {
    console.error("Error starting tracking process:", error);
  }
}

/**
 * Initiates a periodic refresh cycle for the tracking tab based on the configured interval.
 *
 * The function sets up an interval to reload the tracked Facebook tab at the frequency specified in {@link trackingSettings.refreshTime}. If the tab becomes invalid, it attempts to recreate it to maintain continuous tracking.
 *
 * @remark The refresh cycle is automatically stopped if tracking is deactivated or the tab is no longer valid.
 */
function startRefreshCycle() {
  if (!isTracking || !currentTabId) {
    return;
  }

  console.log(
    `Starting refresh cycle every ${trackingSettings.refreshTime} seconds`
  );

  // Set up interval for refreshing (refreshTime is in seconds)
  trackingInterval = setInterval(async () => {
    if (!isTracking) {
      clearInterval(trackingInterval);
      return;
    }

    try {
      // Validate tab exists before attempting operations
      const isValidTab = await validateTab(currentTabId);
      if (!isValidTab) {
        console.log("Tab is invalid, attempting to recreate...");
        await recreateTrackingTab();
        return;
      }

      // Refresh the page
      console.log("Attempting to reload tab:", currentTabId);
      await chrome.tabs.reload(currentTabId);
      console.log("Page refreshed successfully");
    } catch (error) {
      console.error("Error refreshing page:", error);
      // If reload fails, the tab might be invalid
      const isValid = await validateTab(currentTabId);
      if (!isValid) {
        console.log(
          "Tab invalid after reload attempt, will recreate on next cycle"
        );
      }
    }
  }, trackingSettings.refreshTime * 1000); // Convert seconds to milliseconds
}

/**
 * Checks whether a tab with the given ID exists, is a Facebook page, and is currently loaded.
 *
 * @param {number} tabId - The ID of the tab to validate.
 * @returns {Promise<boolean>} True if the tab exists, has a Facebook URL, and is not unloaded; otherwise, false.
 */
async function validateTab(tabId) {
  if (!tabId) return false;

  try {
    const tab = await chrome.tabs.get(tabId);
    return (
      tab &&
      tab.url &&
      tab.url.includes("facebook.com") &&
      tab.status !== "unloaded"
    );
  } catch (error) {
    console.error("Tab validation failed:", error);
    return false;
  }
}

/**
 * Finds or creates a browser tab for the current tracking URL and updates the tracking state.
 *
 * If a tab with the tracking URL exists, it is reused; otherwise, a new inactive tab is created. Updates the current tab ID and persists the tracking state.
 *
 * @remark If no tracking URL is set in the tracking settings, the function logs an error and does nothing.
 */
async function recreateTrackingTab() {
  if (!trackingSettings.trackingUrl) {
    console.error("Cannot recreate tab: no tracking URL");
    return;
  }

  try {
    // Clear the invalid tab reference
    currentTabId = null;

    // Find existing tab or create new one
    const tabs = await chrome.tabs.query({ url: trackingSettings.trackingUrl });
    let targetTab;

    if (tabs.length > 0) {
      targetTab = tabs[0];
      console.log("Found existing tab:", targetTab.id);
    } else {
      targetTab = await chrome.tabs.create({
        url: trackingSettings.trackingUrl,
        active: false,
      });
      console.log("Created new tab:", targetTab.id);
    }

    currentTabId = targetTab.id;
    saveTrackingState();
  } catch (error) {
    console.error("Error recreating tracking tab:", error);
  }
}

/**
 * Filters posts to identify new, unsent posts within the configured recent time window.
 *
 * Checks each post against a stored list of previously sent post IDs and the current time filter setting. Only posts that have not been sent and whose time matches the selected time window ("10" or "5" minutes) are included. Newly filtered posts are added to the sent list in storage to prevent duplicate notifications.
 *
 * @param {Array<Object>} posts - List of post objects to filter. Each post must have `postId` and `time` properties.
 * @returns {Promise<Array<Object>>} A promise that resolves to the array of filtered, unsent posts matching the time criteria.
 */

async function filterPosts(posts) {
  // Await the retrieval of sent_list from storage
  const result = await new Promise((resolve) =>
    chrome.storage.local.get(["sent_list"], resolve)
  );
  // set sentList to result.sent_list if it exists, otherwise set to empty Set
  let sentList = result.sent_list ? new Set(result.sent_list) : new Set();

  console.log("sentList", sentList);

  // get timeOption from trackingSettings
  const filteredPosts = posts.filter((post) => {
    // check if postId is already sent
    if (sentList.has(post.postId)) {
      console.log(`Post ${post.postId} already sent, skipping...`);
      return false;
    }

    // if option is 10 => get this 10m 9m 8m 7m 6m 5m 4m 3m 2m 1m
    if (trackingSettings.timeOption === "10" && set10.has(post.time)) {
      // add to sentList
      sentList.add(post.postId);
      // save sentList to storage
      chrome.storage.local.set({ sent_list: Array.from(sentList) }, () => {
        console.log(`Post ${post.postId} added to sent_list`);
      });
      return true;
    }

    // if option is 5 => get this 5m 4m 3m 2m 1m
    if (trackingSettings.timeOption === "5" && set5.has(post.time)) {
      // add to sentList
      sentList.add(post.postId);
      // save sentList to storage
      chrome.storage.local.set({ sent_list: Array.from(sentList) }, () => {
        console.log(`Post ${post.postId} added to sent_list`);
      });
      return true;
    }

    return false;
  });

  return filteredPosts;
}

/**
 * Sends notifications for new posts using enabled notification channels.
 *
 * If Telegram notifications are enabled in the tracking settings, each post is sent via Telegram.
 *
 * @param {Array<Object>} posts - List of new post objects to notify about.
 */
function sendNotification(posts) {
  // options is ["telegram","discord","email"]
  if (!posts || posts.length === 0) {
    console.log("No new posts to send notifications for.");
    return;
  }
  // send to telegram
  if (trackingSettings.enableTelegram) {
    posts.forEach((post) => sendToTelegram(post));
  }
}

/**
 * Sends a Facebook post notification to a configured Telegram chat via a proxy API.
 *
 * Formats the post details and sends them as a message to the specified Telegram chat or thread using the bot token and chat ID from the current tracking settings.
 *
 * @param {Object} post - The Facebook post to notify about.
 * @param {string} post.author - The author of the post.
 * @param {string} post.link - The URL to the post.
 * @param {string} post.content - The content of the post.
 * @param {string} post.time - The time the post was made.
 * @param {string} post.postId - The unique identifier of the post.
 *
 * @remark
 * If a Telegram thread ID is configured, the message is sent to that thread within the chat.
 */
async function sendToTelegram(post) {
  const { telegramBotToken, telegramChatId, telegramThreadId } =
    trackingSettings;

  // telegram api url
  const telegramApiUrl = `https://cf-worker-telegram.longpham16072001.workers.dev/bot${telegramBotToken}/sendMessage`;

  const message = `
New Facebook Post Detected!
Author: ${post.author}
Link: ${post.link}
Content: ${post.content}
Time: ${post.time}
  `;

  const payload = {
    chat_id: telegramChatId,
    text: message,
    parse_mode: "HTML",
  };

  if (telegramThreadId) {
    payload.message_thread_id = telegramThreadId;
  }

  try {
    const response = await fetch(telegramApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.statusText}`);
    }

    console.log(`Post sent to Telegram: ${post.postId}`);
  } catch (error) {
    console.error("Failed to send to Telegram:", error);
  }
}
