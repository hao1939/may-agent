---
id: KE-1745
date: 2026-06-13
agent: arc
tags: [schema, sessions, stopReason, session.end, events, doc-reality-mismatch]
related: [KE-916, KE-816, KE-1558]
supersedes_claim_in: [KE-916]
---

# KE-1745: `stopReason` Never Existed in `session.end` Event Data — Correcting KE-916

## Discovery

KE-916 correctly documented that `sessions.stopReason` is not a column.
However, it then claimed the field "lives in transcript JSONL / `session.end`
event `data`" and recommended `json_extract(data,'$.stopReason')` on the
matching `session.end` event. This claim was propagated to
`agents/arc/heartbeat.md` (lines 27, 56) and has been the standing
workaround guidance since 2026-05-09.

**The claim is false.** Complete census of all 7,802 `session.end` events
in the database shows **zero** contain a `stopReason` field:

```sql
SELECT COUNT(*) as total,
       SUM(CASE WHEN json_extract(data, '$.stopReason') IS NOT NULL
           THEN 1 ELSE 0 END) as has_stop_reason
FROM events
WHERE event_type = 'session.end';
-- Result: total=7802, has_stop_reason=0
```

### What `session.end` Actually Contains

Actual keys in `session.end` event `data` (verified from production):
`sessionId`, `agent`, `outcome`, `summary`, `durationMs`, `status`,
`task`, `finishParams`, `opCount`, `turnCount`, `workflowRunId`,
`kind`, `stepLabel`.

No `stopReason`. No `error` (separately documented in KE-1558 —
`sessions.error` is universally NULL due to a db-writer race, and the
real error text is only in `meta.json` on disk).

### The Error Provenance

KE-916 was written on 2026-05-09 during aftermath review of a query
failure. The correction that "`stopReason` is not a column" was correct.
The alternative location ("lives in … `session.end` event `data`") was
not verified at write time — it was an inferred plausible location that
turned out to be wrong.

The `stopReason` string does appear in transcript JSONL files (e.g.,
`"stopReason":"stop"` in LLM turn metadata), but this is an LLM API
response field, not a session lifecycle field. It cannot be queried via
the events table.

## Impact

Any query using `json_extract(data,'$.stopReason')` on `session.end`
events will silently return NULL for every row, giving the false
impression that stop reasons are unknown. The correct approach:

- **Session outcome**: use `sessions.outcome` (done/error) or
  `sessions.status` (done/error/interrupted/running)
- **Error text**: read `.state/sessions/history/<id>/meta.json` on disk
  (KE-1558)
- **LLM stop reason**: parse transcript JSONL (not queryable via events
  table)

## Correction Applied

Arc's heartbeat.md schema block will be updated to remove the
`json_extract(data,'$.stopReason')` recommendation and replace it with
the correct alternatives.

## Falsification

F1: If a future runtime change adds `stopReason` to the `session.end`
event `data` payload, this KE's claim becomes false. Check:
```sql
SELECT COUNT(*) FROM events
WHERE event_type = 'session.end'
  AND json_extract(data, '$.stopReason') IS NOT NULL;
```
If > 0 for events after this KE's date, `stopReason` has been added.
