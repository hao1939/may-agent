---
id: KE-917
date: 2026-05-09
agent: arc
tags: [coherence, common-sense, query_db, doc-drift, sessions, metrics]
related: [KE-434, KE-816, KE-910, KE-916]
---

# common-sense.md Conventions table still says "bun:sqlite readonly" for sessions/metrics — contradicts its own Database access section

## What

`agents/shared/common-sense.md` is internally inconsistent about how to read
runtime DB tables.

- Lines 79–80 (Conventions table):
  ```
  | Metrics  | `metrics`  table (read via bun:sqlite readonly) |
  | Sessions | `sessions` table (read via bun:sqlite readonly) |
  ```
- Lines 107–110 (Database access section):
  > Use the `query_db` tool for read-only database inspection. … do not
  > guess DB paths and do not call `sqlite3`. Example: `query_db({ "sql":
  > "SELECT agent, COUNT(*) c FROM sessions GROUP BY agent" })`.

The table is the older guidance from when `query_db` was unimplemented
(KE-434 era). When `query_db` shipped (commit `2b267db20`, 2026-05-07,
verified live by arc 2026-05-08 00:48Z and again this heartbeat 2026-05-09
~11Z), KE-434 was closed and the bottom of the file was rewritten — but
the Conventions table two-liner was left behind.

## Why it matters

Agents skim the Conventions table for "where do I read X" answers. Today,
that table tells them to `import { Database } from "bun:sqlite"` against
a guessed path. That:

1. Re-introduces the gym-scenario better-sqlite3 / path-guessing pattern
   that the heartbeat doctrine explicitly warns against (arc/heartbeat.md
   "Tooling note").
2. Loses the `query_db` schema-hint affordance — when a query references
   a non-existent column, `query_db` returns `PRAGMA table_info` for the
   table in its error. That hint is exactly what would have prevented
   KE-816 / KE-910 / KE-916's recurring "schema footgun" cluster
   (`payload`, `session_id`, `agent`, `id`, `stopReason`,
   `projectId`, `updatedAt`, `lastUpdated`, `value`).
3. Bun's `bun:sqlite` opens the file directly — the Safety section warns
   against opening read-write from bash for WAL safety; readonly is
   technically fine but a fresh agent reading the table line will not
   reliably remember the readonly qualifier.

## Why arc didn't fix it directly

`common-sense.md` is human-controlled (banner: "Human-controlled.
Propose changes with evidence via message({to: 'may', …})"). Out of
arc's edit lane (KE-450, KE-451). Proposal lives at
`agents/arc/workspace/proposals/2026-05-09-common-sense-conventions-table-query_db.md`.

## Suggested fix (verbatim, three-line table edit)

```
| Metrics  | `metrics`  table — use `query_db` (read-only). Schema hint via PRAGMA on column-not-found. |
| Sessions | `sessions` table — use `query_db` (read-only). PK is `sessionId` (KE-816). |
| Events   | `events`   table — use `query_db`; filter by sessionId/agent via `data LIKE` or `json_extract`, not `session_id`/`agent` columns (KE-910). |
```

(Adding the `events` row is a bonus — it's the table where the recurring
column-name footguns actually land.)

— arc heartbeat 2026-05-09 ~11Z
