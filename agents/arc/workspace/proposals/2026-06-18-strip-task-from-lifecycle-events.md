# Proposal: Strip task text from session lifecycle event data payloads

**Author:** arc
**Date:** 2026-06-18
**Priority:** P1
**Status:** proposed

## Problem

Session lifecycle events (`session.start`, `session.end`, `session.completed`) embed the full session task text in their `data` JSON payload. This duplicates `sessions.task` (the primary storage) and creates **610 MB** of event data, of which **~500 MB** is redundant task text.

Current state (KE-2035 census, 16:30Z Jun 18):

| Event Type | Pending | Avg Data (bytes) | Pending Data (MB) |
|-----------|--------:|------------------:|------------------:|
| session.end | 15,708 | 16,601 | 248.7 |
| session.start | 16,735 | 13,692 | 218.5 |
| session.completed | 9,719 | 15,488 | 143.6 |
| **Total** | **42,162** | — | **610.8** |

95.4% of these events are never handled (status=pending → purged at 7d). The task text in their data is never read.

The DB is at 1647 MB / 2000 MB threshold. At pre-cliff throughput (~100 sessions/hr), breach timeline is ~12h. This fix would reclaim ~500 MB — the single largest optimization lever available.

## Proposed change

At each emit site for `session.start`, `session.end`, and `session.completed`, omit the `task` field from the event data payload. Any handler that needs the task text can look it up from `sessions.task` using the `sessionId` that is always present in the event.

### Before

```typescript
emit("session.start", {
  sessionId,
  agent,
  task,        // full prompt text, 4-17 KB
  source,
  kind,
  // ...
});
```

### After

```typescript
emit("session.start", {
  sessionId,
  agent,
  // task OMITTED — available via sessions.task
  source,
  kind,
  // ...
});
```

Apply the same change to `session.end` and `session.completed` emit sites.

## Impact

- **Immediate**: ~500 MB savings on next VACUUM (after 7d retention purges events emitted with old format)
- **Ongoing**: ~70 MB/day less data written at pre-cliff throughput (~3000 lifecycle events/day × ~16 KB task avg ÷ 3 events per session × ~15 KB redundant per event)
- **Breach timeline**: extends from ~12h to ~50h+ at full throughput

## Risk

**Low.** Pre-implementation verification required:

1. **Check cron.json**: confirm no handler subscribes to `session.start`, `session.end`, or `session.completed` with `task` field access.
2. **Check event consumers**: search codebase for `json_extract(data, '$.task')` on these event types.
3. **Check feedback-echo.ts**: this handler processes session events — verify it uses `sessions.task` not `event.data.task`.

If any consumer reads `task` from event data, either migrate it to query `sessions.task` by sessionId, or keep task for that specific event type and strip from the others.

## Validation

After deployment:
1. New lifecycle events should have `LENGTH(data)` < 2 KB (vs current 13-17 KB)
2. After 7 days (old events purged) + VACUUM: DB should drop by ~500 MB
3. No handler errors referencing missing `task` field
4. `infra.persist.db-size-mb` should stabilize well below threshold

## Related proposals

- **NULL task for step > 1 in session_digests** (already proposed P1 in work queue): saves ~100 MB from digests
- Combined with this proposal: ~600 MB total reduction, bringing DB to ~1050 MB (well below 2000 MB threshold)

## Location

Changes in `src/` — requires Hao approval per ORDER-010. Likely in:
- `src/sessions/manager.ts` or wherever `session.start` is emitted
- `src/sessions/` wherever `session.end` and `session.completed` are emitted
