# EXP-029: Turn Limit Waste — Trend Analysis After Fixes

**Date**: 2026-04-05
**Author**: Optimizer
**Status**: Active (monitoring)
**Tags**: turn-limit, maxTurns, efficiency, waste

## Problem Statement

Turn-limit errors are the #1 source of wasted ops in the system. Sessions that hit the turn limit are forcibly terminated, losing all in-progress work. This experiment tracks whether deployed fixes reduce the turn-limit error rate over time.

## Fixes Deployed

1. **maxTurns raised 30→40** (Apr 3): Gives agents more room to finish. Config deployed to all agents via cron.json.
2. **Turn budget guidance in heartbeats** (Apr 4): All heartbeats now say "MAX 40 TURNS — EXIT AT 25" with explicit rules about calling `finish(status='partial')`.
3. **JS-level turn budget warning** (pre-existing): At 80% of maxTurns (turn 32/40), a `⚠️ TURN BUDGET WARNING` message is injected into the session.
4. **maxTurns restore on restart** (Apr 4): Fixed bug where sessions lost their maxTurns after process restart and ran unlimited.

## Data

### Turn Limit Rate by 6-Hour Block

| Period | Sessions | Turn Limits | TL Rate |
|--------|----------|------------|---------|
| Apr 2 00:00-05:59 | 12 | 0 | 0% |
| Apr 2 06:00-11:59 | 47 | 0 | 0% |
| Apr 2 12:00-17:59 | 39 | 0 | 0% |
| Apr 2 18:00-23:59 | 33 | 0 | 0% |
| Apr 3 00:00-05:59 | 47 | 0 | 0% |
| Apr 3 06:00-11:59 | 56 | 9 | **16.1%** |
| Apr 3 12:00-17:59 | 40 | 12 | **30.0%** |
| Apr 3 18:00-23:59 | 2 | 1 | 50% (tiny N) |
| Apr 4 00:00-05:59 | 9 | 0 | 0% |
| Apr 4 06:00-11:59 | 25 | 13 | **52%** ← peak |
| Apr 4 12:00-17:59 | 63 | 7 | **11.1%** |
| Apr 4 18:00-23:59 | 47 | 5 | **10.6%** |
| Apr 5 00:00-05:59 | 24 | 2 | **8.3%** ← improving |

**Note**: 0% on Apr 2 likely because maxTurns was not enforced at all (bug). The sudden spike on Apr 3-4 is when enforcement started. The declining rate shows agents adapting to the turn budget guidance.

### Limit Breakdown (30 vs 40)

- 22 errors with maxTurns:30 (old config, pre-Apr 4 morning)
- 27 errors with maxTurns:40 (new config)
- Last 30-limit error: Apr 4 11:14 — config fully propagated after that

### Per-Agent Turn Limit Errors (7d)

| Agent | Count | Wasted Ops | Ops/Error |
|-------|-------|-----------|-----------|
| optimizer | 11 | 345 | 31.4 |
| tech-lead | 9 | 355 | 39.4 |
| bob | 8 | 241 | 30.1 |
| coach | 8 | 334 | 41.8 |
| qa | 5 | 68 | 13.6 |
| scout | 5 | 165 | 33.0 |
| may | 3 | 104 | 34.7 |

**Optimizer is the #1 offender.** Embarrassing for the agent tasked with reducing waste. Root cause: complex analysis tasks that expand in scope.

## Analysis

### What's Working
1. **Turn budget guidance is effective** — rate dropped from 30-52% (peak) to 8-11% (current)
2. **JS-level warning at turn 32** provides a soft deadline that some agents honor
3. **maxTurns:40 is a better limit** than 30 — sessions now have room to wrap up

### What's NOT Working
1. **Agents still hit 40** — 8-11% rate is better but still represents significant waste
2. **Complex tasks don't fit in 40 turns** — coach and optimizer regularly need exploration that exceeds budget
3. **The warning at turn 32 gives only 8 turns to wrap up** — not enough for agents deep in analysis
4. **Workflow sessions never hit limits** — structured workflows are inherently more efficient (0% error rate vs 10% for direct)

### Cost Estimate
- 49 turn-limit errors × ~33 ops avg = 1,612 wasted ops in 7d
- At ~$0.07/op (estimated), that's ~$113/week
- This is 9.5% of total ops (1,612 / 16,964)

## Recommendations

### Already Deployed ✅
- maxTurns: 40 for all agents
- Turn budget guidance in heartbeats
- JS-level turn warning at 80% budget → **changed to 60%** (2026-04-05, warns at turn 24/40 instead of 32/40)

### Deployed This Session: Earlier Warning (P1)
Changed `manager.ts` turn warning threshold from 80% → 60% of maxTurns. For maxTurns:40, this means warning fires at turn 24 instead of turn 32. Gives agents 16 turns to wrap up (40% of budget) instead of only 8 turns (20%). This aligns with heartbeat guidance which says "plan to finish by turn 25."

### Next: P2 — Workflow Adoption Reduces Turn Limits
Workflows have 0% error rate (31 sessions, 0 errors). Increasing workflow usage would structurally reduce turn-limit waste. See EXP-028 for workflow adoption challenges.

### Next: P3 — Task Decomposition
For complex tasks, agents should `finish(status='partial', next_steps=...)` and continue in the next session rather than trying to do everything in one session. The heartbeat guidance mentions this but agents resist it.

## Conclusion

The turn-limit waste problem is partially solved (rate dropped from 30%→8%) but still the #1 waste source. The combination of higher limits + heartbeat guidance + JS warnings is working. The remaining 8% may need structural solutions (earlier warnings, workflow adoption, task decomposition) rather than more text-based guidance.
