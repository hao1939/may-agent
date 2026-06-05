<ai_context>
The project-execution-engine.md design doc specifies "Maximum decomposition depth: 5" but has no rework-review depth limit. This omission enables unbounded rework recursion chains where each rejected/interrupted task spawns a review task, which spawns another review task on failure, growing task IDs and prompt sizes without bound. Empirical evidence from aks-rp-e2e (24h, 92 sessions): 59 depth-1 rework tasks, 9 depth-2, 5 depth-3, 4 depth-4, 1 depth-5. The depth-5 task was accepted but consumed ~14 sessions across the chain. At depth≥3, interrupt rates are near 100% (KE-1566, KE-1572). The design doc's "Maximum decomposition depth: 5" constrains task splits but not rework chains. Rework-review creates sibling tasks (not children), so the decomposition depth limit doesn't apply to them. This is the structural enabler for the positive feedback loop documented in KE-1572: rejected task → rework-review → interrupted → rejected → rework-review-rework-review → deeper recursion → guaranteed interruption. Proposed fix: add "Maximum rework-review depth: 2" to the Simplicity Constraints section. At depth >2, mark the original task as blocked with a summary of all rework attempts, rather than spawning another review layer.
Triggers: project execution engine, rework depth, design gap, rework-review, recursion limit, circuit breaker, decomposition depth, simplicity constraints, aks-rp-e2e, task tree
</ai_context>

# KE-1574 — Project Execution Engine Missing Rework Depth Limit

**Date:** 2026-06-10
**Author:** arc (heartbeat coherence audit)
**Status:** finding — design gap identified, proposal follows
**Confidence:** High — measured from task tree and session DB; design doc text verified
**Connects:** KE-1566 (rework recursion trap), KE-1572 (interrupt storm phase transition), KE-1569 (initial interrupt storm observation)

## Observation

The `project-execution-engine.md` design doc (at `shared/may-agent-docs/2a-design/project-execution-engine.md`) specifies a set of Simplicity Constraints (line 1161ff):

```
- Maximum decomposition depth: 5.
- Maximum children per split: 7.
- One primary output per leaf task.
```

There is **no rework-review depth limit**.

### Why This Matters

The design doc's lifecycle table (line 174-175) says:

> Validation or required check failed → Mark the task `rejected` and create/activate rework.
> Worker session errored, timed out, was interrupted, or was cancelled → Mark the task `rejected` and create/activate rework.

This means every failed session — including interruptions from timeout — creates a new rework-review task. But there's no rule limiting how many rework layers can accumulate on a single original task.

### The Structural Gap

Decomposition depth limits (depth 5) constrain **task splits** — when a task is too large and gets broken into children. But rework-review tasks are **siblings**, not children. They are created alongside the rejected task, not as sub-decompositions. The decomposition depth limit simply doesn't apply to rework chains.

This creates an unbounded recursion path:

```
task-A (rejected)
  → task-A-rework-review (rejected/interrupted)
    → task-A-rework-review-rework-review (rejected/interrupted)
      → task-A-rework-review-rework-review-rework-review (rejected/interrupted)
        → ... (no limit)
```

### Empirical Evidence

From the aks-rp-e2e task tree (443 total tasks):

| Rework Depth | Tasks | Non-terminal (active/ready/decomposed) |
|-------------|-------|---------------------------------------|
| 0 (no rework) | 365 | many |
| 1 | 59 | several |
| 2 | 9 | 7 (5 decomposed, 1 active, 1 ready) |
| 3 | 5 | 3 decomposed |
| 4 | 4 | 1 ready, 1 decomposed |
| 5 | 1 | 0 (accepted) |

The depth-5 task (`golden-path-catalog-rollout-plan-rework-review×5`) was eventually accepted, but the chain consumed ~14+ sessions across the full depth, with near-100% interrupt rates at depth ≥3 (KE-1566).

The current active task is at depth 2: `oidc-rest-retarget-focused-edit-rework-review-rework-review`. There are also two depth-4 tasks in `ready` or `decomposed` state, meaning the engine is still actively creating deep rework chains.

### Session Cost

In the last 24 hours, aks-rp-e2e consumed:
- 155 task starts (48 distinct tasks)
- 72 of those starts (46%) were rework-review tasks
- 92 sessions total, 31 interrupted (33.7%), 11 errored (12%)
- 1,771 total ops, ~330 minutes of session time

Excluding aks-explorer, the system's 6h error rate drops from 18.1% to 4.2%.

## Analysis

The project-execution-engine design doc is the **authoritative specification** for how the task engine behaves. Its omission of a rework depth limit is the structural enabler for KE-1566's rework recursion trap and KE-1572's interrupt storm. The empirical findings in those KEs identified the symptom; this KE identifies the root design gap.

The fix belongs in the design doc's Simplicity Constraints section.

## Recommendation

Add to Simplicity Constraints:

```
- Maximum rework-review depth: 2. At depth >2, mark the original task
  as blocked (blocker: "exceeded rework depth limit — requires manual
  triage") rather than spawning another review layer.
```

This is analogous to the existing "Maximum decomposition depth: 5" constraint — a structural bound that prevents the system from doing unbounded work on a single work item.

## Falsifier

**F1**: If a depth-2 rework limit is added and implemented, aks-explorer's interrupt rate should drop below 20% within 2 hours (one project iteration cycle). If it doesn't, the remaining interrupts come from non-rework tasks and need separate investigation.

**F2**: If rework chains at depth ≤2 have an interrupt rate comparable to depth ≥3 chains (~100%), then the rework depth isn't the cause — the underlying tasks are simply too large for the session budget. Measured: depth-1 rework interrupt rate is 40% vs depth-3+ at ~100%. The correlation with depth is clear but not absolute at depth 1.
