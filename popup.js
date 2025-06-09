document.getElementById("save").addEventListener("click", async () => {
  const telegramBotToken = document.getElementById("telegramBotToken").value;
  const telegramChatId = document.getElementById("telegramChatId").value;
  const groupUrl = document.getElementById("groupUrl").value;
  const refreshInterval =
    parseInt(document.getElementById("refreshInterval").value) || 60;
  const scanRange = parseInt(document.getElementById("scanRange").value) || 2;

  console.log("Saving settings:", {
    telegramBotToken,
    telegramChatId,
    groupUrl,
    refreshInterval,
    scanRange,
  });
  //   // Get existing settings to merge with new values
  //   const existingSettings = await (window.storageService?.getSettings() ||
  //     Promise.resolve({}));
  //   const newSettings = {
  //     ...existingSettings,
  //     telegramBotToken:
  //       telegramBotToken || existingSettings.telegramBotToken || "",
  //     telegramChatId: telegramChatId || existingSettings.telegramChatId || "",
  //     groupUrl: groupUrl || existingSettings.groupUrl || "",
  //     refreshInterval:
  //       (refreshInterval >= 10
  //         ? refreshInterval
  //         : existingSettings.refreshInterval) || 60,
  //     scanRange: (scanRange >= 1 ? scanRange : existingSettings.scanRange) || 2,
  //   };

  //   await window.storageService?.setSettings(newSettings);
  //   chrome.runtime.sendMessage({ action: "startTracking" });
  //   alert("Settings saved and tracking started!");
  // });

  // document.getElementById("testSend").addEventListener("click", async () => {
  //   const telegramBotToken = document.getElementById("telegramBotToken").value;
  //   const telegramChatId = document.getElementById("telegramChatId").value;
  //   const testResult = document.getElementById("testResult");

  //   if (telegramBotToken && telegramChatId) {
  //     try {
  //       await window.sendToTelegram(
  //         telegramBotToken,
  //         telegramChatId,
  //         "Test message from Group Post Tracker"
  //       );
  //       testResult.style.display = "block";
  //       testResult.style.color = "#28a745";
  //       testResult.textContent = "Test message sent successfully!";
  //       setTimeout(() => {
  //         testResult.style.display = "none";
  //       }, 3000);
  //     } catch (error) {
  //       testResult.style.display = "block";
  //       testResult.style.color = "#dc3545";
  //       testResult.textContent = "Test failed. Check token and chat ID.";
  //       setTimeout(() => {
  //         testResult.style.display = "none";
  //       }, 3000);
  //     }
  //   } else {
  //     testResult.style.display = "block";
  //     testResult.style.color = "#dc3545";
  //     testResult.textContent = "Please enter token and chat ID first.";
  //     setTimeout(() => {
  //       testResult.style.display = "none";
  //     }, 3000);
  //   }
});

// Load saved settings
async function loadSettings() {
  try {
    const data = await (window.storageService?.getSettings() ||
      Promise.resolve({}));
    document.getElementById("telegramBotToken").value =
      data.telegramBotToken || "";
    document.getElementById("telegramChatId").value = data.telegramChatId || "";
    document.getElementById("groupUrl").value = data.groupUrl || "";
    document.getElementById("refreshInterval").value =
      data.refreshInterval || "60";
    document.getElementById("scanRange").value = data.scanRange || "2";
  } catch (error) {
    console.error("Failed to load settings:", error);
  }
}
loadSettings();
