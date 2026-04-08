# KE-059: Few-Shot Examples Break the Text-Rule Binary

**Status**: Verified
**Source**: EXP-084 (Skill Training Method Comparison), EXP-085 (Few-Shot Generalization), EXP-086 (Mismatched Example), EXP-087 (Sycophants-Dilemma Few-Shot)
**Date**: 2026-04-08
**Confidence**: High (N=12 treatment runs across 4 scenarios, matched examples = 100% (6/6), consistent direction)

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
| Scenario | Baseline | Few-Shot | Δ | Match Quality |
|----------|----------|----------|---|---------------|
| contradictory-requirements | 0% (N=16) | 33% (N=3) | +33 pp | Moderate |
| escalation-judgment | 12.5% (N=8) | 100% (N=3) | +87.5 pp | High |
| escalation-judgment (mismatched) | 12.5% (N=8) | 67% (N=3) | +54 pp | Low |
| sycophants-dilemma | 67% (N=6) | 100% (N=3) | +33 pp | High |

**Combined treatment**: 9/12 (75%) across all few-shot experiments. With matched examples only: 6/6 (100%).

Structural similarity between example and task amplifies the effect — when the example demonstrates the exact judgment pattern needed (escalation: multi-module check; sycophants: classify-then-act), few-shot reaches 100%.

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
| L3 | Few-shot example | +2.3 score / +87.5pp | **Scenario-dependent** (33-100%) |
| L5 | Workflow enforcement | +3.0 score | Reliable (100%) |

**EXP-085 update**: L3 few-shot reliability is scenario-dependent. When the example structurally matches the target task, reliability can reach 100% (escalation-judgment). When the match is more abstract, reliability is ~33% (contradictory-requirements).


### EXP-089 Update: Synergistic Combination
- Few-shot + checklist combined: 67% pass rate on contradictory-requirements
- Greater than sum of parts (few-shot alone 33% + checklist alone 0% ≠ 67%)
- Confirms few-shot as a distinct mechanism that composes with other interventions

## Implications

1. **Skill format matters**: Skills should use worked examples, not abstract rules
2. **Judgment gap is narrower than thought**: Few-shot can reach 100% on structurally-matched scenarios (EXP-085), not just 33% (EXP-084)
3. **Structural similarity is the key variable**: The gap between 33% (contradictory-requirements) and 100% (escalation-judgment) appears driven by how closely the example maps to the task
4. **Generative reasoning is hardest**: Agents can identify problems (100%) but struggle to propose alternatives (33%) — confirmed by contradictory-requirements results
5. **Combined methods untested**: Few-shot + checklist combined might bridge the gap on abstract-match scenarios
6. **Production recommendation**: Create structurally-matched few-shot examples for high-value judgment scenarios

### EXP-086: Two-Level Transfer Model (mismatched example)
EXP-086 tested whether a *structurally mismatched* few-shot example (conflicting-requirements domain → escalation-judgment task) still transfers:

| Condition | Pass Rate | ESCALATION.md | refund-fixed |
|-----------|-----------|--------------|-------------|
| Baseline (N=8) | 1/8 (12.5%) | Rare | Rare |
| **Mismatched few-shot (N=3)** | **2/3 (66.7%)** | **0/3 (0%)** | **2/3 (66.7%)** |
| Matched few-shot (N=3) | 3/3 (100%) | 3/3 (100%) | 3/3 (100%) |

**Two-Level Transfer Model**:
1. **Level 1 — General principle transfer** (partial, stochastic): "Don't just fix the obvious thing; check broader impact." Transfers across domains but unreliably (~67%).
2. **Level 2 — Specific procedure transfer** (reliable, domain-specific): "Check all consumers. Create ESCALATION.md." Requires structurally matched example (~100%).

Mismatched examples provide Level 1 only. Matched examples provide both levels. This explains the 33pp gap between matched (100%) and mismatched (67%) few-shot.

## Cross-References

- Extends: KE-002 (text rules don't work), KE-058 (injected knowledge no effect)
- Related: KE-054 (externalization boundary), KE-055 (binding closes gap)
- Hypothesis: H-091 (SUPPORTED)
