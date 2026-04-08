# KE-059: Few-Shot Examples Break the Text-Rule Binary

**Status**: Verified
**Source**: EXP-084 (Skill Training Method Comparison), EXP-085 (Few-Shot Cross-Scenario Generalization)
**Date**: 2026-04-08
**Confidence**: Medium-High (N=16 across 2 scenarios, consistent direction, cross-scenario replication)

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

### Cross-Scenario Replication (EXP-085)

EXP-085 tested few-shot delivery on a DIFFERENT scenario — escalation-judgment (12.5% baseline from EXP-044):

| Condition | Pass Rate | Key Effect |
|-----------|-----------|------------|
| Baseline (EXP-044) | 1/8 (12.5%) | Rarely detects escalation pattern |
| **Few-shot treatment** | **3/3 (100%)** | **Fixed both affected files + created ESCALATION.md** |

Cross-scenario effect: +87.5pp over baseline. The worked example from contradictory-requirements transferred successfully to escalation-judgment — agents learned the pattern (analyze → identify issue → document findings) from a different domain and applied it correctly.

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
2. **Cross-scenario transfer confirmed**: Few-shot examples generalize — a worked example from one domain transfers to different judgment scenarios (EXP-085: 100% on escalation-judgment using contradictory-requirements example)
3. **Judgment gap persists**: Even the best lightweight method varies (33% on original scenario, 100% on simpler scenario) — task difficulty modulates effectiveness
4. **Generative reasoning is hardest**: Agents can identify problems (100%) but struggle to propose alternatives (33%)
5. **Combined methods untested**: Few-shot + checklist combined might bridge remaining gaps

## Cross-References

- Extends: KE-002 (text rules don't work), KE-058 (injected knowledge no effect)
- Related: KE-054 (externalization boundary), KE-055 (binding closes gap)
- Hypothesis: H-091 (SUPPORTED)
