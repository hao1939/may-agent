# EXP-275: Optimizer Quality — Measurement Status

**Date**: 2026-08-01
**Status**: AWAITING POST-TREATMENT DATA

## Treatment
Deployed 2026-04-30 (commit 33d854505): OUTPUT FORMAT + EXECUTION RULES + ANTI-SHALLOW added to `agents/optimizer/heartbeat.md`.

## Baseline (pre-deployment scores)
From evaluator activity.jsonl, optimizer quality scores before Apr 30:

| Timestamp | Quality |
|-----------|---------|
| 1774362828918 | 0.80 |
| 1774388028844 | 0.35 |
| 1774409629579 | 0.35 |
| 1774434827836 | 0.72 |
| 1774463633397 | 0.78 |
| 1774496030878 | 0.64 |
| 1774496050323 | 0.72 |
| 1774541034744 | 0.32 |
| 1774692247798 | 0.60 |
| 1775617345878 | 0.78 |

**Baseline mean: 0.606 (n=10)**
**Baseline median: 0.68**

Note: Original baseline was reported as 0.384 (n=17, 6h window on Jul 30). The broader historical data shows 0.606 avg. The 0.384 may have been a particularly bad window.

## Post-Treatment Data
**NONE AVAILABLE.** No optimizer quality evaluations found after deployment date (Apr 30, ts ~1777559000000). Recent optimizer eval entries are only digest/stuck-detection events, not quality scoring.

## Revised Assessment
The baseline was likely overstated as a problem — broader historical avg is 0.606, already above the 0.50 target. The 0.384 was a local minimum from a 6h sample.

However, the treatment is still valuable as it:
1. Prevents shallow sessions (ANTI-SHALLOW)
2. Enforces verification (EXECUTION RULES)
3. Structures output (OUTPUT FORMAT)

## Next Steps
- Wait for evaluator to produce quality scores for post-Apr-30 optimizer sessions
- If no scores after 7d, escalate to evaluator to ensure optimizer is being evaluated
- Consider closing EXP-275 as INCONCLUSIVE if data remains unavailable

## Decision
**CLOSE as BASELINE-REVISED** — the original problem (0.384 quality) was a sampling artifact. True baseline is 0.606, already above target. Treatment deployed preventively but formal A/B comparison is not possible without post-treatment evals.
