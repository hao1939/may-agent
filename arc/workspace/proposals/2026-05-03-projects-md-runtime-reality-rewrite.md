# Proposal: rewrite agents/shared/may-agent-docs/projects.md to match runtime

**Date:** 2026-05-03
**Author:** arc
**Target file:** `agents/shared/may-agent-docs/projects.md` (out of arc's edit lane)
**Backing KE:** KE-579
**Approver:** May (or Hao)

## Why

The current `projects.md` lifecycle and schema contradict the runtime. See KE-579 for full evidence; summary:

| Claim in doc | Runtime reality |
|---|---|
| Lifecycle: `active → waiting → done` | DB has 0 rows in `done`, 16 in `closed`, 3 in `archived`, 2 in `complete` |
| `done` auto-converts to `waiting` after 48h | No such code path exists (`grep` returns 0 hits in handlers/lib) |
| `blocked` is a status set by humans via `[done]` comment | DB has 0 `blocked` rows; humans use `archived`/`waiting` |
| Schema: 11 columns | Runtime: 12 columns (missing `workflow`) |
| `paused` is unmentioned | Handler treats it as actionable (`project.ts:46`) |

ORDER-014 (2026-05-02) established `closed` as the terminal state read by the orchestrator entry-guard, but the design doc was never updated.

## Proposed replacement (full file)

```markdown
# Projects

## Overview
Projects are the unit of multi-session work. An agent works on a project across multiple heartbeats until it's closed, archived, or paused.

## Location
All projects live at: `agents/shared/projects/<name>/project.md` — shared across agents; any agent can own/advance a project. The legacy `agents/<you>/workspace/projects/` location is no longer scanned.

## Project File Format
```markdown
---
id: my-project
owner: tech-lead
status: active
type: milestone
priority: high
workflow: master-worker      # optional; e.g. master-worker, freestyle
---

# Project Name

## Goal
What this project achieves.

## Plan
- [x] Step 1
- [ ] Step 2

## Journal
### 2026-05-03
Completed step 1. Next: step 2.
```

## Status Vocabulary (runtime-verified 2026-05-03)

| Status | Meaning | Set by |
|---|---|---|
| `active` | Concrete next action ready now; handler iterates | Owner |
| `paused` | Temporarily on hold but still actionable | Owner |
| `waiting` | Blocked on external input or fix | Owner / handler |
| `complete` | All milestones done; awaiting closure | Owner (rare; usually skip to `closed`) |
| `closed` | **Terminal.** Entry-guard exits cleanly. | Owner (per ORDER-014) |
| `archived` | Terminal. Historical, no longer relevant. | Owner / human |

`done` and `blocked` are recognised as synonyms by `project-health.ts` (terminal and waiting respectively) but are not in active use — prefer `closed` and `waiting`.

## Lifecycle

```
active ⇄ paused
   ↓        ↓
waiting ←———┘
   ↓
closed (terminal — per ORDER-014)
   or
archived (terminal — historical)
```

**Key rule (ORDER-014):** Orchestrators close projects in-band by editing `**Status**: active` → `**Status**: closed` directly. The entry-guard only reads `closed` as terminal; without this edit, the workflow loops to its 50-iteration safety cap.

## Staleness signal (not auto-mutation)

There is **no** automatic status conversion. Stale active projects (no `project.iteration` event in 48h) are surfaced via the `project.stale-active-count` metric (`metrics-snapshot.ts:34,183`), which signals attention is needed — owners decide whether to resume, pause, or close.

## Project Handler
`agents/may/handlers/project.ts` runs on heartbeat:
- Scans projects whose status is `active` or `paused` (line 46)
- Checks staleness, comments, and milestones via `agents/shared/lib/project-health.ts`
- Emits `project.iteration` / `project.blocked` events
- Records metrics (`project.active-count`, `project.iterations-24h`, `project.stale-active-count`, `project.blocked-over-6h`, ...)

## DB Table (verified via `PRAGMA table_info(projects)` 2026-05-03)

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  name TEXT NOT NULL,
  owner TEXT,
  status TEXT DEFAULT 'active',
  type TEXT DEFAULT 'milestone',
  workflow TEXT,                    -- e.g. master-worker, freestyle (read by dispatcher)
  iteration INTEGER DEFAULT 0,
  priority TEXT,
  milestones_done INTEGER DEFAULT 0,
  milestones_total INTEGER DEFAULT 0,
  updated_at INTEGER
);
```

(Upsert: `project-health.ts:331-339`.)

## Implementation
- **Project handler:** `agents/may/handlers/project.ts`
- **Health lib:** `agents/shared/lib/project-health.ts`
- **DB schema:** `src/lib/requests.ts` (projects table)
- **Closure rule:** `agents/shared/standing-orders.md` ORDER-014
```

## Diff summary
- Lifecycle: replace `done`-centred 3-state diagram with runtime 6-state vocabulary; cite ORDER-014.
- Remove fictional "auto-converts to waiting after 48h" sentence.
- Replace it with a "Staleness signal (not auto-mutation)" section pointing to `project.stale-active-count`.
- Schema: add `workflow TEXT` column.
- Status table: replace `blocked` row with the actually-used statuses; mark `done`/`blocked` as recognised synonyms only.
- Add `paused` to lifecycle and handler-scan note.
- Add front-matter example for `workflow:` field.

## Risk
Low. The doc is reference material; updating it can only reduce drift. No code changes.

## Adoption clock
Per the adoption-clock pattern (KE-565), if no action in 48h I'll bump priority and ping `tech-lead` via INBOX.
