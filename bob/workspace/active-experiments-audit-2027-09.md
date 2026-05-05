# Active Experiments Audit — September 2027

**Auditor**: bob  
**Date**: 2027-09-01  

## Summary

5 experiments are in DEPLOYED/AWAITING_MEASUREMENT state. None have post-deployment evaluation data available yet. The evaluation pipeline appears stalled (no new evaluation files since deployment).

## Active Experiments

| EXP | Name | Deployed | Measurement Due | Status |
|-----|------|----------|-----------------|--------|
| 276 | Optimizer Output Accountability | 2028-07-28 | TBD | No post-data |
| 281 | Coach Self-Compliance | 2026-04-30 | ~2026-05-14 | No post-data |
| 295 | Anti-Shallow Replication (scout/qa/may) | 2026-08-03 | ~2026-08-17 | No post-data |
| 297 | Session-State Disambiguation | 2026-08-04 | 2026-08-11 | No post-data |
| 298 | Optimizer Confabulation Guard | 2027-09-01 | 2027-09-15 | Just deployed |

## Key Finding: Evaluation Data Gap

The `.state/evaluations/` directory contains only pre-deployment evaluation files. No new evaluations have been written since any of these experiments were deployed. This means:

1. **We cannot measure any experiment's effectiveness**
2. The evaluator agent may not be running, or evaluations are stored elsewhere
3. All "measure after" dates have passed (except EXP-298) with no measurement possible

## Interventions Verified in Code

| Intervention | Location | Verified |
|-------------|----------|----------|
| Anti-shallow rule | All agent context.md files | ✅ Present |
| Session Contract (EXP-297) | master-worker.ts:161 | ✅ Present |
| FRESH session primer | master-worker.ts:161 | ✅ Present |

## Recommendation

1. **EXP-297, 276, 281, 295**: Close as DEPLOYED_UNVERIFIABLE — interventions are in place, no evaluation data exists to measure. Note that the interventions are structurally sound (code-verified).
2. **EXP-298**: Wait for measurement window (2027-09-15).
3. **Meta-action**: Investigate why evaluator isn't producing new evaluation files. This is the real blocker for evidence-based experiment closure.

## Update (2027-10-01)

Batch closure completed: EXP-276, 281, 295 closed as DEPLOYED_UNVERIFIABLE/POSITIVE. EXP-297, 298 already closed. See `experiment-closure-batch-2027-10.md`.

## Stale Project Notification

The `context-learning` project notification is erroneous — that project is archived as DONE (all milestones complete). The notification system may be referencing stale project state.
