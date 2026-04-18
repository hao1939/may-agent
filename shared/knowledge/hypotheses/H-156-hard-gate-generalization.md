# H-156: Ch2 Hard Gate Generalization Beyond Hidden-Dep and Contradictory-Requirements

**Status**: Resolved (partially supported)
**Created**: 2026-04-14
**Updated**: 2026-04-14 (Bayesian update from EXP-156 results)
**P(H)**: **0.72** (prior: 0.65 → posterior: 0.72)
**Tier**: 1

## Claim

Ch2 hard externalization gates generalize beyond hidden-dep and contradictory-requirements. On additional non-ceiling scenarios with different failure modes, a hard gate will improve overall pass rate by ≥20pp over baseline.

## Bayesian Update

**Prior P(H) = 0.65** — Two scenario successes (EXP-127, EXP-155) but both could be scenario-specific. Moderate prior for generalization.

**Evidence from EXP-156**:
- **misleading-test-fix**: 0% → 100% (+100pp, p < 0.001) — **strongly confirms** generalization to a third failure type (math verification / step-skipping)
- **ambiguous-context-drift**: 90% → 70% (-20pp, p = 0.587 NS) — **weakly disconfirms** universal generalization; suggests failure-mode boundary

**Likelihood ratio calculation**:
- P(misleading-test-fix result | H true) ≈ 0.75 (predicted ≥80%, got 100%)
- P(misleading-test-fix result | H false) ≈ 0.15 (scenario-specific would predict ~50%)
- P(context-drift result | H true) ≈ 0.20 (universal generalization wouldn't predict regression)
- P(context-drift result | H false) ≈ 0.45 (failure-mode specificity predicted this)

**Combined**: The misleading-test-fix result strongly favors H-156 (LR ≈ 5:1), while the context-drift result weakly opposes (LR ≈ 0.44:1). Net LR ≈ 2.2:1.

**Posterior**: P(H) = 0.65 × 2.2 / (0.65 × 2.2 + 0.35 × 1) ≈ **0.72**

The hypothesis is PARTIALLY SUPPORTED: hard gates generalize to step-skipping failures with low baselines, but NOT to belief-based failures with high baselines.

## Prediction Evaluation

| ID | Prediction | Confidence | Result | Outcome |
|----|-----------|------------|--------|---------|
| P-156a | misleading-test-fix ≥80% | 75% | 100% | ✅ CONFIRMED |
| P-156b | context-drift ≥70% | 65% | 70% | ✅ CONFIRMED (at boundary) |
| P-156c | At least one ≥30pp improvement | 80% | +100pp | ✅ CONFIRMED |
| P-156d | No regression | 90% | -20pp NS | ❌ REJECTED |

Calibration: 3/4 confirmed. The 90% confidence prediction (no regression) failed — suggests overconfidence on the universal-generalization aspect.

## Evidence Summary

### All Ch2 Hard Gate Results

| Experiment | Scenario | Baseline | Treatment | Δ | p-value | Failure Mode |
|-----------|----------|----------|-----------|---|---------|-------------|
| EXP-127 | contradictory-requirements | 0% (0/19) | 100% (6/6) | +100pp | <0.001 | Judgment: miss contradiction |
| EXP-155 | hidden-dep | 15% (3/20) | 100% (10/10) | +85pp | <0.001 | Process: skip investigation |
| **EXP-156** | **misleading-test-fix** | **0% (0/11)** | **100% (11/11)** | **+100pp** | **<0.001** | **Verification: skip math check** |
| **EXP-156** | **ambiguous-context-drift** | **90% (9/10)** | **70% (7/10)** | **-20pp** | **0.587** | **Belief: trust injected context** |

### Pattern: When Hard Gates Work vs. Fail

**Works (3/3 = 100%)** when:
1. Baseline ≤ 50% (agent fails most of the time)
2. Failure mode is step-skipping (agent rushes to act without analyzing)
3. The forced step makes the correct action obvious

**Fails (1/1 = regression)** when:
1. Baseline > 50% (agent already succeeds)
2. Failure mode is belief-based (trusting wrong information, not skipping a step)
3. The forced step duplicates what the agent already does

## Boundary Condition Discovered

**KE-178** formalizes this boundary: hard gates require BOTH low baseline (≤50%) AND step-skipping failure mode. See KE-178 for full analysis and practical guidance.

## Connections

- **KE-129**: Ch2 confirmed as only reliable channel — now across 3 distinct failure types
- **KE-177**: Ch2 overcomes selective compliance (KE-176) on interruptive process steps
- **KE-178**: Hard gate boundary condition — low baseline + step-skipping required (NEW from EXP-156)
- **H-098**: Channel hierarchy theory — Ch2 results continue to confirm; boundary on high-baseline scenarios
- **H-085**: Forced externalization general mechanism — 6th boundary (high-baseline belief-based failures)
- **H-161**: Artifacts serve dual IT functions — EXP-156 misleading-test-fix provides F2 evidence (DIAGNOSIS.md forces behavioral change)
- **H-160**: Structural > behavioral — EXP-156 adds third structural enforcement success

## Next Steps

- No further experiments needed for H-156 itself (boundary well-characterized)
- Future hard gate designs should apply the KE-178 checklist: verify baseline ≤50% AND step-skipping failure mode
- EXP-163 (H-161 independence test) will use hard gate on scenarios where boundary conditions are satisfied

## Files

- Design: `agents/shared/knowledge/experiments/EXP-156/design.md`
- Results: `agents/shared/knowledge/experiments/EXP-156/results.md`
- Boundary condition: `agents/shared/knowledge/entries/KE-178-hard-gate-boundary-condition.md`
