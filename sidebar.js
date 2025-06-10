document.addEventListener("DOMContentLoaded", function () {
  const trackingUrlInput = document.getElementById("trackingUrl");
  const afterCurrentTimeInput = document.getElementById("afterCurrentTime");
  const refreshTimeInput = document.getElementById("refreshTime");
  const saveButton = document.getElementById("saveSettings");
  const startButton = document.getElementById("startTracking");
  const stopButton = document.getElementById("stopTracking");
  const statusDiv = document.getElementById("status");
  const trackingStatusDiv = document.getElementById("trackingStatus");
  const statusText = document.getElementById("statusText");

  // Load saved settings and status on startup
  loadSettings();
  updateTrackingStatus();

  // Event listeners
  saveButton.addEventListener("click", saveSettings);
  startButton.addEventListener("click", startTracking);
  stopButton.addEventListener("click", stopTracking);

  async function loadSettings() {
    try {
      const result = await chrome.storage.sync.get([
        "trackingUrl",
        "afterCurrentTime",
        "refreshTime",
      ]);

      trackingUrlInput.value = result.trackingUrl || "";
      afterCurrentTimeInput.value = result.afterCurrentTime || 5;
      refreshTimeInput.value = result.refreshTime || 30;
    } catch (error) {
      showStatus("Error loading settings", "error");
    }
  }

  async function saveSettings() {
    const settings = {
      trackingUrl: trackingUrlInput.value.trim(),
      afterCurrentTime: parseInt(afterCurrentTimeInput.value) || 5,
      refreshTime: parseInt(refreshTimeInput.value) || 30,
    };

    // Validate URL
    if (!settings.trackingUrl) {
      showStatus("Please enter a tracking URL", "error");
      return;
    }

    if (!settings.trackingUrl.includes("facebook.com")) {
      showStatus("Please enter a valid Facebook URL", "error");
      return;
    }

    try {
      await chrome.storage.sync.set(settings);
      showStatus("Settings saved successfully!", "success");

      // Send settings to background script
      chrome.runtime.sendMessage({
        action: "updateSettings",
        settings: settings,
      });
    } catch (error) {
      showStatus("Error saving settings", "error");
    }
  }
  async function updateTrackingStatus() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "getStatus",
      });
      trackingStatusDiv.style.display = "block";
      statusText.textContent = response.isTracking ? "Running" : "Stopped";
      statusText.style.color = response.isTracking ? "#42b883" : "#e74c3c";
    } catch (error) {
      console.error("Error getting status:", error);
    }
  }

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = "block";

    setTimeout(() => {
      statusDiv.style.display = "none";
    }, 5000); // Hide after 5 seconds
  }

  async function startTracking() {
    const settings = {
      trackingUrl: trackingUrlInput.value.trim(),
      afterCurrentTime: parseInt(afterCurrentTimeInput.value) || 5,
      refreshTime: parseInt(refreshTimeInput.value) || 30,
    };

    if (!settings.trackingUrl) {
      showStatus("Please save settings first", "error");
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: "startTracking",
        settings: settings,
      });

      if (response.success) {
        showStatus("Tracking started!", "success");
        updateTrackingStatus();
      }

    } catch (error) {
      showStatus("Error starting tracking", "error");
      console.error("Error starting tracking:", error);
    }
  }

  async function stopTracking() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "stopTracking",
      });

      if (response.success) {
        showStatus("Tracking stopped!", "success");
        updateTrackingStatus();
      }
    } catch (error) {
      showStatus("Error stopping tracking", "error");
    }
  }
});
