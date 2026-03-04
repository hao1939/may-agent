# Agent Team

Concrete details about who's on the team, what they have, and how the runner works.

## Feature Team

| Agent | Model | Tools | Turn Limit | Notes |
|-------|-------|-------|------------|-------|
| **May** | opus | exec (read-only), subagents, workflow | — | Supervisor. No read/write tools — forces delegation for all code changes. Can read files and run shell commands for verification (cat, grep, tsc, tests, git) but cannot write files via exec. |
| **Coder** | opus | read, write, exec | 50 | Full project access. Implements code changes. Does not commit — supervisor handles git add/commit after QA review. |
| **QA** | gpt-5.2 | read, write, exec | 30 | Different model from coder for perspective diversity. Can fix issues directly. Uses PASS/FAIL/CONDITIONAL verdicts. |
| **Master** | opus | claude_code, gemini_cli | 30 | Two dedicated CLI agent tools. No read, write, or exec — interacts with codebase exclusively through claude-code and gemini-cli. |

## Meta Team

| Agent | Model | Tools | Turn Limit | Notes |
|-------|-------|-------|------------|-------|
| **Evaluator** | gpt-5.2 | read, write, exec | 20 | Scores each agent in a task tree by responsibility. memoryLimit=5. |
| **Optimizer** | opus | read, write, exec, subagents, workflow | 40 | Implements one fix per run. Can delegate to coder and QA. |
| **Bob** | gemini-3-pro | read, write, exec, subagents | 50 | Design philosopher. Orchestrates meta-loop. Maintains philosophy.md. |
| **Coach** | opus | read, write, exec (read-only), background-exec, socket-watch | 100 | Trains agents through live exercises. Spawns coachee in separate process, observes via socket, writes reports. |

## Model Assignment

Three model families provide independent perspective. Opus for builders (May, Coder,
Optimizer, Master, Coach). GPT-5.2 for reviewers (QA, Evaluator). Gemini 3 Pro for design
philosophy (Bob). All are proxy-aliased labels routed through a local proxy.

## Runner

The runner is agent-agnostic. Any registered agent can serve as the interface agent:

- **`AGENT=may`** (default) — May as persistent interface, delegates to team
- **`AGENT=bob`** — Bob as persistent interface, for meta-loop work
- **`AGENT=coach`** — Coach as persistent interface, for training sessions
- **`AGENT=master`** — Master as persistent interface, for direct CLI tool work

The interface agent gets a persistent session with compaction. All other agents run
as ephemeral sessions.

### Input Routing

- **Default input** goes to the interface agent's persistent session
- **`@agent message`** runs a fresh ephemeral session on any agent directly
- **Socket `run` command** does the same: `{"type":"run","agent":"bob","message":"..."}`
- **Socket `input` command** sends to the interface agent

### External Scheduling

No built-in timers. Use crontab or similar for recurring tasks:
```
# Run meta-loop every 30 minutes
*/30 * * * * echo '{"type":"run","agent":"bob","message":"Run the meta-loop"}' | socat - UNIX-CONNECT:/path/to/.state/may.sock
```

## Workflows

**implement-and-review** — Both May and optimizer have this. Coder implements → QA
reviews → one retry on FAIL/CONDITIONAL → escalate if still failing.

**design-review** — Optimizer only. Evaluator and optimizer independently review
shared docs, then cross-respond.

## Knowledge Hot-Reload

All agent knowledge (domain.md, lessons.md) is read fresh at session start. Changes
take effect on the next agent session without restarting.

## Constraints

- **May cannot write files** — read-only exec enforced structurally
- **Coder never commits** — supervisor handles git add/commit after QA review
- **Master cannot write files** — must use CLI agents (claude-code, gemini-cli)
- **One fix per optimizer run** — isolates changes for measurable evaluation
- **Persistent sessions use compaction** — threshold 70%, keep ratio 40%
