// Function to extract post data from a DOM element
// Note: Selectors are placeholders and need to be adjusted based on Facebook's actual DOM structure.
function extractPostData(postElement) {
  const postLinkElement = postElement.querySelector(
    'a[href*="/posts/"], a[href*="/permalink/"]'
  ); // Example selector
  const postTextElement = postElement.querySelector(
    '[data-ad-preview="message"], .userContent'
  ); // Example selector
  const timestampElement = postElement.querySelector("abbr[data-utime]"); // Example selector

  if (!postLinkElement || !timestampElement) {
    // console.log("Skipping element, missing link or timestamp:", postElement);
    return null;
  }

  const postUrl = postLinkElement.href;
  const postId = postUrl.split("/").filter(Boolean).pop(); // Basic way to get an ID
  const postText = postTextElement
    ? postTextElement.innerText.trim()
    : "No text found";
  const timestamp =
    parseInt(timestampElement.getAttribute("data-utime"), 10) * 1000; // Convert to milliseconds

  if (!postId || isNaN(timestamp)) {
    // console.log("Skipping element, invalid ID or timestamp:", postElement);
    return null;
  }

  return {
    id: postId,
    url: postUrl,
    text: postText,
    timestamp: timestamp,
  };
}

// Function to get all posts currently visible on the page
function getAllPosts() {
  // Note: This selector needs to be accurate for Facebook group posts.
  const postElements = document.querySelectorAll('div[role="article"]'); // Example selector

  const posts = [];
  // start at the second element to avoid the first one which are  filter options
  for (let i = 1; i < postElements.length; i++) {
    const postElement = postElements[i];
    const postData = extractPostData(postElement);
    console.log("Post data extracted:", postData);
    if (postData) {
      posts.push(postData);
    }
  }

  return posts;
}

// Function to scroll to the bottom of the page
function scrollToBottom() {
  window.scrollTo(0, document.body.scrollHeight);
  // console.log("Scrolled to bottom.");
}

// Function to filter posts newer than a specific time
function filterNewPosts(posts, filterTimeHours, processedPostIds) {
  const filterTimestamp = Date.now() - filterTimeHours * 60 * 60 * 1000;
  return posts.filter(
    (post) =>
      post.timestamp >= filterTimestamp && !processedPostIds.has(post.id)
  );
}

// Function to send posts to the background script
function sendPostsToBackground(posts) {
  if (posts.length > 0) {
    // console.log(`Sending ${posts.length} new posts to background script.`);
    chrome.runtime.sendMessage(
      { type: "NEW_POSTS", posts: posts },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error sending message to background:",
            chrome.runtime.lastError.message
          );
        } else {
          // console.log("Background script responded:", response);
        }
      }
    );
  } else {
    // console.log("No new posts to send to background.");
  }
}

// Main function to orchestrate the process
async function processPosts() {
  // console.log("Processing posts...");
  const settings = await chrome.storage.local.get([
    "filterTime",
    "processedPostIds",
  ]);
  const filterTimeHours = parseInt(settings.filterTime, 10) || 24; // Default to 24 hours if not set
  const processedPostIds = new Set(settings.processedPostIds || []);

  const allPosts = getAllPosts();
  const newPosts = filterNewPosts(allPosts, filterTimeHours, processedPostIds);

  if (newPosts.length > 0) {
    sendPostsToBackground(newPosts);
    // Update processed IDs
    newPosts.forEach((post) => processedPostIds.add(post.id));
    await chrome.storage.local.set({
      processedPostIds: Array.from(processedPostIds),
    });
    // console.log(`Updated processed post IDs. Total processed: ${processedPostIds.size}`);
  } else {
    // console.log("No new posts found matching criteria.");
  }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // console.log("Message received in content script:", request);
  if (request.type === "SCROLL_AND_EXTRACT") {
    scrollToBottom();
    // Wait a bit for new posts to load after scroll, then process
    setTimeout(() => {
      processPosts()
        .then(() => {
          sendResponse({ status: "processed" });
        })
        .catch((error) => {
          console.error("Error processing posts after scroll:", error);
          sendResponse({ status: "error", message: error.message });
        });
    }, 3000); // Adjust delay as needed
    return true; // Indicates response will be sent asynchronously
  } else if (request.type === "EXTRACT_POSTS_ONLY") {
    // Directly process posts without scrolling (e.g., on initial load)
    processPosts()
      .then(() => {
        sendResponse({ status: "processed" });
      })
      .catch((error) => {
        console.error("Error processing posts:", error);
        sendResponse({ status: "error", message: error.message });
      });
    return true; // Indicates response will be sent asynchronously
  }
});

// Initial processing when the script loads (optional, depends on workflow)
// console.log("Content script loaded. Performing initial post extraction.");
// processPosts();
