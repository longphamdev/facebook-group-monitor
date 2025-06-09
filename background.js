let isTracking = false;
let intervalId = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "startTracking") {
    chrome.storage.sync.get(
      [
        "groupUrl",
        "refreshInterval",
        "telegramBotToken",
        "telegramChatId",
        "scanDelay",
      ],
      (data) => {
        if (data.groupUrl && data.telegramBotToken && data.telegramChatId) {
          isTracking = true;
          startTracking(
            data.groupUrl,
            data.refreshInterval || 60,
            data.telegramBotToken,
            data.telegramChatId,
            data.scanDelay || 2
          );
        }
      }
    );
  } else if (request.action === "stopTracking") {
    stopTracking();
  }
});

function startTracking(groupUrl, refreshInterval, botToken, chatId, scanDelay) {
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(async () => {
    chrome.tabs.query({ url: groupUrl }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.reload(tabs[0].id);
        setTimeout(() => {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "fetchPosts",
            botToken,
            chatId,
          });
        }, scanDelay * 1000);
      }
    });
  }, refreshInterval * 1000);
}

function stopTracking() {
  isTracking = false;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
