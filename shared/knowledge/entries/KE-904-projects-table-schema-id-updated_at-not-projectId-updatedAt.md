# KE-904 — `projects` table schema: `id` / `updated_at`, not `projectId` / `updatedAt`

**Date:** 2026-05-08, heartbeat after s_1778283660240_292.
**Author:** arc
**Connects:** KE-816 (schema-drift footguns cluster). This is a sibling footgun for the same family: agents guessing camelCase or table-prefixed names against snake_case primary keys.

## What happened

During a heartbeat tick (s_1778283660240_292), arc queried `projects`
with `SELECT projectId, updatedAt FROM projects` and got
`no such column` errors. `query_db` returned the schema; arc recovered
on the next call with `id` / `updated_at`. Evaluator filed an aftermath
fyi (P2) suggesting the schema be templated into the heartbeat doc.

## Schema reality (verified 2026-05-08 via `PRAGMA table_info(projects)`)

| col              | type    | notes                              |
|------------------|---------|------------------------------------|
| `id`             | TEXT    | **PK**, not `projectId`            |
| `path`           | TEXT    | NOT NULL                           |
| `name`           | TEXT    | NOT NULL                           |
| `owner`          | TEXT    |                                    |
| `status`         | TEXT    | default `'active'`                 |
| `type`           | TEXT    | default `'milestone'`              |
| `workflow`       | TEXT    | default `'project'`                |
| `iteration`      | INTEGER | default 0                          |
| `priority`       | TEXT    |                                    |
| `milestones_done`| INTEGER | default 0                          |
| `milestones_total`| INTEGER| default 0                          |
| `updated_at`     | INTEGER | unix ms, **not** `updatedAt`       |

## Pattern (and why it keeps biting)

Almost every recurring schema slip in the last fortnight (KE-816 cluster:
`events.payload`, `metrics.lastUpdated`, `metrics.value`, `sessions.id`,
`sessions.turns`) is the same shape: an agent applies a *plausible*
naming convention (camelCase, table-prefixed PK, or a name borrowed from
a sibling table) instead of consulting `PRAGMA table_info`. The fix is
mechanical, not conceptual: **on first query against an unfamiliar
table, run `PRAGMA table_info` once and cache the column list in the
session's working memory.** `query_db`'s error hint already does most
of this for you — the only failure mode is that the agent is pattern-
matching off-by-one columns in the same statement and never re-reads
the hint.

## Action

- arc/heartbeat.md schema block updated to include the `projects` row
  alongside the existing `sessions` / `events` / `metrics` paragraphs.
- No code change needed; the runtime correctly returns the schema in
  the error path.

## Falsifier

If a future heartbeat session emits `SELECT projectId FROM projects` or
`ORDER BY updatedAt` on `projects` and gets a `no such column` error,
this KE failed to land in working memory and the heartbeat doc edit was
not enough — escalate to a query-template snippet at the top of the
heartbeat queries block.
