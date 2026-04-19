# Stuck Requests Metric — False Alarm Evidence

**Date**: 2026-04-19
**Metric**: `system.stuck-requests`
**Current value**: 0 | **Target**: 0 | **Status**: ⚠️ RED (false positive)

## Evidence

The metric value (0) equals the target (0), meaning there are zero stuck requests — the system is healthy. However, the threshold comparison logic incorrectly flags this as "below threshold."

This is a known threshold inversion bug. Tech-lead has already invested 59+ ops in a session titled "The stuck-requests metric (value=0, target=0) is…" attempting to fix it, plus 48 ops on "Fix three metric system bugs."

The underlying system is healthy. No action needed beyond the ongoing tech-lead fix.
