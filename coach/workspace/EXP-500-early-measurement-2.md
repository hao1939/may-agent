# EXP-500 Early Measurement #2 — 2026-05-10

**Status**: EARLY_SIGNAL (insufficient for formal measurement)

## Data Summary

- **Post-deployment sessions with pre-read injection**: 11 (in history)
- **Total pre-read injections**: 23 across those 11 sessions
- **Active sessions with pre-read**: 2 more (current)
- **Total post-deployment sessions**: ~13

## Observations

1. Pre-read injection is **firing consistently** — 23 injections across 11 sessions shows the regex matching is working
2. Some sessions with pre-read still show edit failures (e.g., s_1777732953220_568: 4 failures, s_1777731254226_538: 6 failures)
3. This suggests pre-read helps but doesn't eliminate all failures — possible causes:
   - Target file changed between pre-read and edit
   - Agent edited a different file than the one pre-read
   - File >200 lines and relevant section was truncated

## Comparison to Baseline

| Metric | Baseline | Current Signal |
|--------|----------|----------------|
| Pre-read injection rate | N/A (new) | 11/~50 sessions (~22%) |
| Edit failure rate | 15.4% | TBD (need clean data) |
| Session clean rate | 52% | ~83% (prior measurement, n=6) |

## Next Steps

- Full measurement at n=50+ sessions (~2026-05-15)
- Investigate edge cases where pre-read fired but edits still failed
- Consider expanding regex patterns if injection rate (<25%) seems low
