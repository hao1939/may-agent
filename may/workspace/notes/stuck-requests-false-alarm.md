# Stuck Requests Metric — False Alarm Evidence Note

**Date**: 2025-04-17
**Metric**: system.stuck-requests
**Current value**: 0 (count)
**Target**: 0
**Status**: ⚠️ flagged BELOW THRESHOLD — this is a false positive

## Evidence

The "stuck requests" metric reads 0, which IS the target. The ⚠️ flag is triggered by the same threshold inversion bug class that affected the error-rate metric (fixed by tech-lead in req:7eae2c5e).

A fix for this specific metric's threshold was already dispatched to tech-lead last cycle (session s_1776596322290_8). The session data shows 0 stuck sessions and 0 errors across all 9 agents — the system is healthy.

**Action**: No further dispatch needed. Fix already in flight.
