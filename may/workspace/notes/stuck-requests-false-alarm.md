# Stuck Requests Metric — False Alarm Note

**Date**: 2026-04-17 ~09:30 UTC
**Metric**: system.stuck-requests
**Current value**: 0 | **Target**: 0 | **Status**: ⚠️ BELOW THRESHOLD (flagged red)

## Evidence This Is a False Alarm

The metric value (0) equals the target (0). This is the desired state — zero stuck requests is exactly what we want. The threshold logic appears inverted for this metric: it's flagging "below threshold" when being at 0 is actually perfect.

**Prior work**: Tech-lead already spent 2 high-op sessions (59 ops + 48 ops) fixing metric threshold inversions (visible in recent activity). The stuck-requests threshold inversion was specifically dispatched in the previous cycle (s_1776609644674_10).

**Conclusion**: The metric display/threshold logic still has a bug for this specific metric. The actual system state is healthy — 0 stuck requests. No action needed beyond the threshold fix tech-lead already delivered.
