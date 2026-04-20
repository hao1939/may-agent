# Cron Job Graduation Process

How recurring tasks move from manual agent work to stable automated cron jobs.

## The Pipeline

```
heartbeat.md instruction → agent does it manually → observe sessions → stabilize pattern → graduate to cron job → graduate to JS handler
```

### Stage 1: Manual (heartbeat.md)
- Task is written as a step in the agent's `heartbeat.md`
- Agent executes it during heartbeat wake-ups
- **Purpose**: Learn what works through trial and error.
- **Duration**: At least 5 successful sessions before considering promotion.
- **Track**: Watch evaluations for quality, note turn counts, identify failure patterns.

### Stage 2: Agent Cron Job
- Task becomes a named cron entry with `"agent": "X"` and a specific message
- Still uses LLM — spawns the agent with a prompt via `run-agent-task` handler
- **Promotion criteria**:
  - ≥5 successful manual sessions
  - Consistent pattern (agent does roughly the same thing each time)
  - Average quality ≥ 0.6 in evaluations
  - Clear, repeatable prompt that produces consistent results
- **Example**: `analyze-failures` (bob, 24h — reads evals, writes analysis)

### Stage 3: JS Handler (graduated)
- Task is implemented as deterministic TypeScript code
- No LLM involved — pure logic
- **Promotion criteria**:
  - ≥10 successful agent cron sessions
  - The pattern is fully predictable (no judgment needed)
  - Can be expressed as: read X → compute Y → write Z
  - Cost savings justify the implementation effort
- **Examples**: `evaluate-sessions`, `watchdog`, `system-status`, `daily-brief`

## Current Status

### Graduated to JS Handler ✅
| Job | Handler file | What it does |
|-----|-------------|--------------|
| evaluate-sessions | `evaluate-sessions.ts` | Find unevaluated sessions, run evaluator |
| watchdog | `watchdog.ts` | Kill sessions stuck >30min |
| system-status | `system-status.ts` | Collect metrics, emit status |
| daily-brief | `daily-brief.ts` | Generate daily metrics summary |
| coaching-report | `coaching-report.ts` | Daily coaching quality report |
| focus-task-tracker | `focus-task-tracker.ts` | Check focus task signals **(disabled)** |
| heartbeat-precheck | `heartbeat-precheck.ts` | Gate agent heartbeats (check if busy) |

### Stage 2: Agent Cron Jobs (via `run-agent-task`)
| Job | Agent | Interval | Ready to graduate? |
|-----|-------|----------|-------------------|
| analyze-failures | bob | 24h | Maybe — check if pattern is deterministic enough |
| optimize | optimizer | 24h | No — requires judgment |
| lesson-consolidation | bob | 7d | Maybe — dedup/merge is somewhat predictable |
| focus-task-driver | bob | 1h | No — requires reading and reasoning about focus tasks |

### Stage 1: Manual (heartbeat.md)
| Task | Agent | Sessions observed | Notes |
|------|-------|-------------------|-------|
| XHS exploration | Amy | ~10 | Not ready — XHS access unstable |
| Research scan | Scout | ~5 | Stabilizing — watch source rotation |
| Design review | Bob | ~3 | Too few sessions |
| Calibration check | Evaluator | New | Just added — needs observation |
| Find coaching needs | Coach | New | Just added — needs observation |

*Source: `agents/may/cron.json` (last verified 2026-03-12)*

## Rules

1. **Never skip stages.** Even if a task seems simple, run it manually first.
2. **Observe before automating.** Watch at least 5 sessions. Note what varies.
3. **Agent cron jobs are not "automated" — they're "scheduled manual work."** The LLM still runs.
4. **JS handlers are the only true automation.** They're deterministic and cheap.
5. **Demote when quality drops.** If a cron job's quality falls below 0.4, move it back to manual.
6. **The heartbeat is the learning ground.** New tasks start here.
