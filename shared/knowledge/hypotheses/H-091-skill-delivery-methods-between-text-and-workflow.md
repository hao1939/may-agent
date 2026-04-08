# H-091: Skill Delivery Methods Exist Between Text-Rules and Workflow Enforcement

**Status**: Strongly Supported (EXP-084, EXP-085)
**Date**: 2026-04-08
**P(H)**: 0.88

## Statement

There exist skill delivery methods between "text in context" (0% effect) and "full workflow enforcement" (100% effect) that produce measurable behavior change on judgment tasks. Specifically, few-shot examples, checklist injection, and echo-back self-prompting each independently improve judgment task scores above the 0% text-rule baseline.

## Evidence

### EXP-084: Contradictory-Requirements (initial test)
Tested 4 delivery methods on contradictory-requirements (0% baseline):
- **Few-shot example**: +2.3 score, 33% pass, 100% analysis creation, 100% contradiction ID
- **Checklist injection**: +2.0 score, ~0% pass, ~100% analysis creation
- **Echo-back**: +1.3 score, 33% pass, 100% analysis creation
- **Negative example**: +0 score, 0% pass (=baseline, confirms KE-002)

All three structural methods produce measurable improvement. The effect size varies with method structure.

### EXP-085: Escalation-Judgment (generalization test)
Tested few-shot (strongest method) on escalation-judgment — a structurally different judgment task:
- **Baseline**: 1/8 (12.5%) from EXP-044
- **Few-shot treatment**: 3/3 (100%) — all runs fixed BOTH payment.js and refund.js, created ESCALATION.md
- **Improvement**: +87.5 pp (12.5% → 100%)
- **Consistency**: All 3 runs COMPREHENSIVE (full fix), vs baseline mostly partial fixes

Cross-scenario comparison:
| Scenario | Baseline | Few-Shot | Improvement |
|----------|----------|----------|-------------|
| contradictory-requirements | 0% (N=16) | 33% (N=3) | +33 pp |
| escalation-judgment | 12.5% (N=8) | 100% (N=3) | +87.5 pp |

Few-shot generalizes, with stronger effect when the example is structurally similar to the target task.

## Mechanism Hierarchy

L1: Text rules → 0% (KE-002)
L1.5: Negative example → 0% (EXP-084)
L2: Echo-back → +1.3 score (EXP-084)
L2.5: Checklist → +2.0 score (EXP-084)
L3: Few-shot example → +2.3 score (EXP-084)
L5: Workflow enforcement → +3.0 score (EXP-045)

## Open Questions

1. Can methods be combined (e.g., few-shot + checklist)?
2. ~~Does the effect generalize across scenario types?~~ **ANSWERED by EXP-085**: YES — few-shot generalizes from contradictory-requirements to escalation-judgment. Effect stronger when example structurally matches task (33% vs 100% pass rate).
3. Why is "alternatives-proposed" specifically resistant to lightweight methods?
4. What is the boundary of structural similarity? EXP-085's strong result (100%) vs EXP-084's moderate result (33%) suggests structural match between example and task matters. Next: test with structurally dissimilar example.

## Cross-References

- Extends: KE-002, KE-058, KE-056 (constraint hierarchy)
- Supported by: KE-059 (new)
- Related: H-085 (forced externalization), H-089 (evidence discovery)
