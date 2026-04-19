# Cron Handler Consolidation Analysis

**Date**: 2026-04-19 | **Lens**: A (System Architecture)

## Inventory

41 entries in `agents/may/cron.json`, 3 disabled. 38 enabled, breaking down as:

### Heartbeats (7 LLM sessions, all 30min)
may, bob, optimizer, coach, scout, tech-lead, qa — no overlap, each agent distinct.

### Session Lifecycle (4 handlers)
| Handler | Interval | Purpose |
|---------|----------|---------|
| session-sync | 5min | Sync FS session metadata → SQLite (`cron.json:name="session-sync"`) |
| active-nudge | 5min | Detect loops/stalls in running sessions (`cron.json:name="active-nudge"`) |
| watchdog | 10min | Cancel sessions stuck >30min (`cron.json:name="watchdog"`) |
| zombie-cleanup | 60min | Archive orphaned sessions (`cron.json:name="zombie-cleanup"`) |

**Overlap**: watchdog, zombie-cleanup, and active-nudge all monitor session health. Watchdog cancels stuck sessions; active-nudge detects behavioral issues (loops, stalls); zombie-cleanup archives orphans. They operate on different lifecycle stages (running → stuck → orphaned) so consolidation would add complexity. **No action recommended.**

### Evaluation (3 handlers)
| Handler | Interval | Purpose |
|---------|----------|---------|
| evaluation-sync | 10min | Heuristic evaluations → SQLite (`cron.json:name="evaluation-sync"`) |
| evaluator-heartbeat | 30min | LLM eval calibration gate (`cron.json:name="heartbeat-evaluator"`) |
| convention-check | 30min | Convention compliance check (`cron.json:name="convention-check"`) |

No significant overlap — heuristic vs LLM vs convention are distinct concerns.

### Reporting (5 handlers)
| Handler | Interval | Purpose |
|---------|----------|---------|
| proof-of-life | 2h | Telegram digest (`cron.json:name="proof-of-life"`) |
| system-status | 4h | Operational status check (`cron.json:name="system-status"`) |
| daily-brief | 24h | Daily metrics summary (`cron.json:name="daily-brief"`) |
| daily-digest | 24h | Daily progress digest (`cron.json:name="daily-digest"`) |
| coaching-report | 24h | Coaching quality report (`cron.json:name="coaching-report"`) |

**⚠️ Overlap: daily-brief vs daily-digest** — both run daily, both summarize system activity. `daily-brief` writes metrics, `daily-digest` writes progress for human review. These could be a single handler producing one combined report. **Recommend consolidation.**

**Mild overlap: proof-of-life vs system-status** — both produce system health summaries. proof-of-life sends to Telegram (2h), system-status is internal (4h). Different audiences/channels justify keeping separate.

### Request Management (2 handlers)
| Handler | Interval | Purpose |
|---------|----------|---------|
| audit-requests | 2h | Expire/clean stale requests (`cron.json:name="audit-requests"`) |
| task-watchdog | 60min | Nudge agents about stale requests (`cron.json:name="task-watchdog"`) |

**Mild overlap**: both deal with request staleness. audit-requests auto-cleans, task-watchdog nudges. Different actions (cleanup vs nudge) justify separation, but could be phases of one handler. **Low-priority consolidation candidate.**

### Monitoring (4 handlers)
| Handler | Interval | Purpose |
|---------|----------|---------|
| heartbeat-context | 30min | Pre-compute context for heartbeats (`cron.json:name="heartbeat-context"`) |
| metrics-snapshot | 1h | Unified metric snapshots (`cron.json:name="metrics-snapshot"`) |
| tool-quality-scan | 4h | Tool failure patterns (`cron.json:name="tool-quality-scan"`) |
| error-scan | 4h | Error log patterns via workflow (`cron.json:name="error-scan"`) |

No significant overlap.

### Coaching/Training (5 handlers)
coaching-feedback-wf (12h), common-sense-verify (4h), common-sense-infra (24h), research-intake (24h), training-sprint (24h), reflect (6h) — all distinct purposes, no overlap.

### Maintenance (5 handlers)
workspace-compaction (24h), memory-trimmer (24h), agents-auto-commit (2h), review-auto-merge (30min), repo-gate-check (30min), lessons-graduation (24h) — all distinct.

### Data Sync (2 handlers)
research-sync (30min), tracker-compact (4h) — distinct.

### Already Deprecated (3)
error-log-scanner, coaching-feedback, amy-kimi — all disabled, kept for rollback.

## Summary

| Finding | Severity | Action |
|---------|----------|--------|
| daily-brief + daily-digest overlap | Medium | Consolidate into single daily report handler |
| audit-requests + task-watchdog overlap | Low | Could merge; different actions justify separation |
| 3 disabled handlers still in cron.json | Low | Clean up after sufficient rollback period |
| 38 enabled cron entries total | Info | High but each serves distinct purpose |

## Recommendation

**One consolidation worth doing**: Merge `daily-brief` and `daily-digest` into a single daily handler. Both are JS-only, both run at 24h intervals, both produce summary reports. The combined handler would produce one comprehensive daily report.

Everything else is well-factored — handlers that seem similar (watchdog/zombie-cleanup/active-nudge, audit-requests/task-watchdog) operate on different lifecycle stages or take different actions, making consolidation a net complexity increase.
