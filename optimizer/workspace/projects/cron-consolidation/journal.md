# Cron Consolidation — Journal

## 2026-04-20 — Project Created
- 43 enabled cron entries, many JS handlers doing similar work at similar intervals
- Natural groupings: 5min DB scans, 30min compliance, 60min maintenance, daily cleanup
- LLM tasks stay separate

## 2026-04-20 — Milestone 1: Full JS Handler Audit

### Inventory (29 JS handlers, 15 LLM run-workflow entries)

| Interval | Handler | Purpose | Notes |
|----------|---------|---------|-------|
| **5min** | active-nudge | Detect loops/stalls in running sessions, cancel or nudge | Writes nudge files, cancels sessions |
| **5min** | session-sync | Sync session meta from filesystem → may.db | Uses own DB connection (WAL bug) |
| **5min** | project-resume | Scan active projects, fork owner agents | Dispatches LLM sessions — heavyweight |
| **10min** | watchdog | Cancel sessions running > threshold | Lightweight DB scan |
| **10min** | evaluation-sync | Heuristic eval for unevaluated sessions | Uses own DB connection (WAL bug) |
| **30min** | convention-check | Check sessions against CONVENTIONS.md | Parses transcripts, writes to DB |
| **30min** | repo-gate-check | Run tsc + vitest before QA review | Slow — runs full test suite |
| **30min** | standing-orders-check | Scan for standing order violations | Similar to convention-check |
| **30min** | research-sync | Sync markdown research → SQLite tables | Data sync |
| **30min** | review-auto-merge | Auto-merge passing review/* branches | Runs tsc + vitest per branch — slow |
| **30min** | heartbeat-context | Pre-compute agent context for heartbeats | Lightweight DB queries |
| **30min** | evaluator-heartbeat | Check if evaluator calibration needed | Gate — spawns LLM only if needed |
| **60min** | zombie-cleanup | Archive orphaned stuck sessions | Lightweight |
| **60min** | task-watchdog | Escalation ladder for stale requests | Nudges agents |
| **60min** | metrics-snapshot | Snapshot all active metrics | SQL queries + writes |
| **120min** | proof-of-life | Send Telegram system digest | Telegram notification |
| **120min** | agents-auto-commit | Safety-net git commit for agents/ | Git operations |
| **120min** | audit-requests | Reconcile request lifecycle, auto-expire | DB maintenance |
| **240min** | system-status | Operational health metrics to log | Report generation |
| **240min** | tracker-compact | Pre-generate compact tracker index | File I/O |
| **240min** | tool-quality-scan | Scan for tool failure patterns | DB scan + analysis |
| **1440min** | daily-brief | System metrics summary → Telegram | Report |
| **1440min** | daily-digest | Progress digest for human review | Report |
| **1440min** | analyze-failures | Failure analysis report | Report → workspace file |
| **1440min** | coaching-report | Per-agent quality scores + trends | Report |
| **1440min** | lessons-graduation | Trim oversized LESSONS.md files | File maintenance |
| **1440min** | workspace-compaction | Archive stale workspace files (7+ days) | File maintenance |
| **1440min** | memory-trimmer | Trim memory .jsonl files | File maintenance |
| **10080min** | health-trend | Weekly per-agent trend comparison | Weekly report |

### Proposed Safe Groupings (Milestone 2 analysis)

**Group 1: `fast-sync` (5min)** — session-sync + evaluation-sync (both 5-10min DB syncs, both use own DB connections)
- Saves 1 entry. Both are data-sync, no side effects on each other.
- active-nudge stays separate (intervention logic, different concern).
- project-resume stays separate (dispatches LLM sessions).

**Group 2: `compliance-check` (30min)** — convention-check + standing-orders-check
- Both scan sessions for rule violations. Similar inputs (transcripts, recent changes). 
- repo-gate-check stays separate (runs tsc/vitest, can be slow).

**Group 3: `system-maintenance` (60min)** — zombie-cleanup + task-watchdog + metrics-snapshot
- All maintenance, no conflicts. Sequential is fine.
- Saves 2 entries.

**Group 4: `daily-reports` (1440min)** — daily-brief + daily-digest + analyze-failures + coaching-report
- All generate reports, pure reads. No conflicts.
- Saves 3 entries.

**Group 5: `daily-cleanup` (1440min)** — workspace-compaction + memory-trimmer + lessons-graduation
- All file trimming/cleanup. Sequential is safe.
- Saves 2 entries.

**Group 6: `periodic-maintenance` (120min)** — agents-auto-commit + audit-requests
- Both maintenance. proof-of-life stays separate (Telegram timing matters).
- Saves 1 entry.

**Total reduction: 29 → 20 JS entries (9 fewer)**

## 2026-04-20 — Milestones 3-4: Build & Deploy Combined Handlers

Built 6 combined handler files:
- `agents/may/handlers/fast-sync.ts` — session-sync + evaluation-sync (5min)
- `agents/may/handlers/compliance-check.ts` — convention-check + standing-orders-check (30min)
- `agents/may/handlers/system-maintenance.ts` — zombie-cleanup + task-watchdog + metrics-snapshot (60min)
- `agents/may/handlers/daily-reports.ts` — daily-brief + daily-digest + analyze-failures + coaching-report (24h)
- `agents/may/handlers/daily-cleanup.ts` — workspace-compaction + memory-trimmer + lessons-graduation (24h)
- `agents/may/handlers/periodic-maintenance.ts` — agents-auto-commit + audit-requests (2h)

Each combined handler:
- Imports sub-handlers via `create()` function
- Runs them sequentially with try/catch isolation (one failure doesn't block others)
- Logs start/end and any errors

Updated `agents/may/cron.json`:
- Disabled 16 individual entries (marked with `_replaced_by` field)
- Added 6 new combined entries (enabled)
- Net change: 47 → 53 entries total (16 disabled + 6 new active = same work, fewer active entries)

### Handlers that should stay independent
- active-nudge (5min) — intervention, timing-critical
- project-resume (5min) — dispatches LLM work
- watchdog (10min) — session cancellation, timing-critical
- repo-gate-check (30min) — slow (tsc+vitest)
- review-auto-merge (30min) — slow (tsc+vitest per branch)
- heartbeat-context (30min) — must complete before heartbeats
- evaluator-heartbeat (30min) — gate for LLM spawn
- research-sync (30min) — independent concern
- proof-of-life (120min) — Telegram timing
- system-status (240min) — different interval
- tracker-compact (240min) — different interval
- tool-quality-scan (240min) — different interval
- health-trend (weekly) — unique interval
### Iteration 5 (comment) — 2026-04-20T10:58:30.255Z
**Comment**: - [2026-04-20 hao] Simple cron checks don't need workflows. But they can be grouped. Focus on JS-only handlers — don't touch LLM task entries.
**Reviewer**: DONE — All 5/5 milestones are complete. The task to reduce cron entry count by grouping related JS-only handlers has been fully addressed across the iterations.

**Evaluator**: PASS (score=8/10) — This is sufficient evidence. The work is real and complete.

SCORE: 8

**Reasoning:**

1. **Deliverables exist**: Yes — combined handler files exist (`fast-sync.ts`, `system-maintenance.ts`, `daily-cleanup.ts`), and cron.json has been updated with the new combined entries and `_replaced_by` annotations on disabled entries.

2. **Goal met**: Yes — cron entries reduced from 43 to 34 (net -9) by grouping related JS handlers. The combined handlers delegate to the original handlers sequentially.

3. 

