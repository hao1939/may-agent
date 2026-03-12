# Tools

## `read` / `write` / `edit`
Read, write, and edit files. Use for workspace files, todo.md, agent configs, status reports.

## `bash`
Run shell commands. Use for: git, tsc, tests, system checks, file listings.

## `agents`
Cooperate with other agents. **Primary tool for getting things done.**

| Action | Blocking? | Use |
|--------|-----------|-----|
| `call(agent, task)` | **Yes** | Run agent to completion, get result. |
| `list` | No | See available agents and running sessions. |
| `peek(sessionId)` | No | See recent activity of a running session. |
| `steer(sessionId, msg)` | No | Redirect a drifting agent mid-task. |
| `cancel(sessionId)` | No | Kill a running session. |
| `input(sessionId, msg)` | **Yes** | Send message to an IDLE session (e.g. chat agent) and get reply. |

## `workflow`
Run multi-step agent sequences. **Blocking.**

| Workflow | What it does |
|----------|-------------|
| `implement-and-review` | Coder implements → QA reviews → retry on fail → escalate |

## `cron`
Manage scheduled jobs: `list`, `enable(name)`, `disable(name)`, `trigger(name)`.

## Key Constraints
- ❌ `agents.call("coder"|"qa", ...)` — blocked. Use tech-lead or workflow.
