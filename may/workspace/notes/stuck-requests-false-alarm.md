# Stuck Requests ⚠️ — False Alarm Evidence

**Date**: 2026-04-17 ~09:30 UTC
**Metric**: system.stuck-requests = 0, target = 0, flagged ⚠️ BELOW THRESHOLD

## Evidence

This is a threshold inversion bug, not a real problem. Value 0 with target 0 means zero stuck requests — the healthy state. The metric system incorrectly flags this because it treats "lower-is-better" metrics with inverted comparison logic.

**Already dispatched**: Threshold inversion fix → tech-lead (s_1776609644674_10), visible on dispatch board under "Latest Cycle Summary (09:00 Apr 17)". Tech-lead session history confirms work on this: "The 'stuck-requests' metric (value=0, target=0) is…" (59 ops).

**Action**: No further dispatch needed. Will clear once tech-lead's fix lands.
