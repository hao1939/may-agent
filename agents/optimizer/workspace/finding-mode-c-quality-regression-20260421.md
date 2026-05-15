# Finding: Quality Metric Regression (Mode C)

**Date:** 2026-04-21
**Metric:** Quality preserved: 0.845 (threshold: 0.85)
**Verdict:** ⚠️ NOT ACTIONABLE — evaluator artifact, not genuine quality drop

## Summary

The quality regression from 0.85 → 0.845 is caused by **false zeros from evaluator-skip**, not a real decline in agent work quality. When zeros are excluded, the actual average quality is **0.61** (which is below ideal but a separate, pre-existing concern).

## Trend Data (Last 6 Hours)

| Agent     | Avg Quality | Count |
|-----------|------------|-------|
| evaluator | 0.000      | 257   |
| optimizer | 0.450      | 1     |
| coach     | 0.520      | 15    |
| bob       | 0.600      | 1     |
| qa        | 0.694      | 8     |
| scout     | 0.733      | 7     |

**Overall:** 289 evaluations, 257 zeros (89%), avg 0.068 including zeros, **0.61 excluding zeros**.

## Root Cause Analysis

All 15 worst sessions (quality=0) fall into exactly **one category**:

1. **Evaluator-skip false zeros (100% of zeros):** The evaluator agent records `quality=0, verdict="skipped"` with empty issues `[]` when it skips evaluation. These 257 records are not real quality assessments — they're metadata entries for sessions the evaluator chose not to score (e.g., self-evaluations, duplicate agent names). They pollute the quality metric by dragging the average toward zero.

No genuine low-quality sessions were found in the bottom 15 — every single one is an evaluator artifact.

## Is This a Genuine Quality Drop?

**No.** This is a measurement/instrumentation bug, not a quality problem.

- The 0.85 → 0.845 shift is entirely explained by the ratio of skipped-evaluations increasing
- The non-zero average (0.61) is stable and reflects the actual quality distribution
- 2 coach sessions also show `quality=0` with `"evaluator did not score this session (duplicate agent name)"` — same root cause

## Recommended Fix

**tech-lead has a pending request to fix evaluator-skip false zeros.** The fix should either:
- Exclude `verdict="skipped"` rows from quality metric aggregation, OR
- Stop writing `quality=0` for skipped evaluations (use NULL or don't insert a row)

Until that fix lands, the quality metric will continue to produce false alerts whenever the skip ratio fluctuates.

## Action Items

- [ ] **No immediate action needed** on agent quality — this alert is a false positive
- [ ] Resolve the 2 pending metric-snapshot alerts as "evaluator artifact"
- [ ] Track tech-lead's fix for evaluator-skip zero pollution
