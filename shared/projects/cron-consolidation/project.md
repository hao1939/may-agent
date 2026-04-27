# Project: Cron Consolidation

**Status**: done
**Owner**: optimizer
**Priority**: P2
**Iteration**: 5

**Health**: 8/10 (PASS)
## Goal
Reduce cron entry count by grouping related JS handlers. Fewer entries, same work, less overhead.

## Background
Currently 43 enabled cron entries. Many JS handlers do similar work at similar intervals and could be combined:
- 3 entries at 5min (active-nudge, project-resume, session-sync) — all scan DB
- 4 entries at 30min doing compliance checks (convention-check, repo-gate-check, standing-orders-check, research-sync)
- 3 entries at 60min doing maintenance (metrics-snapshot, zombie-cleanup, task-watchdog)
- 8+ entries at 1440min doing daily cleanup/summaries

LLM tasks (run-workflow handler) should stay separate — different agents, different concerns.

## Milestones
- [x] Audit all JS-only cron handlers — map what each does, inputs/outputs, dependencies
- [x] Identify safe groupings — which handlers can run sequentially in one entry without side effects
- [x] Build combined handlers (6 groups: fast-sync, compliance-check, system-maintenance, daily-reports, daily-cleanup, periodic-maintenance)
- [x] Migrate: replace individual entries with combined ones, verify same behavior
- [x] Measure: fewer entries, same results, no regressions

## Current State
Complete. 5/5 milestones. All 5/5 milestones are complete. The task to reduce cron entry count by grouping related JS-only han

## Comments
