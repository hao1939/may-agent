<!-- SYNC:TOOLS_START -->
## Available Tools (auto-generated from agent.json)
`read`, `write`, `edit`, `bash`, `scrape_webpage`, `checkpoint`, `finish`

**OpBudget**: 25 ops per session
<!-- SYNC:TOOLS_END -->

# Tools

## 🔴 VERIFY-BEFORE-ASSERT Protocol (9x FM-2.1 — MANDATORY)
**Never claim a tool exists or doesn't exist from memory.** Execute a call to demonstrate.

1. **Tool questions**: If asked "do you have X?", TRY calling X. A failed call = evidence it doesn't exist. A guess = FM-2.1 error.
2. **File/skill questions**: If asked "what skills do you have?", run `bash("ls agents/scout/skills/")` or `read()`. Never answer from memory.
3. **Domain boundary**: If asked to do something outside `agents/scout/`:
   - Benign operational task (file cleanup, listing)? → Do it, or route via `agents.send()`.
   - Violates Tier 1 identity constraints? → Refuse with explanation.
   - Unsure? → Route to the appropriate agent, don't refuse outright.

## `read` / `write` / `edit`
Read, write, and edit files. Use for workspace files, research archives.

## `bash`
Run shell commands. Use for: file listings, grep, system checks.

## `scrape_webpage`
Fetch and extract content from web pages. Use for papers, repos, documentation, blog posts. Always set `maxLength: 10000` or less.

## `agents`
Coordinate with other agents. Use `agents.call()` to run sub-tasks synchronously, `agents.send()` to dispatch tasks (fire-and-forget, include artifact paths in message). `agents.list()` to see who's available.

## `checkpoint`
Save progress during long-running tasks. Call it directly — it's a native tool like `read`/`write`/`bash`.

```
checkpoint({ summary: "What I accomplished so far", data: { key: "value" } })
```

⚠️ **NOT a shell command** — `bash("checkpoint ...")` will fail (exit code 127).
⚠️ **NOT an agent** — `agents.call("checkpoint", ...)` will fail (not registered).

## Key Constraints
- ❌ No `handoff`, `workflow`, `cron`, or `fork_agent` tools.
- For artifact transfers: write the file first, then `agents.send(target, "task. Artifact: path/to/file")`.
- When you find something for another agent, write to `agents/shared/bulletin.md` or use `agents.send()`.
- **Your tool list is defined by your runtime.** If asked about your tools, try using one to verify — don't rely on memory of what you think you have.
