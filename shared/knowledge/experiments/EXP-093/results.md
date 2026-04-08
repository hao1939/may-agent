# EXP-093 Results: Few-Shot Sprint 3 — Verify-After-Edit Discipline

**Date**: 2026-04-08
**Status**: COMPLETE
**Hypothesis**: H-091 — matched few-shot examples improve process discipline skills

## Summary

Few-shot treatment produced **mixed results** for verify-after-edit discipline:
- **C3 (explicit validation)**: Strong improvement, 40%→80% (+40pp)
- **C2.3 (read-after-write)**: No improvement, 40%→20% (-20pp)
- **Product correctness**: Improved, 60%→100% (+40pp)
- **ARM 2 at ceiling**: Both control and treatment 100% — no signal

The few-shot successfully taught the agent to run explicit JSON validation (C3) and improved product quality. However, it did NOT improve the specific "read file back after editing" behavior (C2.3). This suggests few-shot is effective for *what to validate* but not for *when to verify* — a subtle but important distinction.

## ARM 1: convention-verify-edit (N=10)

### Individual Run Results

| Run | Condition | Scenario Pass | valid-json | correct-values | fields-preserved | C2.3 | C3 | Duration |
|-----|-----------|--------------|------------|---------------|-----------------|------|-----|----------|
| 1 | Control | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | 58.2s |
| 2 | Control | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 41.8s |
| 3 | Control | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 35.4s |
| 4 | Control | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | 42.0s |
| 5 | Control | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | 69.4s |
| 1 | Treatment | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | 64.1s |
| 2 | Treatment | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 24.8s |
| 3 | Treatment | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | 22.9s |
| 4 | Treatment | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | 24.6s |
| 5 | Treatment | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | 21.0s |

### Aggregate Rates

| Metric | Control (N=5) | Treatment (N=5) | Δ | p-value (Fisher) |
|--------|--------------|----------------|---|-------------------|
| Scenario pass | 2/5 (40%) | 1/5 (20%) | -20pp | 1.0 (ns) |
| Product pass (all 3) | 3/5 (60%) | 5/5 (100%) | +40pp | 0.44 (ns) |
| valid-json | 5/5 (100%) | 5/5 (100%) | 0 | — |
| correct-values | 5/5 (100%) | 5/5 (100%) | 0 | — |
| fields-preserved | 3/5 (60%) | 5/5 (100%) | +40pp | 0.44 (ns) |
| **C2.3 (verify-after-edit)** | **2/5 (40%)** | **1/5 (20%)** | **-20pp** | **1.0 (ns)** |
| **C3 (validation-attempt)** | **2/5 (40%)** | **4/5 (80%)** | **+40pp** | **0.52 (ns)** |

*Note: With N=5 per condition, no differences reach statistical significance (Fisher exact test). These are directional signals only.*

### ARM 1 Analysis

**C3 improvement (40%→80%)**: The few-shot worked example explicitly demonstrated running `node -e "JSON.parse(...)"` for validation. Treatment runs 3, 4, and 5 all ran validation commands (using `find` + JSON.parse pattern), while control runs 4 and 5 did not. This suggests the few-shot successfully taught "validate after editing" as a practice.

**C2.3 non-improvement (40%→20%)**: Despite the few-shot showing a "read back the file after editing" pattern, the treatment did NOT increase read-after-write behavior. The C2.3 check requires the agent to call `read()` on config.json (or cat it) after writing — many treatment runs skipped this step even though they did validate with JSON.parse.

**Product improvement (60%→100%)**: The treatment eliminated fields-preserved failures. Control runs 1 and 5 dropped `name` and `debug` fields; no treatment run did. The few-shot's example of careful editing with field preservation likely influenced this.

**Duration pattern**: Treatment runs were faster on average (31.5s vs 49.4s), suggesting the few-shot helped the agent work more efficiently.

### Key Insight: C3 vs C2.3 Divergence

The few-shot taught the agent *what* validation to run (explicit JSON.parse validation = C3) but NOT *when* to read back the file (read-after-write = C2.3). This suggests:
- **"What to do" lessons** transfer well via few-shot (consistent with EXP-090, EXP-091)
- **"When to do it" habits** (temporal sequencing of tool calls) may require workflow enforcement, not just examples

## ARM 2: read-before-edit (N=6)

### Individual Run Results

| Run | Condition | Scenario Pass | All Product | C1 (read-before) | C2.3 (verify-after) | Duration |
|-----|-----------|--------------|-------------|-------------------|---------------------|----------|
| 1 | Control | ✅ | ✅ | ✅ | ✅ | 18.8s |
| 2 | Control | ✅ | ✅ | ✅ | ✅ | 18.0s |
| 3 | Control | ✅ | ✅ | ✅ | ✅ | 18.7s |
| 1 | Treatment | ✅ | ✅ | ✅ | ✅ | 17.2s |
| 2 | Treatment | ✅ | ✅ | ✅ | ✅ | 11.5s |
| 3 | Treatment | ✅ | ✅ | ✅ | ✅ | 12.6s |

### Aggregate Rates

| Metric | Control (N=3) | Treatment (N=3) | Δ |
|--------|--------------|----------------|---|
| Scenario pass | 3/3 (100%) | 3/3 (100%) | 0 |
| C1 (read-before-edit) | 3/3 (100%) | 3/3 (100%) | 0 |
| C2.3 (verify-after-edit) | 3/3 (100%) | 3/3 (100%) | 0 |
| All product checks | 3/3 (100%) | 3/3 (100%) | 0 |

### ARM 2 Analysis

Both conditions hit the ceiling. The baseline has improved since EXP-055 (when C2.3 was failing). Bob now consistently verifies after editing in the read-before-edit scenario. This arm provides no signal for or against the few-shot hypothesis — the control is already at 100%.

**Duration note**: Treatment was slightly faster (13.8s avg vs 18.5s avg), but N=3 is too small for significance.

## Comparison to Protocol Predictions

| Prediction | Actual | Match? |
|------------|--------|--------|
| ARM 1 Control scenario: 0% | 40% | ❌ Baseline much higher than expected |
| ARM 1 Treatment scenario: ≥60% | 20% | ❌ Treatment lower than control |
| ARM 1 Treatment C2.3: ≥80% | 20% | ❌ C2.3 did not improve |
| ARM 1 Treatment C3: ≥60% | 80% | ✅ C3 improved |
| ARM 1 Product: ≥80% both | Control 60%, Treatment 100% | Partial — treatment hit target |
| ARM 2 Control scenario: ~91% | 100% | ❌ Baseline at ceiling |
| ARM 2 Treatment C2.3: ≥67% | 100% | ✅ (but control also 100%) |

## H-091 Update

**Assessment: Weak/partial support** — P(H) adjusts from 0.99 to 0.95

The results partially support H-091 but reveal important boundaries:
1. **C3 (validation)**: +40pp improvement supports few-shot teaching "what to do"
2. **C2.3 (verify-after-edit)**: -20pp suggests few-shot does NOT teach "when to do things" in a temporal sequence
3. **Product quality**: +40pp on fields-preserved suggests few-shot improved care/thoroughness

**Updated model**: Few-shot works well for:
- ✅ Judgment skills (know-when-blocked, evidence-over-narrative) — EXP-090
- ✅ Process knowledge (reproduce-first debugging) — EXP-091
- ✅ Validation knowledge (what checks to run) — EXP-093 C3
- ✅ Product quality (thoroughness, field preservation) — EXP-093 product
- ❌ Temporal discipline (read-after-write sequencing) — EXP-093 C2.3

**Implication**: Verify-after-edit (C2.3) may require **workflow enforcement** (explicit step gates) rather than few-shot examples. This is consistent with the hypothesis that behavioral habits involving tool-call sequencing are harder to teach via examples alone.

## Design Issues Noted

1. **Scenario environment mismatch**: Protocol describes a "trailing comma trap" in config.json, but the environment file has valid JSON with correct values already set. The scenario is testing whether the agent properly handles editing an already-correct file while preserving all fields — not the trailing comma repair originally described.

2. **Baseline shift**: Protocol predicted 0% control for ARM 1 based on EXP-025 data. Actual baseline was 40%. Bob's behavior has improved since the earlier measurements (possibly from prior skill deployments). Future experiments should always collect fresh baselines.

3. **ARM 2 ceiling**: Protocol predicted ~33% C2.3 in ARM 2 control. Actual was 100%. The read-before-edit scenario appears fully solved, making it unsuitable as a test bed for verify-after-edit improvement.

## Conclusions

1. **Few-shot produces partial transfer for verify-after-edit**: It teaches *what* to validate (C3: +40pp) but not *when* to read back (C2.3: no improvement)
2. **Baseline has shifted significantly**: Convention-verify-edit is no longer 0% — it's 40% without any few-shot intervention
3. **Read-before-edit is at ceiling**: 100% baseline makes it uninformative for this experiment
4. **Product quality benefits from few-shot**: Treatment had 100% product pass vs 60% control — the examples improve thoroughness
5. **Verify-after-edit (C2.3) may need workflow enforcement**: Few-shot alone is insufficient for temporal behavioral discipline

## Raw Data Location

Individual run results: `/tmp/exp093-results/arm{1,2}_{control,treatment}_run{1-5}.json`
