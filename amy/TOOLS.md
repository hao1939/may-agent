# Amy — XHS Tools Reference

## 小红书工具

Tool location: `agents/amy/tools/xhs-browse.mjs`

Uses CDP (Chrome DevTools Protocol) to connect to Chrome on `localhost:9222`. No Playwright, no npm deps.

### Commands

```bash
# Feed — browse the /explore page, get ~15-20 items
node agents/amy/tools/xhs-browse.mjs feed

# Search — returns results with xsec_token
node agents/amy/tools/xhs-browse.mjs search "<keyword>"

# Read — open a note and extract full content
node agents/amy/tools/xhs-browse.mjs read "<full_url_with_xsec_token>"

# Scroll — scroll feed page down for more items
node agents/amy/tools/xhs-browse.mjs scroll
```

### ⚠️ xsec_token is REQUIRED for `read`

XHS requires `xsec_token` parameter in every note URL. Without it → page won't render.

**Always use the full URL from feed/search results** — they include the token automatically.

```bash
# ❌ No token — will fail
node agents/amy/tools/xhs-browse.mjs read "https://www.xiaohongshu.com/explore/698dc..."

# ✅ With token — works
node agents/amy/tools/xhs-browse.mjs read "https://www.xiaohongshu.com/explore/698dc...?xsec_token=AB81...&xsec_source="
```

### Output Format

All commands return JSON:

```json
{
  "status": "success",
  "data": { ... }
}
```

### Feed/Search Result Fields

| Field | Description |
|-------|-------------|
| `id` | Note ID |
| `title` | Note title |
| `author` | Author name |
| `likes` | Like count |
| `cover` | Cover image URL |
| `link` | Full URL with xsec_token (use this for `read`) |

### Read Result Fields

| Field | Description |
|-------|-------------|
| `noteType` | "video" or "normal" (image) |
| `title` | Note title |
| `description` | Full text description with hashtags |
| `author` | Author name |
| `date` | Post date |
| `likes` | Like count |
| `collects` | Bookmark/collect count |
| `commentCount` | Total comment count |
| `tags` | Array of hashtags (e.g. `["#AI", "#agent"]`) |
| `comments` | Array of `{author, text, isReply?}` (up to 20) |
| `images` | Array of image URLs (up to 10, deduplicated) |
| `rawText` | Raw page text (first 3000 chars, fallback) |

### Standard Workflow

```
1. feed  OR  search "关键词"
   → get post list with links (includes xsec_token)

2. Pick interesting posts, use the `link` field for read
   → get full title, description, comments, engagement

3. Archive to knowledge/posts/<id>.md

4. Synthesize insights → update insights.md
```

### Error Handling

| Output | Meaning | Action |
|--------|---------|--------|
| `CAPTCHA` or login modal | Browser flagged | **Stop all ops.** Report. Wait. |
| `status: "error"` | Various (timeout, DOM change) | Try once more, then switch to synthesis |
| Empty results | Token expired or IP ban | Re-search for fresh tokens |

### Knowledge Archive Location

`agents/amy/knowledge/`:

| File | Content |
|------|---------|
| `insights.md` | Key observations and findings |
| `people.md` | Notable authors |
| `threads.md` | Community discussions |
| `openclaw-mentions.md` | OpenClaw mentions |
| `posts/<id>.md` | Deep-archived post full text |
