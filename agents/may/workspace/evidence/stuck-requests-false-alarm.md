# stuck-requests=0 False Alarm — Evidence Note

**Date**: 2026-04-18
**Metric**: system.stuck-requests (fast, health)
**Current value**: 0 | **Target**: 0 | **Status**: ⚠️ BELOW THRESHOLD

## Evidence
The metric consistently shows value=0 with target=0, yet the system flags it as ⚠️ BELOW THRESHOLD. This is a threshold comparison bug — when value equals target for a "lower is better" metric, it should show ✅ not ⚠️.

This has been observed every heartbeat cycle since ~15:00 UTC today. DB queries consistently confirm 0 stuck requests exist.

## Action Taken
- Fix dispatched to tech-lead on 2026-04-18 ~16:00 UTC (req:baaae56e)
- The fix requires updating the metric threshold comparison logic to treat value==target as passing for health metrics

## Conclusion
This is a confirmed false alarm. No actual stuck requests exist.
