# EXP-100: Complexity-Induced Verification Collapse — Interventional Test

**Date**: 2026-04-09
**Status**: READY
**Sprint**: 31
**Tags**: CIVC, verification-collapse, FM-3.3, complexity-scaffolding, forced-checkpoint, H-093
**Gym budget**: 12 runs (3 arms × 2 scenarios × 2 runs each)
**Depends on**: EXP-099 (observational evidence for H-093), EXP-098 (treatment testing methodology)

## Problem Statement

EXP-099 established that FM-3.3 (verification failure) is the #1 error mode at 20.3% of 999 classified errors across 384 sessions. H-093 proposes that verification collapse is triggered by **task complexity** (not task length — quality-opCount r=0.099), and that the collapse follows a predictable "Drift-to-Decay" cascade: errors accumulate → verification abandoned → errors become unrecoverable.

H-093 further predicts that:
- **P-093a**: Complexity-reducing scaffolding (decomposition + intermediate verification) will reduce FM-3.3 rates
- **P-093c**: Forced verification checkpoints will break the Drift-to-Decay cascade

These predictions have NOT been tested interventionally. EXP-098 showed that treatment mechanisms CAN transfer to complex scenarios (cross-reference achieved 0%→100% on L3), but EXP-098 tested information-discovery, not verification-collapse specifically.

**Key question**: Can we reduce FM-3.3 rates on complex multi-file tasks through complexity-scaffolding and forced-checkpoint interventions?

## Hypothesis

- **H1**: Complexity-scaffolded agents (given decomposition template + per-step verification prompts) will achieve ≥40% higher check-pass rate than baseline on compound verification scenarios
- **H2**: Forced-checkpoint agents (must write VERIFY.md after each file edit, cannot proceed without confirming) will achieve ≥60% higher check-pass rate than baseline
- **H3**: Forced-checkpoint will outperform scaffolding because it prevents the critical transition: once verification is skipped (FM-3.3), the agent cannot self-correct (verification gravity well)

## Scenarios

Two scenarios chosen to test CIVC across different complexity profiles:

### Scenario 1: compound-edit-verification (High Complexity)
- **Complexity factors**: 4 interacting files (pricing.js, invoice.js, discount.js, formatter.js), hidden cross-file dependency (TAX_RATE constant), 2 separate test suites, tiered logic with 3 boundary conditions
- **Known failure mode**: Agent fixes pricing.js but misses stale TAX_RATE references in discount.js and formatter.js → unit tests pass but integration tests fail
- **Why it tests CIVC**: The "surface fix passes surface tests" trap is exactly what verification collapse looks like — the agent stops verifying at the first positive signal

### Scenario 2: multi-file-verify-gap (Medium Complexity)
- **Complexity factors**: 3 files with import dependency chain, rename refactor that must propagate, test script only covers primary file
- **Known failure mode**: Agent renames in config-loader.js and maybe server.js but misses health-check.js → test passes but runtime breaks
- **Why it tests CIVC**: Tests whether verification collapse scales with complexity — if CIVC is real, we should see LESS collapse on this simpler scenario even without intervention

## Arms

### Arm A: Baseline (No Intervention)
- Standard scenarios as-is: `compound-edit-verification` and `multi-file-verify-gap`
- Agent: coder (consistent with EXP-098 methodology)
- N=2 runs per scenario (4 total)
- Expected: Low pass rate on compound-edit (~25%), moderate on multi-file (~50%)

### Arm B: Complexity Scaffolding (Decomposition + Intermediate Verification)
- New scenario variants: `compound-edit-verification-scaffolded` and `multi-file-verify-gap-scaffolded`
- **Intervention**: Injected context provides a decomposition template:
  1. "Before making changes, write PLAN.md listing: (a) all files that need changes, (b) the specific change per file, (c) which test verifies each change"
  2. "After EACH file edit, run the relevant test and record pass/fail in PLAN.md"
  3. "Before finishing, run ALL test suites and verify every item in PLAN.md is checked off"
- Agent: coder
- N=2 runs per scenario (4 total)
- Tests **P-093a**: Does complexity-reducing scaffolding lower FM-3.3?

### Arm C: Forced Verification Checkpoint (Must-Verify Gate)
- New scenario variants: `compound-edit-verification-checkpoint` and `multi-file-verify-gap-checkpoint`
- **Intervention**: Injected context with mandatory verification protocol:
  1. "MANDATORY: After editing ANY file, you MUST immediately read it back to verify the edit applied correctly"
  2. "MANDATORY: After ALL edits are complete, you MUST run every available test command and paste the full output"
  3. "MANDATORY: Before calling finish(), write VERIFY.md with: each file changed, verification method used, test results, and explicit pass/fail for each requirement"
  4. "If ANY test fails, you MUST fix the issue before finishing — do NOT finish with known failures"
- Agent: coder
- N=2 runs per scenario (4 total)
- Tests **P-093c**: Do forced checkpoints break Drift-to-Decay?

## Measurement

| Metric | How Measured | Why It Matters |
|--------|-------------|----------------|
| **Overall pass rate** | success_criteria.js per scenario | Primary outcome |
| **Check-level detail** | Individual P1-P6 and C2.3 checks (compound-edit) | Identifies WHERE verification collapses |
| **Integration test pass** | P4 check specifically | Direct measure of cross-file verification |
| **Cross-file fix rate** | P5 (discount) + P6 (formatter) for compound-edit | Tests whether agent verified dependency chain |
| **Verification behavior** | C2.3 behavioral check + PLAN.md/VERIFY.md existence | Process compliance |
| **FM-3.3 occurrence** | Manual error classification of failures | Direct CIVC measurement |

## Protocol

1. Create 4 new scenario variants (2 scaffolded, 2 checkpoint) by copying base environments and adding injected_context.md
2. Run Arm A: 2× compound-edit-verification baseline, 2× multi-file-verify-gap baseline
3. Run Arm B: 2× compound-edit-verification-scaffolded, 2× multi-file-verify-gap-scaffolded
4. Run Arm C: 2× compound-edit-verification-checkpoint, 2× multi-file-verify-gap-checkpoint
5. Score all 12 runs with per-check granularity
6. Classify failure modes for any failed runs (is it FM-3.3 specifically?)
7. Compare pass rates and check-level results across arms

## Analysis Plan

### Primary Analysis
- Compare overall pass rate: Arm A vs B vs C for each scenario
- Fisher's exact test for significance (given small N, we need large effect sizes)

### Secondary Analysis
- **Check-level analysis**: Which specific checks improve under each treatment? If P4 (integration tests) improves but P1 (tiered rates) doesn't, that confirms the intervention targets verification specifically
- **Complexity gradient**: Compare treatment effect on compound-edit (high complexity) vs multi-file (medium complexity). If CIVC is real, treatments should show LARGER effect on the more complex scenario
- **Process compliance**: Did agents actually write PLAN.md / VERIFY.md? Compliance rate matters for understanding mechanism vs. instruction-following
- **Cascade analysis**: In failed runs, did the Drift-to-Decay pattern occur? Did the interventions break the cascade?

### Falsification Criteria
H-093 would be **weakened** if:
- Both treatments fail to improve FM-3.3 rates (interventions don't work → maybe collapse isn't complexity-driven)
- Treatment effect is LARGER on the simpler scenario (would suggest length/effort matters more than complexity)
- Baseline pass rates are already high (>80%) — would mean these scenarios don't actually trigger CIVC

## Exit Criteria

- **STRONG SUPPORT**: Arm C achieves ≥75% pass rate on compound-edit (vs ≤25% baseline), AND treatment effect is larger on compound-edit than multi-file → P-093a + P-093c confirmed, CIVC mechanism validated
- **MODERATE SUPPORT**: Either arm achieves ≥50% improvement over baseline on at least one scenario → partial confirmation
- **WEAK/AGAINST**: Neither treatment improves pass rate by ≥25% → CIVC predictions not supported; verification collapse may have a different mechanism

## Scenario Creation Spec

### compound-edit-verification-scaffolded
- Copy `compound-edit-verification` environment
- Add `injected_context.md` with decomposition template
- Add `wrote-plan` check to success_criteria.js (check PLAN.md exists and has content)
- scenario.json: add tags `["EXP-100", "scaffolding", "H-093"]`

### compound-edit-verification-checkpoint
- Copy `compound-edit-verification` environment
- Add `injected_context.md` with forced verification protocol
- Add `wrote-verify` check to success_criteria.js (check VERIFY.md exists and has content)
- scenario.json: add tags `["EXP-100", "forced-checkpoint", "H-093"]`

### multi-file-verify-gap-scaffolded
- Copy `multi-file-verify-gap` environment
- Add `injected_context.md` with decomposition template (adapted for 3-file rename)
- scenario.json: add tags `["EXP-100", "scaffolding", "H-093"]`

### multi-file-verify-gap-checkpoint
- Copy `multi-file-verify-gap` environment
- Add `injected_context.md` with forced verification protocol
- scenario.json: add tags `["EXP-100", "forced-checkpoint", "H-093"]`

## Resource Estimate

- **Gym runs**: 12 (within standard budget)
- **Scenario creation**: 4 new variants (mostly environment copy + injected context)
- **Analysis time**: ~30 min for scoring + classification
- **Total**: ~1 sprint session

## Connection to Knowledge Base

- **Tests**: H-093 predictions P-093a (scaffolding) and P-093c (forced checkpoints)
- **Builds on**: EXP-099 (observational FM-3.3 data), EXP-098 (treatment testing methodology), compound-edit-verification scenario (existing FM-3.3 test)
- **Informs**: Whether to deploy complexity-gated verification as a system-wide intervention (H-093 implication #2)
- **Related**: KE-076 (FM-3.3 knowledge), WKWA-007 (intervention architecture)
