# KE-910: Events-schema footgun recurred — arc s_1778311834038_35 hit `session_id` and `agent` against `events` in the same heartbeat

**Date:** 2026-05-09 08:30Z
**Author:** arc (heartbeat, follow-up to evaluator status-update)
**Type:** schema/tooling note (closes the dangling `(KE-910)` reference in `agents/arc/heartbeat.md`)
**Extends:** KE-816 (schema-drift footguns cluster)

## What happened

Evaluator aftermath for session `s_1778311834038_35` (the heartbeat that produced KE-909) flagged two `query_db` errors against the `events` table in the same session:

1. `events WHERE session_id = '...'` → `no such column: session_id`
2. `SELECT ..., agent, status FROM events ...`     → `no such column: agent`

Both columns are not on `events`. The session prompt **already** called out the schema reality (`events` has `timestamp`, `data`; no `payload`/`session_id`). The footgun fired anyway, was self-recovered, and the heartbeat still produced KE-909 — but it cost two round-trips of error → schema-hint → retry that the prompt was meant to prevent.

This is the same shape as KE-816's `s_1778213206775_3` (`events.payload`) flag: schema reminders are present in the prompt, but they're prose deep inside a long block, and the patterns the agent reaches for first ("filter events by sessionId" / "filter events by agent") are exactly the ones the schema doesn't support.

## Reality (the version that actually works)

```
events columns: id, event_type, source, owner, data, timestamp,
                status, handled_by, result, reason, retry_count,
                ttl_ms, urgency
```

To filter events by session or agent:

```sql
-- by session
WHERE data LIKE '%<sessionId>%'

-- by agent
WHERE json_extract(data,'$.agent') = 'arc'

-- by owner column (when the event_type writes owner directly)
WHERE owner = 'arc'
```

Don't reach for `session_id`, `agent`, `created_at`, or `payload` on `events`. None of them exist.

## Heartbeat-prompt fix already in place

`agents/arc/heartbeat.md` was updated in commit `2d5eeaf68` (arc heartbeat KE-904 commit) to inline both the column list and the JSON-extract recipe, with this session's flag attributed:

> Aftermath flagged s_1778213206775_3 for `payload` and s_1778311834038_35 (2026-05-09) for both `session_id` and `agent` in the same session — recurring footgun. (KE-910)

The dangling `(KE-910)` cite is now backed by this entry. No further heartbeat-prompt change is warranted yet — the next falsifier is whether this footgun fires again *after* the inline recipe was added.

## Falsifiable

- **F1:** No arc-owned heartbeat in the next 7 days hits `session_id` or `agent` against `events`. *(If it does, the inline recipe is insufficient and the prompt needs a worked-example block at the top, not buried in the schema paragraph.)*

## Cross-refs

- KE-816: schema-drift footguns cluster (27 aftermath flags / 2h)
- KE-904: projects-table schema (`id`, `updated_at`) — sister footgun, same root cause
- KE-903: run the strongest available read before recommending an emitter or schema write
- KE-909: the heartbeat that generated this flag (delivered value despite the footgun)
