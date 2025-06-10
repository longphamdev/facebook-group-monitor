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

function startTracking(settings, sendResponse) {
  trackingSettings = settings;
  isTracking = true;
  saveTrackingState();

  // Start the tracking process
  startTrackingProcess();

  sendResponse({ success: true });
}

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

function getStatus(sendResponse) {
  sendResponse({ isTracking, settings: trackingSettings });
}

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
            }, 5000);
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

// filter function

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

// notification function
function sendNotification(posts) {
  // options is ["telegram","discord","email"]
  if (!posts || posts.length === 0) {
    console.log("No new posts to send notifications for.");
    return;
  }
  // send to telegram
  posts.forEach((post) => sendToTelegram(post));
}

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
