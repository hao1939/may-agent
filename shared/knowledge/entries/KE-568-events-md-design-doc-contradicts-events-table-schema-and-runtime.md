# KE-568 — `agents/shared/may-agent-docs/events.md` contradicts the live `events` schema and runtime: it claims "no status column, no UPDATEs"; the schema has 7 mutable columns and 19 rows have been UPDATEd

<!-- metrics: doc-vs-runtime-drift, events-table-schema -->

**Date:** 2026-05-03 ~08:55Z
**Author:** arc (heartbeat)
**Status:** finding — design-doc drift, out of arc's lane to edit (events.md sits at `may-agent-docs/events.md`, not `may-agent-docs/design/events.md`); proposal filed.
**Confidence:** High — schema and row counts checked directly.
**Connects:** KE-455 (event-only handlers never fire), KE-468 (project.iteration two payload shapes), KE-453/483 (malformed event_type rows), `unified-events.md` operational-status appendix (the model events.md should follow).
**Severity:** medium (a doc that every event-author reads to decide whether to add status fields, retry, or write UPDATEs is teaching the wrong model).

## Claim

`agents/shared/may-agent-docs/events.md` opens with:

```
Event = something that happened at a point in time (immutable, append-only)
State = derived by querying events (no mutable status fields)
…
No `status` column. No `UPDATE` statements. State is computed from event pairs.
```

That is wrong as a description of what the runtime does today. The schema has six post-creation-mutable columns; nine thousand rows have a `status` value; nineteen rows have been `UPDATE`d to non-default statuses.

## Evidence

Live schema (queried 2026-05-03 08:55Z):

```sql
SELECT sql FROM sqlite_master WHERE type='table' AND name='events';
```

```sql
CREATE TABLE events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type      TEXT NOT NULL,
  source          TEXT,
  owner           TEXT,
  data            TEXT,
  timestamp       INTEGER NOT NULL,
  status          TEXT DEFAULT 'pending',
  handled_by      TEXT,
  result          TEXT,
  reason          TEXT,
  retry_count     INTEGER DEFAULT 0,
  ttl_ms          INTEGER,
  urgency         TEXT DEFAULT 'normal'
);
```

The `status` column is appended via ALTER (visible from the trailing `, status TEXT DEFAULT 'pending', …` in the stored DDL), so this is a post-migration extension — events.md was written against the original schema and never updated.

Row distributions (lifetime, n=9204):

```
status=pending    9185
status=handled      14   (agent.notification: 9, telegram.reply: 5)
status=dismissed     4   (telegram.reply: 4)
status=done          1   (agent.notification: 1)
```

So 19 rows have been UPDATEd from the default. The first such update is `id=10` on 2026-04-29 14:08Z; the most recent is `id=3437` on 2026-05-01 01:00Z. The mutation is concentrated on `agent.notification` and `telegram.reply` — exactly the two event types where the inbox/reply model needs an "I read this" hook.

Two unused mutable fields:

```
handled_by  — 0 rows non-null   (column reserved, not yet written by any handler)
retry_count — all 0             (column reserved, retry logic not yet implemented)
```

events.md "Inbox (time-window based)" section (lines ~37–48) further says agents see recent events with no ack/done needed and "Events naturally expire via TTL or time window. Agents act or they don't." But the production code path that handles `agent.notification` and `telegram.reply` does flip `status` to `handled`/`dismissed`/`done` — the doc and the code disagree.

## Why this is worse than a stale doc

events.md is the doc an agent reads before adding a new event type or a new consumer. Three concrete failure modes the current text encourages:

1. **"No status column" → don't write one.** A new consumer that needs ack/dedup re-invents a parallel mechanism (a sidecar table, a marker file, a payload field) instead of using the existing `status` + `handled_by` columns. We already have one of those: KE-455 handlers use the `events` table for nothing because they never fire; the documented "derived state from event pairs" model assumes the pair completes, which is exactly what KE-455 says is broken.

2. **"State derived by querying events" → don't UPDATE.** Two production code paths already UPDATE (telegram-reply ack, agent.notification handled), but neither is documented. A new author who follows events.md literally will not know the precedent and will not query `WHERE status='pending'` when scanning their inbox — which is the safer query, because it skips rows another consumer already handled.

3. **The existence of `handled_by` and `retry_count` columns implies an in-flight design** that neither events.md nor `unified-events.md` mentions. Without doc, the next author either re-adds the columns (schema conflict) or wires retry logic without checking that someone already started the design (split implementation).

## Mechanism (how the drift happened)

events.md was written when the schema matched the spec (origin design: pure append-only event log, state derived). Subsequently:

- `status`/`handled_by`/`result`/`reason`/`retry_count`/`ttl_ms`/`urgency` were added via ALTER (visible from DDL position).
- Two consumer paths started writing `status` updates for the inbox-style events.
- events.md was never updated.

`unified-events.md` (also a design doc, sibling to events.md) **does** carry an "Operational status (appendix, 2026-05-02 — added by arc)" section that bridges spec vs reality for the `SystemEvent` union and per-event-type emission counts. events.md needs the same treatment.

## Why this is in-scope for arc, not lane-violating

- The fix file (`may-agent-docs/events.md`) sits **outside** arc's edit lane (`design/` is in-lane; the parent `may-agent-docs/` directory is not). Per KE-450/KE-451, an arc edit there is silently stashed.
- This KE itself is in-lane (`shared/knowledge/entries/`).
- The proposal that asks a lane-holder to land the events.md fix sits in `agents/arc/workspace/proposals/` — also in-lane.
- The proposal is filed at `agents/arc/workspace/proposals/2026-05-03-events-md-runtime-reality-appendix.md`.

## Falsifier

If a `git log` of `agents/shared/may-agent-docs/events.md` shows a commit since 2026-04-29 that adds a status/handled_by/retry section, this KE is wrong about "never updated." (Checked 08:55Z 2026-05-03: last commit predates the schema-extension period.)

If `SELECT COUNT(*) FROM events WHERE status != 'pending'` returns 0 next time the DB is sampled, the runtime is no longer mutating rows and the doc would coincidentally become correct again. (Currently 19; the count has been monotone-rising.)

## Recommended actions

1. **Owner: tech-lead or May.** Land an "Operational status" appendix on events.md mirroring the one in `unified-events.md`. Spec section can stay as-is (aspirational); appendix names what the runtime does and which columns are reserved-but-unwritten. Proposal: `agents/arc/workspace/proposals/2026-05-03-events-md-runtime-reality-appendix.md`.
2. **Owner: arc (self).** When the next system-coherence audit picks `may-agent-docs/`, also check `metrics.md`, `sessions.md`, `runtime.md`, `cron.md`, `agents.md` — the `unified-events.md` appendix pattern likely applies to several. (Tracked via this KE's recommendation, no separate proposal yet — pick one per heartbeat.)
3. **Author convention** (for the proposal text): treat `unified-events.md` as the model. A spec section that disagrees with runtime is allowed only if an appendix names the disagreement explicitly.

## Lesson

Two design docs on the same subject (`events.md` and `unified-events.md`) drifted apart because only one got an operational-reality appendix. The "spec doc + appendix that names today's reality" pattern is cheap; without it, the older doc silently becomes wrong while the newer doc looks current. **When you fix one design doc to reflect runtime, scan its siblings** — staleness usually arrives in clusters.

## Related

- `agents/shared/may-agent-docs/design/unified-events.md` (sibling, has the appendix)
- KE-455 — event-only handlers never fire (the "derived state from event pairs" assumption breaks here)
- KE-468 — project.iteration payload shapes (another emitter-vs-spec drift)
- KE-453, KE-483 — malformed event_type rows (another DB-vs-spec gap)
- KE-450, KE-451 — arc edit-lane stash mechanism (why this is a proposal, not a direct edit)
