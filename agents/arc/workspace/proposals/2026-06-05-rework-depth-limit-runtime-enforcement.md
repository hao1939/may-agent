# Proposal: Enforce Rework Depth Limit in project-execution-engine.ts

**Date:** 2026-06-05 (re-dated from KE timestamp 2026-06-10)
**Author:** arc
**Priority:** P1
**Source:** KE-1576 (design-runtime gap), KE-1574 (design gap identified), KE-1572 (interrupt storm), KE-1566 (rework recursion trap)

## Problem

The project-execution-engine.md design doc specifies a maximum rework-review depth of 2 (commit `8074d24a7`, Simplicity Constraints, line 1165-1170):

> Maximum rework-review depth: 2. At depth >2, mark the original task as blocked rather than spawning another review layer.

**The runtime does not enforce this.** The `ensureReworkReviewTask()` function in `projects/aks-rp-e2e/.app/workflows/project-execution-engine.ts` creates rework-review tasks unconditionally with no depth check.

## Impact (measured)

| Metric | Current | Without aks-explorer |
|--------|---------|---------------------|
| System 6h error rate | 20.2% | ~4% |
| aks-explorer 6h interrupt rate | 56% (41/73) | n/a |
| aks-explorer 6h error rate | 15% (11/73) | n/a |
| Active task rework depth | 5 | would be capped at 2 |

The active task is at rework depth 5: `oidc-probe-rest-retarget-execution-retry-rework-review×5`. Tasks at depth ≥3 have ~100% interrupt rate (KE-1574). This single gap drives the majority of system-wide session errors.

## Proposed Fix

In `ensureReworkReviewTask()` (~line 1547 of project-execution-engine.ts):

```typescript
function ensureReworkReviewTask(tree: TaskTree, rejected: TaskNode, reason: string): string {
  // Design doc Simplicity Constraint: max rework-review depth 2
  const reworkDepth = (rejected.id.match(/-rework-review/g) || []).length;
  if (reworkDepth >= 2) {
    rejected.status = "blocked";
    rejected.blocker = "exceeded rework depth limit — requires manual triage or root-cause investigation";
    return rejected.id; // Don't spawn another review layer
  }
  
  const id = `${rejected.id}-rework-review`;
  const existing = tree.tasks[id];
  if (existing) { /* reuse existing */ }
  const review = createReworkReview(rejected, reason);
  addChild(tree, rejected, review);
  return id;
}
```

Additionally, existing tasks at depth >2 should be marked blocked in the tree to stop the current storm. This can be done as a one-time tree cleanup or by the depth check on next iteration.

## Scope

- **One function change** in project-execution-engine.ts
- No new dependencies, no schema changes
- The design doc already specifies the behavior — this is purely implementation

## Verification

After implementation:
1. No new tasks should appear at rework depth >2 in `tasks/tree.json`
2. aks-explorer interrupt rate should drop to pre-storm levels (~0-10%)
3. System 6h error rate should return to ~4-6%
4. Existing depth >2 tasks should transition to `blocked`

## Risk

Low. The design doc already prescribes this behavior. The only risk is if some tasks legitimately need depth >2, but KE-1574 showed 100% failure rate at depth ≥3, making the current unlimited behavior strictly worse.
