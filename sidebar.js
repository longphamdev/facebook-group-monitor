document.addEventListener("DOMContentLoaded", function () {
  const trackingUrlInput = document.getElementById("trackingUrl");
  const refreshTimeInput = document.getElementById("refreshTime");
  const saveButton = document.getElementById("saveSettings");
  const startButton = document.getElementById("startTracking");
  const stopButton = document.getElementById("stopTracking");
  const statusDiv = document.getElementById("status");
  const trackingStatusDiv = document.getElementById("trackingStatus");
  const statusText = document.getElementById("statusText");
  const timeOption = document.getElementById("timeOption");
  const telegramChatId = document.getElementById("telegramChatId");
  const telegramThreadId = document.getElementById("telegramThreadId");
  const telegramBotToken = document.getElementById("telegramBotToken");
  const clearSentListButton = document.getElementById("clearSentList");

  // Load saved settings and status on startup
  loadSettings();
  updateTrackingStatus();

  // Event listeners
  saveButton.addEventListener("click", saveSettings);
  startButton.addEventListener("click", startTracking);
  stopButton.addEventListener("click", stopTracking);
  clearSentListButton.addEventListener("click", clearSentList);

  // Tab logic (CSP-safe, no inline handlers)
  const tablinks = document.querySelectorAll(".tablinks");
  const tabcontents = document.querySelectorAll(".tabcontent");
  tablinks.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabcontents.forEach((tc) => {
        tc.style.display = "none";
        tc.classList.remove("active");
      });
      tablinks.forEach((tl) => tl.classList.remove("active"));
      const tabId = btn.getAttribute("data-tab");
      document.getElementById(tabId).style.display = "block";
      document.getElementById(tabId).classList.add("active");
      btn.classList.add("active");
    });
  });
  if (tablinks.length) tablinks[0].click();

  async function loadSettings() {
    try {
      const result = await chrome.storage.sync.get([
        "trackingUrl",
        "refreshTime",
        "timeOption",
        "telegramChatId",
        "telegramThreadId",
        "telegramBotToken",
      ]);
      trackingUrlInput.value = result.trackingUrl || "";
      refreshTimeInput.value = result.refreshTime || 60;
      timeOption.value = result.timeOption || "10";
      telegramChatId.value = result.telegramChatId || "";
      telegramThreadId.value = result.telegramThreadId || "";
      telegramBotToken.value = result.telegramBotToken || "";
    } catch (error) {
      showStatus("Error loading settings", "error");
    }
  }

  async function saveSettings() {
    const settings = {
      trackingUrl: trackingUrlInput.value.trim(),
      refreshTime: parseInt(refreshTimeInput.value) || 60,
      timeOption: timeOption.value,
      telegramChatId: telegramChatId.value,
      telegramThreadId: telegramThreadId.value,
      telegramBotToken: telegramBotToken.value,
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
      refreshTime: parseInt(refreshTimeInput.value) || 60,
      timeOption: timeOption.value,
      telegramChatId: telegramChatId.value,
      telegramThreadId: telegramThreadId.value,
      telegramBotToken: telegramBotToken.value,
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

  async function clearSentList() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "clearSentList",
      });
      if (response.success) {
        showStatus("Sent list cleared!", "success");
      } else {
        showStatus("Error clearing sent list", "error");
      }
    } catch (error) {
      showStatus("Error clearing sent list", "error");
    }
  }
});
