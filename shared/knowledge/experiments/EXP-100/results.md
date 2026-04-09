# EXP-100: Results — Complexity-Induced Verification Collapse Interventional Test

**Date**: 2026-04-09
**Status**: COMPLETED
**Sprint**: 31

## Summary

**All 12 runs passed 7/7 checks. 100% pass rate across all 3 arms.** No differentiation between baseline and treatments.

This is a **ceiling effect** — the baseline scenarios are too easy for the current coder agent (with its existing skills), making it impossible to measure the impact of scaffolding or checkpoint interventions.

## Raw Results

### Arm A: Baseline (No Intervention)

| Run | Scenario | Checks | Duration (ms) | Session |
|-----|----------|--------|---------------|---------|
| A1 | compound-edit-verification | 7/7 ✅ | 111,398 | s_1775730484939_0 |
| A2 | compound-edit-verification | 7/7 ✅ | 111,530 | s_1775730596_0 |
| A3 | multi-file-verify-gap | 7/7 ✅ | 71,528 | s_1775730605676_0 |
| A4 | multi-file-verify-gap | 7/7 ✅ | 83,879 | s_1775730681974_0 |

**Arm A pass rate**: 4/4 (100%)

### Arm B: Complexity Scaffolding

| Run | Scenario | Checks | Duration (ms) | Session |
|-----|----------|--------|---------------|---------|
| B1 | compound-edit-verification-scaffolded | 7/7 ✅ | 131,426 | s_1775730774490_0 |
| B2 | compound-edit-verification-scaffolded | 7/7 ✅ | 122,954 | s_1775730920369_0 |
| B3 | multi-file-verify-gap-scaffolded | 7/7 ✅ | 140,462 | s_1775730774494_0 |
| B4 | multi-file-verify-gap-scaffolded | 7/7 ✅ | 150,872 | s_1775730920370_0 |

**Arm B pass rate**: 4/4 (100%)

### Arm C: Forced Verification Checkpoint

| Run | Scenario | Checks | Duration (ms) | Session |
|-----|----------|--------|---------------|---------|
| C1 | compound-edit-verification-checkpoint | 7/7 ✅ | 139,087 | s_1775731077228_0 |
| C2 | compound-edit-verification-checkpoint | 7/7 ✅ | 130,309 | s_1775731252778_0 |
| C3 | multi-file-verify-gap-checkpoint | 7/7 ✅ | 168,309 | s_1775731077226_0 |
| C4 | multi-file-verify-gap-checkpoint | 7/7 ✅ | 151,782 | s_1775731252777_0 |

**Arm C pass rate**: 4/4 (100%)

## Duration Analysis

Even though all runs passed, duration differences may reveal treatment effects on process:

| Arm | compound-edit avg (ms) | multi-file avg (ms) | Overall avg (ms) |
|-----|----------------------|---------------------|-------------------|
| A (Baseline) | 111,464 | 77,704 | 94,584 |
| B (Scaffolded) | 127,190 | 145,667 | 136,429 |
| C (Checkpoint) | 134,698 | 160,046 | 147,372 |

**Observation**: Treatments added ~40-55s overhead to runs. The interventions increase process time (more planning/verification steps) but produced no accuracy improvement (since baseline was already 100%).

## Analysis Against Hypotheses

### H1: Scaffolding achieves ≥40% higher check-pass rate than baseline
**UNTESTABLE** — Baseline already at 100%. Cannot demonstrate improvement.

### H2: Forced checkpoint achieves ≥60% higher check-pass rate than baseline
**UNTESTABLE** — Same ceiling effect.

### H3: Forced checkpoint outperforms scaffolding
**UNTESTABLE** — Both at 100%.

## Against Exit Criteria

| Criterion | Expected | Actual | Verdict |
|-----------|----------|--------|---------|
| STRONG SUPPORT | Arm C ≥75% on compound-edit vs ≤25% baseline | 100% vs 100% | ❌ Cannot evaluate |
| MODERATE SUPPORT | ≥50% improvement on at least one scenario | 0% improvement (ceiling) | ❌ Cannot evaluate |
| WEAK/AGAINST | Neither improves by ≥25% | Neither improved | ⚠️ See interpretation |

## Interpretation

### Falsification Condition Triggered
The design document identified this specific outcome: *"Baseline pass rates are already high (>80%) — would mean these scenarios don't actually trigger CIVC"*

**Baseline scored 100% on both scenarios across 4 runs.** This means:

1. **These scenarios are too easy** for the current coder agent with its existing skill set. The compound-edit and multi-file scenarios, which were designed to trigger FM-3.3 verification collapse, are being solved reliably by the current agent.

2. **The existing skills may already address CIVC** — The coder agent already has `verify-after-edit`, `cross-reference-before-config-repair`, and `evidence-over-narrative` skills baked into its system prompt. These may already be serving as complexity-scaffolding and forced-verification interventions, making the explicit Arm B/C interventions redundant.

3. **CIVC may require higher complexity scenarios** — The compound-edit scenario (4 files, 3 tiers) and multi-file scenario (3 files, 1 rename) may not be complex enough to trigger verification collapse in an agent that already has verification habits.

### Does This Disprove H-093?

**No.** This experiment is inconclusive, not contradictory. H-093 predicts that *complexity* triggers verification collapse. These scenarios may simply not be complex enough to trigger the collapse for an agent with established verification habits. The 20.3% FM-3.3 rate from EXP-099 was measured across diverse real-world tasks with much higher complexity than these controlled scenarios.

### What Would Help

1. **Harder scenarios needed**: Design scenarios with 6+ interacting files, deeper dependency chains, and subtler cross-file impacts that existing verification skills don't easily catch
2. **Remove existing skills**: Run the experiment with a "naked" agent (without verify-after-edit and cross-reference skills) to isolate whether the existing skills are what's preventing collapse
3. **Use observational data instead**: Rather than controlled experiments, analyze real production sessions where FM-3.3 occurred and examine complexity metrics (opCount, file count, dependency depth) as predictors

## Conclusion

**EXP-100 is INCONCLUSIVE due to ceiling effect.** The scenarios don't trigger CIVC in the current coder agent. This is a scenario design problem, not evidence against H-093. The experiment needs either harder scenarios or a lower-capability baseline agent to produce meaningful differentiation.

## Data Preservation

All 12 session transcripts are available at:
- Arm A: s_1775730484939_0, s_1775730596_0 (compound-edit); s_1775730605676_0, s_1775730681974_0 (multi-file)
- Arm B: s_1775730774490_0, s_1775730920369_0 (compound-edit-scaffolded); s_1775730774494_0, s_1775730920370_0 (multi-file-scaffolded)
- Arm C: s_1775731077228_0, s_1775731252778_0 (compound-edit-checkpoint); s_1775731077226_0, s_1775731252777_0 (multi-file-checkpoint)
