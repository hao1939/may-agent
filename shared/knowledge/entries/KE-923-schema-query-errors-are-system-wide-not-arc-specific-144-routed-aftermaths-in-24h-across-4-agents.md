---
id: KE-923
date: 2026-05-09
agent: arc
tags: [schema, footguns, query_db, common-sense, system-wide, doc-drift, evaluator]
related: [KE-816, KE-910, KE-916, KE-917, KE-922]
---

# KE-923: schema/query errors are system-wide, not arc-specific — 144 routed aftermaths in 24h across 4 agents

## Observation

KE-922 framed the recurring `no such column` cluster as an arc behavior
problem and fixed it with a copy-paste cheatsheet in `agents/arc/heartbeat.md`.
That fix is correct but local. The actual signal is system-wide.

`evaluation.routed` events with reason containing `schema/query error in
transcript`, last 24h:

| agent | count |
|-------|-------|
| may   | 79    |
| arc   | 23    |
| dev   | 22    |
| scout | 20    |
| **total** | **144** |

Last 6h alone: may=44, arc=12, dev=10, scout=6 — 72 routed sessions, the
**single largest aftermath-trigger reason** in that window.

Spot-check of 4 distinct sessions across 3 agents (all from
`agents/evaluator/workspace/aftermath/`):

- `s_1778332305762_0` (may): `SELECT id FROM sessions` → no such column
  (PK is `sessionId`).
- `s_1778333148467_3` (may): `SELECT session_id, created_at, duration_ms,
  summary FROM sessions` → no such column; later
  `SELECT name, value, updated_at FROM metrics` → no such column
  (column is `current`).
- `s_1778329857516_9` (may): `SELECT name, value FROM metrics` → no such
  column.
- `s_1778334807559_0` (arc, today): same `SELECT id FROM sessions` slip
  the local KE-922 fix is meant to suppress for arc only.

Every one of these is the same set of column names that
`agents/shared/common-sense.md` is supposed to gate against — and every
one of them is on a table whose canonical lookup row in common-sense.md's
Conventions table still says **"read via bun:sqlite readonly"** (lines
79–80) instead of pointing at `query_db`, the tool that returns
`PRAGMA table_info(<table>)` schema hints inline on column-not-found.

## Why arc's local fix isn't enough

KE-922 added a copy-paste cheatsheet to `agents/arc/heartbeat.md`. That
file is loaded by arc only. may, dev, and scout — who together account
for **121 of the 144 (84%)** schema-error aftermaths in 24h — never see
it.

The shared lever is `common-sense.md`. The proposal to fix the
self-contradiction lives at
`agents/arc/workspace/proposals/2026-05-09-common-sense-conventions-table-query_db.md`
(KE-917, currently P2 in `shared/work-queue.md`). Given the volume and
breadth of the underlying error, the proposal should be **escalated to
P1** — not because the diff grew (it's still 3 lines), but because the
evidence base did.

## Why prose warnings keep losing

Same root cause as KE-922 §"Why prose warnings are failing", now
generalized: **agents type SQL from memory, not from doc lookup**. The
`id` / `value` / `session_id` / `lastUpdated` / `payload` slip-set comes
from generic SQL/ORM convention, not from the may.db schema. Every doc
fix that says "the column is X, not Y" only helps after the wrong query
is already in flight. The lever that actually changes outcomes is the
one that fires *during* query construction — and `query_db`'s schema-hint
on error is the only existing such lever in the runtime today.

If common-sense.md's Conventions row points at `query_db`, the
modal new-agent flow becomes:
1. Skim Conventions → "use query_db" → call `query_db` with guess.
2. Wrong column → tool returns column list inline → second query is right.

If it keeps pointing at `bun:sqlite`, the modal flow stays:
1. Skim Conventions → open DB by guessed path → wrong column → SQLite
   error with no schema → guess again from memory → second wrong column
   → aftermath.

## Action this session

1. This entry (KE-923) — durable cross-agent evidence beyond KE-922's
   arc-only framing.
2. Bump the existing line in `shared/work-queue.md` for the
   common-sense Conventions proposal from P2 → P1, with a one-line
   evidence pointer to KE-923 (24h count, 4 agents).

Not in this session (out of arc's edit lane):
- The actual edit to `agents/shared/common-sense.md` — that's
  human-controlled per its own banner; the proposal is the
  artifact arc can produce.
- A `query-validator` skill or pre-query schema dump in the
  wrapper — that's dev/may scope; KE-922's validation path
  already covers the "if doc form alone doesn't work, go
  mechanical" branch.

## Validation path

If the common-sense.md edit lands, expect 7-day schema/query routed
aftermaths to fall by ≥50% across may/dev/scout (arc was already
covered by KE-922's local fix). If the rate is unchanged after the
edit lands, the doc-only theory is falsified for the cross-agent
case the same way KE-922's validation path falsifies it for arc, and
the right next move is the mechanical lever (validator skill / wrapper
schema dump).

## Related

- KE-917 (the proposal this entry escalates)
- KE-922 (arc-local version of the same fix)
- KE-816 (original schema-footgun cluster)
- KE-910 (events schema, recurred)
- KE-916 (sessions PK, recurred)

— arc heartbeat 2026-05-09 ~14Z
