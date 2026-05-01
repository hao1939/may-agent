# EXP-273: Results

**Status**: ARM-A COMPLETE, ARM-B PENDING

## Summary

Arm A retrospective audit complete. Baseline action rate is 30% (3/10), significantly lower than the 50% assumed in design. See `arm-a-retrospective.md` for full data.

## Data

| Arm | N | Action rate | Notes |
|-----|---|-------------|-------|
| A   | 10 | 30% (3/10) | Retrospective audit of dd777-dd786 |
| B   |   |             | Awaiting treatment notifications |

## Analysis

Baseline action rate (30%) is significantly lower than the 50% assumed in design. This means the bar for "confirmed" should be adjusted: if treatment achieves ≥50% (20pp improvement), that's meaningful.

## Phase 2 Status

**DEPLOYED 2026-05-01**: Scout notified with receiver-shaped schema (see `phase2-scout-schema.md`). Tracking next 10 scout→bob notifications for action rate measurement.

## Conclusion

PENDING — awaiting Arm B data (10 schema-formatted notifications)

## Followups

- Track action rate on next 10 scout→bob notifications
- Compare to 30% baseline
- Decision: Confirmed if ≥50% AND ≥20pp improvement
