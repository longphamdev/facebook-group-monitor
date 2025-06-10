function extractPostsFromDOM() {
  const posts = [];
  document.querySelectorAll('div[role="article"]').forEach((elem) => {
    const author =
      elem.querySelector('h3 a[role="link"] strong span')?.textContent.trim() ||
      "";
    const autoDivs = Array.from(elem.querySelectorAll('div[dir="auto"]'));
    let content = "";
    for (const div of autoDivs) {
      const text = div.textContent.trim();
      if (text && text !== author && !/^\d{1,2} [A-Za-z]+$/.test(text)) {
        content = text;
        break;
      }
    }
    const timeElem = elem.querySelector('a[aria-label][href*="/posts/"]');
    const time = timeElem?.textContent.trim() || "";
    let link = timeElem?.getAttribute("href") || "";
    if (link.startsWith("/")) link = "https://www.facebook.com" + link;
    let postId = "";
    const match = link.match(/\/posts\/(\d+)/);
    if (match) postId = match[1];
    posts.push({ author, link, content, time, postId });
  });
  return posts;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractPosts") {
    const posts = extractPostsFromDOM();
    sendResponse(posts);
  }
  return true;
});
