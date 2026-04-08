# EXP-077: Bridging the Gym-Production Gap — Scenario Fidelity Ladder

**Status**: COMPLETE
**Owner**: Coach
**Sprint**: 31
**Full design + results**: agents/coach/workspace/experiments/EXP-077/design.md

**Summary**: Built 3-level fidelity ladder for gym scenarios. 9 gym runs (3 per level). Key findings:
- L1 (noisy context): 67% — same as base. Content noise doesn't create difficulty.
- L2 (ambiguous task + competing priorities): 100% core / 0% full — agent handles ambiguity well but drops documentation deliverables.
- L3 (cascading state from crashed session): 0% — genuine difficulty gap. Partial corruption undetected.
- **Primary gym-production gap driver**: Cascading state from failures, not context noise or task ambiguity.
- **Non-ceiling scenario found**: L3 (0% pass) — suitable for intervention testing.

**Knowledge deployed**: KE-053 (gym-production gap), KE-007 (structural interventions)
**Knowledge produced**: Cascading state is the key fidelity lever. Documentation compliance depends on instruction specificity.
