# May Handler Audit — 2026-04-11

## Summary

- **Before audit**: 30 handler files, 9,503 lines (before auto-pause-recovery deletion)
- **Deleted this round**: 2 files, 585 lines (focus-task-tracker.ts, reflect.ts)
- **Previously deleted**: auto-pause-recovery.ts (523 lines)
- **Total removed**: 3 files, 1,108 lines (11.7% reduction)
- **Current state**: 27 handler files, 8,395 lines

## Dead Handlers Deleted

### focus-task-tracker.ts (161 lines) — DELETED
- **Why dead**: No cron.json entry. No imports anywhere. Never wired up.
- **What it did**: Monitored `agents/shared/focus-tasks.md` for activity signals
- **Confirming evidence**: focus-tasks.md doesn't exist. Optimizer flagged it as orphaned in March. Previously disabled, never activated.

### reflect.ts (424 lines) — DELETED
- **Why dead**: The cron entry named "reflect" uses `handler: "run-agent-task"`, NOT `handler: "reflect"`. The handler file was the original JS implementation before reflection was moved to LLM-based dispatch.
- **What it did**: Pure JS lesson extraction from memory-stream.jsonl
- **Confirming evidence**: Zero imports. The `reflect` reference in `src/lib/tools/request-status.ts` is just a schedule name for display, not a handler import.

### auto-pause-recovery.ts (523 lines) — DELETED (previous session)
- Already documented. The inline auto-pause in cron.ts handles everything.

## Active Handlers — All Verified

All 27 remaining handlers have matching cron.json entries and are legitimately used:

| Handler | Lines | Purpose | Category |
|---------|-------|---------|----------|
| convention-check | 1,078 | Convention compliance checker | Quality |
| agents-auto-commit | 709 | Safety-net for uncommitted agent changes | Ops |
| analyze-failures | 509 | Daily failure analysis | Reporting |
| tool-quality-scan | 426 | Tool failure pattern scanner | Quality |
| heartbeat-context | 402 | Pre-compute context for heartbeats | Infra |
| error-log-scanner | 384 | Scan ERROR_LOG.jsonl for patterns | Quality |
| task-watchdog | 375 | Nudge agents about stale requests | Ops |
| evaluation-sync | 362 | Heuristic evaluations → may.db | Infra |
| workspace-compaction | 344 | Archive stale workspace files | Ops |
| run-agent-task | 304 | Generic LLM task dispatch | Infra |
| memory-trimmer | 303 | Trim memory files, remove orphans | Ops |
| daily-brief | 282 | Metrics summary → Telegram | Reporting |
| repo-gate-check | 273 | QA commit preflight (git+tsc+vitest) | Quality |
| active-nudge | 265 | Detect loops/stalls in sessions | Ops |
| audit-requests | 260 | Request lifecycle cleanup | Ops |
| lessons-graduation | 258 | LESSONS.md health scan | Quality |
| daily-digest | 247 | Progress digest for human | Reporting |
| run-workflow | 240 | Workflow dispatch for cron | Infra |
| health-trend | 235 | Weekly per-agent health trends | Reporting |
| coaching-report | 233 | Daily coaching quality report | Reporting |
| system-status | 223 | Operational status check | Ops |
| session-sync | 162 | FS → may.db session sync | Infra |
| coaching-feedback | 161 | Convention violations → coach | Quality |
| tracker-compact | 146 | Compact status index for coach | Infra |
| watchdog | 129 | Cancel stale running sessions | Ops |
| research-sync | 62 | Research artifacts → SQLite | Infra |
| zombie-cleanup | 23 | Archive orphaned zombie sessions | Ops |

## Overlap Analysis — No True Duplicates

Investigated potential overlaps:

1. **watchdog (129L) vs zombie-cleanup (23L)**: Different scope. Watchdog cancels actively-running sessions exceeding time limits (10min interval). Zombie-cleanup archives DB records stuck in "running" state that are no longer active in memory (60min).

2. **daily-brief (282L) vs daily-digest (247L)**: Different output. Brief emits metrics to Telegram. Digest writes a comprehensive progress report to `agents/shared/daily-digests/`.

3. **coaching-report (233L) vs coaching-feedback (161L)**: Different purpose. Report summarizes quality scores/trends. Feedback sends specific convention violations to coach for training briefs.

## Observations for Future Work

1. **convention-check.ts (1,078 lines)** is the largest handler — bigger than some core modules. May benefit from being split or having some checks extracted.

2. **agents-auto-commit.ts (709 lines)** is surprisingly large for a "commit orphaned changes" task. Worth reviewing if complexity is justified.

3. **5 "reporting" handlers** (analyze-failures, daily-brief, daily-digest, coaching-report, health-trend) total 1,506 lines. Some could potentially be consolidated, but they serve different audiences/frequencies.

4. **Handler loading is cron.json-driven** (agent-loader.ts auto-discovers based on `handler` field). Files without cron entries are guaranteed dead. This makes auditing straightforward.
