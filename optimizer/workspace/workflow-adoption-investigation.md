# Workflow Adoption Investigation — Root Cause Analysis

**Date**: 2026-04-07
**Investigator**: Optimizer
**Status**: Complete — code fix applied + diagnosis

## Task
Investigate why "0 workflow runs in 6+ days" — understand if workflows are truly not running, why, and fix.

## Findings

### Finding 1: Workflows ARE Running — But Invisibly

The claim "0 runs in 6+ days" was **misleading**. Workflows are actually running:
- `training-sprint`: 4 runs on Apr 7, 1 on Apr 5, daily runs Apr 2-4
- `growth-cycle`: Last run was Mar 31 — genuinely stopped

**Total workflow runs**: 229 historical, 8 in April

### Finding 2: Training Sprints Produce Zero Results

Every April training-sprint completed with: `"0 promoted, 0 discarded"`. The workflow infrastructure works, but the experiment content hits ceiling effects — all gym scenarios where skills could help are already at 100%.

### Finding 3: Growth-Cycle Stopped After Heartbeat Rewrite

`growth-cycle` last ran Mar 31. The Apr 1 heartbeat rewrite removed explicit `workflow.run("growth-cycle", ...)` instructions. Only `training-sprint` survived because it has a cron trigger. EXP-028 documented this correlation.

### Finding 4: DB Metadata Bug (Code Fix Applied)

**Root cause**: `session_start` events on the EventBus were missing `workflowRunId`, `source`, `kind`, and `requestId` fields. This caused:

1. DbWriter couldn't persist these fields when sessions start
2. `source` field was NEVER populated (0/17,084 sessions had it)
3. `kind` and `workflowRunId` were only populated later through other code paths
4. Queries filtering by `workflowRunId` or `source` appeared to show zero workflow activity

**Impact**: Any dashboard or monitoring querying the DB for workflow activity would see misleading data. The "0 runs" conclusion likely came from a DB query that missed the workflow runs.

## Code Fixes Applied

### 1. `src/app/event-bus.ts` (line 40)
Added `workflowRunId`, `source`, `kind`, `requestId` to the `session_start` event type.

### 2. `src/lib/manager.ts` (lines 926-927, 947-950, 1305-1308)
- `run()`: Now persists `source` and `requestId` to meta.json
- `run()`: Now emits `workflowRunId`, `source`, `kind`, `requestId` in session_start event
- `resumeSession()`: Now emits same fields from persisted data

### 3. `src/lib/db-writer.ts` (lines 31-37)
- Now passes `source`, `workflowRunId`, `requestId` from the event to `upsertSession()`
- Removed unnecessary `(event as any)` casts for typed fields

### 4. `src/lib/persistence.ts` (lines 50-53)
- Added `source` and `requestId` fields to `PersistedSession` interface
- These are now properly persisted in meta.json and survive crash recovery

## Recommendations

1. **Growth-cycle revival**: Add a cron entry for growth-cycle (like training-sprint has) so it doesn't depend on heartbeat instructions
2. **Training-sprint value**: The current training sprints are futile — they find no non-ceiling scenarios to test. Either add harder gym scenarios or pause the cron
3. **Monitoring**: Use the now-fixed `source` field to build proper workflow activity dashboards
