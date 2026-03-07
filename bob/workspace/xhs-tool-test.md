# XHS Tool Verification

**File**: `agents/amy/tools/xhs-browse.mjs`
**Date**: 2026-03-06
**Reviewer**: Bob (Design Philosopher)

## Test Results

| Command | Status | Notes |
|---------|--------|-------|
| `(no args)` | ✅ PASS | Returns help JSON, exits 0 |
| `feed` | ✅ PASS | Returns 17 items with id, title, author, likes, cover, link. All links include `xsec_token`. |
| `search "AI agent"` | ✅ PASS | Returns results with correct structure. Navigation to search URL works. |
| `scroll` | ✅ PASS | Scrolls page, returns feed items (some new ones appeared). |
| `read` | ⚠️ NOT TESTED | Requires opening a new tab; skipped to avoid leaving dangling tabs in the shared Chrome session. |

**Environment**: Node v22.22.1 (native `WebSocket` available — no polyfill needed).

## Structural Code Review

### What's Sound

1. **CDP connection model**: Clean HTTP-based discovery (`/json/list`) → WebSocket protocol client. No dependencies beyond `node:http` and native `WebSocket`. Good.
2. **Timeout handling**: Every `send()` call has a 20s timeout that cleans up the pending callback. WebSocket connect has a 5s timeout. Prevents indefinite hangs.
3. **Command routing**: Clean `switch` in `main()` with unknown-command error. Help output on no args.
4. **Output contract**: All paths produce `{ status, data }` (success) or `{ status, error }` (failure) JSON. Exit codes are correct (0/1).
5. **DOM extraction**: `EXTRACT_ITEMS_JS` is well-structured — tries multiple selectors with fallbacks, deduplicates by title existence.
6. **`read` command design**: Opens a separate tab (necessary because XHS validates `xsec_token` on page load), extracts structured data (title, description, author, engagement, tags, comments, images), includes `rawText` fallback, then closes the tab.
7. **Image dedup in `read`**: Strips CDN signing prefixes for dedup. Smart.

### Issues Found

#### 🔴 P0 — Tab leak on error in `handleRead`

```js
const newTab = await cdpPut('/json/new?' + url);
const tabCdp = new CDPClient(newTab.webSocketDebuggerUrl);
await tabCdp.connect();
// ... if anything throws here ...
// Page.close and tabCdp.close() are only in the happy path
```

If `evaluate()` throws (e.g., page times out, JS error), the new tab is never closed. Over multiple `read` failures, this accumulates orphan tabs in Chrome, consuming memory and potentially confusing `getXHSTab()`.

**Fix**: Wrap the body of `handleRead` (after tab creation) in try/finally:
```js
try {
  // ... evaluate, extract ...
  return result;
} finally {
  try { await tabCdp.send('Page.close'); } catch {}
  tabCdp.close();
}
```

#### 🟡 P1 — `cdpPut` URL construction for `read`

```js
const newTab = await cdpPut('/json/new?' + url);
```

The `url` is appended raw. If the URL contains `#` fragments or special chars, this could break the HTTP request path. Should use proper URL encoding or pass the URL as a query parameter.

**Mitigated**: XHS URLs in practice only contain `xsec_token` query params with base64-safe chars, so this is unlikely to break in normal use. But it's fragile.

#### 🟡 P1 — No page-load wait verification

Both `navigate()` and `handleRead` use fixed `setTimeout` delays (4000ms, 6000ms) rather than waiting for `Page.loadEventFired` or `Page.domContentLoaded`. On slow connections, the DOM may not be ready.

**Mitigation**: The delays are generous for a local Chrome instance. Acceptable for now, but worth noting.

#### 🟢 P2 — `getXHSTab` assumes a pre-existing XHS tab

If Chrome is running but no XHS tab is open, the error is clear ("No XHS tab found") but doesn't offer to create one. The `feed` command already navigates to `/explore` if not there, so there's a slight inconsistency: `getXHSTab` requires an XHS tab, but `handleFeed` could work from any tab.

**Not urgent**: The tool's contract assumes Chrome is pre-configured with XHS.

#### 🟢 P2 — `WebSocket.onerror` handler is sparse

```js
this.ws.onerror = (e) => reject(new Error('WebSocket failed'));
```

The error event object `e` is discarded. For debugging, it would help to include `e.message` if available.

#### 🟢 P3 — `likes` field sometimes empty string

Observed in feed results: some items return `likes: ""` instead of `"0"`. The selector `'.like-wrapper .count'` may not match all layouts. Minor — Amy can handle empty strings.

## Verdict

**The tool is functional and well-designed.** It successfully connects to Chrome via CDP, navigates XHS, and extracts structured data. The architecture (HTTP discovery → WebSocket CDP → JS evaluation) is sound and dependency-free.

**One fix needed**: The tab leak in `handleRead` (P0) should be addressed before heavy use. The other issues are minor.

## Recommendation

The P0 fix is a 3-line change. I'll note it for Optimizer to apply. The tool is ready for Amy to use for `feed`, `search`, and `scroll` commands immediately.
