<!-- SYNC:TOOLS_START -->
## Available Tools (auto-generated from agent.json)
`read`, `write`, `edit`, `bash`, `agents`, `message`, `system_status`, `checkpoint`, `workflow`, `finish`
<!-- SYNC:TOOLS_END -->

# Tools

## `read` / `write` / `edit`
Read, write, and edit files. Use for workspace files, design docs, agent configs.

## `bash`
Run shell commands. Use for: git, tsc, tests, system checks, file listings.

## `agents`
Cooperate with other agents.

| Action | Blocking? | Use |
|--------|-----------|-----|
| `call(agent, task)` | **Yes** | Run agent to completion, get result. |
| `send(agent, message)` | No | Dispatch task to agent (creates tracked request in DB, triggers heartbeat). Fire-and-forget. Include artifact file paths in the message. |
| `list` | No | See available agents and running sessions. |
| `peek(sessionId)` | No | See recent activity of a running session. |
| `cancel(sessionId)` | No | Kill a running session. |

## `checkpoint`
Save progress during long-running tasks. Call it directly — it's a native tool like `read`/`write`/`bash`.

```
checkpoint({ summary: "What I accomplished so far", data: { key: "value" } })
```

⚠️ **NOT a shell command** — `bash("checkpoint ...")` will fail (exit code 127).
⚠️ **NOT an agent** — `agents.call("checkpoint", ...)` will fail (not registered).

## `workflow`
Run predefined workflows. Use `workflow.list()` to see available workflows.

### `persistent-task` workflow
For project work that spans multiple sessions. When you have an active project to resume:
```
workflow({ action: "run", name: "persistent-task", task: "Resume project: <project-file-path>" })
```
This workflow handles session continuity, checkpointing, and progress tracking automatically. **Use it whenever resuming or continuing project work** instead of working inline.

## `finish`
Signal structured completion of a task. Call as the last action in a session.

## Key Constraints
- ❌ No `handoff` or `cron` tools.
- For artifact transfers: write the file first, then `agents.message(target, "task description. Artifact: path/to/file")`.
