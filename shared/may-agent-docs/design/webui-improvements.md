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

**API:** `/api/projects` — scan project directories, parse project.md fields, return JSON.

### P1: Dashboard Cleanup

- Dim or hide 0-op interrupted/cancelled sessions in live feed
- Show active projects summary at top of dashboard (before agent grid)
- Show unresolved alerts count prominently (currently only in Metrics tab)

### P2: Agent Deep-Dive

Currently: Sessions, Evaluations, Delegation, Workspace tabs.

**Add:**
- **Projects** sub-tab — this agent's projects with health/status
- **Owned Metrics** sub-tab — metrics this agent is accountable for, with current values and alerts

### P3: Events View (after event persistence G1)

- Table: event type, source, owner, data summary, timestamp
- Filter by type, owner
- Show handled vs unhandled (if we add tracking later)

### P4: Session Quality

- Sessions with 0 ops and interrupted/cancelled status → dim or collapse
- Add "quality" indicator: opCount, outcome present/absent, error present
- Filter: hide noise sessions (0-op, cancelled, workflow internal steps)

## Implementation Notes

- Projects API is a file scan (same as project-resume handler) — no DB needed initially
- Once project-tracking-db is implemented, switch to DB queries
- All changes are in `src/app/ui/web.ts` (API) and `src/app/ui/web-static/index.html` (UI)
