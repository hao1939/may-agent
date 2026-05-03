# KE-579: projects.md drift from runtime — no `done` status, `closed` is terminal, `blocked` not used, `workflow` column undocumented

**Date:** 2026-05-03
**Author:** arc
**Lane:** shared/knowledge
**Related:** KE-570 (sessions.md drift), KE-571 (metrics.md drift), KE-573 (agents.md/sdk.md status vocab drift), ORDER-014 (closed = terminal)

## Claim
`agents/shared/may-agent-docs/projects.md` describes a project lifecycle and status vocabulary that the runtime no longer uses. New agents reading the doc to learn "how projects work" will write the wrong `**Status**:` field in their `project.md`, and orchestrators following the doc will never close a project (the doc never mentions `closed`).

## Evidence

### 1. The `done` status doesn't exist in the DB

```
$ bun -e "const {Database}=require('bun:sqlite'); ...
SELECT status, COUNT(*) FROM projects GROUP BY status"
[
  {"status":"active",   "c":1},
  {"status":"archived", "c":3},
  {"status":"closed",   "c":16},
  {"status":"complete", "c":2},
  {"status":"waiting",  "c":1}
]
```

Total 23 project rows, **zero** in status `done`. The doc's lifecycle diagram is:

```
active → active (iterating)
       → waiting (blocked on external input)
       → done (all milestones complete — auto-converts to waiting after 48h)
```

Reality:
- Terminal status is `closed` (16/23 = 70% of all projects), enforced by ORDER-014 (2026-05-02): *"`**Status**: closed` is the only terminal state the entry-guard reads."*
- `archived` (3) and `complete` (2) also exist but are not in the doc's vocabulary.
- `done` is treated by `agents/shared/lib/project-health.ts:174` as a synonym for `complete`/`completed` ("terminal status") but no agent writes it — it's a code path with no producers.

### 2. The "auto-converts to waiting after 48h" mechanism does not exist

`grep -rn "auto.*conver\|done.*waiting\|48h"` across `agents/may/handlers/project.ts` and `agents/shared/lib/project-health.ts` returns **zero matches** for any auto-conversion logic. The only `48h` reference in the project pipeline is `metrics-snapshot.ts:34,183` — a stale-detection metric that emits a signal, not a status mutation. The doc's claim *"`done` auto-converts to `waiting` so the project can be picked up again if needed"* is fictional.

### 3. `blocked` status is unused

The doc's status-transition table includes:

| any | blocked | Human (via `[done]` comment) |

DB has zero rows in `blocked`. `project-health.ts:179` treats `"waiting"` and `"blocked"` as synonyms for "stopped, awaiting fix" — a code path with no producers. Humans use `archived` / `closed` / `waiting` instead.

### 4. The `workflow` column is missing from the documented schema

Doc (lines 64–77):
```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY, path TEXT NOT NULL, name TEXT NOT NULL,
  owner TEXT, status TEXT DEFAULT 'active', type TEXT DEFAULT 'milestone',
  priority TEXT, iteration INTEGER DEFAULT 0,
  milestones_done INTEGER DEFAULT 0, milestones_total INTEGER DEFAULT 0,
  updated_at INTEGER
);
```

Runtime (`PRAGMA table_info(projects)`):
```
id, path, name, owner, status, type, workflow, iteration, priority,
milestones_done, milestones_total, updated_at
```

The `workflow` column is written by `project-health.ts:331-339` (the actual upsert) and read by the orchestrator dispatch path. Doc readers won't know it exists.

### 5. `paused` is referenced by the handler but undocumented in lifecycle

`project.ts:46`: `const hasActionable = projects.some(p => p.status === "active" || p.status === "paused");`

The handler treats `paused` as actionable, but the doc's lifecycle diagram never mentions `paused`. (It does appear in `common-sense.md`'s status legend, so it's known elsewhere — but `projects.md` is the canonical project doc.)

## Why it matters
This is the same drift family as KE-570/571/573: an authoritative design doc that new agents are pointed at (linked from `common-sense.md`'s "convention" table) is silently lying about the runtime. Specific failure modes:

1. **Orchestrators write `**Status**: done`** following the doc, then loop to safety cap because the entry-guard only reads `closed` (the exact failure ORDER-014 was written to prevent — but ORDER-014 doesn't update the doc).
2. **Agents query `WHERE status='done'`** to find finished projects and get zero rows.
3. **Anyone writing tooling against the projects table** misses the `workflow` column.
4. **Coach training materials / context-discovery chains** that cite projects.md inherit the bad vocabulary.

## Lane
`agents/shared/may-agent-docs/projects.md` is in `may-agent-docs/` but **not** under `design/` — out of arc's direct-edit lane. Filing proposal at `agents/arc/workspace/proposals/2026-05-03-projects-md-runtime-reality-rewrite.md` for May/Hao to apply.

## What good looks like
After fix:
- Lifecycle diagram shows `active → closed` as the standard terminal transition, with `waiting`, `archived`, `paused`, `complete` documented.
- Status-transition table replaces `blocked` with the actually-used statuses; cites ORDER-014 as the source of `closed = terminal`.
- Schema block includes `workflow` column.
- "Auto-converts to waiting after 48h" claim removed (it's not implemented); replaced with a note about the `project.stale-active-count` metric (the actual 48h mechanism, which signals not mutates).

## Cross-check
- `git log --oneline -- agents/shared/may-agent-docs/projects.md` would show the doc predates ORDER-014 (2026-05-02). The drift is recent (last ~24h) and correlates with the orchestrator-close pattern landing without doc update — the same gap that produced KE-449/450/451 in a different domain.
