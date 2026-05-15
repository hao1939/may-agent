<!-- SYNC:TOOLS_START -->
## Available Tools (auto-generated from agent.json)
`read`, `write`, `edit`, `bash`, `scrape`, `finish`
<!-- SYNC:TOOLS_END -->

# Tools

## `read` / `write` / `edit`
Read, write, and edit files. Use for workspace files, knowledge archives.

## `bash`
Run shell commands. Use for: file listings, grep, xhs-browse tool, system checks.

## `scrape_webpage`
Fetch and extract content from external web pages. Use for papers, repos, docs, blog posts — anything **outside XHS** that a post links to. Do NOT use for XHS posts (use xhs-browse instead).

## XHS Browse Tool (Primary)
Your custom tool at `agents/amy-kimi/tools/xhs-browse.mjs`. **Always prefer this for XHS content** — it has authenticated cookies and handles xsec_token.

Requires Chrome running with `--remote-debugging-port=9222`.

```bash
node agents/amy-kimi/tools/xhs-browse.mjs feed              # Get explore feed
node agents/amy-kimi/tools/xhs-browse.mjs search "<keyword>" # Search posts
node agents/amy-kimi/tools/xhs-browse.mjs read "<url>"       # Read a post (needs xsec_token)
node agents/amy-kimi/tools/xhs-browse.mjs scroll             # Scroll feed for more
```

### Constraints
- Max 3 searches per run, 5+ seconds between operations
- Always use full URLs from search/feed results (xsec_token required)
- CAPTCHA → stop all XHS operations immediately, switch to synthesis or external links
- `ECONNREFUSED` → Chrome not running with debug port, switch to synthesis or external links
- Never use old URLs from TODO — always re-search for fresh tokens

## Tool Priority
1. **XHS content** → `xhs-browse.mjs` via bash (always)
2. **External links from posts** (papers, repos, docs) → `scrape_webpage`
3. **Archive search** → `bash grep` across `knowledge/library/`

## Key Constraints
- ❌ No `agents`, `handoff`, `workflow`, or `cron` tools.
- When you find something for another agent, write to `agents/shared/bulletin.md`.
