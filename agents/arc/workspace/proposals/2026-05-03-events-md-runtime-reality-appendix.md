# Proposal: add "Operational status (appendix)" to `agents/shared/may-agent-docs/events.md` mirroring the one already in `unified-events.md`

**Date:** 2026-05-03
**Author:** arc
**Connects:** KE-568 (this proposal's rationale), KE-455, KE-468, `unified-events.md` operational-status appendix (the existing pattern this proposal generalizes).
**Lane:** `agents/shared/may-agent-docs/events.md` — outside arc's edit lane. Asking a lane-holder (May or tech-lead) to land it.

## Problem

`events.md` documents the events table as pure append-only ("no status column, no UPDATE statements"). The live schema has seven post-original-design columns (`status, handled_by, result, reason, retry_count, ttl_ms, urgency`) and 19 rows have been UPDATEd to non-default `status`. The doc is the one new-event-author reading material, so it is shaping new code against a model the runtime no longer follows. Full evidence in KE-568.

## Evidence

- Schema: `SELECT sql FROM sqlite_master WHERE name='events'` — see KE-568 §Evidence.
- Row distribution: `pending=9185, handled=14, dismissed=4, done=1` (n=9204).
- Two consumer paths flip status (`agent.notification` → `handled`/`done`, `telegram.reply` → `handled`/`dismissed`); both paths predate the doc's last edit and are not mentioned in it.
- `unified-events.md` already carries an "Operational status (appendix, 2026-05-02 — added by arc)" doing exactly what this proposal asks for events.md.

## Proposed Change

Append the section below to `agents/shared/may-agent-docs/events.md` (after the "Implementation" section). Do NOT rewrite the spec — keep it as the aspirational target.

```markdown
---

## Operational status (appendix, 2026-05-03 — added by arc per KE-568)

This section names the gap between the spec above and what the runtime
does today. Where they disagree, the runtime is current; the spec is
the design we are converging toward. Keep this table in sync when
wiring changes.

### Schema reality (live `events` DDL, queried 2026-05-03)

The original spec in §Schema is correct as a starting point but
incomplete. The live schema has been extended via ALTER:

```sql
CREATE TABLE events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type      TEXT NOT NULL,
  source          TEXT,
  owner           TEXT,
  data            TEXT,
  timestamp       INTEGER NOT NULL,
  -- Added post-spec:
  status          TEXT DEFAULT 'pending',  -- mutated by inbox consumers
  handled_by      TEXT,                    -- reserved, no writer yet
  result          TEXT,                    -- reserved, no writer yet
  reason          TEXT,                    -- reserved, no writer yet
  retry_count     INTEGER DEFAULT 0,       -- reserved, retry not implemented
  ttl_ms          INTEGER,                 -- read by inbox query (spec)
  urgency         TEXT DEFAULT 'normal'    -- read by inbox ORDER BY (spec)
);
```

### UPDATE reality

`UPDATE events SET status = …` is performed by two production code paths:

- `agent.notification` consumers flip `status='pending' → 'handled' | 'done'` after the owner reads the inbox row.
- `telegram.reply` consumers flip `status='pending' → 'handled' | 'dismissed'` after the reply is processed.

Lifetime distribution (queried 2026-05-03 08:55Z, n=9204):

| `status`   | rows | event types |
|------------|------|-------------|
| `pending`  | 9185 | all types (default) |
| `handled`  |   14 | `agent.notification` (9), `telegram.reply` (5) |
| `dismissed`|    4 | `telegram.reply` |
| `done`     |    1 | `agent.notification` |

So the spec's "no UPDATE statements" rule is **not** enforced; new
inbox-style consumers should follow the precedent and flip `status`,
not invent a parallel mechanism.

### Reserved-but-unwritten columns

`handled_by`, `result`, `reason`, `retry_count` are present in the
schema but no code path currently writes them. Treat them as reserved
for future use (likely retry/dead-letter wiring per KE-455). **Do not
re-add them in a different place** — extend the existing columns.

### Inbox-query authoring rule

If you are scanning your inbox, prefer:

```sql
SELECT id, event_type, data, urgency, timestamp
FROM events
WHERE owner = ?
  AND status = 'pending'                  -- skip rows another consumer handled
  AND timestamp > ?                       -- now - 2h
  AND (ttl_ms IS NULL OR timestamp + ttl_ms > ?)
ORDER BY CASE WHEN urgency = 'immediate' THEN 0 ELSE 1 END,
         timestamp DESC
LIMIT 20;
```

After you handle a row, UPDATE its `status` to `handled` (or
`dismissed` / `done`). The spec in §Inbox is silent on this; in
practice it is required for dedup across consumers.

### Drift this appendix names (link to KEs)

- KE-568 — this appendix exists because `events.md` opened with "no
  status column, no UPDATE statements" while the runtime had both.
- KE-455 — every event-only `on:` handler in `cron.json` has fired
  zero times; the "derived state from event pairs" model assumes the
  pair completes, which is what KE-455 says is broken.
- KE-468 — `project.iteration` events are emitted with two
  incompatible payload shapes; aggregating by `projectId` undercounts.
  Until §Event Types names a single shape and the emitters converge,
  query-by-projectId callers must handle both.
- KE-453, KE-483 — there are 24 lifetime rows whose `event_type` is a
  JSON-stringified object (e.g. `{"type":"heartbeat.trigger",…}`).
  These are a leak from a custom-workflow registration path; treat
  any `event_type LIKE '{%'` row as a malformed restart fingerprint,
  not a real event.

### When extending this design

Before adding a new event type, column, or consumer:

1. Confirm the runtime emits/consumes what you expect (query the
   `events` table for ≥1 matching row in the last 7 days).
2. If you need ack/dedup semantics, use the existing `status` column;
   do not invent a parallel marker.
3. If you need retry semantics, plan to wire `handled_by`/`retry_count`
   rather than adding new columns.
4. Update this appendix when the wiring changes — the spec section
   stays aspirational; the appendix is the live truth.
```

## Expected Impact

- New event-authors see the live schema and current UPDATE precedent before designing parallel mechanisms.
- The "reserved-but-unwritten" callout prevents schema collisions for the same retry/dead-letter design.
- Pairs with `unified-events.md`'s appendix so a reader of either doc sees the same truth.
- Cheap: one append, no rewrite, no code change.

## Risks

- **Risk:** Spec section becomes ignored because readers jump to the appendix. **Mitigation:** Same risk applies to `unified-events.md`; experience there suggests the spec is still useful as the design target. The appendix points back: "the runtime is current; the spec is what we are converging toward."
- **Risk:** Appendix goes stale next time the schema or runtime changes. **Mitigation:** Add the "When extending this design" rule that requires updating the appendix on wiring changes — same convention as `unified-events.md`. arc heartbeats already audit these docs (this proposal is the audit firing); regression will be caught on the next pass.
- **Risk:** `result`/`reason` columns turn out to be already-written by a code path I missed. **Mitigation:** I queried `WHERE handled_by IS NOT NULL` and `WHERE retry_count != 0` and got 0 rows for both; same expected for `result`/`reason`. If a lane-holder spots a writer I missed, edit the appendix at landing time — it is descriptive, not normative.

## Out of scope (follow-ups, not this proposal)

- Decide whether to actually wire `handled_by` / `retry_count` (separate design proposal).
- Decide whether to formalize the inbox-status protocol as part of the spec section (separate proposal — would require deciding on the canonical state-transition table).
- Audit sibling docs (`metrics.md`, `sessions.md`, `runtime.md`, `cron.md`, `agents.md`) for the same drift pattern (arc owns this; will pick one per heartbeat).

## How to land

```
git -C /app/agents add shared/may-agent-docs/events.md
git -C /app/agents commit -m "may-agent-docs/events: add operational-status appendix per KE-568 (status column, UPDATE precedent, reserved columns)"
```

The text above is structured so a `>>` append at end of file is the only edit needed; no existing content needs to change.
