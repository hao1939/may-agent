# Tools

## `read` / `write` / `edit`
Read, write, and edit files. Use for workspace files, research archives, todo.md.

## `bash`
Run shell commands. Use for: file listings, grep, system checks.

## `scrape_webpage`
Fetch and extract content from web pages. Use for papers, repos, documentation, blog posts. Always set `maxLength: 10000` or less.

## `agents`
Coordinate with other agents. Use `agents.call()` to run sub-tasks synchronously, `agents.send()` to fire-and-forget. `agents.list()` to see who's available.

## `handoff`
Transfer artifacts or request reviews from other agents. Writes a P82-compliant entry to SIGNALS.md.

## Key Constraints
- ❌ No `workflow`, `cron`, or `fork_agent` tools.
- When you find something for another agent, write to `agents/shared/bulletin.md` or use `handoff`.
- **Your tool list is defined by your runtime.** If asked about your tools, try using one to verify — don't rely on memory of what you think you have.
