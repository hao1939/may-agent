<!-- SYNC:TOOLS_START -->
## Available Tools (auto-generated from agent.json)
`read`, `write`, `edit`, `bash`, `agents`, `message`, `cron`, `system_status`, `query_db`, `run_cli_agent`, `finish`
<!-- SYNC:TOOLS_END -->

# Tools

## Chat-May Runtime Tools

In the persistent human chat session, runtime filters May's tool surface to the
conversation-safe set: `query_db`, `system_status`, `agents`, `message`,
`read`, and `run_cli_agent`. Chat-May does not receive `finish`, `bash`,
`write`, `edit`, or `cron`; concrete code or project changes should be
delegated to project owners, task agents, or CLI workers.

The full tool list below still applies to bounded May job sessions.

## `read` / `write` / `edit`
Read, write, and edit files. Use for workspace files, agent configs, status reports.

## `bash`
Run shell commands. Use for: git, tsc, tests, system checks, file listings.

## `agents`
Cooperate with other agents. **Primary tool for getting things done.**

| Action | Blocking? | Use |
|--------|-----------|-----|
| `call(agent, task)` | **Yes** | Run agent to completion, get result. |
| `fork(agent, task)` | No | Start a tracked asynchronous agent session. Include the expected artifact and stop condition. |
| `list` | No | See available agents and running sessions. |
| `peek(sessionId)` | No | See recent activity of a running session. |
| `cancel(sessionId)` | No | Kill a running session. |

Use `message` for a durable agent-to-agent notification. It is distinct from
starting a child work session with `agents.fork`.

## `cron`
Manage scheduled jobs: `list`, `enable(name)`, `disable(name)`, `trigger(name)`.

## Runtime Restart
Do not run inline `supervisorctl restart may-agent ...` from an agent shell.
Use `runtime.restart.requested`, or run `supervisorctl start
may-agent-restarter` when a shell command is explicitly required. The
supervisor-owned one-shot restarter performs the actual restart after the
caller exits. Once supervisor accepts the start request, it survives
`may-agent` stopping or crashing; if `may-agent` crashes before sending the
request, normal supervisor `autorestart` owns recovery.

For runtime code deployment inside the container, use `cd
/app/projects/may-agent && bun run deploy`. The `deploy` script builds the
binary, writes the staged deploy marker, and starts supervisor's
`may-agent-restarter` one-shot, which installs the binary while the runtime is
stopped and then starts the runtime again. If the live restarter does not
support staged deploy, recreate the container from the updated image.
After deploy, check `supervisorctl status may-agent may-agent-web
may-agent-restarter`, tail `/tmp/may-agent-supervisor-restart.log`, and confirm
`bundle/deploy-requested` is gone.

## `run_cli_agent`
Delegate focused work to Claude Code or Codex through the durable async CLI
task runner. Use when Hao asks for Claude/Codex, a second opinion, comparison,
long investigation, independent review, or patch proposal. Prefer
`reuseSession: true` for May's normal Claude/Codex continuity. CLI workers run
with full-power execution by default; keep the prompt sharp and explicit rather
than relying on sandbox mode for safety.

## Key Constraints
- ❌ No `handoff` or `agents.send` action — use `message({ to, content })` for a notification or `agents.fork` for work.
- ❌ `agents.call("coder"|"qa", ...)` — blocked. Use tech-lead, which owns the structured implementation workflows.
