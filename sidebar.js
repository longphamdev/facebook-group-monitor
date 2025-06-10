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
  const enableTelegram = document.getElementById("enableTelegram");
  const enableDiscord = document.getElementById("enableDiscord");

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

  /**
   * Loads saved tracking and integration settings from Chrome's synchronized storage and updates the corresponding UI fields.
   *
   * Displays an error status message if settings cannot be loaded.
   */
  async function loadSettings() {
    try {
      const result = await chrome.storage.sync.get([
        "trackingUrl",
        "refreshTime",
        "timeOption",
        "telegramChatId",
        "telegramThreadId",
        "telegramBotToken",
        "enableTelegram",
        "enableDiscord",
      ]);
      trackingUrlInput.value = result.trackingUrl || "";
      refreshTimeInput.value = result.refreshTime || 60;
      timeOption.value = result.timeOption || "10";
      telegramChatId.value = result.telegramChatId || "";
      telegramThreadId.value = result.telegramThreadId || "";
      telegramBotToken.value = result.telegramBotToken || "";
      enableTelegram.checked = !!result.enableTelegram;
      enableDiscord.checked = !!result.enableDiscord;
    } catch (error) {
      showStatus("Error loading settings", "error");
    }
  }

  /**
   * Saves the current tracking and integration settings to Chrome's synchronized storage.
   *
   * Validates that the tracking URL is present and contains "facebook.com" before saving. On success, displays a confirmation message and notifies the runtime to update settings. Shows an error message if validation fails or if saving encounters an error.
   */
  async function saveSettings() {
    const settings = {
      trackingUrl: trackingUrlInput.value.trim(),
      refreshTime: parseInt(refreshTimeInput.value) || 60,
      timeOption: timeOption.value,
      telegramChatId: telegramChatId.value,
      telegramThreadId: telegramThreadId.value,
      telegramBotToken: telegramBotToken.value,
      enableTelegram: enableTelegram.checked,
      enableDiscord: enableDiscord.checked,
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

  /**
   * Updates the UI to reflect the current tracking status by querying the extension runtime.
   *
   * Displays whether tracking is "Running" or "Stopped" and applies corresponding color coding.
   */
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

  /**
   * Displays a status message with styling based on the message type and hides it after 5 seconds.
   *
   * @param {string} message - The message to display to the user.
   * @param {string} type - The type of message, such as "success" or "error", which determines the styling.
   */
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = "block";

    setTimeout(() => {
      statusDiv.style.display = "none";
    }, 5000); // Hide after 5 seconds
  }

  /**
   * Initiates the tracking process using the current settings from the UI.
   *
   * Displays a success or error message based on the outcome and updates the tracking status indicator.
   * If the tracking URL is missing, prompts the user to save settings first.
   */
  async function startTracking() {
    const settings = {
      trackingUrl: trackingUrlInput.value.trim(),
      refreshTime: parseInt(refreshTimeInput.value) || 60,
      timeOption: timeOption.value,
      telegramChatId: telegramChatId.value,
      telegramThreadId: telegramThreadId.value,
      telegramBotToken: telegramBotToken.value,
      enableTelegram: enableTelegram.checked,
      enableDiscord: enableDiscord.checked,
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

  /**
   * Sends a request to stop the tracking process and updates the UI based on the result.
   *
   * Displays a success message and refreshes the tracking status if stopping succeeds; otherwise, shows an error message.
   */
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

  /**
   * Sends a request to clear the sent list and displays a status message based on the result.
   *
   * @remark
   * Shows a success message if the sent list is cleared, or an error message if the operation fails.
   */
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
