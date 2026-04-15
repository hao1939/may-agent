# Finding: Post-Restart Verification — Fixes Now Deployed

**Date:** 2026-03-18T10:49 UTC  
**Category:** Handler Health Check / Deployment Verification

## Summary

Process restart occurred at ~07:35 UTC on 2026-03-18. Multiple committed fixes are now live and verified working.

## Evidence

### 1. Cron Intervals Fixed ✅
- **Before restart (05:00-07:30 UTC):** optimizer heartbeat every 9 minutes
- **After restart (07:49+ UTC):** clean 30-minute intervals for all agents
- All 10 heartbeat entries firing at configured intervals

### 2. skipIfIdle Working ✅
- **38 idle skips in last 24h** (was 0 skips before restart)
- Evenly distributed: 4 per heartbeat entry (2 for evaluator, which has 2h interval)
- `hasPendingWork()` is correctly querying the DB (was broken when requests.db was empty)

### 3. All JS Handlers Healthy ✅
- **13 handler types active**, zero failures in last 12 hours
- Key handlers verified: watchdog (72 runs), evaluate-sessions (24), agents-auto-commit (72), error-log-scanner (3), audit-requests (6)
- Previously unfired handlers now active: daily-brief (1), lessons-graduation (1), workspace-compaction (1)

### 4. Preflight Checks Wired ✅
- 7 cron entries have preflight configs in cron.json
- `preflight-state.json` tracks baselines for 6 entries (consolidate-memory-* × 5, reflect)
- analyze-failures hasn't fired yet post-restart (24h interval, due ~18:58 UTC)

### 5. Session Volume Reduction
| Window | Heartbeat sessions per 4h |
|--------|--------------------------|
| 8-12h ago (pre-restart) | 150 |
| 4-8h ago (mixed) | 145 |
| Last 4h (post-restart) | 84 total, 46 effective (38 skipped) |

**69% reduction** in effective heartbeat sessions.

### 6. Only Failure: 1 Orphaned Session
- `heartbeat-amy-kimi` had one FAILED request at 07:35 (orphaned by restart) — expected behavior

## Items Still Blocked on Deployment

These fixes are committed but their effects couldn't be verified because they require specific trigger conditions:
- Prompt caching bypass (7c86665) — needs ANTHROPIC_API_KEY env var
- Tool-as-Agent guard (07b0d7f) — needs Bob to attempt misuse to verify
- Read-dedup guard (9eefa72) — needs Amy to attempt excessive reads
- Circuit breaker (97f3a50) — needs Bob API errors to verify
- finish() status fix (82ced56) — needs session with finish() tool call
- finish() evidence guard (2233509) — needs false success attempt
- Evaluator re-eval loop fix (e7c1cb9) — needs old session re-eval attempt

## Impact

The restart deployed at least **51 committed changes**. The cron interval + skipIfIdle fixes alone reduced heartbeat sessions by 69%, from ~37/hr to ~11.5/hr. At estimated ~$0.50-1.00 per heartbeat session, this saves **$12-26/hr = $288-624/day**.
