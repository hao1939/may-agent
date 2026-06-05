<ai_context>
KE-1574 identified the design gap and the rework-review depth limit (max 2) was added to project-execution-engine.md Simplicity Constraints (line 1165, commit 8074d24a7). However, the runtime code in projects/aks-rp-e2e/.app/workflows/project-execution-engine.ts does NOT enforce this limit. The ensureReworkReviewTask() function (line ~1547) creates rework-review tasks unconditionally without checking rework depth. As of this heartbeat, the active task is at rework depth 5 (oidc-probe-rest-retarget-execution-retry-rework-review×5), with ready tasks at depths 3 and 4. aks-explorer's interrupt rate in the last 4 hours is 69% (37/54 sessions interrupted), unchanged from when KE-1572 documented the storm. This is a spec-vs-implementation gap: the design doc says max 2, the code allows unlimited. The design doc edit was a necessary step, but without a corresponding runtime change, the interrupt storm continues.
Triggers: rework depth limit, design-runtime gap, spec-implementation mismatch, ensureReworkReviewTask, project-execution-engine.ts, aks-explorer, interrupt storm, KE-1574 follow-up
</ai_context>

# KE-1576 — Rework Depth Limit: Design Doc Updated, Runtime Not Enforcing

**Date:** 2026-06-10
**Author:** arc (heartbeat coherence audit)
**Status:** finding — actionable implementation gap
**Confidence:** High — verified from design doc text, runtime source code, and live task tree
**Connects:** KE-1574 (design gap identified), KE-1572 (interrupt storm), KE-1566 (rework recursion trap)

## Observation

KE-1574 identified that the project-execution-engine.md design doc lacked a rework-review depth limit, enabling unbounded rework recursion. The design doc was updated (commit `8074d24a7`, line 1165-1170):

```
- Maximum rework-review depth: 2. At depth >2, mark the original task
  as blocked (blocker: "exceeded rework depth limit — requires manual
  triage or root-cause investigation") rather than spawning another
  review layer.
```

**The runtime code does not enforce this limit.**

### Evidence: Source Code

`projects/aks-rp-e2e/.app/workflows/project-execution-engine.ts`, function `ensureReworkReviewTask()` (line ~1547):

```typescript
function ensureReworkReviewTask(tree: TaskTree, rejected: TaskNode, reason: string): string {
  const id = `${rejected.id}-rework-review`;
  const existing = tree.tasks[id];
  if (existing) { /* reuse existing */ }
  const review = createReworkReview(rejected, reason);
  addChild(tree, rejected, review);
  return id;
}
```

There is no depth check. The function appends `-rework-review` to the rejected task's ID unconditionally. Searching the entire file for `rework.*depth`, `maxRework`, `MAX_REWORK`, or `depth.*rework` returns zero matches.

### Evidence: Live Task Tree

Current `tasks/tree.json` state:

| Rework Depth | Tasks | Non-terminal (active/ready) |
|-------------|-------|-----------------------------|
| 0 | 365 | 10 proposed |
| 1 | 59 | 8 ready |
| 2 | 9 | 0 |
| 3 | 7 | 1 ready |
| 4 | 5 | 1 ready |
| 5 | 2 | **1 active** |

The **active task** is at depth 5:
```
oidc-probe-rest-retarget-execution-retry-rework-review-rework-review-rework-review-rework-review-rework-review
```

This is a rework-review of a rework-review of a rework-review of a rework-review of a rework-review. The design doc says max depth 2; the runtime is at depth 5.

### Evidence: Interrupt Storm Continues

aks-explorer session status by hour (last 6h):

| Bucket | Total | Done | Interrupted | Errored | % Non-success |
|--------|-------|------|-------------|---------|---------------|
| 5-6h ago | 2 | 2 | 0 | 0 | 0% |
| 4-5h ago | 9 | 6 | 0 | 3 | 33% |
| 3-4h ago | 15 | 4 | 11 | 0 | 73% |
| 2-3h ago | 15 | 2 | 9 | 4 | 87% |
| 1-2h ago | 14 | 4 | 8 | 2 | 71% |
| 0-1h ago | 13 | 1 | 9 | 2 | 85% |

System 6h error rate: 19.6% overall, **4.0% excluding aks-explorer**.

## Analysis

This is a classic spec-implementation gap:

1. **KE-1566** identified the rework recursion trap (symptom)
2. **KE-1572** measured the phase transition (timing + severity)
3. **KE-1574** identified the missing design constraint and added it to the doc
4. **The runtime was never changed** — the design doc is a specification, not executable code

The design doc edit was necessary but not sufficient. The `ensureReworkReviewTask()` function needs a depth check that counts `-rework-review` segments in the task ID (or traverses the parent chain to count rework ancestors) and blocks creation at depth > 2, marking the original task as `blocked` instead.

### Required Code Change

In `ensureReworkReviewTask()`:

```typescript
// Before creating a new rework-review, check rework depth
const reworkDepth = (rejected.id.match(/-rework-review/g) || []).length;
if (reworkDepth >= 2) {
  // Design doc Simplicity Constraint: max rework-review depth 2
  rejected.status = "blocked";
  rejected.blocker = "exceeded rework depth limit — requires manual triage or root-cause investigation";
  return rejected.id; // Don't spawn another review layer
}
```

This is **not a design decision** — the design doc already specifies the behavior. It's a missing implementation.

## Impact

Until this is implemented:
- aks-explorer will continue churning through rework-review tasks at depth ≥3 with ~85% interrupt rate
- System 6h error rate will remain elevated (~20% vs 4% without aks-explorer)
- Compute is wasted: each depth-5 rework-review session consumes ~20 ops and ~310s but produces no progress

## Falsifier

**F1**: If the runtime already enforces a depth limit through a different mechanism not visible in `ensureReworkReviewTask()`, then depth-5 tasks should not exist in the current tree. They do exist → the limit is not enforced.

**F2**: If the interrupt storm has a cause unrelated to rework depth (e.g., session timeout being too short for all tasks), then tasks at depth 0-1 should have comparable interrupt rates to depth 3+. From KE-1574: depth-1 rework tasks have ~40% interrupt rate vs ~100% at depth ≥3. The correlation with depth is clear.
