# Agent Team

Concrete details about who's on the team, what they have, and how the runner works.

## Feature Team

| Agent | Model | Tools | Notes |
|-------|-------|-------|-------|
| **Tech Lead** | opus | read, exec, workflow, subagents | Architect. Decomposes features, supervises execution. |
| **May** | opus | read, write, exec, subagents, workflow, cron | Hao's Deputy. Orchestrates agents, tracks work end-to-end, maintains system. Delegates code changes to tech-lead/master. |
| **Coder** | opus | read, write, exec | Full project access. Implements code changes. Does not commit — supervisor handles git add/commit after QA review. |
| **QA** | gpt-5.2 | read, write, exec | Different model from coder for perspective diversity. Can fix issues directly. Uses PASS/FAIL/CONDITIONAL verdicts. |
| **Master** | opus | claude-code, gemini-cli | Two dedicated CLI agent tools. No read, write, or exec — interacts with codebase exclusively through claude-code and gemini-cli. |
| **Amy** | opus | read, write, exec | XHS content exploration and archival. |
| **Amy-Kimi** | kimi | read, write, exec | Kimi-powered variant of Amy for Chinese content. |
| **Scout** | gemini-3-pro | read, write, exec | Wide-net research and discovery. |

## Meta Team

| Agent | Model | Tools | Notes |
|-------|-------|-------|-------|
| **Evaluator** | gpt-5.2 | read, write, exec | Scores each agent in a task tree by responsibility. memoryLimit=5. |
| **Optimizer** | opus | read, write, exec, subagents, workflow | Implements one fix per run. Can delegate to coder and QA. |
| **Bob** | gemini-3-pro | read, write, exec, subagents | Design philosopher. Orchestrates meta-loop. Maintains philosophy.md. |
| **Coach** | opus | read, write (workspace only), exec (read-only), subagents, workflow, validate-workflow, socket-watch | Trains agents through live exercises. Spawns coachee via subagents (detached), observes via socket, writes reports. |

## Model Assignment

Three model families provide independent perspective. Opus for builders (May, Coder,
Optimizer, Master, Coach). GPT-5.2 for reviewers (QA, Evaluator). Gemini 3 Pro for design
philosophy (Bob) and research (Scout). All are proxy-aliased labels routed through a local proxy.

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

Recurring tasks use cron.json (agent-owned cron handlers) or external crontab:
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

All agent knowledge (SOUL.md, DOMAIN.md, TOOLS.md, LESSONS.md, skills/) is read
fresh at session start. Changes take effect on the next agent session without
restarting.

## Constraints

- **May delegates code changes** — code goes through tech-lead/master, not written directly
- **Coder never commits** — supervisor handles git add/commit after QA review
- **Master cannot write files** — must use CLI agents (claude-code, gemini-cli)
- **One fix per optimizer run** — isolates changes for measurable evaluation
- **Persistent sessions use compaction** — threshold 70%, keep ratio 40%
