## Project Context
Greenfield Node.js project. No existing code.

## Task
Build a Facebook Group post monitor using Chrome DevTools Protocol (CDP).
Connect to an EXISTING running Chrome instance OR inject cookies for headless login.

## Environment Variables (load from .env)
CHROME_CDP_URL=http://127.0.0.1:9223        # CDP endpoint of running Chrome
FB_COOKIES="c_user=123456; xs=abc; datr=xyz; sb=..."  # Raw cookie header string from browser DevTools
GROUP_URLS=["https://www.facebook.com/groups/utcshop"]
HEADLESS=true
INTERVAL_MONITOR=5m
WEBHOOK_URL="https://n8n.longphamthien.us/webhook/xxx"

## Connection Strategy
Use this priority logic in config.js:

1. If CHROME_CDP_URL is set → connect to existing Chrome via puppeteer.connect({ browserURL })
2. If FB_COOKIES is set + no CDP URL → launch new headless Chromium, inject cookies before navigating
3. If both set → prefer CDP connection, fall back to cookie mode if CDP fails

### Cookie Injection Mode (when FB_COOKIES is used)
- Parse the raw cookie string "key=value; key2=value2; ..." into array of cookie objects
- Set cookies on the facebook.com domain via page.setCookie(...) BEFORE navigating to any URL
- Navigate to https://www.facebook.com first to verify login:
  - Check if redirected to login page → throw "Cookie login failed. Please refresh FB_COOKIES in .env"
  - If profile name found in page → log "Logged in successfully as [name]"
- Use puppeteer.launch() with these args to avoid detection:
```js
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  ]
```

## Post Scraping Logic
- Navigate to each group URL
- Wait for the feed to load (wait for post article elements)
- Extract from each visible post:
  - **Post ID**: parse from post permalink URL `/groups/xxx/posts/123456`
  - **Author**: name of person who posted
  - **Content**: text content of the post (first 500 chars)
  - **Post URL**: full permalink
  - **Timestamp**: from `<abbr>` or `<time>` element
- Scroll down slightly to load a few more posts, wait 1.5s
- Extract top 10–15 most recent posts per cycle

## Deduplication
- Store seen post IDs in `data/seen_posts.json`
- Structure: `{ "group_url": ["post_id_1", "post_id_2"] }`
- Cap at 500 IDs per group
- Only notify for NEW post IDs not in seen list

## Webhook — n8n format
Send POST to WEBHOOK_URL for each new post with this JSON body:
```json
{
  "event": "new_facebook_post",
  "group_url": "https://www.facebook.com/groups/utcshop",
  "group_name": "UTC Shop",
  "post_id": "123456789",
  "author": "Nguyen Van A",
  "content": "first 500 chars of post...",
  "post_url": "https://www.facebook.com/groups/utcshop/posts/123456789",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "detected_at": "2024-01-15T10:35:00.000Z"
}
```
- Use axios for POST request
- On webhook failure: log error + retry once after 5s, then skip (do not crash)

## Cookie Expiry Detection
- On each cycle, before scraping, do a lightweight check: GET https://www.facebook.com/api/graphql or check if feed loads
- If FB redirects to login page → log "⚠️  FB_COOKIES expired! Please update .env" and send ONE webhook notification:
```json
  { "event": "cookie_expired", "message": "FB session expired, crawler paused", "detected_at": "..." }
```
- Pause scraping until restart (don't keep spamming failed requests)

## Error Handling
- CDP connect fail → retry after 30s
- Group 403 / redirected to login → skip that group, log warning
- Never crash main loop on single group error

## Interval Parsing
Support: `30s`, `5m`, `1h` — default 5m

## Project Structure
src/
  index.js        # main loop
  crawler.js      # CDP connect OR cookie-based launch + scrape
  notifier.js     # n8n webhook POST
  storage.js      # seen_posts.json
  config.js       # parse .env, export connection strategy

data/
  seen_posts.json

.env.example      # all vars with comments
package.json      # puppeteer, axios, dotenv
README.md         # setup instructions, how to get FB cookies, how to run

## Notes
- Use puppeteer (not playwright)
- Multiple fallback CSS selectors for FB post elements (FB changes DOM often)
- Random 800–1500ms delay between groups
- Log each cycle: timestamp, groups checked, new posts found
- Run indefinitely