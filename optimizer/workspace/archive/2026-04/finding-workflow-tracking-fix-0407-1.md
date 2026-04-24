# Finding: Workflow Tracking DB Persistence Failure

**Date**: 2026-04-07  
**Severity**: High  
**Status**: Fixed (commit `00aed9a`)  
**Investigation session**: s_1775579654245_246

## Summary

Workflow runs were completing successfully but invisible to DB queries. All April sessions had `workflowRunId=none` in SQLite despite `.state/workflows/` and `meta.json` files containing correct workflow data. This made workflow adoption appear to be zero when queried via the database.

## Root Cause

The `session_start` event type in `event-bus.ts` was missing `workflowRunId`, `source`, `kind`, and `requestId` fields. When `manager.ts` emitted `session_start`, these fields were silently dropped because TypeScript's type didn't include them. `DbWriter` then called `upsertSession()` without the fields, so they defaulted to `none` in the DB.

Meanwhile, `persistence.ts` wrote the correct data to `meta.json` files via a separate code path, creating a split-brain situation: filesystem had the data, DB index did not.

## Evidence

- **Workflow runs exist**: `.state/workflows/` contains April runs (e.g., `wr_1775525545867_z6l9`) with `status=done`
- **DB had no data**: All April sessions had `workflowRunId=none` in the sessions table
- **Only exception**: One April 1 session (`wr_1775034577833_vab7`) had a workflowRunId — this was from an interrupted run that may have used a different code path
- **meta.json files correct**: Session meta.json files contained `workflowRunId`, `source`, `kind`, `requestId` properly

## What Changed

Three files modified:

1. **`src/app/event-bus.ts`** (line 40): Added `workflowRunId?`, `source?`, `kind?`, `requestId?` to `session_start` event type
2. **`src/lib/db-writer.ts`** (line 28+): Pass `workflowRunId`, `source`, `kind`, `requestId` to `upsertSession()` call; removed unsafe `(event as any)` casts
3. **`src/lib/manager.ts`** (lines 926, 947, 1307): Include these fields when emitting `session_start` in both `startSession()` and `resumeSession()` code paths

## Expected Impact

- Workflow runs will now be properly indexed in SQLite
- Queries like `SELECT * FROM sessions WHERE workflowRunId != 'none'` will return actual results
- Workflow adoption metrics will be trackable
- Session source/kind/requestId data will be queryable for analytics

## Lesson

When two persistence paths exist (filesystem meta.json + SQLite DB), both must receive the same data fields. The event bus type definition serves as a contract — if a field isn't in the type, it won't flow through even if the emitter tries to include it.
