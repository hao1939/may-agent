# Agent Team

Concrete details about who's on the team, what they have, and how the runner works.

## Feature Team

| Agent | Role | Model | Tools | Notes |
|-------|------|-------|-------|-------|
| **Tech Lead** | Builder | opus | read, bash, edit, write, workflow, agents | The Builder. Shares Bob's vision, drives implementation. Leads coder+QA, applies philosophy in code. |
| **May** | Supervisor | opus | read, bash, edit, write, agents, workflow, cron | Hao's Deputy. Orchestrates agents, tracks work end-to-end, maintains system. Delegates code changes to tech-lead/master. |
| **Coder** | Builder | opus | read, bash, edit, write | Full project access. Implements code changes. Does not commit — supervisor handles git add/commit after QA review. |
| **QA** | Builder | gpt-5.2 | read, bash, edit, write | Different model from coder for perspective diversity. Can fix issues directly. Uses PASS/FAIL/CONDITIONAL verdicts. |
| **Master** | Builder | opus | claude-code, gemini-cli | Two dedicated CLI agent tools. No read, bash, edit, or write — interacts with codebase exclusively through claude-code and gemini-cli. |
| **Amy** | Researcher | opus | read, bash, edit, write, scrape_webpage | XHS content exploration and archival. `scrape` preset provides `scrape_webpage` for web fetching. |
| **Amy-Kimi** | Researcher | kimi | read, bash, edit, write | Kimi-powered variant of Amy for Chinese content. |
| **Scout** | Researcher | opus | read, bash, edit, write, scrape_webpage | The Scholar. Takes leads and goes deep — cross-referencing, archiving, building compounding knowledge. `scrape` preset provides the `scrape_webpage` tool for web fetching. |

## Meta Team

| Agent | Role | Model | Tools | Notes |
|-------|------|-------|-------|-------|
| **Evaluator** | Supervisor | gpt-5.2 | read, bash, edit, write | Scores each agent in a task tree by responsibility. memoryLimit=5. |
| **Optimizer** | Builder | opus | read, bash, edit, write, agents, workflow | Implements one fix per run. Can delegate to coder and QA. |
| **Bob** | Philosopher | gemini-3-pro | read, bash, edit, write, agents | System architect. Holds the blueprint, designs agent cooperation and evolution, reviews designs, stewards philosophy.md, drives meta-loop. |
| **Coach** | Philosopher | opus | read, bash, edit, write, agents, workflow, socket_watch, fork_agent, verify_agent, promote_agent, discard_agent | Trains agents through live exercises. Spawns coachee via agents (detached), observes via socket_watch, writes reports. Uses agent-growth tools to fork/verify/promote agents. |

## Model Assignment

Four model families provide independent perspective. Opus for builders and research
(Tech Lead, May, Coder, Optimizer, Master, Coach, Amy, Scout). GPT-5.2 for reviewers
(QA, Evaluator). Gemini 3 Pro for design philosophy (Bob). Kimi for Chinese-language
research (Amy-Kimi). All are proxy-aliased labels routed through a local proxy.

## Runner

The system runs on the **V2 Runner**, which uses **ephemeral sessions** for everything.
There are no persistent sessions.

- **Interface Agent**: Default is **May**.
- **Chat Loop**: The runner spawns a *fresh* session for every user message.
- **Context**: The chat loop injects a rolling transcript of the conversation into each new session.

### Input Routing

- **Default input** spawns a fresh session for the interface agent (May).
- **`@agent message`** spawns a fresh session for the target agent.
- **Socket `run` command**: `{"type":"run","agent":"bob","message":"..."}` spawns a fresh session.
- **Interactive Console**: Supports `/status`, `/cancel`, `/exit` commands natively.

### External Scheduling

Recurring tasks use `cron.json` (agent-owned cron handlers).
The runner spawns **detached sessions** (separate processes) for these tasks.

```
# Example cron entry
"monitor-feeds": "0 * * * *",
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
- **No persistent state in memory** — agents must write to `workspace/` or `.state/` to persist data between runs.
