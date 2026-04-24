# XHS Browsing Tool Design

## Goal
A minimal, dependency-free Node.js script for Amy to browse Xiaohongshu (XHS) via Chrome DevTools Protocol (CDP).

## Constraints
- Environment: Node 22 (Container)
- Connectivity: CDP @ localhost:9222
- No external npm packages (puppeteer, playwright, etc.)
- Single file: `agents/amy/tools/xhs-browse.mjs`

## Architecture

### 1. Connection
- Fetch `http://localhost:9222/json/list`
- Find tab with url containing `xiaohongshu.com`
- If none, create new via `http://localhost:9222/json/new?https://www.xiaohongshu.com/explore`
- Connect WebSocket to `webSocketDebuggerUrl`

### 2. CDP Helpers
- `send(method, params)`: Promisified WebSocket sender with ID tracking.
- `evaluate(expression)`: Helper for `Runtime.evaluate` with `returnByValue: true`.

### 3. Commands

#### `feed`
- Action:
    - Check if current URL is explore. If not, navigate to `https://www.xiaohongshu.com/explore`.
    - Wait for network idle or simple timeout (2s).
    - Inject JS to scrape feed items.
- Scraper Logic:
    - Target: `.feed-container .note-item` (or similar, need to verify).
    - Fallback: Look for `section` tags or links containing `/explore/`.
    - Extract: Title, Author, Link, Likes.

#### `search <keyword>`
- Action:
    - Navigate to `https://www.xiaohongshu.com/search_result?keyword=<encoded_keyword>&source=web_search_result_notes`.
    - Wait for results.
    - Inject JS to scrape results (similar structure to feed).

#### `read <url>`
- Action:
    - Navigate to `<url>`.
    - Wait for content load.
    - Inject JS to scrape details.
- Scraper Logic:
    - Title: `h1` or `.title`.
    - Content: `.desc` or generic text container.
    - Comments: `.comments-container` (if available without scrolling).
    - **Note**: XHS web often requires login for full comments or scrolling. We will scrape what is visible.

### 4. Robustness
- **Captcha Check**: Before scraping, check page title or text for "验证" or "captcha". Return error JSON if found.
- **Login Check**: Check for login modal.
- **Timeouts**: 10s timeout for all operations.

## JSON Output Format
```json
{
  "status": "success",
  "data": [ ... ] | { ... },
  "error": null
}
```
OR
```json
{
  "status": "error",
  "error": "Captcha detected",
  "screenshot": "<base64? maybe too large>" 
}
```
