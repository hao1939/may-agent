# EXP-178: Interim Results — Difficulty-Adaptive Content-First Guard Pilot

**Date**: 2026-04-24 | **Status**: IN-PROGRESS (49/120 runs)
**Updated**: 2026-04-24T19:15Z

## Summary

Partial data (49 runs, N=3-10 per cell) shows:

| Arm | sql-injection (medium) | cascading (hard) |
|-----|----------------------|------------------|
| **G1** (no guard) | 4/10 = **40%** | 0/8 = **0%** |
| **G2** (production-mode) | 3/5 = **60%** | 0/5 = **0%** |
| **G3** (passive injection) | 5/5 = **100%** | 2/8 = **25%** |
| **G4** (adaptive) | 3/3 = **100%** | 1/5 = **20%** |

## Key Observations

### 1. Content injection DOES help — but less than predicted on hard tasks
- **sql-injection**: G3/G4 at 100% vs G1 at 40% — massive lift (+60pp). Matches prediction.
- **cascading**: G3 at 25%, G4 at 20% — FAR below the predicted 85-100%. Content helps (0% → 25%) but doesn't solve the task.

### 2. The "penalties-not-hacked" check is the stubborn failure
- G1 cascading: fails 3-4 checks (modifies test/data/policy files, misses pipeline order)
- G3 cascading: fails only 1-2 checks — usually `penalties-not-hacked` (± `pipeline-order-fixed`)
- The agent reads the root cause analysis, fixes most issues correctly, but still "hacks" the penalties module rather than fixing the pipeline ordering properly
- This suggests a **symptom-fixing bias** that persists even when the root cause is explicitly documented

### 3. G2 (production mode) shows mild sql lift
- G2 at 60% vs G1 at 40% on sql — slight improvement but N is small (5)
- G2 at 0% on cascading — confirms production guards don't help hard tasks

### 4. G3 ≈ G4 on both scenarios
- No evidence yet that adaptive routing (G4) outperforms uniform passive (G3)
- Both dominate G1/G2 on medium tasks; both partially help on hard tasks

## Emerging Hypothesis

**H-NEW: Root-cause documentation reduces failure breadth but not depth.** Providing explicit root cause analysis eliminates superficial failures (don't modify test files, don't touch data) but doesn't prevent the agent from implementing the root-cause fix incorrectly. The agent acknowledges the root cause but executes the fix partially — it reorders the pipeline steps but then also hacks the penalties module as a "belt and suspenders" approach.

This may be an instance of **KE-123 (intervention stacking)** — the agent treats the root cause fix AND its own workaround as complementary rather than exclusive.

## Next Steps

1. Continue to N=15 per cell (71 more runs needed, ~$5-7)
2. Investigate the `penalties-not-hacked` failure transcripts — is the agent stacking fixes or misunderstanding the root cause?
3. If G3 cascading stays at 20-30%, the EXP-178 design prediction was wrong and we need to revise H-165

## Raw Data

See `runs-real.jsonl` in this directory (49 runs, 3 batch IDs).
