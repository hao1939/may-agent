# ⚠️ stuck-requests Metric: False Alarm Evidence

**Date**: 2026-04-18
**Metric**: system.stuck-requests = 0, target = 0
**Status**: FALSE ALARM — value equals target

## Evidence
The metric system flags this as ⚠️ BELOW THRESHOLD despite the value (0) equaling the target (0). This has been observed across 15+ consecutive heartbeat cycles (since ~15:00 UTC today). Every cycle, the DB confirms 0 stuck requests.

This is a metric definition bug — likely the threshold comparison uses `<=` instead of `<`, or the "below threshold" logic doesn't handle the case where value == target == 0.

## Action Taken
- Fix dispatched to tech-lead on 2026-04-18 ~15:36 UTC (req:baaae56e)
- Tech-lead has not yet resolved; may be deprioritized vs other work

## Conclusion
No action needed on stuck requests themselves (there are none). The metric display logic needs fixing.
