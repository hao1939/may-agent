# Design: Web UI Improvements

**Status:** Proposal (partially implemented)
**Date:** 2026-04-21
**References:** [project-system.md](project-system.md)

## What's Implemented

### Projects Tab ✅
- `/api/projects` — scans project.md files, returns name, owner, status, health, milestones, metrics list, iteration, updatedAt
- List view: Table with Project, Owner, Status, Health, Milestones (progress bar), Metrics (names only), Iter, Updated. Color-coded status/health. Sorted active-first.
- Detail view: Click shows raw project.md as monospace text. Back button.

## Remaining: Projects Tab Enhancements

### 1. Journal sub-tab in detail view (~30 LOC)

**API**: Add `/api/projects/journal?path=<relPath>` — reads `journal.md` from same directory as project.md.

**UI**: Detail view gets two sub-tabs: **Project** | **Journal**. Project shows project.md (as today). Journal shows journal.md in same monospace style.

### 2. Metric values in list view (~20 LOC)

**API**: Enhance `/api/projects` — for projects with metrics, query `SELECT id, current, target FROM metrics WHERE id IN (...)` and return current vs target values.

**UI**: Metrics column changes from just metric names to `coder.quality: 0.72 ✅` (green check if meets target, red ✗ if breached).

### 3. Session list in detail view (~15 LOC)

Design requires `projectId` column on sessions table (G10, not yet fully implemented).

**Interim workaround**: Use workflow run files from `.state/workflows/` — the handler already writes these with `steps[].sessionId`. Add `/api/projects/sessions?path=<relPath>` that scans workflow run files matching the project, returns session list with agent, status, duration.

### 4. Metric chart in detail view (deferred)

Requires metric history data (time-series). Not worth building until metric projects are actively running.

## Events View (not started)

The `events` table exists (G1 implemented). This makes the whole event system visible and debuggable.

- Table: event type, source, owner, data summary, timestamp
- Filter by type, owner
- Primary debugging tool: "what events did this workflow/handler emit?"

## Dashboard Cleanup (not started)

- Dim or hide 0-op interrupted/cancelled sessions in live feed
- Show active projects summary at top of dashboard (before agent grid)
- Show unresolved alerts count prominently

**Agent Deep-Dive — add to existing agent view:**
- **Projects** sub-tab — this agent's projects with health/status (filtered by owner)
- **Owned Metrics** sub-tab — `SELECT * FROM metrics WHERE owner = ?` with current values and alerts

## Session Quality (low priority)

- Sessions with 0 ops and interrupted/cancelled status → dim or collapse
- Add "quality" indicator: opCount, outcome present/absent, error present
- Filter: hide noise sessions (0-op, cancelled, workflow internal steps)

## Summary

| Change | LOC | Status |
|--------|-----|--------|
| Projects tab (list + detail) | done | ✅ Implemented |
| Journal sub-tab | ~30 | Not started |
| Metric values in list | ~20 | Not started |
| Session list via workflow runs | ~15 | Not started |
| Metric chart | ~40 | Deferred |
| Events view | ~40 | Not started |
| Dashboard cleanup | ~30 | Not started |
| Session quality | ~20 | Low priority |
