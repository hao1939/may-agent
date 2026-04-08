# H-091: Skill Delivery Methods Exist Between Text-Rules and Workflow Enforcement

**Status**: Supported (EXP-084)
**Date**: 2026-04-08
**P(H)**: 0.75

## Statement

There exist skill delivery methods between "text in context" (0% effect) and "full workflow enforcement" (100% effect) that produce measurable behavior change on judgment tasks. Specifically, few-shot examples, checklist injection, and echo-back self-prompting each independently improve judgment task scores above the 0% text-rule baseline.

## Evidence

EXP-084 tested 4 delivery methods on contradictory-requirements (0% baseline):
- **Few-shot example**: +2.3 score, 33% pass, 100% analysis creation, 100% contradiction ID
- **Checklist injection**: +2.0 score, ~0% pass, ~100% analysis creation
- **Echo-back**: +1.3 score, 33% pass, 100% analysis creation
- **Negative example**: +0 score, 0% pass (=baseline, confirms KE-002)

All three structural methods produce measurable improvement. The effect size varies with method structure.

## Mechanism Hierarchy

L1: Text rules → 0% (KE-002)
L1.5: Negative example → 0% (EXP-084)
L2: Echo-back → +1.3 score (EXP-084)
L2.5: Checklist → +2.0 score (EXP-084)
L3: Few-shot example → +2.3 score (EXP-084)
L5: Workflow enforcement → +3.0 score (EXP-045)

## Open Questions

1. Can methods be combined (e.g., few-shot + checklist)?
2. Does the effect generalize across scenario types?
3. Why is "alternatives-proposed" specifically resistant to lightweight methods?

## Cross-References

- Extends: KE-002, KE-058, KE-056 (constraint hierarchy)
- Supported by: KE-059 (new)
- Related: H-085 (forced externalization), H-089 (evidence discovery)
