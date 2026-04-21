# Design: Web UI — Projects Tab Update

**Status:** Proposal
**Date:** 2026-04-21
**References:** [project-system.md](project-system.md)

## Current State

**API** (`web.ts:handleProjects`): `/api/projects` scans project.md files, returns name, owner, status, health, milestones, metrics list, iteration, updatedAt. Matches the design doc's table columns.

**List view**: Table with Project, Owner, Status, Health, Milestones (progress bar), Metrics (names only), Iter, Updated. Color-coded status/health. Sorted active-first.

**Detail view**: Click shows raw project.md as monospace text. Back button. That's it.

## Gap

Design doc specifies:

> "Click → project.md content, journal, session list (by projectId), metric chart."

## Proposed Changes

### 1. Journal sub-tab in detail view (~30 LOC)

**API**: Add `/api/projects/journal?path=<relPath>` — reads `journal.md` from same directory as project.md.

**UI**: Detail view gets two sub-tabs: **Project** | **Journal**. Project shows project.md (as today). Journal shows journal.md in same monospace style.

### 2. Metric values in list view (~20 LOC)

**API**: Enhance `/api/projects` — for projects with metrics, query `SELECT id, current, target FROM metrics WHERE id IN (...)` and return current vs target values.

**UI**: Metrics column changes from just metric names to `coder.quality: 0.72 ✅` (green check if meets target, red ✗ if breached).

### 3. Session list in detail view (~15 LOC)

Design requires `projectId` column on sessions table (G10, not yet implemented).

**Interim workaround**: Use workflow run files from `.state/workflows/` — the handler already writes these with `steps[].sessionId`. Add `/api/projects/sessions?path=<relPath>` that scans workflow run files matching the project, returns session list with agent, status, duration.

### 4. Metric chart in detail view (deferred)

Requires metric history data (time-series). Not worth building until metric projects are actively running. Skip for now.

## Summary

| Change | LOC | Blocked? |
|--------|-----|----------|
| Journal sub-tab in detail | ~30 | No |
| Metric current vs target in list | ~20 | No — reads metrics table |
| Session list via workflow runs | ~15 | No — uses .state/workflows/*.json |
| Metric chart | ~40 | Yes — needs time-series data |

**Recommended order**: Journal tab → metric values → session list. Total ~65 LOC across `web.ts` + `index.html`. Metric chart deferred.
