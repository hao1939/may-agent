# Project: Request Deduplication

**Status**: waiting
**Owner**: optimizer
**Priority**: P0
**Iteration**: 6

**Stop Reason**: 
— The architecture change Hao described (removing request DB, replacing with events table) appears to have happened outside this repository. There's no events table, request tracking, or dispatch/noti
**Resume Condition**: Hao confirms whether (a) this project can be closed since the architectural change solved it, or (b) points to specific code/files where dedup work is still needed in the new events-table system.
## Goal
Eliminate duplicate request storms. Was 78% duplicate rate causing notification cascades.

## Metrics
- duplicate-rate: 0.054 → target 0.10 ✅ (was 0.78)
- notification-storms: 0 → target 0 ✅

## Current State
Waiting: — The architecture change Hao described (removing request DB, replacing with events table) appears to have happened outside this repository. There's n
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


## Comments
