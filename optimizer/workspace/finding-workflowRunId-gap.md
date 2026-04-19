# Finding: workflowRunId Tracking Gap for Cron-Dispatched Heartbeat Sessions

**Date**: 2026-04-19  
**Investigator**: Optimizer  
**Severity**: Medium — affects workflow coverage metrics but not functionality

## Summary

May (0/79) and QA (0/40) have zero sessions with `workflowRunId` in the last 24h. Other agents have partial coverage (optimizer 143/201, bob 93/136). The root cause is a **timing gap from a very recent cron migration**, not a code bug.

## Root Cause Analysis

### The Migration
Per-agent heartbeat workflows (`may-heartbeat`, `qa-heartbeat`, etc.) were migrated from the old built-in heartbeat dispatcher to the `run-workflow` handler in commits `1a15b827b` and `a24764603` (2026-04-19 ~18:14-18:19 UTC). This migration is literally within the last few hours.

### Why May/QA Show 0%
- The old heartbeat mechanism created sessions with `kind: "job"`, `source: null` and **no workflowRunId** — it didn't create workflow run records at all.
- The new `run-workflow` handler properly: (1) creates a workflow run with `runId`, (2) passes `workflowRunId: runId` to `callAgent()`, (3) stores it in `meta.json` → synced to DB by session-sync.
- **Proof it works**: Scout's sessions after migration DO have workflowRunId (`wr_1776624029685_8iwk`). This optimizer session has `wr_1776624114562_edwp`.
- May's last heartbeat session (`s_1776622204023_341`) was created 244 seconds BEFORE the migration commit — it used the old mechanism.
- May's next heartbeat simply hasn't fired yet since the migration.

### The 18,987 Historical Sessions
There are ~18,987 old heartbeat sessions (`task LIKE '%heartbeat%', kind='job', source IS NULL`) with no workflowRunId. These will never get backfilled unless we do it manually.

## Evidence

```
Last 24h sessions by agent:
agent      | total | withWf
evaluator  | 427   | 0      (pure JS handler, no workflow)
optimizer  | 201   | 143    ✓ working
bob        | 136   | 93     ✓ working  
coach      | 135   | 49     ✓ working
tech-lead  | 94    | 39     ✓ working
may        | 79    | 0      ✗ not yet fired post-migration
scout      | 59    | 16     ✓ working
qa         | 40    | 0      ✗ not yet fired post-migration
```

## Recommendations

### R1: Backfill workflowRunId for recent May/QA heartbeat sessions (DO NOW)

**Files**: No file changes — DB update only  
**Change**: Run a SQL UPDATE to set `workflowRunId` on old heartbeat sessions based on matching them to workflow run records by timestamp/parentSessionId. For sessions that have NO workflow run record (old mechanism), create synthetic workflowRunId values so coverage metrics work.

**Concrete SQL**:
```sql
-- Set synthetic workflowRunId for old heartbeat sessions that went through the old mechanism
UPDATE sessions 
SET workflowRunId = 'wr_legacy_' || sessionId
WHERE workflowRunId IS NULL 
  AND task LIKE '%[heartbeat]%' 
  AND kind = 'job' 
  AND source IS NULL
  AND startedAt > (strftime('%s','now') * 1000 - 7*24*3600*1000);
```

**Impact**: Workflow coverage for May/QA jumps from 0% to reflect actual heartbeat activity. Only backfills last 7 days to keep scope reasonable.

**Risk**: Low — synthetic IDs won't collide with real `wr_` IDs and are clearly marked as legacy.

### R2: Wait and verify post-migration sessions get workflowRunId (MONITOR)

**Files**: None  
**Change**: After 1-2 heartbeat cycles (~30-60 min), verify that new May/QA sessions created through `run-workflow` handler have proper workflowRunId.  
**Impact**: Confirms the migration is working. If new sessions still show NULL, there's a deeper issue.

### R3: Add workflowRunId to the cron session itself (OPTIONAL)

**Files**: `agents/may/handlers/run-workflow.ts`  
**Change**: The `cron_` session that triggers the workflow doesn't get workflowRunId. After generating `runId`, update the cron session's meta.json to include it:
```typescript
// After: const runId = generateRunId();
// Add: write workflowRunId back to the cron session
const cronMetaPath = join(ctx.projectRoot, '.state', 'sessions', entry.name, 'meta.json');
// ... update meta with workflowRunId: runId
```
**Impact**: The cron tracker session itself would link to its workflow run. Minor — most queries focus on the agent sessions, not cron sessions.

## Conclusion

This is primarily a **timing issue from a very recent migration**, not a code bug. The `run-workflow` handler correctly sets workflowRunId on child sessions. R1 (backfill) provides immediate metric improvement. R2 (monitor) confirms ongoing correctness. No urgent code fix needed.
