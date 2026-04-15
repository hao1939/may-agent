# Finding: Session Archaeology — Coach & Bob 24h Analysis (Apr 15)

**Date**: 2026-04-15 ~08:00 UTC  
**Mode**: A (Session Archaeology)  
**Scope**: Coach and Bob sessions over last 24h, compared to 24-72h baseline

## Executive Summary

Both coach and bob show **healthy op distributions** with no systemic bloat. Coach's avg ops/session dropped from 16.5 (prior 48h) to 13.7 (last 24h) — a 17% improvement. Bob remains flat at ~14.6 ops/session. The 48-op coaching-feedback session and 73-op ENVIRONMENT FACTS session are **explainable one-offs**, not recurring patterns. No new multi-restart accumulation issues detected.

## Coach Analysis

### Op Distribution (Last 24h: 64 sessions, 878 total ops)

| Category | Sessions | Avg Ops | Total Ops | Max | Notes |
|---|---|---|---|---|---|
| Heartbeats | 28 | 4.6 | 128 | 9 | Excellent — well under 10-op target |
| Cron tasks | 8 | 23.4 | 187 | 43 | common-sense-verify is the spike (43 ops) |
| Work sessions | 41 | 12.2 | 502 | 48 | Most under 20, a few spikes |
| WF env tasks | 10 | 23.0 | 230 | 73 | One 73-op outlier explained below |

### Spike Investigation

**48-op coaching-feedback session** (`s_1776234795917_39`):
- Convention violation analysis task, dispatched via workflow
- Only 2 coaching-feedback sessions exist all-time (avg 31 ops, max 48)
- This is the nature of the task — analyzing violations requires reading multiple agents' code
- **Verdict**: One-off, no fix needed. Only 2 sessions ever = not a recurring cost driver

**73-op ENVIRONMENT FACTS session** (`s_1776174784898_152`):
- Part of a 2-session workflow run (89 total ops)
- 18 ENVIRONMENT FACTS sessions all-time, avg 20 ops, this one 3.65× average
- **Verdict**: Outlier within acceptable variance. The ENVIRONMENT FACTS task pattern averages 20 ops — the 73-op run likely hit edge cases. Not recurring (only 1 of 18 sessions was this high)

**43-op cron:common-sense-verify**:
- common-sense-verify tasks are inherently variable (need to pick item, design test, run it)
- Prior entry in todo.md already notes coach cron sessions as a known cost center
- **Verdict**: Known pattern, not new

### Trend

| Period | Sessions | Avg Ops | Total Ops | Max |
|---|---|---|---|---|
| Last 24h | 64 | 13.7 | 878 | 73 |
| Prior 24-72h | 161 | 16.5 | 2,655 | 133 |

Coach avg ops **dropped 17%** (16.5 → 13.7). Max ops dropped from 133 to 73. No sessions over 100 ops in last 24h (previously had 133-op sessions). This is a real improvement trend.

## Bob Analysis

### Op Distribution (Last 24h: 58 sessions, 848 total ops)

| Category | Sessions | Avg Ops | Total Ops | Max | Notes |
|---|---|---|---|---|---|
| Heartbeats | 28 | 6.3 | 177 | 12 | Healthy, max 12 is good |
| Work/call | 51 | 14.4 | 735 | 69 | 9 sessions >30 ops |
| Other | 4 | — | — | — | Design reviews, cron infra |

### Bob >30-op Sessions (9 total)

| Ops | Task | Verdict |
|---|---|---|
| 69 | Design EXP-RECOGNITION | Complex design task — justified |
| 67 | POC: Guards as Workflow Demands | POC work — justified |
| 59 | Design Recognition-Layer Scenarios | Multi-scenario design — justified |
| 53 | Run Baselines for 2 scenarios | Gym runs are legitimately heavy |
| 39 | Gym triage criteria + lab→gym merge | Design task — justified |
| 39 | Run Baselines for 3 scenarios | Gym runs — justified |
| 37 | Execute EXP-RECOGNITION Phase 2 | Experiment execution — justified |
| 37 | Reinterpret KE-129 | Research synthesis — justified |
| 34 | Baseline premature-ship-pressure | Gym baseline — justified |

**All 9 high-op bob sessions are complex design/experiment/gym tasks** — none are bloated heartbeats or runaway reads. Bob's budget cap system is working: P1 violations not appearing.

### Trend

| Period | Sessions | Avg Ops | Total Ops | Max |
|---|---|---|---|---|
| Last 24h | 58 | 14.6 | 848 | 69 |
| Prior 24-72h | 172 | 14.6 | 2,510 | 187 |

Bob avg ops is **flat at 14.6** — completely stable. Max dropped dramatically from 187 to 69. No runaway sessions in last 24h. The D-o-R budget cap and research thread caps are holding.

## Multi-Restart Sessions

### Coach (5 multi-session workflow runs in 24h)
- Largest: 89 total ops across 2 sessions (the 73-op ENVIRONMENT FACTS run)
- Others: 42, 38, 32, 29 total ops — all reasonable 2-session workflows
- **No sessions >100 ops** — the prior era of 184-op and 129-op multi-restart sessions appears resolved

### Bob (4 multi-session workflow runs in 24h)
- Largest: 68 total ops across 3 sessions
- Others: 42 (4 sessions), 20 (3 sessions), 15 (4 sessions)
- **No accumulation problem** — all well-controlled

## Conclusions

1. **Coach is improving** — 17% avg ops reduction, no 100+ op sessions, heartbeats averaging 4.6 ops
2. **Bob is stable** — flat at 14.6 avg, all high-op sessions are justified complex tasks, budget caps holding
3. **The 48-op coaching-feedback was a one-off** — only 2 such sessions ever, task is inherently heavy
4. **No new optimization opportunities identified** — both agents are within healthy operating ranges
5. **Multi-restart accumulation: resolved** — no sessions over 89 total ops (previously 184+)

## Actionable Items

**None.** Both agents are operating within acceptable ranges. Prior interventions (D-o-R budget cap, research thread caps, heartbeat dispatch improvements) are holding. Continue monitoring.
