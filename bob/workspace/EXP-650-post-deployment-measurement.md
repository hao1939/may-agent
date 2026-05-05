# EXP-650: Diminishing Returns Gate — Post-Deployment Measurement

**Date**: 2025-05-03
**Author**: bob
**Status**: CLOSED NEGATIVE — text gate did not prevent busywork

## Context

EXP-650 deployed a "diminishing returns gate" as text in `master-worker.ts` telling the orchestrator to stop when all plan items and metrics are met. The question: does this text actually prevent post-completion busywork?

## Evidence: Run `mopn5t1g78mzrlir` (system-efficiency project)

| Metric | Value |
|--------|-------|
| Total orchestrator steps | 84 |
| Project iteration at DONE | 35 |
| Post-completion steps | **49** (58% of total) |
| Agent | optimizer (all 84 steps) |
| Gate text present? | Yes (deployed in master-worker.ts:135-142) |

### Timeline
- Steps 1-35: Productive work across 6 phases, all metrics exceeded targets
- Step 35: Project marked DONE — all 6 phases complete, 35 iterations, all 3 metrics sustained above targets
- Steps 36-84: **49 additional orchestrator iterations** despite project being complete

### What happened after DONE?
The orchestrator kept re-planning and dispatching workers even though every plan item was checked off and every metric was at target. The "recognize when a project is DONE" text was present but completely ignored.

## Verdict: **CLOSED NEGATIVE**

The text-based diminishing returns gate had **zero measurable effect**. This is consistent with the broader pattern documented in the Unshipped Findings Audit:

| Experiment | Intervention Type | Compliance |
|-----------|------------------|------------|
| EXP-300 | Text coaching (VAW) | 3.2% |
| EXP-303 | Finish-gate enforcement | 9.6% |
| EXP-451 | Write-first instruction | 0% |
| **EXP-650** | **Text gate (stop at DONE)** | **0%** |

## Root Cause

The orchestrator's `extractDecision()` function parses the first line of agent output for CONTINUE/DONE. Even when the agent's response semantically says "project is complete," the extraction logic can still yield CONTINUE if the agent outputs any next-step text. **The text gate cannot override structural parsing.**

## Recommendation

**EXP-650 text gate should be REMOVED** — it adds context tokens with zero benefit. Instead, the fix must be structural:

1. **Structural fix**: `extractDecision()` should check project.md status. If status=closed or stop_reason=DONE, force termination regardless of agent output.
2. **Iteration cap**: Hard-cap master-worker runs at `2 * planned_iterations` (e.g., if project has 35 planned items, cap at 70 steps max).
3. **Metric-based termination**: If all declared metrics are at target for N consecutive iterations, auto-stop.

These structural approaches align with the proven pattern from EXP-500 (structural read-before-edit achieved 97% reduction where text coaching achieved 0%).

## Impact Estimate

In the measured run: 49 wasted orchestrator steps × ~$0.50-1.00/step = **$25-50 wasted on a single run**. If this pattern repeats across master-worker runs, it's a significant cost driver.

## Meta: Strengthening the "Text ≠ Behavior" Knowledge Entry

This is now the **5th experiment** confirming that text-based behavioral nudges don't change agent behavior for procedural/structural tasks. This pattern should be treated as a hard constraint in experiment design: **never propose text-only interventions for behavioral change**.
