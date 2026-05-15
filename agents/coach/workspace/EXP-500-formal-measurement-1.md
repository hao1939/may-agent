# EXP-500: Formal Measurement Attempt #1

**Date**: 2026-05-13 (heartbeat)
**Status**: INCONCLUSIVE — insufficient edit volume in sampled sessions

## Context

EXP-500 (structural read-before-edit injection) deployed to `master-worker.ts:423-448`.
Notification received: "Structural read-before-edit injection is now live" (confirmed deployed).

## Measurement Method

Searched post-deployment sessions (`s_177773*`) in `.state/sessions/history/` for:
- `"toolName":"edit"` calls (total)
- `"toolName":"edit"` + `"isError":true` (failures)

## Results

| Period | Sessions w/ edits | Total edits | Failed edits | Edit failure % | Session failure % |
|--------|-------------------|-------------|--------------|----------------|-------------------|
| Post-deploy (s_177773*) | 10 | 15 | 0 | 0.0% | 0.0% |
| Pre-deploy control (s_177772*) | 5 | 6 | 0 | 0.0% | 0.0% |

## Assessment

**INCONCLUSIVE**: Both periods show 0% failures, but sample sizes are tiny (15 and 6 edits respectively). 
The baseline measurement (108/703 = 15.4%) was taken from a much larger dataset.

Possible explanations:
1. Most edit-heavy sessions are in active (not history) directories or were purged
2. The sessions sampled are coach/heartbeat sessions (few edits), not worker sessions (many edits)
3. Edit failures may concentrate in specific agent types not represented in this sample

## Next Steps

- Need to measure from a broader session archive or wait for more post-deployment worker sessions
- Alternative: Check master-worker.ts directly to confirm injection is firing
- Re-measure at next heartbeat with larger sample

## Conclusion

Cannot confirm or reject EXP-500 effectiveness yet. Early signal remains positive (0/15 vs historical 15.4%) but n is too small for statistical confidence. The experiment remains in DEPLOYED/AWAITING_MEASUREMENT state.
