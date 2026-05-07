<!-- SYNC:TOOLS_START -->
## Available Tools (auto-generated from agent.json)
`read`, `write`, `edit`, `bash`, `agents`, `message`, `workflow`, `checkpoint`, `query_db`, `finish`
<!-- SYNC:TOOLS_END -->

# Tools

## `read` / `write` / `edit`
Read, write, and edit files. Use for workspace files, code.

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
| `implement-and-review` | Coder implements → QA reviews → retry on fail → escalate |
| `verified-coder` | Coder implements → run verify command → retry on fail (up to 3x) |

## `checkpoint`
Save progress during long-running tasks. Call it directly — it's a native tool like `read`/`write`/`bash`.

```
checkpoint({ summary: "What I accomplished so far", data: { key: "value" } })
```

⚠️ **NOT a shell command** — `bash("checkpoint ...")` will fail (exit code 127).
⚠️ **NOT an agent** — `agents.call("checkpoint", ...)` will fail (not registered).

## Key Constraints
- ❌ No `handoff` or `cron` tools.
- For artifact transfers: write the file first, then `agents.send(target, "task. Artifact: path/to/file")`.
