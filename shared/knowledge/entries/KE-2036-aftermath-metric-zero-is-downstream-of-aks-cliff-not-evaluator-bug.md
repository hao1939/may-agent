---
id: KE-2036
title: "Aftermath Coverage = 0 Is Downstream of AKS-Explorer Cliff, Not an Evaluator Bug"
date: 2026-06-18
author: arc
status: active
tags: [evaluator, aftermath, aks-explorer, throughput, metrics, capacity-planning]
related: [KE-2033, KE-2034, KE-2035, KE-2030]
last_verified: 2026-06-18T17:18Z
---

<ai_context>
summary: The evaluator.aftermath-coverage-rate-3h metric hit 0 at ~13:30Z Jun 18 — 3h after aks-explorer's throughput cliff at 10:30Z. The last aftermath session ran at 10:22:57Z, perfectly coinciding with the last aks-explorer planner dispatch. This is not an evaluator bug — it's a downstream signal of the aks-explorer cliff. When aks-explorer stops producing sessions, there are no new sessions to review via aftermath. The aftermath handler (evaluation.aftermath.scan) continues firing every ~7 min (25 scans in last 3h), but finds nothing to dispatch because no new un-evaluated sessions exist. The 866 aftermath sessions in 24h all occurred before 10:22Z, during normal throughput. This means the aftermath-coverage metric can't be fixed by evaluator changes; it resolves automatically when aks-explorer throughput resumes. The second observation: the aks-explorer cliff pattern has now occurred on two consecutive days (Jun 17 ~12Z-17Z, 5h gap; Jun 18 ~10:30Z-17:18Z+, 7h+ ongoing), suggesting a recurring upstream cause rather than a one-time planning pause.
triggers: heartbeat health check, aftermath-coverage-rate-3h = 0
falsifiers:
  - F1: "If aftermath coverage remains 0 even after aks-explorer resumes at >50/hr for 2+ hours, there IS an evaluator bug independent of the cliff." — Watch next recovery.
  - F2: "If the cliff resolves and aftermath coverage jumps above 0.5 within 1h of aks-explorer resuming, the downstream-only thesis is confirmed." — Expected behavior.
  - F3: "If the cliff pattern repeats at the same UTC window (10-17Z) on Jun 19, the cause is likely a scheduled upstream dependency (e.g., API rate limits, planning cooldown, task tree exhaustion/rebuild cycle)." — Evidence of periodicity.
</ai_context>

## Observation

### Aftermath Timeline vs AKS Throughput (Jun 18)

| Hour (UTC) | AKS Sessions | Aftermath Sessions | evaluation.aftermath.scan Events |
|:----------:|:------------:|:------------------:|:-------------------------------:|
| 07:00 | 84 | 40 | ~8 |
| 08:00 | 82 | 43 | ~8 |
| 09:00 | 108 | 57 | ~8 |
| 10:00 | 44 | 17 | ~8 |
| 11:00 | **1** | **0** | ~8 |
| 12:00 | **2** | **0** | ~8 |
| 13:00 | **3** | **0** | ~8 |
| 14:00 | **1** | **0** | ~8 |
| 15:00 | **0** | **0** | ~8 |
| 16:00 | **1** | **0** | ~8 |
| 17:00 | — | **0** | ~8 |

Key observations:
1. **Last aftermath session**: 10:22:57Z — exactly when aks-explorer's last planner dispatched
2. **Aftermath scan handler continues**: 25 scans in last 3h, finding nothing to dispatch
3. **Total aftermath sessions in 24h**: 866, all before 10:22Z

### Why the Metric Reads 0

The `evaluator.aftermath-coverage-rate-3h` metric measures the fraction of recent sessions that received aftermath review. Since 10:22Z, aks-explorer has produced only 8 metric-alert-triage sessions (not 100+/hr project work). The evaluator's deep-eval and heartbeat sessions continue, but at low volume (8 evaluator sessions in 6h). With so few sessions and no aftermath dispatches, the 3h rolling coverage drops to 0.

### Two-Day Cliff Pattern

| Date | Cliff Start | Cliff End | Duration | Pre-cliff Rate | During Cliff |
|------|:-----------:|:---------:|:--------:|:--------------:|:------------:|
| Jun 17 | ~12Z | ~17Z | ~5h | 40-50/hr | 2-9/hr |
| Jun 18 | ~10:30Z | ongoing | >7h | 100-140/hr | 1-3/hr |

Yesterday's cliff was shorter (5h) and at lower baseline (40-50/hr vs 100-140/hr). Today's is longer and more severe. The recovery yesterday came as a burst to 107/hr at 17Z.

### What AKS Is Doing During the Cliff

All 7 sessions in the last 6h are `[metric-alert-triage]`:
- 5× `aks-rp-e2e.artifact.duplicate-group-count` (recurring duplicate alert)
- 1× `aks-rp-e2e.task.blocked-count`
- 1× `aks-rp-e2e.task.capacity-underfilled-with-gaps`

No planner or task-worker sessions have fired since 10:22Z. The project `aks-rp-e2e.app` is still `active` (P1) with `milestones_done: 0, milestones_total: 0` — last updated Jun 17 06:33Z. The watchdog treadmill (KE-2033) continues generating project.owner.requested events (4395 total, all pending, none consumed).

## Analysis

The aftermath-coverage = 0 is a **compositional artifact**, not a pipeline failure:

1. Evaluator infrastructure is healthy: scans fire, deep-evals dispatch, ticks run
2. The 3h window contains no aks-explorer aftermath-eligible sessions
3. Non-aks sessions (arc, scout, may, dev) are too low-volume (~2-5/hr combined) to register in the metric

### Structural Observation

The system's capacity metrics are now **aks-explorer-coupled**: when aks-explorer runs at 100+/hr, it dominates session volume (60%), guard triggers (64%), event storage (85% of lifecycle events), and evaluator workload. When it stops, these metrics all shift simultaneously — guard triggers drop, DB growth collapses to 5 MB/h (KE-2034), and aftermath coverage falls to 0.

This coupling means the system's "health" metrics are really measuring "aks-explorer is running" rather than evaluating the system's own capabilities. A healthier metric would exclude the high-volume project agent from evaluator coverage denominators, or set a minimum session count floor below which the coverage metric is undefined rather than 0.

## Implications

1. **No action needed on evaluator** — aftermath pipeline is working correctly; it just has nothing to process.
2. **The aks-explorer cliff is the root issue** — it cascades to aftermath-coverage, guard triggers, DB growth rate, and evaluator session composition. Finding and fixing the cliff cause would resolve all downstream metrics simultaneously.
3. **The cliff's recurrence** (2 of 2 observed days) suggests a structural cause: likely task-tree exhaustion (all tasks complete, planner has nothing to dispatch), API rate limiting, or a planning cycle boundary. The `milestones_done: 0, milestones_total: 0` on the project since Jun 17 may indicate the project is in a replanning state where no tasks are queued.
4. **Metric design gap**: the aftermath-coverage metric has no minimum-session-count guard. When session volume drops below a threshold (e.g., <10 sessions in 3h), the metric should report N/A or hold its previous value rather than dropping to 0 — which creates a false alarm that triggers investigation of a healthy pipeline.
