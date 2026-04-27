# Design: Project System Metrics

**Status**: approved
**Date**: 2026-04-27

## Problem
No visibility into project system health. Projects get falsely completed, stuck as active with no work, or blocked with nobody unblocking. No metrics track any of this.

## Architecture

```
project.md (ground truth) → project handler scans → projects table (DB cache) → metrics-snapshot queries → metrics
```

project.md is always the source of truth. The project handler (`agents/may/handlers/project.ts`) calls `scanAllProjects()` from `agents/shared/lib/project-health.ts` every 5 minutes. After scanning, it upserts each project to the DB.

### Projects table (DB cache)

```sql
CREATE TABLE projects (
  id              TEXT PRIMARY KEY,    -- "skill-workflow-audit"
  path            TEXT NOT NULL,       -- "agents/shared/projects/skill-workflow-audit"
  name            TEXT NOT NULL,       -- "Skill & Workflow Quality"
  owner           TEXT,
  status          TEXT DEFAULT 'active',
  type            TEXT DEFAULT 'milestone',
  workflow        TEXT DEFAULT 'project',
  iteration       INTEGER DEFAULT 0,
  priority        TEXT,
  milestones_done INTEGER DEFAULT 0,
  milestones_total INTEGER DEFAULT 0,
  updated_at      INTEGER              -- from statSync(projectFile).mtimeMs
);
```

**Who writes**: project handler in `agents/may/handlers/project.ts` — already calls `scanAllProjects()` every 5min. Add upsert after scan.

**Who reads**: metrics-snapshot handler, web UI `/api/projects`, heartbeat data loaders.

**updated_at**: from `statSync(projectFile).mtimeMs` — reflects when actual work happened, not when the scanner ran.

**First run**: if projects table is empty, the handler populates it on first scan. Web UI falls back to filesystem scan if table has 0 rows.

### Prerequisite: project.iteration event

Workflows must emit `project.iteration` after each worker+review cycle. Currently NOT emitted.

Add to:
- `agents/shared/workflows/master-worker.ts` — after each review, emit via `ctx.emit`
- `agents/shared/workflows/project.ts` — after each iteration, emit via `emitProjectEvent()`

## Metrics

### `project.active-count`
- **What**: Projects with status=active
- **Query**: `SELECT COUNT(*) FROM projects WHERE status = 'active'`
- **Target**: 3 — **Threshold**: 1
- **Owner**: may

### `project.blocked-count`
- **What**: Projects with status=blocked or waiting
- **Query**: `SELECT COUNT(*) FROM projects WHERE status IN ('blocked', 'waiting')`
- **Target**: 0 — **Threshold**: 3
- **Owner**: may

### `project.stale-active-count`
- **What**: Active projects with no `project.iteration` event in 48h
- **Query**: active projects from DB LEFT JOIN events, filter where last iteration > 48h ago or NULL
- **Target**: 0 — **Threshold**: 2
- **Owner**: may

### `project.iterations-24h`
- **What**: Project iterations in the last 24h
- **Query**: `SELECT COUNT(*) FROM events WHERE event_type = 'project.iteration' AND timestamp > ?`
- **Target**: 10 — **Threshold**: 3 (intentionally low — system may pause overnight)
- **Owner**: may

### `project.blocked-rate-7d`
- **What**: % of project events that are blocks vs productive events in last 7d
- **Query**: `project.blocked / (project.blocked + project.completed + project.iteration)`
- **Target**: 0.10 — **Threshold**: 0.30
- **Owner**: may

## Implementation

| Step | File | Change |
|------|------|--------|
| 1 | `src/lib/requests.ts` | Add projects table to SCHEMA (done) |
| 2 | `agents/shared/lib/project-health.ts` | Add `upsertProject(db, project)` — called after scanAllProjects |
| 3 | `agents/may/handlers/project.ts` | Call upsertProject for each scanned project |
| 4 | `agents/shared/workflows/master-worker.ts` | Emit project.iteration after each review cycle |
| 5 | `agents/shared/workflows/project.ts` | Emit project.iteration via emitProjectEvent after each iteration |
| 6 | `agents/may/handlers/metrics-snapshot.ts` | Add 5 project metrics (query DB, not filesystem) |
| 7 | `src/app/ui/web.ts` | `/api/projects` reads from DB, fallback to filesystem if empty |
