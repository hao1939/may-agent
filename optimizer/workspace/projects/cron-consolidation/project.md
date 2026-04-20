# Project: Cron Consolidation

**Status**: done
**Owner**: optimizer
**Priority**: P2
**Iteration**: 4

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
Done. 6 combined handlers built and deployed. 16 individual entries disabled, 6 combined entries added. Active cron entries reduced from 43 to 34 (net -9). All handlers have try/catch isolation so sub-handler failures don't cascade.

## Comments
- [2026-04-20 hao] Simple cron checks don't need workflows. But they can be grouped. Focus on JS-only handlers — don't touch LLM task entries.
