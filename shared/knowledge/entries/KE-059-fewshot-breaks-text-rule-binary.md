# KE-059: Few-Shot Examples Break the Text-Rule Binary

**Status**: Verified
**Source**: EXP-084 (Skill Training Method Comparison)
**Date**: 2026-04-08
**Confidence**: Medium (N=3 per treatment, consistent direction)

## Finding

Few-shot worked examples produce measurable behavior change on judgment tasks where text rules produce zero effect. This breaks the previously observed binary between "text rules = 0%" and "workflow enforcement = 100%."

## Evidence

EXP-084 tested 4 skill delivery methods on the contradictory-requirements scenario (0% baseline, 2/5 score):

| Method | Pass Rate | Avg Score | Key Effect |
|--------|-----------|-----------|------------|
| Negative example (text) | 0/3 (0%) | 2.0/5 | No effect (confirms KE-002) |
| Echo-back (micro-externalize) | 1/3 (33%) | 3.3/5 | Reliably triggers document creation |
| Checklist injection | ~0/3 (0%) | ~4.0/5 | High scores but inconsistent criteria |
| **Few-shot example** | **1/3 (33%)** | **4.3/5** | **3/3 analysis, 3/3 contradiction ID** |
| Workflow (positive ctrl) | 1/1 (100%) | 5.0/5 | Full pass as expected |

Few-shot was the strongest lightweight method:
- 100% analysis document creation (vs 0% baseline)
- 100% contradiction identification (vs 0% baseline)
- Only "alternatives-proposed" was inconsistent
- +2.3 average score improvement over baseline

## Mechanism

A worked example provides a template for HOW to reason, not just WHAT to do. The agent learns the pattern (analyze → identify tension → propose alternatives) from seeing it applied to a different domain, then transfers it.

This is distinct from text rules which state the desired behavior abstractly, and from workflows which force the behavior structurally.

## Updated Mechanism Hierarchy

| Level | Method | Effect on Judgment | Reliability |
|-------|--------|-------------------|-------------|
| L1 | Text rules | 0% | Confirmed (N=32+) |
| L1.5 | Negative example | 0% | Confirmed (N=3) |
| L2 | Echo-back | +1.3 score | Unreliable (33%) |
| L2.5 | Checklist | +2.0 score | Unreliable (0-33%) |
| L3 | Few-shot example | +2.3 score | Unreliable (33%) |
| L5 | Workflow enforcement | +3.0 score | Reliable (100%) |

## Implications

1. **Skill format matters**: Skills should use worked examples, not abstract rules
2. **Judgment gap persists**: Even the best lightweight method is only 33% reliable for judgment tasks
3. **Generative reasoning is hardest**: Agents can identify problems (100%) but struggle to propose alternatives (33%)
4. **Combined methods untested**: Few-shot + checklist combined might bridge the 33%→100% gap

## Cross-References

- Extends: KE-002 (text rules don't work), KE-058 (injected knowledge no effect)
- Related: KE-054 (externalization boundary), KE-055 (binding closes gap)
- Hypothesis: H-091 (SUPPORTED)
