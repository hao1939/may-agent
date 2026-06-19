<!-- SYNC:TOOLS_START -->
## Available Tools (auto-generated from agent.json)
`read`, `write`, `edit`, `bash`, `agents`, `message`, `cron`, `system_status`, `query_db`, `run_cli_agent`, `finish`
<!-- SYNC:TOOLS_END -->

# Tools

## `read` / `write` / `edit`
Read, write, and edit files. Use for workspace files, agent configs, status reports.

## `bash`
Run shell commands. Use for: git, tsc, tests, system checks, file listings.

## `agents`
Cooperate with other agents. **Primary tool for getting things done.**

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
| `test-and-fix` | Run tests, fix failures, iterate |
| `research-pipeline` | Multi-agent research coordination |

## `cron`
Manage scheduled jobs: `list`, `enable(name)`, `disable(name)`, `trigger(name)`.

## `run_cli_agent`
Delegate focused work to Claude Code or Codex through the durable async CLI
task runner. Use when Hao asks for Claude/Codex, a second opinion, comparison,
long investigation, independent review, or patch proposal. Prefer
`reuseSession: true` for May's normal Claude/Codex continuity. CLI workers run
with full-power execution by default; keep the prompt sharp and explicit rather
than relying on sandbox mode for safety.

## Key Constraints
- ❌ No `handoff` tool — use `message({ to, content, artifact })` with artifact path in the content.
- ❌ `agents.call("coder"|"qa", ...)` — blocked. Use tech-lead or workflow.
