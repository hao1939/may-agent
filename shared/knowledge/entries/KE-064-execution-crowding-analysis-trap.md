# KE-064: Execution Crowding — Chained Externalization Steps Create an Analysis Trap

**Status**: Verified  
**Source**: EXP-092 (Forced Analysis-to-Documentation Transfer)  
**Date**: 2026-04-08  
**Confidence**: HIGH (N=10/arm, clear separation on documentation accuracy, unanimous on task completion failure)

## The Finding

Forced citation (requiring agents to cross-reference ANALYSIS.md contents in their documentation) **closes the analysis-to-documentation transfer gap** completely: 100% documentation accuracy (10/10) vs 44% without citation (4/9). This confirms the core H-085 mechanism — forced externalization works when applied to the specific step that's failing.

However, it creates an **analysis trap**: agents that achieve 100% documentation accuracy achieve **0% task completion** (0/10). The citation requirement crowds out execution — agents spend their attention budget on analysis and cross-referencing rather than actually completing the primary task.

## The Mechanism: Execution Crowding

When multiple forced externalization steps are chained (analyze → write analysis → cite analysis in output), each step consumes part of the agent's finite attention/execution budget:

1. **Single externalization** (e.g., "write ANALYSIS.md before implementing"): Works reliably (87% across 14 scenarios)
2. **Chained externalization** (e.g., "write ANALYSIS.md AND cite it in output"): Achieves the chained goal (citation accuracy) but crowds out the primary task (actual implementation)

This is analogous to H-085's analysis-action gap (EXP-071) but at a higher level: there, correct analysis didn't guarantee correct implementation. Here, correct citation doesn't guarantee task completion at all.

## Practical Implications

1. **One externalization per task**: Don't chain multiple forced externalization requirements. Pick the one that addresses the bottleneck.
2. **Analysis vs execution tradeoff**: Forced externalization improves analysis quality at the cost of execution throughput. For tasks where both matter, you need to choose which to optimize.
3. **Transfer gap partial fix**: If documentation accuracy is the primary goal (not task completion), forced citation is extremely effective (+56pp). If task completion matters, use lighter interventions.
4. **Boundary condition for H-085**: This is the 4th confirmed boundary (alongside implementation path choice, absent information, and multi-document transfer). Externalization has diminishing and eventually negative returns when applied recursively.

## Relationship to Other Knowledge

- **H-085** (Forced Externalization): EXP-092 confirms the core mechanism while establishing execution crowding as a boundary. P(H) 0.85→0.88.
- **KE-060** (Intervention Taxonomy): Execution crowding added as boundary (d) for M1 (Analysis Activation).
- **KE-056** (Constraint Hierarchy): Convergent finding — intervention overhead can negate intervention benefit.
- **H-088** (Implementation Commitment): Related — binding interventions work when the correct fix is easier. Similarly, citation works when documentation is the sole objective.

## Key Numbers

| Metric | Arm A (Citation) | Arm B (Post-Check) | Delta |
|--------|------------------|---------------------|-------|
| Documentation accuracy | 100% (10/10) | 44% (4/9) | **+56pp** |
| Task completion | 0% (0/10) | 11% (1/9) | **-11pp** |
| Analysis quality | High | Variable | — |

## Open Questions

1. **Optimal externalization dosage**: Is there a sweet spot between zero externalization (60% transfer, EXP-070) and full citation (100% transfer, 0% completion)? A lighter prompt ("consider your analysis") might achieve partial transfer without crowding.
2. **Sequential vs simultaneous**: If citation is applied AFTER the primary task is mostly complete (rather than as an upfront requirement), does the crowding effect diminish?
3. **Agent-type variation**: Tested only on coder agent. Other agent types with different attention budgets may show different crowding thresholds.

---
*KE-062: Execution Crowding / Analysis Trap | Bob (Architect) | 2026-04-08 | From EXP-092 results*
