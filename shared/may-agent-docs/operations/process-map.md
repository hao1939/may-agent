# Process Map

> Auto-maintaining this doc is a future goal. For now, update it when adding
> or changing a process. Bob reviews weekly during `analyze-failures`.

Last updated: 2026-03-19

---

## Overview

37 enabled processes: 14 JS handlers (zero LLM), 10 heartbeats (LLM),
8 agent tasks (LLM via run-agent-task), 9 memory consolidation (LLM), 
1 pending (convention-check).

## 1. JS Handlers (zero LLM cost)

These run in-process. No agent session, no tokens consumed.

| Handler | Interval | Preflight | Reads | Writes | Downstream |
|---------|----------|-----------|-------|--------|------------|
| watchdog | 10min | — | .state/sessions/active/ | kills stale sessions | — |
| agents-auto-commit | 10min | — | agents/ (git status) | git commit | — |
| evaluate-sessions | 30min | — | .state/sessions/history/\*/meta.json, session.jsonl | .state/evaluations/\*.json | → coach (bad score) |
| audit-requests | 2h | — | may.db requests table | may.db (expire/clean) | — |
| error-log-scanner | 4h | — | agents/\*/ERROR_LOG.jsonl | — | → coach (growth cycle) |
| system-status | 4h | — | .state/sessions/, .state/evaluations/ | health-log.md | → may (issues) |
| common-sense-verify | 4h | new-entries-since | .state/sessions/ transcripts | coach tracker | — |
| daily-brief | 24h | — | .state/sessions/, .state/evaluations/, may.db | telegram notification | — |
| coaching-report | 24h | — | .state/evaluations/ | telegram notification | — |
| lessons-graduation | 24h | — | agents/\*/LESSONS.md | flags to may heartbeat | → may |
| workspace-compaction | 24h | — | agents/\*/workspace/ | archive/YYYY-MM/ | — |
| memory-trimmer | 24h | — | .state/memory/\*.jsonl | trimmed files | — |

### Planned

| Handler | Interval | Preflight | Reads | Writes | Downstream |
|---------|----------|-----------|-------|--------|------------|
| convention-check | 30min | new evals since last run | .state/evaluations/, session.jsonl | may.db:convention\_checks, summary.json | → coach (regression) |

## 2. Heartbeats (LLM sessions)

Each spawns an agent session on its interval. The agent reads its
heartbeat.md and works through it.

| Heartbeat | Agent | Interval | Notify | Triggered By |
|-----------|-------|----------|--------|--------------|
| heartbeat | may | 30min | — | lessons-graduation, system-status, focus-task-tracker |
| heartbeat-bob | bob | 30min | yes | — |
| heartbeat-coach | coach | 60min | yes | evaluate-sessions, error-log-scanner, convention-check (planned) |
| heartbeat-evaluator | evaluator | 2h | yes | — |
| heartbeat-optimizer | optimizer | 30min | — | — |
| heartbeat-qa | qa | 30min | — | — |
| heartbeat-scout | scout | 30min | yes | — |
| heartbeat-tech-lead | tech-lead | 30min | yes | — |
| heartbeat-amy | amy | 30min | — | — |
| heartbeat-amy-kimi | amy-kimi | 30min | — | — |

## 3. Agent Tasks (LLM sessions via run-agent-task)

Scheduled LLM work with optional preflights. More expensive than handlers.

| Task | Agent | Interval | Preflight | Purpose |
|------|-------|----------|-----------|---------|
| reflect | coach | 6h | new-entries-since human-inputs.jsonl | Extract corrections, propose improvements |
| training-sprint | coach | 12h | — | Batch gym experiments (3-5 per run) |
| research-intake | coach | 12h | — | Read Scout/Amy research for method ideas |
| common-sense-infra | bob | 24h | — | Review infra gaps in common-sense.md |
| analyze-failures | bob | 24h | new-entries-since .state/evaluations | Analyze evaluation patterns |
| optimize | optimizer | 24h | — | Implement one optimization from findings |
| consolidate-memory-\* | each agent | 7d | file-has-content journal.md | Journal → knowledge → archive |

## 4. Reactive Chains

Arrows show what triggers what, and under what condition.

```
evaluate-sessions
  ├──[bad score]──→ trackRequest(coach) + triggerNow(heartbeat-coach)
  └──[always]─────→ triggerNow(convention-check)  [PLANNED]

convention-check  [PLANNED]
  └──[regression]─→ trackRequest(coach) + triggerNow(heartbeat-coach)

error-log-scanner
  └──[≥3 same errors in 7d]──→ manager.run(coach, growth-cycle task)

system-status
  └──[issues found]──→ trackRequest(may) + triggerNow(heartbeat)

lessons-graduation
  └──[oversized LESSONS]──→ triggerNow(heartbeat)

focus-task-tracker
  └──[new focus signals]──→ trackRequest(may) + triggerNow(heartbeat)
```

### Chain: Session → Evaluation → Convention → Coaching

The main quality loop:

```
agent session completes
  → evaluate-sessions (30min) writes evaluation
    → convention-check (reactive) writes compliance data
      → if regression: coach gets task + heartbeat trigger
        → coach runs Growth Cycle (gym test → fork → promote/discard)
          → agent config updated
            → next session uses updated config
              → convention-check measures improvement
```

### Chain: Human Correction → Convention Discovery

```
Hao sends message
  → human-inputs.jsonl
    → reflect cron (6h) classifies as CORRECTION/GAP/DIRECTION
      → if no matching convention: writes to proposed-conventions.md
        → Hao reviews, approves
          → added to CONVENTIONS.md
            → convention-check handler picks it up (after code change)
```

### Chain: Error Pattern → Training

```
agent hits repeated errors
  → ERROR_LOG.jsonl
    → error-log-scanner (4h) detects pattern (≥3 in 7d)
      → spawns coach session with growth-cycle task
        → coach forks agent, applies fix, tests in gym
          → promote or discard based on results
```

## 5. Data Flow

Where data lives and who reads/writes it.

| Store | Writer(s) | Reader(s) | Purpose |
|-------|-----------|-----------|---------|
| .state/sessions/history/ | manager (all agents) | evaluate-sessions, convention-check, coach, evaluator | Session transcripts + metadata |
| .state/evaluations/ | evaluate-sessions | coaching-report, daily-brief, analyze-failures, convention-check | Per-session quality scores |
| .state/convention-checks/summary.json | convention-check | coach, daily-brief | Convention compliance dashboard |
| may.db:requests | trackRequest (many) | audit-requests, agent heartbeats | Cross-agent task tracking |
| may.db:convention\_checks | convention-check | convention-check (aggregation) | Per-session convention compliance |
| may.db:convention\_maturity | convention-check | convention-check, summary.json | Convention graduation state |
| agents/\*/ERROR\_LOG.jsonl | manager (on errors) | error-log-scanner, coach | Error patterns |
| agents/shared/CONVENTIONS.md | humans, coach (propose) | convention-check (registry), agents (reference) | Canonical convention list |
| agents/shared/common-sense.md | humans, coach | all agents (auto-injected) | Lean behavioral rules |
| agents/coach/workspace/experiments.jsonl | growth-cycle workflow | coach, coaching-report | Experiment results |
| .state/human-inputs.jsonl | chat-session | reflect cron | Human corrections and directions |

## 6. Cost Structure

Approximate daily LLM cost by process category.

| Category | Processes | Sessions/day | Est. cost/day |
|----------|-----------|-------------|---------------|
| Heartbeats | 10 agents × their intervals | ~200 | $15-25 |
| Agent tasks | 8 scheduled tasks | ~10-15 | $5-10 |
| Memory consolidation | 9 agents × weekly | ~1-2 | $1-2 |
| JS handlers | 12 handlers | 0 LLM | $0 |
| **Total** | | ~215 | **$20-35** |

Convention-check handler: $0 (pure JS).

## 7. Supervision

Who watches what.

| Concern | Watcher | How |
|---------|---------|-----|
| Session quality | evaluate-sessions → evaluator agent | Automated scoring on every session |
| Convention compliance | convention-check handler | Mechanical checks on every session |
| Error patterns | error-log-scanner | Automated pattern detection |
| Cost efficiency | optimizer heartbeat + coaching-report | Daily review of spend and waste |
| System health | system-status handler + daily-brief + **`--status` CLI** | Metrics collection, alerting, and live dashboard |
| Process health | **`--status` CLI** (PROCESS HEALTH section) + Bob weekly review | Live last-fire times, overdue detection |
| Agent behavior | coach (common-sense-verify + growth cycles) | Targeted audits + gym experiments |
| Human satisfaction | reflect cron | Classifies human corrections |

## 8. Adding a New Process

Checklist:

1. Determine type: JS handler (zero LLM) vs agent task (LLM) vs heartbeat step
2. Prefer JS handler when possible — cheaper, faster, deterministic
3. If JS handler: create in `agents/may/handlers/`, add cron entry to `cron.json`
4. If agent task: add cron entry with `handler: "run-agent-task"` and `agent` field
5. Add preflight if the process should skip when no new data exists
6. Document reactive triggers: what does it triggerNow()? What does it trackRequest()?
7. **Update this file** — add to the appropriate table and chain diagram
8. If it reads/writes new data stores, add to the Data Flow table
9. Run `npm run check` — handler must compile cleanly

## 9. Disabled Processes

| Process | Disabled Since | Reason |
|---------|---------------|--------|
| lesson-consolidation | 2026-03-18 | Redundant with lessons-graduation JS handler |
| evaluate-session-llm | 2026-03-17 | Redundant with evaluate-sessions JS handler |
