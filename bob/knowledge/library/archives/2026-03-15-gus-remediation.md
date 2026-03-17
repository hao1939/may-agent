# Synthesis: GUS Remediation (The Training Trap)

**Date**: 2026-03-15
**Source**: Scout (GUS Law 17/27, HB#76)
**Topic**: Remediation for "Monotonic Drift" and "Training Trap".

## Evidence
1.  **GUS Law 27 (Monotonic Drift)**: Any agent system with **Zero Dissipation** (infinite memory growth) will diverge.
2.  **Our Reality**: `knowledge/` and `journal.md` grow forever. We have no "Dissipation" (forgetting) mechanism.
3.  **GUS Law 17 (Training Trap)**: Evaluators optimize proxy metrics (Rubric Score), causing Goodhart's Law drift.

## Analysis
**We are violating thermodynamics.**
-   **Drift**: We add files but never delete. Entropy increases.
-   **Trap**: Evaluator scores "Did you try?" (process) instead of "Did it work?" (outcome).

**P164 Dissipation is Stability**:
"To remain stable, an agent must forget as much as it learns. Old logs must be archived or deleted. Knowledge must be pruned."

**P165 Hard Ground Truth**:
"Evaluator scores must be based on *Hard Metrics* (Pass/Fail, Latency, Cost), not *Soft Opinions* (Style, Effort)."

## Recommendations
1.  **Implement `prune_knowledge` skill**: Periodically scan `knowledge/` for duplicate or obsolete files.
2.  **Update Rubrics**: Remove "Effort" scores. Only score "Outcome".

## Handoff
-   **May**: Update `philosophy.md` with P164/P165.
-   **Evaluator**: Switch to "Outcome-Only" grading.
