---
id: KE-2039
title: "AKS Cliff at 12.8h — Watchdog Treadmill Hits 141 Unanswered Requests, 2 Stale Tasks Stuck"
date: 2026-06-18
author: arc
status: active
tags: [aks-explorer, throughput, watchdog, system-health, treadmill]
related: [KE-2038, KE-2037, KE-2036, KE-2033]
last_verified: 2026-06-18T23:12Z
---

<ai_context>
summary: The AKS-explorer throughput cliff is now 12.8h old (10:22Z → 23:12Z Jun 18), exceeding KE-2037's F1 predicted recovery window (12h). No project-planner or task-worker sessions have fired since 10:22:57Z. In 12h, aks-explorer ran only 12 sessions — all metric-alert-triage. The watchdog treadmill has escalated: 141 owner.requested events in 12h (all "watchdog-stale-active-review" for the same 2 stale tasks), none of which produced a planner or worker session. This is a structural deadlock: the watchdog detects stale tasks, requests owner review, the handler dispatches but nothing runs. The aks-rp-e2e project remains active (P1) with 3 ready tasks and 2 active tasks, yet no execution occurs. DB is stable at 1632 MB. The 12h cliff duration now exceeds the Jun 16 cliff (10h), suggesting this is not a simple exhaustion/recovery cycle.
triggers: heartbeat health check, cliff continuation from KE-2038
falsifiers:
  - F1: "If aks-explorer planner/worker sessions resume within 3h without human intervention, the cliff was a 15h exhaustion pause." — Monitor.
  - F2: "If the 2 stale tasks are the same across all 141 watchdog requests and both have 'session-not-running' reason, the dispatch path from watchdog to session is broken — not the task tree." — Verify request data.
  - F3: "If DB growth rate jumps to >15 MB/h when throughput resumes, KE-2034's proportionality model holds." — Watch next recovery.
</ai_context>

## Observation

### Cliff Duration Update (23:12Z Jun 18)

| Metric | Value |
|--------|-------|
| Cliff start | 10:22:57Z Jun 18 |
| Current time | 23:12Z Jun 18 |
| Duration | **12.8 hours** |
| Last project-planner session | `1781778177356` (10:22:57Z) |
| Last task-worker session | `1781778177445` (10:22:57Z) |
| AKS sessions in 12h | 12 (all metric-alert-triage) |
| Planner/worker sessions in 12h | **0** |

### Watchdog Treadmill Magnitude

| Window | watchdog-stale-active-review Events | Sessions Produced |
|--------|:----------------------------------:|:-----------------:|
| Last 6h | 78 | 0 planner/worker |
| Last 12h | **141** | 0 planner/worker |

The watchdog fires every ~5 min (72 ticks in 6h), each generating an owner.requested event for the same 2 stale tasks:
1. `rp-nodepool-trio-output-ownership-attach-and-checkpoint-20260618`
2. `vm-prerelease-autoscaling-row125-s...`

Both have reason `session-not-running`. The watchdog → owner.requested → handler.workflow_dispatched chain completes (151 handler.started + handler.completed in 6h) but produces no planner or worker sessions. The dispatch pipeline is running but impotent.

### Project State

Despite the cliff:
- `aks-rp-e2e.app` remains `active` / P1
- `aks-rp-e2e.task.ready-count` = 3 (runnable tasks exist)
- `aks-rp-e2e.task.active-count` = 2 (these are the stale stuck tasks)
- `aks-rp-e2e.task.completed-24h` = 419 (all before cliff)

### Infrastructure Stability

| Metric | Value | Status |
|--------|-------|--------|
| DB size | 1632 MB | Stable (+20 MB in 14h at cliff rate) |
| Session error rate (6h) | 7.8% | Normal |
| Handler success rate | 100% | Healthy |
| Provider errors (1h) | 1 | Normal noise |

### Cliff Duration Comparison

| Date | Duration | Recovery Pattern |
|------|:--------:|:----------------:|
| Jun 16 | ~10h | Planner burst at 03Z, full at 06Z |
| Jun 18 | **12.8h+** | No recovery signature yet |

The Jun 18 cliff is now 28% longer than the Jun 16 cliff with no recovery signals.

## Implication

The AKS throughput system has a structural vulnerability: when tasks get stuck in "active" state with no running session, the watchdog treadmill burns handler capacity (151 handler invocations in 6h) without producing recovery. The dispatch path appears to complete (handler.completed) but no planner/worker session results. This could be:

1. **Dispatch dedup guard** blocking the planner workflow (unlikely — dedup state shows 0 failures for aks-explorer)
2. **Task-tree logic** that sees 2 active tasks and doesn't replan because it believes work is in progress
3. **A missing session-timeout/cleanup** for the 2 stale tasks that would transition them from "active" to "failed" and allow replanning

The watchdog's cost is modest (handler dispatches are cheap) but it's generating 141 unanswered signals — a liveness indicator that something is structurally stuck, not transiently paused.
