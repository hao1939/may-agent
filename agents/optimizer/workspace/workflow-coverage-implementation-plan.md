# Workflow Coverage: Implementation Plan to Reach 80%

**Date**: 2026-04-20  
**Status**: Actionable — requires code changes to session creation infrastructure

## Problem Statement

Real session-level workflow coverage is **19.9%** (1165/5869 sessions have `workflowRunId`). The 80% target requires ~4695 sessions to have workflow attribution. The gap is NOT in cron configuration (most LLM cron entries already use `run-workflow` handler) — it's in **child session propagation**.

## Root Cause Analysis

### Where sessions come from (by source)
1. **Cron → run-workflow handler** → Creates workflow run, child sessions via `ctx.manager.callAgent()` get `workflowRunId` ✅
2. **Cron → run-agent-task handler** → Sets `workflowRunId` on the wrapper session ✅ 
3. **LLM agent calls `agents.fork`/`agents.call`** → Child sessions do NOT inherit parent's `workflowRunId` ❌
4. **Cron → JS-only handlers** (watchdog, system-status, proof-of-life) → No LLM sessions, not counted

### The critical gap: Category 3

When a heartbeat workflow runs agent X, and agent X calls `agents.fork(agent Y, task)`, the forked session for agent Y has **no `workflowRunId`**. This is the vast majority of actual work sessions — heartbeats dispatch work, and that dispatched work creates the bulk of sessions.

## Implementation Plan

### Fix 1: Propagate workflowRunId to forked/called child sessions (HIGH IMPACT)

**File to modify**: The MCP tool handler for `agents` tool (fork/call actions). When a session has a `workflowRunId`, any child session it creates should inherit that `workflowRunId`.

**Pseudocode**:
```typescript
// In the agents tool handler for fork/call:
if (currentSession.workflowRunId) {
  childSessionOptions.workflowRunId = currentSession.workflowRunId;
}
```

**Expected impact**: This single change would cascade `workflowRunId` through the entire session tree rooted at a workflow run. Since most sessions originate from heartbeat workflows, this should push coverage from ~20% to 60-70%.

### Fix 2: Ensure evaluator-heartbeat sets workflowRunId on child sessions

**File**: `/app/agents/may/handlers/evaluator-heartbeat.ts` (line ~157)  
**Status**: Already sets `workflowRunId` ✅ — but verify child sessions from evaluator's `agents.fork` calls also get it.

### Fix 3: Track workflow lineage in session-sync

**File**: `/app/agents/may/handlers/session-sync.ts`  
**Current**: Stores `workflowRunId` from session metadata  
**Needed**: Also look up parent session's `workflowRunId` when the child doesn't have one explicitly set.

```typescript
// In session-sync, when syncing a session:
if (!meta.workflowRunId && meta.parentSessionId) {
  // Look up parent's workflowRunId
  const parent = db.prepare('SELECT workflowRunId FROM sessions WHERE id = ?').get(meta.parentSessionId);
  if (parent?.workflowRunId) {
    meta.workflowRunId = parent.workflowRunId;
  }
}
```

**Expected impact**: Retroactively fixes sessions that were created without propagation. Combined with Fix 1, should reach 80%+.

### Fix 4 (Stretch): SQL backfill for historical sessions

```sql
-- Propagate workflowRunId from parent to child sessions
UPDATE sessions SET workflowRunId = (
  SELECT p.workflowRunId FROM sessions p WHERE p.id = sessions.parentSessionId
)
WHERE workflowRunId IS NULL 
  AND parentSessionId IS NOT NULL
  AND EXISTS (SELECT 1 FROM sessions p WHERE p.id = sessions.parentSessionId AND p.workflowRunId IS NOT NULL);
```

Run this recursively (multiple passes) to propagate through deep session trees.

## Priority Order

1. **Fix 1** (propagate in fork/call) — highest impact, single code change
2. **Fix 3** (session-sync fallback) — catches anything Fix 1 misses
3. **Fix 4** (SQL backfill) — fixes historical data for accurate measurement
4. **Fix 2** (verify evaluator) — likely already working

## Verification

After implementing, run:
```sql
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN workflowRunId IS NOT NULL THEN 1 ELSE 0 END) as with_wf,
  ROUND(100.0 * SUM(CASE WHEN workflowRunId IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*), 1) as pct
FROM sessions 
WHERE createdAt > datetime('now', '-24 hours');
```

Target: ≥80%.

## Key Insight

The cron configuration is already correct — 8 of 8 LLM-agent heartbeats use `run-workflow`. The problem is purely that **child sessions don't inherit `workflowRunId` from their parent**. This is an infrastructure bug, not a workflow adoption problem.
