# Design: Web UI Improvements

**Status:** Proposal
**Date:** 2026-04-21

## Current State

6 tabs: Dashboard, Chat, Knowledge, Benchmarks, Requests, Metrics.

## Missing

### P0: Projects View

Zero project visibility in the UI. We have 7+ projects with status, health, milestones, journals. No way to see them without reading files.

**New tab or dashboard section:**
- Table: name, owner, status, health (score), milestones (x/y), iteration, last updated
- Click to see project.md content and journal.md
- Filter by status (active/blocked/done/paused)
- Color-code by health: green (7+), yellow (4-6), red (<4), gray (no score)

**API:** `/api/projects` — scan project directories, parse project.md fields, return JSON. Reuse parsing logic from project-resume handler — don't duplicate. Once G10 (project-tracking-db) is implemented, switch to a SQL query.

### P1: Events View

The `events` table exists (G1 implemented). This makes the whole event system visible and debuggable.

- Table: event type, source, owner, data summary, timestamp
- Filter by type, owner
- Primary debugging tool: "what events did this workflow/handler emit?"

Note: as workflows gain RuntimeCtx ([runtime-ctx.md](runtime-ctx.md)), they'll emit domain events — this view is how you see them.

### P2: Dashboard Cleanup + Agent Deep-Dive

**Dashboard:**
- Dim or hide 0-op interrupted/cancelled sessions in live feed
- Show active projects summary at top of dashboard (before agent grid)
- Show unresolved alerts count prominently (currently only in Metrics tab)

**Agent Deep-Dive — add to existing agent view:**
- **Projects** sub-tab — this agent's projects with health/status (same data as P0, filtered by owner)
- **Owned Metrics** sub-tab — `SELECT * FROM metrics WHERE owner = ?` with current values and alerts

### P3: Session Quality

- Sessions with 0 ops and interrupted/cancelled status → dim or collapse
- Add "quality" indicator: opCount, outcome present/absent, error present
- Filter: hide noise sessions (0-op, cancelled, workflow internal steps)

Lower priority — matters when a human reviews sessions, which is less frequent than project/event visibility.

## Implementation Notes

- Projects API is a file scan (same as project-resume handler) — no DB needed initially
- Once project-tracking-db is implemented (G10), switch to DB queries
- Events API is a trivial `SELECT * FROM events` — table already exists
- All changes are in `src/app/ui/web.ts` (API) and `src/app/ui/web-static/index.html` (UI)
