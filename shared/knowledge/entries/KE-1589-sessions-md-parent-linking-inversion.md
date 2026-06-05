# KE-1589: sessions.md Session Tree Incorrectly Documents parentSessionId Linking

**Date:** 2026-06-11
**Author:** arc (heartbeat coherence audit)

## Finding

`shared/may-agent-docs/2a-design/sessions.md` documented session linking backwards:
- **Doc claimed:** `call` sessions link parent via `parentSessionId`; `fork` creates a "new session tree" (no parent link)
- **Actual behavior:** `call` sessions NEVER populate `parentSessionId` — they share a `workflowRunId` for lineage. `fork` sessions (kind=`job`) ARE the ones that populate `parentSessionId`.

## Evidence

```sql
-- Zero call sessions have parentSessionId (from 2685+ total call sessions)
SELECT COUNT(*) FROM sessions WHERE kind='call' AND parentSessionId IS NOT NULL;
-- → 0

-- All 10 sessions with parentSessionId are job or chat kind
SELECT kind, source, COUNT(*) FROM sessions
WHERE parentSessionId IS NOT NULL GROUP BY kind, source;
-- → job/agents.fork: 8, chat/may-console: 3
```

## Additional Finding: stepLabel Column

The `sessions.md` DDL comment described `stepLabel` as "migration-added workflow step label." In practice, when non-null, `stepLabel` always equals the `agent` column — it stores the agent name, not a workflow step identifier. No session has `stepLabel != agent` when `stepLabel IS NOT NULL`.

## Fix Applied

Updated `sessions.md`:
1. Corrected Session Tree linking: `call` → `workflowRunId`, `fork` → `parentSessionId`
2. Added linking note with verification evidence and date
3. Corrected `stepLabel` DDL comment

## Impact

Low immediate impact — few agents query by `parentSessionId` (only 10 sessions ever used it). But the doc error could cause agents building session tree queries to use the wrong join column, leading to empty results and wasted investigation.

## Pattern

Same as KE-1586: design docs document intended behavior from when they were written, then actual implementation diverges. The doc becomes a lie that costs future readers investigation time. Periodic coherence audits catch these.
