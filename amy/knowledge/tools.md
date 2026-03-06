# Amy — XHS Tools Reference

## 小红书工具

Tool location: `~/.openclaw/tools/xhs-downloader/xhs_fetch.mjs`

Tools use CDP (Chrome DevTools Protocol) to connect to the browser directly. No Playwright, no anti-automation detection.

### Data Commands

```bash
# Search — returns results with xsec_token
node ~/.openclaw/tools/xhs-downloader/xhs_fetch.mjs search "<keyword>" --count 10

# Feed — read /explore page DOM (zero navigation)
node ~/.openclaw/tools/xhs-downloader/xhs_fetch.mjs feed --count 20

# User favorites
node ~/.openclaw/tools/xhs-downloader/xhs_fetch.mjs favorites --count 20 --read 0

# User likes
node ~/.openclaw/tools/xhs-downloader/xhs_fetch.mjs likes --count 20
```

### Post Reading

```bash
# Basic read — title, text, tags, engagement
node ~/.openclaw/tools/xhs-downloader/xhs_fetch.mjs read-post "<url with xsec_token>"

# Deep read — OCR all images + comments + references
node ~/.openclaw/tools/xhs-downloader/xhs_fetch.mjs read-deep "<url with xsec_token>"

# Deep read (skip OCR)
node ~/.openclaw/tools/xhs-downloader/xhs_fetch.mjs read-deep "<url>" --no-ocr
```

### ⚠️ xsec_token is REQUIRED

XHS requires `xsec_token` parameter in every post URL. Without it → 404 (error 300031).

**Always use the full URL from search/feed results** — they include the token.

```bash
# ❌ No token — will 404
node xhs_fetch.mjs read-post "https://www.xiaohongshu.com/explore/698dc..."

# ✅ With token — works
node xhs_fetch.mjs read-post "https://www.xiaohongshu.com/explore/698dc...?xsec_token=AB81..."
```

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
   → get post list with id, title, author, likes, url (with xsec_token)

2. Pick interesting posts, use returned url for read-post
   → get full title, desc, author

3. For deeper content (image OCR, comments), use read-deep
   → get fullText, topComments, references

4. Archive to knowledge/posts/<id>.md
```

### Error Handling

| Output | Meaning | Action |
|--------|---------|--------|
| `CAPTCHA` | Browser flagged | **Stop all ops.** Report. Wait for user QR scan. |
| `Rate limited` | Too frequent | Wait 5-10 min, reduce frequency |
| `404 or error` | Token invalid/expired | Re-search for new token |
| `No XHS tab` | Browser not on XHS | Report and wait |

### Keyword Management

```bash
node ~/.openclaw/tools/sync-keywords.mjs list
node ~/.openclaw/tools/sync-keywords.mjs add "new keyword"
node ~/.openclaw/tools/sync-keywords.mjs remove "old keyword"
```

### Batch Archive

```bash
node ~/.openclaw/tools/xhs-downloader/batch-archive.mjs        # incremental
node ~/.openclaw/tools/xhs-downloader/batch-archive.mjs --dry   # preview
```

### Knowledge Archive Location

`~/.openclaw/knowledge/amy/`:

| File | Content |
|------|---------|
| `insights.md` | Key observations and findings |
| `people.md` | Notable authors |
| `threads.md` | Community discussions |
| `openclaw-mentions.md` | OpenClaw mentions |
| `posts/<id>.md` | Deep-archived post full text |
