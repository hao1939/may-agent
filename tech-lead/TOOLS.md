# Tools

## `read` / `write` / `edit`
Read, write, and edit files. Use for workspace files, code, todo.md.

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

## `handoff`
Transfer ownership or request review of an artifact. Writes a P82-compliant entry to SIGNALS.md with automatic read_by tracking, notifies the target agent, and validates the artifact exists.

## `workflow`
Run multi-step agent sequences. **Blocking.**

| Workflow | What it does |
|----------|-------------|
| `implement-and-review` | Coder implements → QA reviews → retry on fail → escalate |
| `verified-coder` | Coder implements → run verify command → retry on fail (up to 3x) |

## Key Constraints
- ❌ No `cron` tool.
