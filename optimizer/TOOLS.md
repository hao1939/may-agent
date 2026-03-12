# Tools

## `read` / `write` / `edit`
Read, write, and edit files. Use for workspace files, design docs, todo.md.

## `bash`
Run shell commands. Use for: git, tsc, tests, system checks, file listings.

## `agents`
Cooperate with other agents.

| Action | Blocking? | Use |
|--------|-----------|-----|
| `call(agent, task)` | **Yes** | Run agent to completion, get result. |
| `send(agent, message)` | No | Add todo for agent + trigger their heartbeat. Fire-and-forget. |
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
- ❌ No `cron` tool.
