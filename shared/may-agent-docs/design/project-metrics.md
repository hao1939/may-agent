# Design: Project System Metrics

**Status**: draft
**Date**: 2026-04-27

## What we want to understand

The project system should self-drive work. Metrics tell us if it's actually doing that.

## Metrics

### `project.active-count`
- **What**: Number of projects with status=active right now
- **Source**: scan project.md files (filesystem)
- **Target**: 3 (at least some work always in progress)
- **Threshold**: 1 (below 1 = system idle, nothing happening)
- **Owner**: may
- **Why**: If active count drops to 0, the system stopped working. This happened multiple times — projects get falsely completed or stuck.

### `project.blocked-count`
- **What**: Number of projects with status=blocked or waiting
- **Source**: scan project.md files
- **Target**: 0
- **Threshold**: 3 (too many blocked = systemic issue)
- **Owner**: may
- **Why**: Blocked projects need attention. If this stays high, nobody is unblocking them.

### `project.iterations-24h`
- **What**: Number of project iterations in the last 24h
- **Source**: events table — `COUNT(*) WHERE event_type = 'project.iteration' AND timestamp > 24h ago`
- **Target**: 10
- **Threshold**: 3 (catches 'completely dead', not 'slow day')
- **Owner**: may
- **Why**: Measures system throughput. Threshold is intentionally low — the system may pause overnight.

### `project.blocked-rate-7d`
- **What**: % of project events that are blocks/escalations vs completions in last 7d
- **Source**: events table — `project.blocked / (project.blocked + project.completed + project.iteration)`
- **Target**: 0.10 (10% blocked is normal)
- **Threshold**: 0.30 (30% = something is systematically wrong)
- **Owner**: may
- **Why**: High block rate means the workflow is failing frequently. We saw this with the stall detector and false completions.

### `project.stale-active-count`
- **What**: Number of projects with status=active but no iteration event in 48h+
- **Source**: cross-reference filesystem (active projects) with events table (last project.iteration per project)
- **Target**: 0
- **Threshold**: 2
- **Owner**: may
- **Why**: The #1 failure mode — projects marked active but nobody is working on them. More actionable than active-count because it points to specific broken projects.

## Metrics NOT included (and why)

- **Average iterations to completion**: Hard to measure — projects have different sizes. A 3-iteration project and a 50-iteration project aren't comparable. Not actionable.
- **Blocked duration**: Useful but complex to measure (need to track when blocked started). Can add later if blocked-count stays high.
- **Per-project metrics**: Too granular. The 4 metrics above cover system health. Individual project issues surface through the orchestrator.
- **Completion rate**: Misleading — 43 "done" projects includes many false completions. Not trustworthy until the completion mechanism is fixed.

## Measurement

All measured by the metrics-snapshot handler (already runs every 5min).

Project status comes from filesystem scan — same `scanAllProjects()` the handler already uses. Add 4 queries to the existing handler.

## Implementation

Add to `agents/may/handlers/metrics-snapshot.ts` — extend the existing handler with project metric queries.
