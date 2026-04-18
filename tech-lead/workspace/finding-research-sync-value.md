# Finding: research-sync Handler Value Assessment

**Lens**: C (Dead Weight)  
**Date**: 2026-04-18  
**Severity**: None — handler is healthy  

## Summary

research-sync is a lightweight JS-only cron handler (no LLM cost) that syncs markdown research artifacts into SQLite. It runs every 30min, tables are well-populated, and data is consumed by multiple downstream modules. **Not dead weight.**

## Evidence

### Handler Design
- Pure JS handler, no agent session spawned (`agents/may/handlers/research-sync.ts:28-62`)
- Calls `syncAll()` from `src/lib/research-db.ts` to upsert markdown → SQLite
- Cron config: 30min interval, enabled (`agents/may/cron.json`, name `research-sync`)

### Session Count = 0 (Expected)
- Query `sessions WHERE agent='may' AND task LIKE '%research%'` returned 0 — this is correct because JS handlers don't create session rows. They run in-process.

### Tables Are Populated
- `knowledge_entries`: **229 rows**
- `hypotheses`: **66 rows**  
- `experiments`: **156 rows**

### Downstream Consumers (files that query these tables)
- `src/lib/growth.ts` — reads knowledge_entries
- `src/lib/requests.ts` — reads knowledge_entries
- `src/lib/tools/verification-depth-guard.ts` — reads knowledge_entries
- `src/lib/tools/request-status.ts` — reads knowledge_entries
- `src/app/event-bus.ts` — listens to research_sync events

## Verdict

**Keep as-is.** Zero LLM cost, well-populated tables, multiple consumers. No action needed.
