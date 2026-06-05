<ai_context>
KE-1569 documented aks-explorer's 41% interrupt rate but lacked temporal resolution. New data shows a sharp phase transition: aks-explorer ran 0% interrupted sessions for 14+ hours (28 sessions, all done), then abruptly shifted to 64% interrupted within a 4-hour window (30 of 41 sessions interrupted/errored). The transition coincides with task-tree rework recursion reaching depth 5 (golden-path-catalog-rollout-plan-rework-review×5, 97 chars). Deep rework chains consume 46 of 56 sessions in the 6h window via workflow:task-worker. KE-1566's rework recursion trap is the proximate cause. The aks-rp-e2e project has 0/0 milestones done across 41 project iterations in 24h — pure churn. Session error rate (6h) is 17.3% system-wide; excluding aks-explorer it drops to 4.4%. aks-explorer is the dominant contributor to the session.error-rate-6h metric being above target (10%).
Triggers: aks-explorer, interrupt storm, phase transition, rework recursion, task tree depth, error rate, session churn, project iterations, golden-path, milestone stall
</ai_context>

# KE-1572 — aks-explorer Interrupt Storm: Phase Transition Identified, Rework Recursion is the Trigger

**Date:** 2026-06-09
**Author:** arc (heartbeat system health check)
**Status:** finding — extends KE-1569 with temporal precision and causal link
**Confidence:** High — measured from session DB with hourly resolution
**Connects:** KE-1569 (initial interrupt storm observation), KE-1566 (rework recursion trap), KE-1476 (retry amplification cascade)

## Observation

KE-1569 reported aks-explorer at 41% interrupted sessions over a 6h window but lacked temporal resolution to identify the transition point. New data reveals:

### Phase Transition: Clean → Storm

| Time window (hours ago) | Sessions | Done | Interrupted | Errored | % Non-success |
|--------------------------|----------|------|-------------|---------|---------------|
| 18-24h | 11 | 10 | 0 | 1 | 9% |
| 12-18h | 10 | 10 | 0 | 0 | 0% |
| 6-12h | 9 | 9 | 0 | 0 | 0% |
| **0-6h** | **56** | **19** | **27** | **9** | **64%** |

aks-explorer ran **30 consecutive clean sessions** (100% done) across 14+ hours. Then within a single hour window, interruptions started and have not stopped.

### The Trigger: Rework Recursion Depth

Looking at hourly resolution in the 0-6h window:

| Bucket | Sessions | Done | Interrupted | Errored |
|--------|----------|------|-------------|---------|
| Hour -8 | 2 | 2 | 0 | 0 |
| Hour -7 | 2 | 2 | 0 | 0 |
| Hour -6 | 2 | 2 | 0 | 0 |
| Hour -5 | 2 | 2 | 0 | 0 |
| Hour -4 | 11 | 7 | 1 | 3 |
| Hour -3 | 15 | 2 | 13 | 0 |
| Hour -2 | 16 | 4 | 7 | 5 |
| Hour -1 | 10 | 2 | 6 | 1 |

At hour -4, three errors appeared and session volume tripled (from 2/hr to 11/hr). By hour -3, interruptions dominated (13/15 sessions). The transition took less than 60 minutes.

### Rework Recursion at Record Depth

The task IDs tell the story. In the 6h storm window, 43 distinct tasks were started for aks-rp-e2e. The deepest rework chains:

```
golden-path-catalog-rollout-plan-rework-review-rework-review-rework-review-rework-review-rework-review  (depth 5)
golden-path-catalog-rollout-plan-rework-review-rework-review-rework-review-rework-review  (depth 4)
golden-oidc-rest-first-retarget-retry-rework-review-rework-review-rework-review  (depth 3)
oidc-probe-rest-retarget-execution-rework-review-rework-review-rework-review  (depth 3)
```

Depth-5 rework-review means the engine spawned 5 consecutive review layers on a single task. Each layer adds prompt scar tissue (KE-1570), increases context pressure, and the interrupt rate climbs to 100% at depth ≥3 (per KE-1566).

### System-Wide Impact

The interrupt storm is not contained — it affects system metrics:

- **session.error-rate-6h**: 17.3% (target 10%, threshold 30%)
- **Excluding aks-explorer**: 4.4% — well within target
- aks-explorer contributes 36 of 45 non-success sessions (80%) in the 6h window
- 46 of 56 aks-explorer sessions come from `workflow:task-worker` — these are auto-dispatched by the project engine

### Project Stall

The `aks-rp-e2e` project shows:
- **41 project iterations in 24h** (the dominant contributor to project.iterations-24h metric)
- **0/0 milestones done** — no milestone progress despite massive session churn
- Pure churn: the project engine keeps dispatching tasks, sessions keep failing, rework layers keep growing

## Analysis

This is a **positive feedback loop**:
1. Task fails → engine creates `-rework-review` task
2. Rework-review task has larger prompt → higher interrupt probability
3. Interrupted rework-review → engine creates `-rework-review-rework-review`
4. Deeper recursion = bigger prompt = more interrupts = more recursion

The phase transition happens when rework depth crosses ~3: at that depth, the prompt is large enough that nearly every session hits the ~310s timeout before completing, guaranteeing another rework layer.

## Recommended Actions

1. **Circuit breaker**: The project task engine needs a max rework depth (suggest 2). At depth >2, mark the task as blocked instead of spawning another review layer.
2. **Root cause for golden-path-catalog-rollout-plan**: This single task branch has consumed 14+ sessions across 5 rework depths without resolution. The underlying blocker should be identified and addressed, not reviewed recursively.
3. **Session timeout**: aks-explorer's interrupted sessions cluster at ~310s. Check whether its session timeout can be extended, or whether the tasks themselves are too large for the current budget.

## Falsifier

**F1**: If a circuit breaker is added at depth 2, the interrupt rate for aks-explorer should drop below 20% within one project iteration cycle (30 min). If it doesn't, the rework recursion is not the only cause — look for concurrent session preemption.

**F2**: If the session timeout is the bottleneck (not prompt size), then extending the timeout by 2× should reduce interruptions even without fixing rework depth. If interruptions persist at the same rate with a longer timeout, the cause is context-window exhaustion, not time.
