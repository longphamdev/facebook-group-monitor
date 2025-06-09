async function fetchNewPosts() {
  const postElements = document.querySelectorAll('div[role="article"]'); // Common Facebook post selector
  const seenPosts = await getSeenPosts();
  const newPosts = [];

  postElements.forEach((post) => {
    const postId = post.getAttribute("data-id") || post.innerText.slice(0, 50); // Unique identifier
    if (!seenPosts[postId]) {
      const postData = {
        id: postId,
        author: post.querySelector("h3, h4")?.innerText || "Unknown",
        content:
          post.querySelector('div[data-ad-comet-preview="message"]')
            ?.innerText || "No content",
        timestamp:
          post.querySelector("span.timestampContent")?.innerText ||
          new Date().toISOString(),
      };
      newPosts.push(postData);
      seenPosts[postId] = true;
    }
  });

  await setSeenPosts(seenPosts);
  return newPosts;
}
