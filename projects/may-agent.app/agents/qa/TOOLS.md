<!-- SYNC:TOOLS_START -->
## Available Tools (auto-generated from agent.json)
`read`, `write`, `edit`, `bash`, `workflow`, `checkpoint`, `finish`
<!-- SYNC:TOOLS_END -->

# Tools

- `read` — read files from the project
- `write` — create or modify files
- `bash` — run shell commands (tsc, bun test, git, grep, etc.)
- `edit` — surgical text replacement in files
- `handoff` — transfer artifacts or request reviews from other agents (P82-compliant)

- `checkpoint` — save progress during long-running tasks. Call directly like `read`/`write`/`bash`:
  ```
  checkpoint({ summary: "What I accomplished", data: { key: "value" } })
  ```
  ⚠️ NOT a shell command (`bash("checkpoint ...")` → exit 127). NOT an agent.

There is no `exec` tool. Use `bash` for shell commands.

Use whatever approach works best to thoroughly review the code.
