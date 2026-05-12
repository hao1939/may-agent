# Proposal: Reconcile common-sense.md Conventions table with `query_db` doctrine

**For:** Hao / may
**From:** arc heartbeat 2026-05-09 ~11Z
**Urgency:** P2 — coherence cleanup; no current breakage but actively misleads new agents into the schema-footgun cluster
**See:** KE-917 (this proposal's evidence), KE-434 (predecessor doc-drift on same topic), KE-816 / KE-910 / KE-916 (the recurring schema footguns this fix would help suppress)

## Problem

`agents/shared/common-sense.md` contradicts itself. The Conventions
table (lines 79–80) tells agents to read `sessions` and `metrics` via
`bun:sqlite readonly`. The Database access section near the bottom
(lines 107–110) tells agents to use the `query_db` tool and explicitly
warns "do not guess DB paths and do not call `sqlite3`."

The bottom section is correct as of `2b267db20` (2026-05-07). The
table is residue from the KE-434 era when `query_db` had no runtime
implementation.

## Why it matters

`query_db` returns a `PRAGMA table_info(<table>)` schema hint when a
query references a non-existent column. That single affordance is the
durable fix for the recurring "wrong column name" cluster:

- KE-816 footgun cluster: `payload`, `id` on sessions, `lastUpdated`,
  `value`, `config` table, `projectId`, `updatedAt`
- KE-910: `session_id`, `agent` columns on events (recurred 2026-05-09)
- KE-916: `stopReason` column on sessions (recurred 2026-05-09)

Every one of those is a query that `query_db` would have rejected
with the right column list inline. `bun:sqlite` returns the same
SQLite error but no schema affordance — agents then guess again.

## Proposed change (3-line edit to common-sense.md)

Replace lines 79–80 of `agents/shared/common-sense.md`:

```diff
-| Metrics  | `metrics` table (read via bun:sqlite readonly) |
-| Sessions | `sessions` table (read via bun:sqlite readonly) |
+| Metrics  | `metrics`  table — use `query_db` (read-only). |
+| Sessions | `sessions` table — use `query_db`. PK is `sessionId`, not `id` (KE-816). |
+| Events   | `events`   table — use `query_db`. Filter by session/agent via `data LIKE` or `json_extract`, not `session_id`/`agent` columns (KE-910). |
```

Keep the Database access section (lines 107–110) as-is; it is already
canonical.

## Risk

None I can see. The change is doc-only, in a file every agent reads on
every session, and brings the top of the file into agreement with the
bottom. Worst case: agents who needed to chain JS logic across multiple
queries (the rare bun:sqlite use-case the heartbeat note preserves) are
unaffected because nothing in the table forbids it — they'd just read
the heartbeat note for that workflow.

## Out of scope

The 2026-05-01 proposal `2026-05-01-query-db-tool-cleanup.md` is now
partly stale (KE-434 closed, `query_db` is wired). It can be closed
without further action; this proposal supersedes its `common-sense.md`
ask.

— arc

---

**Update 2026-05-12 (arc heartbeat):** Still open, still unmerged.
Re-verified the contradiction is unchanged: `grep -n "bun:sqlite\|query_db" agents/shared/common-sense.md`
returns lines 79–80 (table) and 108–110 (Database access). A near-duplicate
proposal almost shipped this heartbeat before discovery via work-queue
read; aborted per Memory-Curse / conformity-amplification discipline
(KE-1232 / KE-1234). The 2026-05-09 P1 above is the canonical ask; no
new artifact needed, only review/merge.
