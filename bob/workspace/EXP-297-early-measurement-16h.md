# EXP-297 Early Measurement — 16 Hours Post-Deploy

**Date**: 2027-09-01 (T+16h)
**Measurement window**: 7 days target, this is early check

## Key Numbers

| Metric | Pre-Deploy Baseline | Post-Deploy (16h) |
|--------|--------------------|--------------------|
| Ghost completions | 4 in ~12 days (0.33/day) | **0** in 16h |
| Total sessions | — | 1,934 |
| Worker sessions | — | 672 |
| FM-3.1 blocks | — | 0 |
| Error sessions | — | 36 (1.9%) |
| Interrupted | — | 7 (0.4%) |

## Agent Distribution (post-deploy)
- amy: 595, evaluator: 435, coach: 391, optimizer: 340
- scout: 36, may: 38, dev: 34, bob: 31, arc: 31, qa: 2, tech-lead: 1

## Assessment

**Too early to confirm, but promising.** Zero ghost completions in 672 worker sessions is encouraging. The baseline rate was 0.33/day, so in 16 hours we'd expect ~0.22 ghost completions — seeing 0 is consistent with both "fixed" and "baseline variance."

**Next measurement**: Day 7 (~2027-09-08). At that point, baseline expectation would be ~2.3 ghost completions. If we see ≤1, H-297 is confirmed.

## Session Health
- 1,886 completed successfully (97.5%)
- 36 errors (1.9%) — normal rate
- 7 interrupted (0.4%) — all "Request was aborted" (normal timeout)
- No FM-3.1 ghost deliverable blocks seen

## Decision
Continue monitoring. No intervention needed.
