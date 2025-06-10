let trackingSettings = {};
let isTracking = false;
let trackingInterval = null;
let currentTabId = null;

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
          window.scrollTo({
            top: document.body.scrollHeight,
            behavior: "smooth",
          });
        },
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
