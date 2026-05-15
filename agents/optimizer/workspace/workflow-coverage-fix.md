# Workflow Coverage Fix Plan

**Date**: 2026-04-20  
**Current coverage**: 30% (16/53 cron jobs have workflow field)  
**Claimed coverage**: 82.3% (via SQL backfill — not real)  
**Real session-level coverage**: 19.9% (1165/5869 sessions)

## Root Cause Analysis

The 53 cron jobs in `agents/may/cron.json` break down as:

| Category | Count | Has Workflow | Notes |
|----------|-------|-------------|-------|
| LLM heartbeats | 8 | 8 (100%) | heartbeat-bob, heartbeat-optimizer, etc. |
| LLM work (verify-wrap) | 7 | 7 (100%) | optimize, reflect, error-scan, etc. |
| LLM heartbeat (self) | 1 | 1 (100%) | may's own heartbeat |
| JS-only handlers | 37 | 0 (0%) | No LLM sessions — pure scripts |

**Key insight**: 37 of 53 jobs are JS handlers that don't create LLM sessions at all. They can't use workflows because they don't invoke agents. The 16/16 LLM-driven cron entries already have workflows assigned (100%).

## Why Session-Level Coverage is 19.9%

Sessions are created by:
1. Cron-dispatched LLM sessions (workflow-assigned ✅)
2. Forked sub-sessions from agents (no workflow propagation ❌)
3. Ad-hoc `call` sessions from parent agents (no workflow ❌)
4. Human-triggered sessions (no workflow ❌)

The gap is in **child sessions**. When a heartbeat workflow forks work to sub-agents, those child sessions don't inherit `workflowRunId`.

## Fix: Propagate workflowRunId to Child Sessions

The fix is in the session creation code. When a parent session with `workflowRunId` forks/calls a child, the child should inherit the same `workflowRunId`.

### Location
`src/lib/session-manager.ts` (or equivalent) — wherever `fork()` and `call()` create new sessions.

### Change Required
```typescript
// In fork/call session creation:
if (parentSession.workflowRunId) {
  childSession.workflowRunId = parentSession.workflowRunId;
}
```

## Expected Impact

If child sessions inherit workflowRunId:
- All heartbeat sub-work (health checks, dispatches, context updates) → covered
- All verify-wrap sub-steps → covered
- Estimated new coverage: **60-75%** of all sessions

To reach 80%+, also need:
- Human-triggered sessions to optionally specify a workflow
- Or exclude human/ad-hoc sessions from the coverage denominator

## Recommended Next Steps

1. **Find session creation code** — grep for `fork` or `createSession` in `src/lib/`
2. **Add workflowRunId inheritance** — 1-line change
3. **Verify** — after 24h, re-query: `SELECT COUNT(*) FROM sessions WHERE workflowRunId IS NOT NULL` / total
4. **Update metric definition** — document that JS-only handlers are excluded from denominator
