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
            filterTime: filterTimeInput.value,
            processedPostIds: [] // Reset processed posts when settings change
        };

        // Validate required fields
        if (!settings.postLink || !settings.botToken || !settings.chatId) {
            alert('Please fill in all required fields (Post Link, Bot Token, Chat ID)');
            return;
        }

        // Validate refresh interval
        if (isNaN(settings.refreshInterval) || settings.refreshInterval < 1) {
            alert('Refresh interval must be a number greater than 0');
            return;
        }

        chrome.storage.local.set(settings, function() {
            // Provide feedback to the user
            const status = document.createElement('div');
            status.textContent = 'Settings saved successfully!';
            status.style.color = 'green';
            status.style.marginTop = '10px';
            saveButton.insertAdjacentElement('afterend', status);
            
            // Remove the status message after 3 seconds
            setTimeout(() => {
                status.remove();
            }, 3000);
        });
    });
});
