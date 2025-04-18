document.addEventListener('DOMContentLoaded', function() {
    const postLinkInput = document.getElementById('postLink');
    const botTokenInput = document.getElementById('botToken');
    const chatIdInput = document.getElementById('chatId');
    const refreshIntervalInput = document.getElementById('refreshInterval');
    const filterTimeInput = document.getElementById('filterTime');
    const saveButton = document.getElementById('saveSettings');

    // Load saved settings when the popup opens
    chrome.storage.local.get(['postLink', 'botToken', 'chatId', 'refreshInterval', 'filterTime'], function(result) {
        if (result.postLink) {
            postLinkInput.value = result.postLink;
        }
        if (result.botToken) {
            botTokenInput.value = result.botToken;
        }
        if (result.chatId) {
            chatIdInput.value = result.chatId;
        }
        if (result.refreshInterval) {
            refreshIntervalInput.value = result.refreshInterval;
        }
        if (result.filterTime) {
            filterTimeInput.value = result.filterTime;
        }
    });

    // Save settings when the button is clicked
    saveButton.addEventListener('click', function() {
        const settings = {
            postLink: postLinkInput.value,
            botToken: botTokenInput.value,
            chatId: chatIdInput.value,
            refreshInterval: refreshIntervalInput.value,
            filterTime: filterTimeInput.value
        };

        chrome.storage.local.set(settings, function() {
            // Optional: Provide feedback to the user
            alert('Settings saved!');
            // Optionally close the popup after saving
            // window.close();
        });
    });
});
