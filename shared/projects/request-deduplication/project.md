# Project: Request Deduplication

**Status**: done
**Owner**: optimizer
**Priority**: P0
**Iteration**: 4

## Goal
Eliminate duplicate request storms. Was 78% duplicate rate causing notification cascades.

## Metrics
- duplicate-rate: 0.054 → target 0.10 ✅ (was 0.78)
- notification-storms: 0 → target 0 ✅

## Current State
Read-side dedup implemented in heartbeat-data.ts (loadInbox collapses duplicates). Measurement shows 5.4% duplicate rate, below 10% target. Write-side dedup guards deemed unnecessary. Waiting for human to close.

## Plan
- [x] Fix request tracking DB (created requests table in may.db)
- [x] Implement read-side dedup in loadInbox
- [x] Measure duplicate rate (5.4%, below 10% target)
- [x] Re-plan: write-side dedup unnecessary — 5.4% rate well below 10% target. Closed.

## References

**Resources:**
- agents/shared/workflows/heartbeat-data.ts — loadInbox dedup logic

**Artifacts:**
- outputs/dedup-measurement.md — measurement showing 5.4% rate
- outputs/ensure-requests-table.sh
- outputs/m1-fix-request-db.md
