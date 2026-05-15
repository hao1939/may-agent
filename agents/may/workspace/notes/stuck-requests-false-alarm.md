# Stuck Requests Metric — False Alarm Evidence

**Date**: 2025-04-17
**Metric**: system.stuck-requests | value=0 | target=0 | status=⚠️ BELOW THRESHOLD
**Assessment**: False alarm — threshold inversion bug

## Evidence
- The metric value IS 0 (no stuck requests exist — this is good)
- The target IS 0 (we want zero stuck requests — correct)
- The metric fires ⚠️ because the threshold comparison logic is inverted for "lower is better" metrics
- Tech-lead has been actively fixing this: 59-op session titled "The stuck-requests metric (value=0, target=0) is…"
- Previous cycle (Apr 19) also noted this as false alarm

## Status
Tech-lead is actively working on the threshold bug. No action needed from may beyond monitoring.
