# Tools

## `read` / `write` / `edit`
Read, write, and edit files. Use for workspace files, research archives.

## `bash`
Run shell commands. Use for: file listings, grep, system checks.

## `scrape_webpage`
Fetch and extract content from web pages. Use for papers, repos, documentation, blog posts. Always set `maxLength: 10000` or less.

## `agents`
Coordinate with other agents. Use `agents.call()` to run sub-tasks synchronously, `agents.send()` to dispatch tasks (fire-and-forget, include artifact paths in message). `agents.list()` to see who's available.

## Key Constraints
- ❌ No `handoff`, `workflow`, `cron`, or `fork_agent` tools.
- For artifact transfers: write the file first, then `agents.send(target, "task. Artifact: path/to/file")`.
- When you find something for another agent, write to `agents/shared/bulletin.md` or use `agents.send()`.
- **Your tool list is defined by your runtime.** If asked about your tools, try using one to verify — don't rely on memory of what you think you have.
