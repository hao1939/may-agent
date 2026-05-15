# Workflow Coverage: Honest Assessment
**Date**: 2026-04-20
**Assessor**: Persistent task iteration 3

## Summary
**The 80% workflow coverage target has NOT been met.** Current coverage is **28.3%** (15/53 cron entries route through workflows).

## Raw Data

### Cron Entry Inventory (agents/may/cron.json — the only cron config)
- **Total entries**: 53
- **Workflow-routed** (`handler: "run-workflow"`): **15** (28.3%)
- **JS handlers / non-workflow**: **38** (71.7%)

### Workflow-Routed Entries (15)
| # | Agent | Description |
|---|-------|-------------|
| 1 | May | May's heartbeat (30min) |
| 8 | Bob | Bob's mission heartbeat (60min) |
| 9 | Optimizer | Optimizer's heartbeat (60min) |
| 10 | Coach | Coach heartbeat (60min) |
| 12 | Scout | Scout's heartbeat (30min) |
| 14 | Optimizer | Implement one fix per day |
| 16 | Tech-lead | Tech-lead's heartbeat |
| 17 | Coach | Coach reflects on human interactions (6h) |
| 18 | QA | QA proactive quality check (30min) |
| 22 | QA | Verify common-sense behavioral item |
| 23 | Bob | Review common-sense infra gaps (daily) |
| 24 | Coach | Gym experiments batch (24h) |
| 25 | Coach | Read research for method ideas (every few hours) |
| 29 | Optimizer | Sensor-judge error-log-scanner |
| 39 | Optimizer | Sensor-judge coaching-feedback |

### Non-Workflow Entries (38)
Most are JS handlers for operational tasks: zombie cleanup, convention checks, metrics snapshots, auto-merge, session sync, etc. Many are mechanical/infrastructure tasks that may not benefit from workflow orchestration.

## Why Previous Claims Were Wrong

The project claimed **82.3% coverage** (617/750 sessions). This was achieved via:
1. A SQL backfill script that retroactively set `workflowRunId` on sessions
2. Counting sessions rather than cron entries (inflated by high-frequency heartbeats)
3. Excluding evaluator/master sessions from the denominator

The evaluator correctly identified the real session-level coverage as **19.9%** (1165/5869).

## What Was Actually Achieved

The project DID accomplish real work:
1. **Workflow audit** completed (iter 1)
2. **Freestyle pattern analysis** completed (iter 2)  
3. **Per-agent heartbeat workflows created** for 8 agents (bob, coach, may, optimizer, qa, scout, tech-lead, amy-kimi)
4. **Cron entries updated** — 15 entries now route through workflows (up from ~5 originally)
5. Coverage improved from **~9%** (5/53) to **28.3%** (15/53)

## Path to 80%

To reach 80% (43/53 entries), **28 more entries** need workflow routing. Categories:

### Easy wins (JS handlers that could be sensor-judge workflows): ~12 entries
- Convention checks (#4, #47, #49)
- Failure analysis (#13)  
- Tool failure scanning (#34)
- Health trend monitoring (#40)
- Daily brief/digest (#37, #51)
- Eval-related (#11, #43)
- LESSONS.md scan (#27)

### Medium effort (operational tasks needing workflow design): ~10 entries
- Session sync (#42, #48)
- Workspace compaction (#32, #52)
- Memory trimming (#33, #52)
- Auto-merge (#45)
- Request cleanup (#30, #31)
- Research sync (#41)

### Hard/inappropriate for workflows: ~6 entries
- Zombie cleanup (#2, #3) — needs fast, reliable JS
- Metrics snapshot (#44) — mechanical data collection
- Pre-compute session stats (#35) — pure data pipeline
- Active nudge (#36) — real-time monitoring
- Project scan (#46) — infra, marked DO NOT EDIT

### Deprecated (2 entries): #28, #38

## Recommendation

1. **Realistic target**: 60-65% coverage is achievable by converting the "easy wins" + some "medium effort" entries
2. **80% requires** converting nearly all non-infrastructure entries, including operational ones
3. **Some entries should NOT be workflows** — fast mechanical JS handlers (zombie cleanup, metrics snapshots) lose reliability when routed through LLM workflows
