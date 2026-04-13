## Project Context
Greenfield Node.js project. No existing code.

## Task
Build a Facebook Group post monitor using Chrome DevTools Protocol (CDP).
Support two environments:
- **macOS (dev)**: connect to existing Chrome Dev instance via CDP
- **Linux/Docker (prod)**: connect to Selenium standalone-chrome container via CDP, with noVNC for visual monitoring

## Environment Variables (load from .env)
```
CHROME_CDP_URL=http://127.0.0.1:9223        # macOS: Chrome Dev CDP port
                                             # Linux: Selenium container CDP port (e.g. http://localhost:9222)
FB_COOKIES="c_user=123456; xs=abc; datr=xyz; sb=..."  # Raw cookie header string from browser DevTools
GROUP_URLS=https://www.facebook.com/groups/utcshop,https://www.facebook.com/groups/abc  # comma-separated
HEADLESS=false
INTERVAL_MONITOR=5m
WEBHOOK_URL="https://n8n.longphamthien.us/webhook/xxx"
TRACE=false                                  # set true to record Playwright traces for debugging
```

## Docker Setup (Linux/prod)
Provide a `docker-compose.yml` at project root:

```yaml
services:
  chrome:
    image: selenium/standalone-chrome
    ports:
      - "4444:4444"
      - "9222:9222"   # CDP endpoint → set CHROME_CDP_URL=http://localhost:9222
      - "7900:7900"   # noVNC web UI → open http://<host>:7900 to watch browser live
    environment:
      - SE_NODE_MAX_SESSIONS=1
      - VNC_NO_PASSWORD=1
      - SE_START_XVFB=true
    shm_size: 2gb
    restart: unless-stopped

  crawler:
    build: .
    depends_on:
      - chrome
    environment:
      - CHROME_CDP_URL=http://chrome:9222
    env_file:
      - .env
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

Also provide a `Dockerfile` for the crawler service:
```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["node", "src/index.js"]
```

## Connection Strategy
Priority logic in config.js:

1. If `CHROME_CDP_URL` is set → connect to existing Chrome via `chromium.connectOverCDP(url)`
   - Works for BOTH macOS Chrome Dev and Selenium Docker container
2. If `FB_COOKIES` set + no CDP URL → launch new headless Chromium locally via Playwright, inject cookies
3. If both set → prefer CDP, fall back to cookie mode if CDP fails after 30s

### Cookie Injection Mode (fallback only)
- Parse raw cookie string `"key=value; key2=value2; ..."` into array of cookie objects
- Set via `context.addCookies([...])` on `facebook.com` domain BEFORE navigating
- Navigate to `https://www.facebook.com` to verify login:
  - Redirected to login page → throw `"Cookie login failed. Please refresh FB_COOKIES in .env"`
  - Profile name found → log `"Logged in successfully as [name]"`
- Launch via:
  ```js
  const browser = await chromium.launch({
    headless: config.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ]
  })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  })
  ```

### Playwright-specific features to use
- Use `page.waitForSelector()` with built-in auto-wait instead of manual delays where possible
- Use `page.locator()` with CSS, XPath, and text selectors as fallback chain for FB DOM
- Enable **Trace Viewer** in dev mode for debugging:
  ```js
  await context.tracing.start({ screenshots: true, snapshots: true })
  // ... scrape ...
  await context.tracing.stop({ path: 'data/trace.zip' })
  // Open with: npx playwright show-trace data/trace.zip
  ```
  Only record trace when `TRACE=true` env var is set

## Post Scraping Logic
- Navigate to each group URL
- Wait for feed to load (wait for post article elements)
- Extract from each visible post:
  - **Post ID**: parse from permalink URL `/groups/xxx/posts/123456`
  - **Author**: name of person who posted
  - **Content**: text content (first 500 chars)
  - **Post URL**: full permalink
  - **Timestamp**: from `<abbr>` or `<time>` element
- Scroll down slightly to load more posts, wait 1.5s
- Extract top 10–15 most recent posts per cycle
- Multiple fallback CSS selectors for each field (FB DOM changes often)

## Deduplication
- Store seen post IDs in `data/seen_posts.json`
- Structure: `{ "https://facebook.com/groups/xxx": ["post_id_1", "post_id_2"] }`
- Cap at 500 IDs per group
- Only notify for NEW post IDs

## Webhook — n8n format
POST to `WEBHOOK_URL` for each new post:
```json
{
  "event": "new_facebook_post",
  "group_url": "https://www.facebook.com/groups/utcshop",
  "group_name": "UTC Shop",
  "post_id": "123456789",
  "author": "Nguyen Van A",
  "content": "first 500 chars...",
  "post_url": "https://www.facebook.com/groups/utcshop/posts/123456789",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "detected_at": "2024-01-15T10:35:00.000Z"
}
```
- Use axios
- On failure: retry once after 5s, then skip. Never crash.

## Cookie Expiry Detection
- Before each cycle, check if FB session is still valid
- If redirected to login → log warning + send ONE webhook:
  ```json
  { "event": "cookie_expired", "message": "FB session expired, crawler paused", "detected_at": "..." }
  ```
- Pause scraping until process restart

## Error Handling
- CDP connect fail → retry after 30s, log clearly
- Group redirects to login / 403 → skip that group, log warning
- Never crash main loop on single group failure

## Interval Parsing
Support: `30s`, `5m`, `1h` — default `5m`

## Project Structure
```
src/
  index.js        # main loop, interval scheduling
  crawler.js      # CDP connect + scrape logic
  notifier.js     # n8n webhook POST
  storage.js      # read/write seen_posts.json
  config.js       # parse & validate .env, export connection strategy

data/
  seen_posts.json  # auto-created

docker-compose.yml  # Selenium chrome + noVNC + crawler
Dockerfile          # crawler image
.env.example        # all vars with comments
package.json        # playwright, axios, dotenv
README.md           # setup for both macOS and Linux/Docker
```

## README must include
- **macOS setup**: rsync Chrome profile + start Chrome Dev with CDP flags
- **Linux/Docker setup**: `docker compose up -d`, open `http://<host>:7900` to watch browser via noVNC
- How to get FB cookies from DevTools Network tab
- How to update cookies when expired

## Notes
- Use `playwright` (`@playwright/test` + `playwright` package), NOT puppeteer
- Import: `import { chromium } from 'playwright'`
- `GROUP_URLS` is comma-separated string, split in config.js (not JSON array)
- Random 800–1500ms delay between navigating to each group
- Log each cycle: timestamp, groups checked, new posts found
- Set `TRACE=true` in .env to enable Playwright Trace Viewer recording for debugging
- Run indefinitely