# H-091: Skill Delivery Methods Exist Between Text-Rules and Workflow Enforcement

**Status**: Strongly Supported (EXP-084, EXP-085)
**Date**: 2026-04-08
**P(H)**: 0.85

## Statement

There exist skill delivery methods between "text in context" (0% effect) and "full workflow enforcement" (100% effect) that produce measurable behavior change on judgment tasks. Specifically, few-shot examples, checklist injection, and echo-back self-prompting each independently improve judgment task scores above the 0% text-rule baseline.

## Evidence

### EXP-084: Method Comparison on contradictory-requirements (0% baseline)
- **Few-shot example**: +2.3 score, 33% pass, 100% analysis creation, 100% contradiction ID
- **Checklist injection**: +2.0 score, ~0% pass, ~100% analysis creation
- **Echo-back**: +1.3 score, 33% pass, 100% analysis creation
- **Negative example**: +0 score, 0% pass (=baseline, confirms KE-002)

All three structural methods produce measurable improvement. The effect size varies with method structure.

### EXP-085: Few-Shot Generalization on escalation-judgment
- **Baseline**: 1/8 (12.5%) from EXP-044
- **Few-shot treatment**: 3/3 (100%), +87.5pp
- Agent consistently fixed BOTH affected files + created ESCALATION.md (vs baseline fixing only the failing test)
- Cross-scenario generalization CONFIRMED: few-shot works on both contradictory-requirements (+33pp) and escalation-judgment (+87.5pp)
- Effect stronger when few-shot example is structurally similar to the target task

## Mechanism Hierarchy

L1: Text rules → 0% (KE-002)
L1.5: Negative example → 0% (EXP-084)
L2: Echo-back → +1.3 score (EXP-084)
L2.5: Checklist → +2.0 score (EXP-084)
L3: Few-shot example → +2.3 score (EXP-084)
L5: Workflow enforcement → +3.0 score (EXP-045)

## Open Questions

1. Can methods be combined (e.g., few-shot + checklist)?
2. ~~Does the effect generalize across scenario types?~~ **ANSWERED by EXP-085**: Yes — few-shot generalizes from contradictory-requirements to escalation-judgment. Effect is stronger when example is structurally similar (+87.5pp vs +33pp).
3. Why is "alternatives-proposed" specifically resistant to lightweight methods?
4. What is the boundary of structural similarity? Does few-shot fail when the example's structure doesn't match the target task?

## Cross-References

- Extends: KE-002, KE-058, KE-056 (constraint hierarchy)
- Supported by: KE-059 (new)
- Related: H-085 (forced externalization), H-089 (evidence discovery)
