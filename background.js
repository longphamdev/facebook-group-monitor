let refreshInterval = 60; // Default interval in seconds
let postLink = '';
const alarmName = 'facebookRefreshAlarm';

// Function to get settings and update local variables
function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['refreshInterval', 'postLink'], function(result) {
      if (result.refreshInterval) {
        // Convert minutes from popup (if it was minutes) to seconds for alarm
        // Assuming the input is already in seconds as per todo.md
        const intervalSeconds = parseInt(result.refreshInterval, 10);
        if (!isNaN(intervalSeconds) && intervalSeconds > 0) {
           // chrome.alarms API uses minutes for periodInMinutes
           refreshInterval = intervalSeconds / 60;
        } else {
            console.warn("Invalid refresh interval found in storage, using default.");
            refreshInterval = 1; // Default to 1 minute if invalid
        }
      } else {
          refreshInterval = 1; // Default to 1 minute if not set
      }

      if (result.postLink) {
        postLink = result.postLink;
      } else {
        postLink = ''; // Clear postLink if not set
      }
      console.log(`Settings loaded: Interval ${refreshInterval} minutes, Link: ${postLink}`);
      resolve();
    });
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
        periodInMinutes: refreshInterval
      });
      console.log(`Alarm '${alarmName}' created with interval: ${refreshInterval} minutes for link: ${postLink}`);
    } else {
      console.log(`Alarm not set. Interval: ${refreshInterval}, Post Link: ${postLink}`);
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
                console.error(`Error reloading tab ${tabId}:`, chrome.runtime.lastError.message);
            } else {
                console.log(`Tab ${tabId} reloaded successfully.`);
                // Inject content script after reload if needed, or handle in manifest
            }
        });
      } else {
        console.log(`No open tab found with URL: ${postLink}`);
      }
    });
  }
});

// Listener for changes in storage (e.g., when settings are saved in the popup)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    let settingsChanged = false;
    for (let key in changes) {
      if (key === 'refreshInterval' || key === 'postLink') {
        settingsChanged = true;
        break;
      }
    }
    if (settingsChanged) {
      console.log('Settings changed in storage. Re-evaluating alarm setup.');
      setupAlarm(); // Reload settings and reset the alarm
    }
  }
});

// Initial setup when the extension starts
console.log("Background script started. Setting up initial alarm.");
setupAlarm();
