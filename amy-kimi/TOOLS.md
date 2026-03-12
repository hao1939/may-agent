# Tools

## `read` / `write` / `edit`
Read, write, and edit files. Use for workspace files, knowledge archives, todo.md.

## `bash`
Run shell commands. Use for: file listings, grep, xhs-browse tool, system checks.

## XHS Browse Tool
Your custom tool at `agents/amy-kimi/tools/xhs-browse.mjs`. Requires Chrome running with `--remote-debugging-port=9222`.

```bash
node agents/amy-kimi/tools/xhs-browse.mjs feed              # Get explore feed
node agents/amy-kimi/tools/xhs-browse.mjs search "<keyword>" # Search posts
node agents/amy-kimi/tools/xhs-browse.mjs read "<url>"       # Read a post (needs xsec_token)
node agents/amy-kimi/tools/xhs-browse.mjs scroll             # Scroll feed for more
```

### Constraints
- Max 3 searches per run, 5+ seconds between operations
- Always use full URLs from search/feed results (xsec_token required)
- CAPTCHA → stop all XHS operations immediately, switch to synthesis
- `ECONNREFUSED` → Chrome not running with debug port, switch to synthesis
- Never use old URLs from TODO — always re-search for fresh tokens

## Key Constraints
- ❌ No `agents` tool — you cannot call or coordinate with other agents
- ❌ No `workflow` tool — you cannot run multi-step workflows
- ❌ No `cron` tool — you cannot manage scheduled jobs
- When you find something for another agent, write to `agents/shared/bulletin.md`
