# Tools

## `read` / `write` / `edit`
Read, write, and edit files. Use for workspace files, design docs, knowledge files.

## `bash`
Run shell commands. Use for: git, tsc, tests, system checks, file listings.

## `agents`
Cooperate with other agents.

| Action | Blocking? | Use |
|--------|-----------|-----|
| `call(agent, task)` | **Yes** | Run agent to completion, get result. |
| `send(agent, message)` | No | Dispatch task to agent (creates tracked request in DB, triggers heartbeat). Fire-and-forget. Include artifact paths in the message. |
| `list` | No | See available agents and running sessions. |
| `peek(sessionId)` | No | See recent activity of a running session. |
| `cancel(sessionId)` | No | Kill a running session. |

## `workflow`
Run multi-step agent sequences. **Blocking.**

| Workflow | What it does |
|----------|-------------|
| `design-review` | Design analysis and review |
| `enhance-cron` | Improve cron job configurations |
| `implement-and-review` | Coder implements → QA reviews → retry on fail → escalate |
| `safe-edit` | Safe file editing with rollback |

## Key Constraints
- ❌ No `handoff`, `cron`, `scrape_webpage`, `scrape`, `exec`, or `discard_agent` tools. These do NOT exist.
- For artifact transfers: write the file first, then `agents.send(target, "task. Artifact: path/to/file")`.
- If you need web content, use `bash` with `curl`.
- ✅ Your ONLY tools are: `read`, `write`, `edit`, `bash`, `agents`, `workflow`.
