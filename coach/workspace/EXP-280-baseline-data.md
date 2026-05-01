# EXP-280: Baseline Data (Pre-Treatment Bob Quality Scores)

**Date collected**: 2026-05-01
**Treatment deployed**: ~2026-05-01 (57 min before this measurement)

## Bob Quality Scores (All Available, Chronological)

From `agents/evaluator/workspace/activity.jsonl`, all bob "done" events:

| # | Timestamp | Quality | Verdict |
|---|-----------|---------|---------|
| 1 | 1774364671 | 0.80 | good |
| 2 | 1775446272 | 0.90 | good |
| 3 | 1775638152 | 0.75 | needs_improvement |
| 4 | 1775648879 | 0.85 | good |
| 5 | 1775648886 | 0.85 | good |
| 6 | 1775648896 | 0.60 | acceptable |
| 7 | 1775650400 | 0.15 | needs_improvement |
| 8 | 1775650408 | 0.20 | needs_improvement |
| 9 | 1775664805 | 0.20 | needs_improvement |
| 10 | 1775694214 | 0.85 | good |
| 11 | 1775697815 | 0.75 | acceptable |
| 12 | 1775699616 | 0.90 | good |
| 13 | 1775699623 | 0.90 | good |
| 14 | 1775699630 | 0.90 | good |
| 15 | 1775701417 | 0.90 | good |
| 16 | 1775701424 | 0.80 | acceptable |
| 17 | 1775701432 | 0.80 | good |
| 18 | 1775701437 | 0.30 | needs_improvement |
| 19 | 1775703216 | 0.55 | acceptable |
| 20 | 1775703223 | 0.85 | acceptable |
| 21 | 1775814837 | 0.25 | needs_improvement |
| 22 | 1775816641 | 0.30 | needs_improvement |
| 23 | 1775823821 | 0.70 | acceptable |
| 24 | 1775831025 | 0.65 | acceptable |
| 25 | 1775836422 | 0.60 | acceptable |
| 26 | 1775838223 | 0.90 | good |
| 27 | 1775840022 | 0.75 | acceptable |
| 28 | 1775845424 | 0.78 | acceptable |
| 29 | 1775849038 | 0.00 | needs_improvement (no transcript) |
| 30 | 1775900262 | 0.80 | acceptable |

## Baseline Summary (excluding 0.0 no-transcript outlier)

- **N**: 29
- **Mean**: 0.66
- **Median**: 0.80
- **Recent 10 (post ts 1775814837)**: mean 0.64, scores: 0.25, 0.30, 0.70, 0.65, 0.60, 0.90, 0.75, 0.78, 0.80
- **FM-3.3 (VERIFICATION_FAILURE)** cited in: #19 (0.55), #21 (0.25), #23 (0.70)

## EXP-280 Treatment

- Hard rule: every edit()/write() must be followed by read()
- Added to bob/skills/verify-after-edit.md + bob/heartbeat.md EXECUTION RULES
- **Measurement due**: ~2026-05-03 (48h post-deployment)

## Success Criteria
- ≥50% read()-after-edit compliance (from estimated <20%)
- No quality score regression (maintain ≥0.64 mean)
