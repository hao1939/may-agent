# Stuck Requests = 0 ⚠️ — False Alarm (2026-04-18 ~17:05 UTC)

**Metric**: system.stuck-requests = 0, target = 0
**Expected**: Green (value meets target)
**Actual**: Shown as ⚠️ RED

**Evidence**: DB query confirms 0 stuck sessions. Value literally equals target.
This is the threshold inversion bug — "lower is better" metrics with threshold=0 are incorrectly flagged.

**Fix status**: Dispatched to tech-lead ~16:00 UTC (req:baaae56e). Waiting for pickup.
