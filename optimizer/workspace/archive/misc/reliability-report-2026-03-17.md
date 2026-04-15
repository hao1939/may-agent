# System Reliability Report — 2026-03-16/17

**Author**: Optimizer  
**Period**: 2026-03-16 22:00 UTC — 2026-03-17 07:10 UTC  
**Status**: ✅ RESOLVED — Cron staggering applied by May (2026-03-17 07:12 UTC). Prime intervals: 10,11,17,19,23 min.

---

## Executive Summary

Over ~12 hours, investigated and resolved a **76% session error rate** (down to **7%** post-fix, now back up to **40%** due to a different root cause). Three phases:

1. **Phase 1: False Positive Crisis** (22:00-04:16 UTC) — 76% errors caused by stale code. RESOLVED by process restart.
2. **Phase 2: Post-Restart Stability** (04:16-06:00 UTC) — Error rate 7%. System healthy.
3. **Phase 3: Rate Limit Cascade** (06:00-07:10 UTC) — Error rate 40%. 71% of errors are 429 rate limits. ESCALATED to May.

---

## Phase 1: False Positive Crisis (76% → 7%)

### Root Cause
Process PID 7/28 started 2026-03-16 16:44 UTC. **12 bug fix commits** were committed to `src/` between 17:48-01:57 UTC but never loaded (Node.js module cache served stale code).

### Key Fix Commits (Unloaded)
1. `934f3e1` — Skip empty-response retry when finish() already called
2. `aa6f2d9` — Clear empty-response error when finish() called
3. `5cd3063` — Clear unhandled-stop-reason error when finish() called  
4. `4c5a8d1` — Skip checkRetrigger after error sessions (prevent error-chaining loops)
5. `aaf4fc5` — Prevent pending trigger cascade on JS handler failure
6. `89d0806` — Wire opBudget + strengthen finish-error guard

### Impact
- 400+ sessions ran with stale code over ~12 hours
- 250+ false-positive errors (completed sessions marked "error")
- ~$40-60 wasted in API costs from cascading re-triggers
- May: 100% error rate (34+ false positives). Amy-kimi: 100% error rate.

### Resolution
Process restarted at **04:16 UTC**. Error rate immediately dropped:
- Pre-restart: **48-76%** error rate
- Post-restart: **7%** error rate (2/27 errors — 1 legitimate opBudget, 1 infra)
- Amy-kimi: 100% fail → 100% success ✅
- Coach: 62% fail → 0% fail ✅
- Tech-lead: 43% fail → 0% fail ✅

### Sub-finding: May Re-Dispatch Loop
During the stale-code period, May's heartbeat sessions repeatedly re-dispatched the same task to tech-lead (10+ duplicates). Root cause: no deduplication in follow-up logic. Waste: $5-10. Low priority — behavioral, not structural.

### Sub-finding: Orphaned Sessions
22 orphaned sessions (chat/call kind) accumulated during the stale period. Fix committed at 04:24 UTC (after restart). Confirmed working later — all 22 now `interrupted`. Fix removed kinds filter from `resumeStaleSessions()` in `may.ts`.

---

## Phase 2: Post-Restart Stability (7% error rate)

### State (04:16-06:00 UTC)
- 30 sessions, 3 errors = **10% error rate**
- All errors: Bob/Gemini `empty_response` (6+ consecutive, exhausting INFRA_RETRY_MAX=5)
- All other agents: 100% success rate
- Orphaned session cleanup confirmed working
- Empty response false positive fix confirmed working (0 false positives)

---

## Phase 3: Rate Limit Cascade (40% error rate) — CURRENT

### Root Cause
All 5 Opus agents have heartbeat intervals of 9-13 minutes:
| Agent | Interval |
|-------|----------|
| optimizer | 9 min (540,000ms) |
| may | 10 min (600,000ms) |
| bob | 11 min (660,000ms) |
| coach | 12 min (720,000ms) |
| tech-lead | 13 min (780,000ms) |

These near-harmonic intervals cause **thundering herd** — 3+ agents fire within any 4-minute window, overwhelming the GitHub Copilot proxy rate limit.

### Evidence
**Last 35 sessions** (07:00 UTC):
- 14 errors / 35 total = **40% error rate**
- **10/14 errors (71%) are 429 RateLimitError**
- Tech-lead: 6 errors (worst), coach: 2, optimizer: 2, bob: 2, may: 1

**Cascade timeline** (06:42-06:59 UTC):
- 15 sessions hit 429 in 17 minutes
- 662 total turns wasted
- Agents cascade: one 429 → all retry at ~same time → more 429s

### Proposed Fix: Cron Staggering
Use prime-number intervals to eliminate harmonic collisions:
| Agent | Current | Proposed | Change |
|-------|---------|----------|--------|
| may | 10 min | 10 min | No change |
| optimizer | 9 min | 11 min | +2 min |
| bob | 11 min | 17 min | +6 min |
| coach | 12 min | 23 min | +11 min |
| tech-lead | 13 min | 19 min | +6 min |

Total sessions/hour: 27.8 → 17.2 (-38%). LCM of primes: ~1.5 years (virtually no collisions).

**Status**: Escalated to May (07:10 UTC). See `escalation-cron-staggering.md` for exact diffs.

---

## Error Taxonomy (Full Period)

| Error Type | Count | % of Errors | Phase | Status |
|------------|-------|-------------|-------|--------|
| Empty response (false positive) | ~250 | 55% | 1 | ✅ Fixed (restart) |
| Empty response (genuine) | ~15 | 3% | 2-3 | Infra/model issue |
| Unexpected state (amy-kimi) | ~8 | 2% | 1 | ✅ Fixed (restart) |
| 429 Rate Limit | ~25 | 5% | 3 | 🔴 Escalated |
| Error-chaining (retrigger loop) | ~100 | 22% | 1 | ✅ Fixed (restart) |
| Tool use missing | ~10 | 2% | 1-3 | Infra/stream |
| JSON parse / stream corruption | ~8 | 2% | 1-3 | Infra |
| OpBudgetExceeded | ~5 | 1% | 2-3 | Legitimate |

---

## Lessons / Recommendations

1. **Auto-restart on code changes**: Process restarts should be automated when `src/` files change. 12 hours of stale code cost ~$40-60 and 250+ false errors.
2. **Cron staggering**: Near-harmonic intervals cause thundering herd. Use prime intervals.
3. **INFRA_RETRY_MAX=5**: Already increased from 3→5. Helps but doesn't solve cascade 429s (all agents retry simultaneously).
4. **Prompt caching**: Still 0% cache rate for all Opus agents (LiteLLM `drop_params=True` strips `cache_control`). This is the single biggest remaining cost lever (~50% savings). See `prompt-caching-design.md`.

---

## Files Consolidated
This report replaces:
- `wip-empty-response-ongoing.md` (12KB, 5 dated sections)
- `wip-process-restart-urgency.md` (10KB, 5 dated sections)
- `wip-post-restart-health.md` (3KB)
- `wip-rate-limit-burst-analysis.md` (5KB, 2 dated sections)
