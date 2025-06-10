let trackingSettings = {};
let isTracking = false;

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
  sendResponse({ success: true });
}

function stopTracking(sendResponse) {
  isTracking = false;
  trackingSettings = {};
  sendResponse({ success: true });
}

function getStatus(sendResponse) {
  sendResponse({ isTracking, settings: trackingSettings });
}
