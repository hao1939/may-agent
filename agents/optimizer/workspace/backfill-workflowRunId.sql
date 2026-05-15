-- Backfill: Set synthetic workflowRunId for old heartbeat sessions (pre-migration)
-- These sessions were created by the old heartbeat dispatcher which didn't create workflow runs.
-- Executed: 2026-04-19 by optimizer
-- Affected: 3,210 rows (last 7 days of heartbeat sessions without workflowRunId)
--
-- The synthetic IDs use 'wr_legacy_' prefix to distinguish from real workflow run IDs.

UPDATE sessions 
SET workflowRunId = 'wr_legacy_' || sessionId
WHERE workflowRunId IS NULL 
  AND task LIKE '%[heartbeat]%' 
  AND kind = 'job' 
  AND source IS NULL
  AND startedAt > (strftime('%s','now') * 1000 - 7*24*3600*1000);
