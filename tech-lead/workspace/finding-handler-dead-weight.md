# Finding: Handler Dead Weight Audit

**Date**: 2026-04-18 | **Lens**: C (Dead Weight) | **Scope**: `agents/may/handlers/*.ts` + `agents/may/cron.json`

## Summary

One significant dead-weight handler found (`priority-drift.ts`, 401 lines). The watchdog trio (watchdog/task-watchdog/zombie-cleanup) looks overlapping but each serves a distinct purpose. No trivially empty handlers found.

## Finding 1: `priority-drift.ts` is dead code (HIGH)

**Evidence**: `priority-drift.ts` (401 lines) exists as a fully-implemented handler but is **not registered in `cron.json`**. Grep across the entire codebase shows it is only referenced in workspace design docs (`priority-drift.ts:1-401`):
- `agents/may/workspace/improvement-queue.md`
- `agents/may/workspace/DESIGN-guards-v2.md`
- `agents/may/workspace/research-sensor-judge-workflow.md`
- `agents/may/workspace/DESIGN-sensor-judge-migration.md`

No `.ts` or `.json` file imports or registers it. It was designed as a sensor+judge pattern prototype (`priority-drift.ts:1-19`) but never activated.

**Severity**: High — 401 lines of unmaintained code that will rot silently.

**Recommended action**: Delete `priority-drift.ts`. If the sensor+judge pattern is still wanted, it can be rebuilt from the design docs when needed.

## Finding 2: Watchdog trio — distinct, not overlapping (LOW)

Three handlers manage session/request lifecycle but with clearly different scopes:

| Handler | Lines | Purpose | Interval |
|---------|-------|---------|----------|
| `watchdog.ts` | 129 | Cancels sessions stuck running >30min (`watchdog.ts:4-6`) | 10min |
| `zombie-cleanup.ts` | 23 | Archives orphaned sessions stuck in terminal states (`zombie-cleanup.ts:3-6`) | 60min |
| `task-watchdog.ts` | 375 | Nudges/escalates stale *requests* (not sessions) via escalation ladder (`task-watchdog.ts:4-8`) | 60min |

**Verdict**: No overlap. `watchdog` kills running sessions, `zombie-cleanup` archives dead ones, `task-watchdog` manages the request queue. All three are needed.

## Finding 3: Smallest handlers are all functional (LOW)

| Handler | Lines | Status |
|---------|-------|--------|
| `zombie-cleanup.ts` | 23 | Minimal but functional — calls `cleanupZombieSessions()` (`zombie-cleanup.ts:14`) |
| `research-sync.ts` | 62 | Syncs markdown knowledge entries to SQLite (`research-sync.ts:1-5`) |
| `watchdog.ts` | 129 | Full stale-session detection logic |
| `tracker-compact.ts` | 146 | DB compaction |
| `coaching-feedback.ts` | 161 | Coaching feedback generation |

No trivially empty or no-op handlers found.

## Follow-up

- [ ] Delete `priority-drift.ts` (separate session)
