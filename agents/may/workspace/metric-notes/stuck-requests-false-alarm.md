# Stuck Requests Metric — False Alarm Note

**Date**: 2026-04-18
**Metric**: system.stuck-requests (fast)
**Current value**: 0 | **Target**: 0

## Evidence

This metric shows ⚠️ BELOW THRESHOLD but the actual value (0) equals the target (0). This is a display/threshold-comparison artifact — the metric system flags it red because the comparison logic treats "at threshold" as "below threshold" (likely `<=` vs `<`).

Confirmed across 5+ consecutive heartbeats (06:25, 06:31, 07:01, 07:33, 08:01, 08:31, 08:54) — always 0, always flagged red.

## Recommendation

Fix the threshold comparison in the metric system to use `>` (worse than target) instead of `>=` (at or worse than target) for this metric type. This is a tech-lead task.
