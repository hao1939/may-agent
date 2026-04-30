# KE-339: Short-Window Quality Baselines Are Unreliable

**Date**: 2026-08-01
**Source**: EXP-275 measurement analysis
**Confidence**: HIGH

## Finding

Quality baselines measured in short windows (e.g., 6h) can be extreme outliers. EXP-275 used a 6h window showing optimizer at 0.384 (n=17), but the full historical dataset (n=10 scored evals) showed a true mean of 0.606 — already above the 0.50 target.

## Implication

Before designing interventions, always:
1. Check the FULL historical quality distribution, not just a recent window
2. Require n≥10 AND span ≥7 days for baseline claims
3. Compare the short-window measurement against all-time mean ± 1 SD

## Rule
**Minimum baseline requirements**: n≥10, time-span ≥48h, comparison to all-time mean. If short-window shows >2 SD from historical mean, flag as potential outlier before investing in treatment.

## Related
- EXP-275 (optimizer quality — closed as baseline-revised)
- KE-338 (text coaching dead for compliance behaviors)
