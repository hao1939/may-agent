# Finding: Cron Handler Set — Redundancy & Overlap Analysis

**Date**: 2026-04-18  
**Lens**: A (System Architecture)  
**Severity**: Low (no active bugs, but maintenance/cognitive overhead)

## Summary

42 cron entries registered (`agents/may/cron.json`), 38 enabled. Three overlap clusters exist where multiple handlers operate on the same domain. Total cron-triggered load: **~27 invocations/hour** (dominated by 5-min interval jobs).

## Cron Inventory by Interval

| Interval | Count (enabled) | Handlers |
|----------|----------------|----------|
| 5min | 2 | session-sync, active-nudge |
| 10min | 2 | watchdog, evaluation-sync |
| 30min | 10 | 7 heartbeats (may, bob, optimizer, coach, scout, tech-lead, qa) + convention-check, heartbeat-context, research-sync, repo-gate-check, review-auto-merge, evaluator-heartbeat |
| 1h | 3 | zombie-cleanup, task-watchdog, metrics-snapshot |
| 2h | 3 | proof-of-life, agents-auto-commit, audit-requests |
| 4h | 4 | system-status, tracker-compact, common-sense-verify, error-scan, tool-quality-scan |
| 6h | 1 | reflect |
| 12h | 1 | coaching-feedback-wf |
| 24h | 8 | daily-brief, analyze-failures, optimize, coaching-report, training-sprint, research-intake, workspace-compaction, memory-trimmer, lessons-graduation, daily-digest, common-sense-infra |
| 1w | 1 | health-trend |

**Disabled (4):** heartbeat-amy-kimi, error-log-scanner, coaching-feedback, (none else)

## Overlap Cluster 1: Stuck/Stale Session Management

Three handlers all query running sessions and take corrective action:

- **active-nudge** (5min, `active-nudge.ts`): Detects loops/stalls/ghosts in running sessions, cancels or writes nudge files. (`active-nudge.ts:1-15`)
- **watchdog** (10min, `watchdog.ts`): Cancels sessions running longer than per-agent thresholds (default 60min). (`watchdog.ts:1-15`, threshold at `watchdog.ts:23`)
- **zombie-cleanup** (60min, `zombie-cleanup.ts`): Archives sessions stuck in "running" that aren't active in memory. (`zombie-cleanup.ts:1-12`)

**Assessment**: These are actually **layered** rather than redundant. active-nudge catches behavioral issues (loops) fast; watchdog catches time-exceeded sessions; zombie-cleanup catches process-level orphans. The concern is that active-nudge (5min) and watchdog (10min) could **both cancel the same session** — active-nudge detects a stall, watchdog detects timeout. Risk: double-cancel log noise. Not a correctness issue (cancelling an already-cancelled session is a no-op).

## Overlap Cluster 2: Request Lifecycle Management

- **audit-requests** (2h, `audit-requests.ts`): Auto-expires stale CREATED requests (>4h), resets orphaned IN_PROGRESS, archives old completed. (`cron.json` description)
- **task-watchdog** (1h, `task-watchdog.ts`): Nudges agents about stale requests, escalates to May/human if ignored. (`cron.json` description)

**Assessment**: Complementary — task-watchdog nudges, audit-requests expires. No true redundancy, but they both scan the requests table with overlapping queries. Could be merged into one handler with two modes.

## Overlap Cluster 3: Deprecated + Replacement Coexisting

- **coaching-feedback** (disabled) + **coaching-feedback-wf** (enabled, 12h): Old handler kept for rollback. (`cron.json`)
- **error-log-scanner** (disabled) + **error-scan** (enabled, 4h): Same pattern. (`cron.json`)

**Assessment**: No runtime cost (disabled entries are skipped), but they add 90 lines of dead config. Low priority cleanup.

## Total Load Per Hour

- 5min jobs: 2 × 12 = **24 invocations/hr**
- 10min jobs: 2 × 6 = **12 invocations/hr**
- 30min jobs: ~12 × 2 = **24 invocations/hr** (but heartbeats are LLM sessions, ~$0.10-0.50 each)
- 1h jobs: **3/hr**
- Less frequent: ~**2/hr** amortized

**Total: ~65 invocations/hr**, of which ~24/hr are heartbeat LLM sessions and ~41/hr are JS-only (zero LLM cost).

## Recommended Actions (for separate sessions)

1. **Low priority**: Remove disabled cron entries (coaching-feedback, error-log-scanner, heartbeat-amy-kimi) — dead config cleanup.
2. **Low priority**: Consider merging audit-requests + task-watchdog into a single request-lifecycle handler with nudge + expire phases.
3. **No action needed** on the session management cluster — the layering is intentional and correct.
