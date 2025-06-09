chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchPosts") {
    handleFetchPosts(request.botToken, request.chatId);
  }
});

async function handleFetchPosts(botToken, chatId) {
  const newPosts = await fetchNewPosts();
  for (const post of newPosts) {
    const message = `New Post\nAuthor: ${post.author}\nContent: ${post.content}\nTime: ${post.timestamp}`;
    await sendToTelegram(botToken, chatId, message);
  }
}
