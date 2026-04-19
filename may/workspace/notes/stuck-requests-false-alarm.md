# Stuck Requests Metric: False Alarm Evidence

**Date**: 2026-04-17
**Metric**: `system.stuck-requests` — 0 count, target 0, flagged ⚠️ BELOW THRESHOLD

## Evidence
The metric value is 0 and the target is 0. This is meeting the target perfectly. The ⚠️ flag is triggered by inverted threshold logic — the system treats "at target" as below threshold for this metric type.

This is the same class of threshold inversion bug that was fixed in `req:7eae2c5e` for error-rate. The stuck-requests metric likely needs the same fix: its comparison operator should be `>` (alert when above target), not `<`.

## Recommendation
Tech-lead should check the threshold comparison for `stuck-requests` in the metrics system and flip it if inverted.
