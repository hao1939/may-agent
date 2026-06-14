# Proposal: Add size-based event retention to db-retention.ts

**Author:** arc  
**Date:** 2026-06-14  
**Priority:** P1  
**Status:** implemented  

## Problem

DB size is 4.2GB (threshold: 2GB). The `workflow:platform-owner-review`
workflow is storing exponentially growing conversation context in event
`data` blobs — the last 6 sessions grew from 1.6MB to 220MB per event.
22 oversized events (>1MB each) consume 987.6MB (23% of the DB).

Row-count retention (7d for events) cannot address this because the
events are less than 1 hour old. The problem is row SIZE, not row AGE.

## Evidence

```
Events > 1MB:       22 total, 987.6 MB combined
Largest event:      220.4 MB (session.end, platform-owner-review)
Growth pattern:     1.6MB → 4.0MB → 10.5MB → 28.3MB → 78.0MB → 220.4MB
                    (~2.7x per session iteration)
DB total size:      4,227 MB (may.db)
DB threshold:       2,000 MB
```

## Proposed Change

Add one DELETE statement to `db-retention.ts` (may's handler):

```sql
DELETE FROM events WHERE LENGTH(data) > 1048576;
```

This deletes any event whose `data` blob exceeds 1MB. No legitimate
event needs >1MB of data — normal events average ~7KB.

**Why 1MB?** The average event data size is 6,978 bytes. The 99.99th
percentile of legitimate events is well under 100KB. A 1MB threshold
provides a 100x margin while catching the cascading blobs.

After the deletes, `VACUUM` would reclaim the space, but VACUUM requires
exclusive access. The existing retention handler doesn't vacuum. The
freed pages will be reused by new inserts, so even without VACUUM the
DB should stabilize.

## Alternatives Considered

1. **Truncate data on INSERT** (in db-writer.ts): Better long-term fix
   but requires `src/` changes (Hao approval per ORDER-010). This
   proposal can ship today.
2. **VACUUM after retention**: Would immediately reclaim ~1GB. But
   VACUUM locks the DB and may disrupt concurrent writers. Should be
   a separate decision.

## Risk

- Deleting oversized events loses audit trail for those specific sessions.
  But the sessions themselves (in `sessions` table + disk `meta.json`)
  are preserved — only the event bus copies are removed.
- If a legitimate event >1MB emerges in the future, the threshold can
  be raised. Current data shows no legitimate events anywhere near 1MB.

## Implementation

One block added to `db-retention.ts`, similar to existing retention
blocks:

```typescript
// Size-based retention: delete oversized event data blobs (KE-1986)
const oversizedResult = db.prepare(`
  DELETE FROM events WHERE LENGTH(data) > 1048576
`).run();
log(`[db-retention] Deleted ${oversizedResult.changes} oversized events (>1MB data)`);
```
