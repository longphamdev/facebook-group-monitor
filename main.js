

// Extract facebook post link
const postLinkElement = postElement.querySelector('a[href*="/posts/"]');
const postUrl = postLinkElement?.href || null;

console.log(postUrl);

// Extract time upload from post
const timeString =
  postElement.querySelector('a[href*="/posts/"]').textContent.trim() || "";

// convert to timestamp
const now = Date.now();

// timeString can be "1h", "2m", "3d"
let timestamp = null;

if (timeString.includes("h")) {
  const num = parseInt(timeString);
  timestamp = now - num * 3600 * 1000; // Hours to milliseconds
}
if (timeString.includes("m")) {
  const num = parseInt(timeString);
  timestamp = now - num * 60 * 1000; // Minutes to milliseconds
}
if (timeString.includes("d")) {
  const num = parseInt(timeString);
  timestamp = now - num * 86400 * 1000; // Days to milliseconds
}

console.log(timestamp);

// Extract post content

const postContentElement =
  postElement
    .querySelector(
      'div[data-ad-rendering-role="story_message"] div.xdj266r.x11i5rnm.xat24cr.x1mh8g0r.x1vvkbs'
    )
    .textContent.trim() || "";
