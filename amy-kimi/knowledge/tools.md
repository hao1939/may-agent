# Amy-Kimi — XHS Tools Reference

## 小红书工具

Tool location: `/home/hao/.openclaw/tools/xhs-downloader/xhs_fetch.mjs`

Tools use CDP (Chrome DevTools Protocol) to connect to the browser directly.

### Data Commands

```bash
# Search — returns results with xsec_token
node /home/hao/.openclaw/tools/xhs-downloader/xhs_fetch.mjs search "<keyword>" --count 10

# Feed — read /explore page DOM (zero navigation)
node /home/hao/.openclaw/tools/xhs-downloader/xhs_fetch.mjs feed --count 20

# Cookie health check (for diagnostics only, not routine)
node /home/hao/.openclaw/tools/xhs-downloader/xhs_fetch.mjs cookie-status
```

### Post Reading

```bash
# Basic read — title, text, tags, engagement
node /home/hao/.openclaw/tools/xhs-downloader/xhs_fetch.mjs read-post "<url with xsec_token>"

# Deep read — OCR all images + comments + references
node /home/hao/.openclaw/tools/xhs-downloader/xhs_fetch.mjs read-deep "<url with xsec_token>"

# Deep read (skip OCR)
node /home/hao/.openclaw/tools/xhs-downloader/xhs_fetch.mjs read-deep "<url>" --no-ocr
```

### ⚠️ xsec_token is REQUIRED

XHS requires `xsec_token` parameter in every post URL. Without it → 404.

**Always use the full URL from search/feed results.**

### read-deep Fields

| Field | Description |
|-------|-------------|
| `fullText` | OCR text from all images (core content) |
| `imageTexts[]` | Per-image OCR text |
| `topComments[]` | Top comments (author, content, likes, replies) |
| `references[]` | Extracted references (GitHub, arXiv, papers, code) |
| `desc` | Post text description |

### Standard Workflow

```
1. search "keyword" --count 10
   → get post list with url (includes xsec_token)

2. Pick interesting posts, use returned url for read-post

3. For deeper content (image OCR, comments), use read-deep

4. Archive to knowledge/posts/<id>.md
```

### Error Handling

| Output | Meaning | Action |
|--------|---------|--------|
| `CAPTCHA` | Browser flagged | **Stop all ops.** Report. Wait. |
| `Rate limited` | Too frequent | Wait 5-10 min |
| `404 or error` | Token invalid/expired | Re-search for new token |

### Keyword Management

```bash
node /home/hao/.openclaw/tools/sync-keywords.mjs list
node /home/hao/.openclaw/tools/sync-keywords.mjs add "new keyword"
node /home/hao/.openclaw/tools/sync-keywords.mjs remove "old keyword"
```

### Knowledge Archive Locations

**Your archive:** `/home/hao/.openclaw/knowledge/amy-kimi/`

| File | Content |
|------|---------|
| `insights.md` | Key observations and findings |
| `people.md` | Notable authors |
| `threads.md` | Community discussions |
| `openclaw-mentions.md` | OpenClaw mentions |
| `posts/<id>.md` | Deep-archived post full text |

**Amy's archive (read-only for cross-reference):** `/home/hao/.openclaw/knowledge/amy/`
