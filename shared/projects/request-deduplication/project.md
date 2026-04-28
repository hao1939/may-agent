# Project: Request Deduplication

**Status**: closed
**Owner**: optimizer
**Priority**: P0
**Iteration**: 7

## Goal
Eliminate duplicate request storms. Was 78% duplicate rate causing notification cascades.

## Metrics
- duplicate-rate: 0.054 → target 0.10 ✅ (was 0.78)
- notification-storms: 0 → target 0 ✅

## Current State
Resolved. The requests table was removed entirely (replaced by events table). Read-side dedup in loadInbox collapses duplicates. Measured 5.4% rate, below 10% target. The ensure-requests-table.sh script is obsolete — do not run it.

## Plan
- [x] Implement read-side dedup in loadInbox
- [x] Measure duplicate rate (5.4%, below 10% target)

## References

**Resources:**
- agents/shared/workflows/heartbeat-data.ts — loadInbox dedup logic

**Artifacts:**
- outputs/dedup-measurement.md — measurement showing 5.4% rate
