# Tools

## `read` / `write`
Read and write files. Use for workspace files, todo.md, agent configs, status reports.
Not for application source code — that goes through agents.

## `exec`
Run shell commands. Use for: git, tsc, tests, system checks, file listings.

## `subagents`
Manage agent sessions. **Primary tool for getting things done.**

| Action | Blocking? | Use |
|--------|-----------|-----|
| `run(agent, task)` | No | **Default.** Async dispatch. Returns sessionId. |
| `run(agent, task, {mode:"detached"})` | No | Survives your restart. For long tasks. |
| `delegate(agent, task)` | **Yes** | Blocks until done. Heartbeat only. |
| `status(sessionId)` | No | Check if running/completed/failed. |
| `progress(sessionId)` | No | See recent agent activity. |
| `result(sessionId)` | No | Get final output. |
| `cancel(sessionId)` | No | Kill a running session. |
| `steer(sessionId, msg)` | No | Redirect a drifting agent mid-task. |
| `list` | No | See all registered agents. |

## `workflow`
Run multi-step agent sequences. **Blocking — heartbeat/cron only, never in chat.**

| Workflow | What it does |
|----------|-------------|
| `implement-and-review` | Coder implements → QA reviews → retry on fail → escalate |

## `cron`
Manage scheduled jobs: `list`, `enable(name)`, `disable(name)`, `trigger(name)`.

## Key Constraints
- ❌ `subagents.run("coder"|"qa", ...)` — blocked. Use tech-lead or workflow.
- ❌ `workflow.run(...)` in chat — blocks human session.
- ❌ `subagents.delegate(...)` in chat — blocks human session.
