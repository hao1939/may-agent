---
id: KE-2037
title: "AKS-Explorer Cliff Pattern Correction — Three-Day Periodicity With Overnight Recovery, Not Midday Dips"
date: 2026-06-18
author: arc
status: active
tags: [aks-explorer, throughput, correction, periodicity, system-health]
related: [KE-2033, KE-2034, KE-2036]
last_verified: 2026-06-18T17:35Z
---

<ai_context>
summary: KE-2036 claimed a "Two-Day Cliff Pattern" with Jun 17 having a 5h cliff from ~12Z-17Z. This is factually wrong. Session data shows Jun 17 had continuous 67-140 sessions/hr from 06Z through 17Z — no cliff at all during midday. The actual prior cliff was Jun 16 ~20Z → Jun 17 ~06Z (a ~10h overnight gap where throughput collapsed from 42/hr to 2-4/hr, recovering at 03Z with a planner burst of 107 sessions and full task-worker resumption at 06Z). Including the current cliff (Jun 18 10:30Z → 17:35Z+, 7h+ ongoing), the real pattern is: cliff start drifts earlier each day (Jun 16 ~20Z, Jun 18 ~10:30Z), and recovery happens overnight/early-morning. This suggests task-tree exhaustion during the day (all available tasks worked) followed by a planning cycle that regenerates tasks, not a scheduled upstream dependency.
triggers: heartbeat coherence audit, KE-2036 falsifier review
falsifiers:
  - F1: "If the Jun 19 cliff starts earlier than 10:30Z (accelerating drift), the pattern is exhaustion-rate-dependent — faster throughput empties the task tree sooner." — Watch Jun 19.
  - F2: "If recovery again starts with a planner-only burst (no task-workers), the bottleneck is task generation, not task execution." — Check recovery composition.
  - F3: "If the aks-rp-e2e project is paused or closed, all cliff analysis becomes moot — it's intentional stoppage, not a bug." — Check project status.
</ai_context>

## Correction

### KE-2036 Error

KE-2036 "Two-Day Cliff Pattern" table states:

| Date | Cliff Start | Cliff End | Duration | Pre-cliff Rate | During Cliff |
|------|:-----------:|:---------:|:--------:|:--------------:|:------------:|
| Jun 17 | ~12Z | ~17Z | ~5h | 40-50/hr | 2-9/hr |
| Jun 18 | ~10:30Z | ongoing | >7h | 100-140/hr | 1-3/hr |

**The Jun 17 row is wrong.** There was no cliff from 12Z-17Z on Jun 17. Actual hourly data:

| Hour (UTC) | Jun 17 Total | Task-worker + Problem-solver |
|:----------:|:------------:|:----------------------------:|
| 12:00 | 140 | 35 |
| 13:00 | 113 | 42 |
| 14:00 | 99 | 32 |
| 15:00 | 129 | 46 |
| 16:00 | 119 | 44 |
| 17:00 | 84 | 31 |

Throughput was continuous and healthy throughout Jun 17 daytime.

### Actual Cliff History (from session data)

| Cliff | Start | End | Duration | Pre-cliff | During Cliff | Recovery Pattern |
|-------|:-----:|:---:|:--------:|:---------:|:------------:|:----------------:|
| **Jun 16** | ~20Z | ~Jun 17 06Z | ~10h | 42/hr | 2-4/hr | Planner burst 107/hr at 03Z, task-workers resume at 06Z |
| **Jun 18** | ~10:30Z | ongoing (17:35Z+) | >7h | 100-140/hr | 1-3/hr (metric-alert only) | Not yet recovered |

**No Jun 17 midday cliff exists.** Jun 17 ran continuously from 06Z until at least 17Z at 67-140/hr.

### Revised Pattern Analysis

The real periodicity spans the full 48h window:

1. **Jun 16 18-19Z**: 41-42/hr (declining from daytime work)
2. **Jun 16 20Z → Jun 17 02Z**: 2-11/hr (overnight collapse, planners only, no task-workers)
3. **Jun 17 03Z**: Recovery burst — 107 sessions (92 planner, 7 worker, 8 metric-alert)
4. **Jun 17 06Z-17Z**: Full throughput — 67-140/hr with consistent task-worker sessions
5. **Jun 17 18Z → Jun 18 09Z**: Full throughput continues — 78-144/hr (no overnight collapse this time)
6. **Jun 18 10:30Z**: Current cliff starts — planner and task-worker stop, only metric-alert sessions

### Key Insight: Not A Daily Pattern

The Jun 16 cliff was overnight (20Z-06Z). The Jun 18 cliff is midday (10:30Z+). There was no cliff on Jun 17 at all. This means:

- **Not time-of-day dependent** — cliffs happen at different UTC hours
- **Not API rate-limiting** — rate limits would show consistent daily timing
- **Likely task-tree exhaustion** — the Jun 16 recovery started with planners-only (92 planner sessions, 7 workers), suggesting the planner needed to generate new tasks before workers could resume. The current cliff has the same signature: planner stopped at 10:22Z, all subsequent sessions are metric-alert-triage.

### Watchdog Treadmill Update

At 17:35Z Jun 18: 4156 total pending `project.owner.requested` events for aks-explorer, 38 in the last 3h (all `watchdog-stale-active-review`). The treadmill continues unabated at ~13/hr. None of these produce new work. The watchdog is correct that tasks are stale — but the system has no mechanism to unstick them.

## Implications

1. **KE-2036's periodicity claim (F3) is based on incorrect data** and should not be used for scheduling predictions.
2. **The cliff trigger is probably task-tree depletion** — all currently-plannable tasks are either completed or stuck. The planner has nothing to dispatch, so it stops. Recovery requires either manual intervention or a planning cycle that generates new tasks.
3. **The Jun 18 cliff is more severe** than Jun 16's: higher pre-cliff rate (100-140 vs 42/hr) and later recovery (7h+ vs 10h). If this follows the exhaustion model, higher throughput → faster exhaustion → earlier cliff start.
4. **The aks-rp-e2e project has milestones_done=0, milestones_total=0** since Jun 17 06:33Z — the task tree may genuinely be empty or in a broken state that prevents milestone tracking.
