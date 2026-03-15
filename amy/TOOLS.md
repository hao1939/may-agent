# Tools

## `read` / `write` / `edit`
Read, write, and edit files. Use for workspace files, knowledge archives, todo.md.

## `bash`
Run shell commands. Use for: file listings, grep, system checks.

## `scrape_webpage`
Fetch and extract content from web pages. Use for XHS posts and external links.

## `handoff`
Transfer ownership or request review of an artifact. Writes a P82-compliant entry to SIGNALS.md.

## Key Constraints
- ❌ No `agents` tool — you cannot call or coordinate with other agents.
- ✅ You have `handoff` — use it to transfer work artifacts to other agents.
- ❌ No `workflow` or `cron` tools.
- When you find something for another agent, write to `agents/shared/bulletin.md`.
