---
id: KE-2025
title: "Planner Amplification Ratio 1.86:1 — Quantified Session Volume Driver"
date: 2026-06-18
author: arc
status: active
tags: [aks-explorer, throughput, planner, jevons-paradox, capacity-planning, amplification]
related: [KE-2024, KE-952, KE-2022, KE-2023]
---

<ai_context>
summary: In the last 24h, aks-explorer ran 2610 sessions decomposed as 1608 planner (62%), 863 task (33%), 139 other (5%). The planner-to-task ratio is 1.86:1 — for every task dispatched, 1.86 planner sessions ran. At 5.8 avg ops/planner vs 41 avg ops/task, planners consume 9328 ops/day (21%) vs tasks at 35383 ops/day (79%), but planners dominate session count, event count, and guard trigger count. This is the concrete amplification loop behind KE-952's Jevons paradox: each planner can dispatch multiple tasks, each completed task triggers a re-plan, and each re-plan is its own session generating events, guard triggers, and DB rows. The planning overhead — not task execution — is the primary driver of DB growth (25.2 MB/h) and guard trigger count (5032/5500).
triggers: heartbeat health check, KE-2024 dual-pressure follow-up, session composition analysis
falsifiers:
  - F1: "If planner-to-task ratio drops below 1.2:1 for 24h without a workflow change, the current ratio is transient (burst of re-planning from failed tasks)."
  - F2: "If a planning cooldown (e.g., minimum interval between re-plans for the same project) is implemented and session count drops below 1500/day, the amplification loop was the primary throughput driver."
  - F3: "If task completion rate increases (more tasks done per planner) without total session growth, the amplification loop is tightening naturally."
</ai_context>

## Observation

aks-explorer session composition (last 24h, measured 2026-06-18 ~04:30Z):

| Session Type | Count | Share | Avg Ops | Total Ops | Ops Share |
|-------------|------:|------:|--------:|----------:|----------:|
| Planner | 1608 | 62% | 5.8 | 9,326 | 21% |
| Task | 863 | 33% | 41.0 | 35,383 | 79% |
| Other (heartbeat etc) | 139 | 5% | 32.1 | 4,462 | — |
| **Total** | **2610** | 100% | 18.9 | **49,171** | — |

**Planner-to-task ratio: 1.86:1.** For every task session that runs, nearly two planner sessions fire.

## Why This Matters for Capacity

Each planner session is lightweight (5.8 ops avg) but generates:
- 1 session row + session.start + session.end + session.receipt events (~4 events minimum)
- 1-2 guard triggers (ghost-deliverable pattern per KE-2022: 21.7% of planners trigger it)
- 1 evaluation (or skip event)
- 1 handler.started + handler.completed event pair

Conservative estimate: each planner session produces ~8-10 events. At 1608 planners/day: **~12,000-16,000 events/day from planning alone.** This is additive to task execution events.

## The Amplification Loop

```
Task completes → project handler fires → planner session dispatched
  → planner analyzes state → dispatches 0-N new tasks
  → each new task completion → another planner session
  → planner also fires on timeouts, failures, periodic checks
```

The 1.86:1 ratio means the loop is amplifying: planners run more often than tasks complete. Sources of "extra" planner sessions:
- **Periodic re-planning** on timer ticks (not just task completions)
- **Failed task re-planning** (27 error tasks → re-plan attempts)
- **Watchdog/health check** patterns triggering re-plans

## Connection to KE-952 and KE-2024

KE-952 identified the Jevons paradox: per-unit efficiency savings were consumed by volume increases. This KE quantifies the mechanism:

- The **planning layer** — not task execution — is the volume multiplier
- Reducing per-planner cost (already low at 5.8 ops) yields minimal savings
- The structural lever is **planning frequency**, not planning efficiency
- A planning cooldown (e.g., one re-plan per 15 minutes per project) would immediately reduce sessions from ~2600 to ~1200-1400/day

## Current System Pressure (updated from KE-2024)

| Metric | Current | Threshold | Hours to Breach |
|--------|---------|-----------|-----------------|
| DB size | 1903 MB | 2000 MB | ~3.8h at 25.2 MB/h |
| Guard triggers (24h) | 5032 | 5500 | Stabilizing (rolling window equilibrium) |

Both pending proposals (DB threshold raise, guard dedup) remain unapproved after 24+ hours. KE-2023 F1 (DB stabilizes below 1800 MB) is definitively falsified — DB has grown monotonically through 1800 → 1903 MB.

## Recommendation

The planner amplification ratio is the highest-leverage observation for throughput governance. Unlike guard threshold raises (stopgap) or event dedup (symptom management), reducing planner frequency addresses the root cause of all three pressures: DB growth, guard trigger count, and event bus volume. This is a platform decision requiring human judgment per KE-2024.
