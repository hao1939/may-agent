---
id: KE-2033
title: "AKS-Explorer Throughput Cliff at 10:30Z — Watchdog Treadmill Generating 45 Unanswered Owner Requests in 4h"
date: 2026-06-18
author: arc
status: active
tags: [aks-explorer, throughput, watchdog, project-execution, capacity-planning, system-health]
related: [KE-2031, KE-2025, KE-952]
last_verified: 2026-06-18T15:40Z
---

<ai_context>
summary: AKS-explorer session throughput collapsed from ~100-140/hr to ~1-3/hr at approximately 10:30Z Jun 18. The project-planner last dispatched at 10:22Z and the task-worker at 10:22Z. Since then, aks-explorer's only sessions (6 in 4h) are from metric-alert-triage, not project work. The project-execution-watchdog continues ticking every ~5 min (11/hr), generating 45 "watchdog-stale-active-review" owner requests for 2 stuck tasks in 4h — but none of these produce new planner or worker sessions. This is a treadmill: the watchdog detects stale tasks, emits requests, the system acknowledges them, and nothing happens. Two implications: (1) KE-2031's 1.3 MB/h growth rate was measured during this collapse window and may underestimate steady-state growth; (2) the evaluator.aftermath-coverage-rate-3h = 0 is expected when the primary session source stopped producing work.
triggers: heartbeat system health check, session composition analysis
falsifiers:
  - F1: "If aks-explorer planner/worker sessions resume at >50/hr within 6h of this observation without human intervention, the cliff was a transient planning pause (all tasks complete, replanning cycle)." — Monitor next 6h.
  - F2: "If the stale tasks are resolved (completed or dequeued) and the watchdog stops requesting reviews, the treadmill was a real problem that needed manual task cleanup." — Check task tree state.
  - F3: "If KE-2031's growth rate holds at <2 MB/h even when throughput resumes (next burst), the retention fix is the primary growth reducer, not the throughput cliff." — Compare growth during next >50/hr window.
</ai_context>

## Observation

### Throughput Timeline (Jun 18, last 12h)

| Hour (UTC) | AKS Sessions | Evaluator Sessions | Planner | Worker | Notes |
|------------|:-----------:|:------------------:|:-------:|:------:|-------|
| 03:00 | 42 | 25 | — | — | Normal |
| 04:00 | 124 | 55 | — | — | Normal |
| 05:00 | 139 | 64 | — | — | Peak |
| 06:00 | 106 | 57 | — | — | Normal |
| 07:00 | 84 | 55 | — | — | Normal |
| 08:00 | 82 | 57 | — | — | Normal |
| 09:00 | 108 | 71 | 58 | 47 | Normal |
| 10:00 | 44 | 24 | 24 | 16 | **Declining** |
| 11:00 | **1** | **0** | 0 | 0 | **Cliff** |
| 12:00 | **2** | **1** | 0 | 0 | Post-cliff |
| 13:00 | **3** | **2** | 0 | 0 | Post-cliff |
| 14:00 | **1** | **3** | 0 | 0 | Post-cliff |
| 15:00 | **0** | **0** | 0 | 0 | Ongoing |

**Drop magnitude**: ~100/hr → ~1/hr = **99% reduction**

### What Stopped

- **Last planner session**: 10:22:57Z (s_project_planner_planning_update_20260618101949_iu98l0)
- **Last task-worker session**: 10:22:57Z
- **All aks-explorer sessions since 12:13Z**: `source = workflow:metric-alert-triage` (6 sessions in 4h)
- **focus.plan.requested at 10:25Z** and **focus.review.requested at 10:27Z** coincide with the cliff timing

### The Watchdog Treadmill

Despite no planner/worker sessions, the project-execution-watchdog continues operating at full cadence:

| Window | Watchdog Ticks | Owner Requests | Planner Sessions | Worker Sessions |
|--------|:-------------:|:-------------:|:----------------:|:---------------:|
| 08:00-10:00 | 22 | 11 | 72 | 45 |
| 10:00-11:00 | 12 | 9 | 0 | 0 |
| 11:00-15:00 | 44 | 45 | 0 | 0 |

The watchdog detects 2 stale active tasks:
- `rp-nodepool-trio-output-ownership-attach-and-checkpoint-20260618` (reason: session-not-running)
- `vm-prerelease-autoscaling-row125-service-principal-contradiction-reconcile-20260618` (reason: session-not-running)

Every ~5 min, it fires `project.owner.requested` with reason `watchdog-stale-active-review` for these same 2 tasks. **45 identical requests in 4h, 0 new sessions dispatched.** The requests are acknowledged (handler.completed status = done) but produce no work.

### Impact on KE-2031 Forecast

KE-2031 measured a 1.3 MB/h post-VACUUM growth rate over 0.53h of "steady state." But that measurement window (09:31Z-10:05Z) overlapped with the throughput decline (09:00Z: 108 sessions, 10:00Z: 44 sessions). The 7 snapshots used for the linear fit were collected as throughput was collapsing.

**If throughput resumes at pre-cliff levels (~100/hr)**, the growth rate will likely return to >1.3 MB/h. The pre-VACUUM growth rate at full throughput was ~3.3 MB/h net; the fix removed the digest duplication (~2 MB/h), so steady-state at full throughput should be ~1.3 MB/h — which coincidentally matches, but confidence is low because the observation window doesn't include full throughput.

### Impact on Evaluator Metrics

- `evaluator.aftermath-coverage-rate-3h` = 0: 21 eligible sessions in the 3h window (non-evaluator, terminal, ended 7min-3h ago), but 0 have evaluations. The evaluator is still running (100 evaluations in 6h, last at 15:12Z) but likely evaluating sessions from the earlier high-throughput burst, not the recent low-volume window.
- Alert #1947 open for aftermath coverage. This is expected behavior given the throughput cliff — not an evaluator failure.

## Root Cause Hypothesis

The planner stopped dispatching new work around 10:22Z. Two possible causes:

1. **Planning decision**: The planner determined all current tasks are in progress or blocked, and no new work should be dispatched. The focus.plan.requested at 10:25Z may have confirmed this state.
2. **Stuck state**: The 2 stale active tasks are preventing new task assignment (e.g., max concurrent limit reached with stale tasks occupying slots). The watchdog detects them as stale but the system can't recover them.

The `maxConcurrent: 5` field in watchdog events suggests a concurrency limit. If 2 tasks are stuck in "active" state without running sessions, they may be occupying 2 of 5 concurrent slots, but this alone shouldn't prevent new work — there are 3 free slots.

## Recommendation

1. **Investigate task tree state** for aks-rp-e2e — are there pending tasks that should be dispatched but aren't?
2. **Check if the focus review at 10:27Z changed the project state** in a way that paused normal dispatch
3. **Mark stale tasks complete or reassign them** to break the watchdog treadmill
4. **Monitor growth rate during next throughput burst** to verify KE-2031's forecast under real load
