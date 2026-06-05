<ai_context>
KE-1576 claimed the project-execution-engine runtime does NOT enforce the rework depth limit added to the design doc (KE-1574, commit 8074d24a7). New evidence shows this is partially falsified: the `isReviewTask(rejected)` guard at line 1556 of ensureReworkReviewTask() DOES prevent deepening — when a review task fails, it resets the same task to `ready` instead of creating a nested child. Live task tree evidence: 27 rework tasks at depth 3+ are all `superseded`, while all 8 currently active/ready tasks are at depth 0 or 1. However, the rework depth guard creates a new problem: horizontal retry churn. The same depth-1 rework-review tasks are retried 8-10 times each (measured from task.started events, 6h window). aks-explorer's interrupt rate persists at 46% (60/130 interrupted, 6h) because the retry loop has no horizontal limit. The task tree has grown to 476 tasks (94 rework-reviews, 20% of all tasks) with 346 accepted, 84 decomposed, 27 superseded. Only 1 task is blocked, 5 ready, 3 active, 10 proposed. The aks-rp-e2e project has 0/0 milestones despite 51 iterations in 24h — milestone tracking itself is not wired to task acceptance. The rework depth cap worked as a vertical circuit breaker but exposed the horizontal retry loop. A max-retry-per-task cap (e.g., 3 attempts before marking blocked) would address the remaining churn.
Triggers: rework depth guard, horizontal retry, rework-review retry, aks-explorer, interrupt rate, task tree bloat, KE-1576 update, isReviewTask guard, ensureReworkReviewTask, circuit breaker
</ai_context>

# KE-1580 — Rework Depth Guard Active, Horizontal Retry Churn Persists

**Date:** 2026-06-10
**Author:** arc (heartbeat coherence audit)
**Status:** finding — updates KE-1576, partially falsifies its core claim
**Confidence:** High — verified from runtime source code, live task tree, and session DB
**Connects:** KE-1576 (design-runtime gap claim), KE-1574 (rework depth limit design), KE-1572 (interrupt storm phase transition), KE-1566 (rework recursion trap), KE-1578 (blueprint refinement principle)

## Observation

KE-1576 stated: *"The runtime code does not enforce this limit."* referring to the `ensureReworkReviewTask()` function creating rework-review tasks unconditionally.

### Evidence: The Guard IS Active

`project-execution-engine.ts` line 1555-1564:

```typescript
function ensureReworkReviewTask(tree: TaskTree, rejected: TaskNode, reason: string): string {
  if (isReviewTask(rejected)) {
    // A failed review task should not create an infinite review-of-review chain.
    // Retry the same review leaf so the branch stays auditable without starving
    // unrelated work behind nested recovery tasks.
    rejected.status = "ready";
    rejected.blocker = undefined;
    rejected.claimed_by = undefined;
    rejected.lease_expires_at = undefined;
    return rejected.id;
  }
  // ... creates depth-1 rework-review for non-review tasks
```

When a rework-review task fails, `isReviewTask(rejected)` returns `true`, and the function **resets the task to `ready`** instead of creating a deeper `-rework-review-rework-review` child. This is the vertical circuit breaker.

### Live Task Tree Confirms

Current `aks-rp-e2e` task tree (476 tasks):

| Status | Count |
|--------|-------|
| accepted | 346 |
| decomposed | 84 |
| superseded | 27 |
| proposed | 10 |
| ready | 5 |
| active | 3 |
| blocked | 1 |

Rework depth distribution:

| Depth | Count | Current Status |
|-------|-------|---------------|
| 1 | 70 | Mixed (most accepted, some ready/active) |
| 2 | 9 | All superseded |
| 3 | 7 | All superseded |
| 4 | 5 | All superseded |
| 5 | 2 | All superseded/accepted |
| 6 | 1 | Superseded |

**All tasks at depth ≥2 are superseded.** The current ready/active tasks are at depth 0 or 1. The vertical depth guard is working.

### New Problem: Horizontal Retry Churn

The guard prevents *deepening* but enables *unbounded horizontal retry*. Same depth-1 rework-review tasks are retried repeatedly:

| Task ID | Attempts (6h) |
|---------|---------------|
| aks-ui-v4-scenario-path-table-retry-rework-review | 10 |
| aks-ui-v4-rest-scenario-actions-rework-review | 10 |
| aks-ui-v4-feature-brief-reference-panel-rework-review | 9 |
| golden-path-rollout-batch-1-rework-review | 8 |
| golden-oidc-rest-first-retarget-retry-rework-review | 8 |
| aks-ui-v4-action-receipts-state-rework-review | 8 |

Each retry consumes a full session (~25 ops, ~260 seconds). 8-10 retries × 6+ tasks × 25 ops = ~1,500 ops spent retrying the same reviews.

### Impact on aks-explorer

| Window | aks-explorer Sessions | Interrupted | Error | Done | Int+Err Rate |
|--------|----------------------|-------------|-------|------|--------------|
| Last 6h | 115 | 60 | 15 | 37 | 65% |
| Last 1h | 51 | 25 | 6 | 20 | 61% |

The storm identified in KE-1572 persists but at reduced depth — the failure mode shifted from **vertical recursion** (depth 5+ chains) to **horizontal retry** (same task retried 10+ times).

## What KE-1576 Got Wrong

KE-1576 stated the runtime "does NOT enforce" the depth limit. This was an incomplete analysis:
1. The design doc's "Maximum rework-review depth: 2" spec was added at commit `8074d24a7` ✓
2. The `isReviewTask()` guard was already present in the runtime, predating the spec
3. The guard prevents depth >1 by resetting review tasks instead of nesting them
4. The spec says "depth >2 → mark blocked" but the runtime resets to ready, which is different behavior but achieves the vertical depth cap

The discrepancy: the spec says *block at depth >2*, the runtime *retries infinitely at depth 1*. Neither behavior matches the other exactly, but the depth cap is functionally enforced.

## Missing: Horizontal Retry Limit

There is no cap on how many times a depth-1 rework-review task is retried. When the underlying issue is structural (e.g., the task goal conflicts with gate constraints, or the task needs information the agent doesn't have), retrying is pure churn.

### Proposed Fix

Add to the `ensureReworkReviewTask()` function:

```typescript
if (isReviewTask(rejected)) {
  const attempts = /* count prior attempts from event history or a task-level counter */;
  if (attempts >= 3) {
    rejected.status = "blocked";
    rejected.blocker = "exceeded retry limit (3 attempts) — requires root-cause investigation";
    return rejected.id;
  }
  rejected.status = "ready";
  // ...existing reset logic
}
```

This would convert horizontal retry churn into explicit blocked state that triggers human triage.

## Falsifier

**F1**: If horizontal retry is capped at 3 and the blocking is correct, aks-explorer's session error+interrupt rate should drop below 25% within 2 hours. If not, the remaining churn comes from non-rework task types.

**F2**: If the task tree's 10 proposed tasks all get dispatched and aks-explorer succeeds on new (non-rework) tasks at a normal rate, the interrupt storm is rework-specific, not agent-wide. If even new tasks have high interrupt rates, the problem is session-level (timeout, context pressure) not task-level.
