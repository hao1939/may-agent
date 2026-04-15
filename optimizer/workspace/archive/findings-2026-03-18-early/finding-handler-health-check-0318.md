# Handler Health Check — 2026-03-18T04:28

## Summary
3 of 13 JS handlers have **NEVER FIRED** since system start (~22h ago). All other handlers healthy.

## Findings

### ✅ Healthy Handlers (running correctly)
| Handler | Interval | Runs (4h) | Actual Interval |
|---------|----------|-----------|-----------------|
| watchdog | 10min | 24 | 10.0min ✅ |
| agents-auto-commit | 10min | 24 | 10.0min ✅ |
| evaluate-sessions | 30min | 8 | 30.0min ✅ |
| audit-requests | 2h | 2 | 2h ✅ |
| error-log-scanner | 4h | 1 | ~4h ✅ |
| system-status | 4h | 1 | ~4h ✅ |

### ❌ Never-Fired Handlers
| Handler | Configured | Added | Last Run |
|---------|-----------|-------|----------|
| daily-brief | 24h | Mar 17 22:34 | NEVER |
| lessons-graduation | 24h | Mar 17 15:26 | NEVER |
| workspace-compaction | 24h | Mar 18 02:53 | NEVER |

### LLM-based cron tasks (also running)
| Task | Interval | Runs (4h) |
|------|----------|-----------|
| training-sprint | 12h | 1 ✅ |
| research-intake | 12h | 1 ✅ |
| common-sense-verify | 4h | 1 ✅ |
| common-sense-infra | 24h | 1 ✅ |

## Root Cause
**Known: cron config hot-reload is broken** (see `finding-cron-reload-broken.md`).

All three never-fired handlers were added to `cron.json` AFTER the process (PID 7) started on Mar 17 ~06:00 UTC. The running process uses the old mtime-based config watcher which doesn't detect changes reliably in this environment. Content-hash fix committed (440bc6a) but undeployed.

Note: `common-sense-infra` (also 24h) DID fire because it existed in cron.json at process start time. The difference is when the entry was added, not the interval length.

## Secondary Issue: Initial Delay Jitter for Long-Interval Jobs
Even after deploy, `computeResumeDelay()` uses `Math.floor(Math.random() * entry.intervalMs)` for first-ever runs. For a 24h handler, this means up to 24h random delay before first fire. Should cap at e.g. `Math.min(entry.intervalMs, 300_000)` (5 min max jitter for never-run entries).

## Impact
- **daily-brief**: No daily system metrics summaries generated for 22h
- **lessons-graduation**: LESSONS.md health scans not running (automation I built is dead)
- **workspace-compaction**: 2,300+ stale files not being archived

All will self-heal after process restart.

## Action Required
Same as all other findings: **restart PID 7** (req:939d944c).
