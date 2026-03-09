# Amy-Kimi — Tools

## XHS Tool

Location: `agents/amy-kimi/tools/xhs-browse.mjs`
Uses CDP (Chrome DevTools Protocol) to connect to Chrome on `localhost:9222`.

### Commands

```bash
# Feed — browse /explore page, ~15-20 items
node agents/amy-kimi/tools/xhs-browse.mjs feed

# Search — returns results with xsec_token
node agents/amy-kimi/tools/xhs-browse.mjs search "<keyword>"

# Read — open a note, extract full content
node agents/amy-kimi/tools/xhs-browse.mjs read "<full_url_with_xsec_token>"

# Scroll — scroll feed page for more items
node agents/amy-kimi/tools/xhs-browse.mjs scroll
```

### xsec_token is Required for `read`
Always use the full URL from feed/search results — they include the token.
```bash
# ✅ Works — full URL from search result
node xhs-browse.mjs read "https://www.xiaohongshu.com/explore/698dc...?xsec_token=AB81...&xsec_source="
```

### Result Fields

**Feed/Search**: `id`, `title`, `author`, `likes`, `cover`, `link` (use `link` for read)

**Read**: `noteType`, `title`, `description`, `author`, `date`, `likes`, `collects`, `commentCount`, `tags`, `comments` (up to 20), `images` (up to 10)

### Error Handling

| Output | Action |
|--------|--------|
| `CAPTCHA` or login modal | Stop all XHS ops. Report and wait. |
| `status: "error"` | Try once more, then switch to synthesis |
| Empty results | Re-search for fresh tokens |

## Standard Tools

### read
Read any file. Use for your archive, Amy's archive (cross-reference), shared docs.

### write
Write to your workspace and knowledge archive only.

### exec
Shell commands. Primary use: run `xhs-browse.mjs`. Also: `grep`, `ls`, `wc -l` for archive management.
