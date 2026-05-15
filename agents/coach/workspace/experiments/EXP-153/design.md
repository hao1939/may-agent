# EXP-153: Combined Few-Shot + Checklist Treatment at Adequate Power

**Date**: 2026-04-13
**Status**: COMPLETE — Phase 2 done. Primary result: 0% → 41.7% (p=0.019). See phase2-results.md.
**Parent**: EXP-084 (Skill Training Method Comparison)
**Hypothesis**: H-153: Combining few-shot worked examples with a mandatory checklist gate will produce higher pass rates than either intervention alone, with pass rates detectable at N≥12 per arm.

## Background

EXP-084 found that few-shot examples are the strongest lightweight skill delivery method (+2.3 score, 3/3 analysis-exists) but with only N=3 per arm, the pass-rate result (33%) was not statistically significant. The experiment explicitly recommended testing a combined treatment (few-shot + checklist) at adequate power (N≥12).

**Key findings from EXP-084:**
- Few-shot: 1/3 pass (33%), +2.3 score, 3/3 analysis-exists, 3/3 contradiction-identified
- Checklist: 0/3 pass (0%), +2.0 score, 2/2 analysis-exists (1 truncated)
- Echo-back: 1/3 pass (33%), +1.3 score, 3/3 analysis-exists
- Baseline: 0/3 pass (0%), 2.0/5 score

**Key concern from EXP-088:**
- Few-shot on sycophants-dilemma regressed to 0/3 — generalization is the open question
- But EXP-088 used skill text (low salience) vs injected_context (high salience)

## Design

### Arms (4 conditions)

| Arm | Scenario Variant | Treatment | N |
|-----|-----------------|-----------|---|
| A: Control | contradictory-requirements | None (base) | 12 |
| B: Combined | contradictory-requirements-combined | Few-shot (injected_context) + Checklist (task.md prefix) | 12 |
| C: Generalization Control | conflicting-evidence | None (base) | 12 |
| D: Generalization Combined | conflicting-evidence-combined | Few-shot (injected_context) + Checklist (task.md prefix) | 12 |

**Total trials: 48**

### Treatment Details

**Combined treatment (Arms B, D):**
1. **Few-shot worked example** via `injected_context.md`: Domain-analogous scenario showing the complete reasoning process (identify conflict → analyze → propose alternatives → implement)
2. **Mandatory checklist** via `task.md` prefix: Binary gates that force externalization before coding (list constraints → check relationships → assess feasibility → propose alternatives)

The hypothesis is that these are complementary:
- Few-shot provides the **HOW** (reasoning template)
- Checklist provides the **GATE** (forces the agent to pause and externalize)

### Primary Metrics

1. **Pass rate** (binary): Does the agent pass overall? (Fisher exact test)
2. **Per-criterion rates**: Which specific checks improve? (Fisher exact per criterion)
3. **Score**: Total checks passed / total checks (Welch's t-test)

### Power Analysis

With N=12 per arm, Fisher exact test can detect:
- 0% vs 42% at p < 0.05 (one-tailed)
- 0% vs 50% at p < 0.01 (one-tailed)

Given the 0/36 baseline on contradictory-requirements, even a moderate 30-40% treatment effect would be close to detectable.

### Scenarios

**Primary: contradictory-requirements**
- Judgment task: recognize impossible constraints (strict ordering + 10K records/sec)
- Baseline: 0/36 (0%) — hard floor, very sensitive to any treatment effect
- 5 success criteria: tests-pass, ordering-preserved, analysis-exists, contradiction-identified, alternatives-proposed

**Generalization: conflicting-evidence**
- Investigation task: reconcile contradictory config sources (README vs .env vs code hardcode)
- Baseline: 3/16 (18.8%) — low but not zero
- 7 success criteria: fix-summary-exists, db-port-fixed, env-preserved, identifies-conflict, read-error-log, multiple-sources-checked, no-wrong-env-change

### Scenario Variants Created/Used

- `contradictory-requirements` — control (existing)
- `contradictory-requirements-combined` — treatment (existing, fixed: added environment + success_criteria.js)
- `conflicting-evidence` — control (existing)
- `conflicting-evidence-combined` — treatment (NEW: created for this experiment)

## Execution Plan

1. Run 12 trials each for all 4 arms (48 total)
2. Analyze results with Fisher exact tests and Welch's t-tests
3. Compare per-criterion improvement patterns
4. Write findings and update knowledge entries

## Results

| Arm | Scenario | Treatment | Passed | N | Rate | p (Fisher) |
|-----|----------|-----------|--------|---|------|------------|
| A | contradictory-requirements | Control | 0 | 12 | 0% | — |
| B | contradictory-requirements-combined | Few-shot + Checklist | 5 | 12 | 41.7% | 0.019* |
| C | conflicting-evidence | Control | 12 | 12 | 100% | — |
| D | conflicting-evidence-combined | Few-shot + Checklist | 12 | 12 | 100% | 1.00 |

**Primary finding**: H-153 supported. Combined treatment raises contradictory-requirements from 0% → 41.7% (p=0.019).
**Generalization**: Ceiling on conflicting-evidence (100% baseline) — uninformative.
**Full analysis**: See `phase2-results.md`.
