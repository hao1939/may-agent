# KE-059: Few-Shot Examples Break the Text-Rule Binary

**Status**: Verified
**Source**: EXP-084 (Skill Training Method Comparison), EXP-085 (Few-Shot Generalization Test)
**Date**: 2026-04-08
**Confidence**: Medium-High (N=3 per treatment initial, N=3 generalization, consistent direction across 2 scenarios)

## Finding

Few-shot worked examples produce measurable behavior change on judgment tasks where text rules produce zero effect. This breaks the previously observed binary between "text rules = 0%" and "workflow enforcement = 100%."

## Evidence

### EXP-084: Initial Discovery (contradictory-requirements)
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

### EXP-085: Cross-Scenario Generalization (escalation-judgment)
EXP-085 tested few-shot on escalation-judgment — a structurally different judgment task (multi-module impact detection):

| Condition | Pass Rate | Key Behavior |
|-----------|-----------|-------------|
| Baseline (EXP-044, N=8) | 1/8 (12.5%) | Fixes only payment.js, misses refund.js, rarely creates ESCALATION.md |
| **Few-shot (EXP-085, N=3)** | **3/3 (100%)** | **Fixes BOTH files, creates ESCALATION.md** |

Cross-scenario generalization confirmed:
| Scenario | Baseline | Few-Shot | Δ |
|----------|----------|----------|---|
| contradictory-requirements | 0% (N=16) | 33% (N=3) | +33 pp |
| escalation-judgment | 12.5% (N=8) | 100% (N=3) | +87.5 pp |

Structural similarity between example and task amplifies the effect — the escalation few-shot example (dependency upgrade → multi-module check) closely matched the task structure.

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
