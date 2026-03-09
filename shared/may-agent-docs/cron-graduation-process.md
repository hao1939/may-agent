# Cron Job Graduation Process

How recurring tasks move from manual agent work to stable automated cron jobs.

## The Pipeline

```
heartbeat.md instruction → agent does it manually → observe sessions → stabilize pattern → graduate to cron job → graduate to JS handler
```

### Stage 1: Manual (heartbeat.md)
- Task is written as a step in the agent's `heartbeat.md`
- Agent executes it during heartbeat wake-ups
- **Purpose**: Learn what works. The agent figures out the right approach through trial and error.
- **Duration**: At least 5 successful sessions before considering promotion.
- **Track**: Watch evaluations for quality, note turn counts, identify failure patterns.

### Stage 2: Agent Cron Job
- Task becomes a named cron entry with `"agent": "X"` and a specific message
- Still uses LLM — spawns the agent with a prompt
- **Promotion criteria**:
  - ≥5 successful manual sessions
  - Consistent pattern (agent does roughly the same thing each time)
  - Average quality ≥ 0.6 in evaluations
  - Clear, repeatable prompt that produces consistent results
- **Example**: `analyze-failures` (14 sessions, stable pattern of reading evals + writing analysis)

### Stage 3: JS Handler (graduated)
- Task is implemented as deterministic TypeScript code
- No LLM involved — pure logic
- **Promotion criteria**:
  - ≥10 successful agent cron sessions
  - The pattern is fully predictable (no judgment needed)
  - Can be expressed as: read X → compute Y → write Z
  - Cost savings justify the implementation effort
- **Examples**: `evaluate-sessions`, `drain-todo`, `watchdog`, `system-status`

## Current Status

### Graduated to JS Handler ✅
| Job | What it does | Sessions before graduation |
|-----|-------------|---------------------------|
| evaluate-sessions | Find unevaluated sessions, run evaluator | Many |
| drain-todo (×5) | Read todo.md, spawn agent for top item | Many |
| watchdog | Kill sessions stuck >30min | N/A (always JS) |
| system-status | Collect metrics, emit status | Many |
| focus-task-tracker | Check focus task signals | N/A (born as JS) |
| daily-brief | Generate daily metrics summary | N/A (born as JS) |

### Stage 2: Agent Cron Jobs (learning)
| Job | Agent | Sessions | Ready to graduate? |
|-----|-------|----------|-------------------|
| analyze-failures | bob | 14 | Maybe — check if pattern is deterministic enough |
| coaching | coach | 14 | No — requires judgment |
| lesson-consolidation | bob | 10 | Maybe — dedup/merge is somewhat predictable |
| optimize | optimizer | 2 | No — too few sessions, needs more learning |
| philosophy-check | bob | 8 | RETIRED — disabled |

### Stage 1: Manual (heartbeat.md)
| Task | Agent | In heartbeat.md | Sessions observed | Notes |
|------|-------|-----------------|-------------------|-------|
| XHS exploration | Amy | Step 3 | ~10 | Not ready — XHS access unstable |
| Research scan | Scout | Step 3 | ~5 | Stabilizing — watch source rotation |
| Synthesis | Bob | Step 3a | ~5 | Needs more observation |
| Philosophy audit | Bob | Step 3b | ~8 (was cron) | Demoted back to manual — low value as cron |
| Design review | Bob | Step 3c | ~3 | Too few sessions |
| Calibration check | Evaluator | Step 4 | New | Just added — needs observation |
| Find coaching needs | Coach | Step 3 | New | Just added — needs observation |
| Find optimization opps | Optimizer | Step 3 | New | Just added — needs observation |

## Rules

1. **Never skip stages.** Even if a task seems simple, run it manually first.
2. **Observe before automating.** Watch at least 5 sessions. Note what varies.
3. **Agent cron jobs are not "automated" — they're "scheduled manual work."** The LLM still runs.
4. **JS handlers are the only true automation.** They're deterministic and cheap.
5. **Demote when quality drops.** If a cron job's quality falls below 0.4, move it back to manual.
6. **The heartbeat is the learning ground.** New tasks start here.
