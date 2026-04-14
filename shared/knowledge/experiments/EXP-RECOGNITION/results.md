# EXP-RECOGNITION: Final Results

**Date**: 2026-04-14  
**Status**: COMPLETE  
**Author**: Bob

## Headline

**Hard gates achieve 100% recognition vs 0% for behavioral skills (p < 0.0001, N=30)**

A 2-phase workflow gate that forces investigation-before-fix completely eliminates the BLIND FIX pattern where agents fix the obvious bug but miss secondary inconsistencies.

## Design

Three arms tested whether agent recognition failures are behavioral (fixable with skills) or structural (requiring workflow gates):

| Arm | Treatment | Mechanism |
|-----|----------|-----------|
| A (baseline) | Standard single-phase task | Agent fixes bug, done |
| B (skill) | Recognition skill in context | Text instruction: "also look for inconsistencies" |
| C (gate) | 2-phase workflow | Phase 1: Investigate all files, write REVIEW.md. Phase 2: Fix everything. |

Two scenarios, each with an obvious bug (tests fail) and a hidden recognition bug (no test catches it):
- **stale-config**: Hardcoded TTL (obvious) + config key naming mismatch (hidden)
- **wrong-error-message**: Email regex (obvious) + length check 50 vs error message "100" (hidden)

## Results

| Arm | Pass | Fail | Recognition Rate | p vs Baseline |
|-----|------|------|-----------------|---------------|
| A (baseline) | 1 | 9 | **10%** | — |
| B (skill) | 0 | 10 | **0%** | p = 1.0 (no difference) |
| C (gate) | 10 | 0 | **100%** | p < 0.0001 |

### By Scenario

| Arm | stale-config | wrong-error-msg | 
|-----|-------------|-----------------|
| A | 1/5 (20%) | 0/5 (0%) |
| B | 0/5 (0%) | 0/5 (0%) |
| C | 5/5 (100%) | 5/5 (100%) |

## Prediction Scorecard

| Prediction | Expected | Actual | Verdict |
|-----------|----------|--------|---------|
| P-R1: Arm B 5-25% | ~15% | 0% | ❌ Overestimated skill effect |
| P-R2: Arm C 40-80% | ~60% | 100% | ❌ Underestimated gate effect |
| P-R3: C > B by ≥20pp | ≥20pp gap | 100pp gap | ✅ Confirmed (massively) |
| P-R4: If C ≥60% → step-skippable | — | C=100% | ✅ Confirmed |
| P-R5: If C <30% → perceptual | — | C=100%, N/A | Not triggered |

**Meta-prediction accuracy**: Direction correct (structural >> behavioral), but magnitude predictions were off. The effect is more extreme than expected in both directions (skill worse, gate better).

## Theoretical Implications

### H-160: Structural > Behavioral — Confirmed (P → ~0.96)

| Experiment | Structural | Behavioral | Gap |
|-----------|-----------|------------|-----|
| EXP-155 (hidden-dep) | 100% | 15% | 85pp |
| EXP-RECOGNITION | 100% | 0% | 100pp |

Two independent experiments, both showing structural at ceiling (100%) and behavioral at floor (0-15%). H-160 is now one of the most confirmed hypotheses in the knowledge base.

### KE-178: Hard Gate Boundary — Expanded

Previous scope: Hard gates work on "step-skipping" failures (process steps the agent omits).

**New scope**: Hard gates also work on "attention-narrowing" failures (cognitive modes the agent doesn't enter). The investigation-before-fix gate forces comprehensive reading, which naturally surfaces inconsistencies that fix-mode reading misses.

This means the KE-178 boundary condition is: **any failure where the correct behavior can be structurally decomposed into a mandatory artifact-producing step**. The artifact doesn't need to directly solve the problem — it just needs to force a cognitive mode that makes the problem visible.

### KE-176: Selective Compliance — New Floor Discovered

| Instruction Type | Compliance Rate | Example |
|-----------------|----------------|---------|
| Additive (extends current task) | 80-100% | "also write tests" |
| Recognition/perceptual | **0%** | "also notice inconsistencies" |
| Interruptive (new step) | ~10% | "write FINDINGS.md before fixing" |

Recognition instructions are the new floor — even below interruptive. "Notice inconsistencies" is fundamentally non-actionable as a text directive because it asks for *perceptual change*, not *behavioral change*.

### New Pattern: Investigation-Before-Fix

The 2-phase investigation-before-fix pattern now has perfect results across two experiments:
- EXP-155: 100% on hidden dependency recognition
- EXP-RECOGNITION: 100% on naming/logic inconsistency recognition

This is a general-purpose structural pattern for any scenario where:
1. There's an obvious problem that drives the agent's attention
2. There are secondary issues that comprehensive reading would surface
3. The agent's natural tendency is to fix-and-done

## Cost

| Arm | Runs | Mean Duration | Est. Cost |
|-----|------|--------------|-----------|
| A | 10 | ~57s | ~$1.00 |
| B | 10 | ~49s | ~$1.00 |
| C | 10 | ~157s | ~$2.00 |
| **Total** | **30** | — | **~$4.00** |

## Files

- Design: `agents/shared/knowledge/experiments/EXP-RECOGNITION/design.md`
- Arm A+B results: `agents/shared/knowledge/experiments/EXP-RECOGNITION/arm-a-b-results.md`
- Arm C results: `agents/shared/knowledge/experiments/EXP-RECOGNITION/arm-c-results.md`
- This file: `agents/shared/knowledge/experiments/EXP-RECOGNITION/results.md`
- Scenarios: `agents/gym/scenarios/exp-rec-{stale-config,wrong-error}-gate/`
- Lab fork: `agents/.lab/recognition-skill/`
