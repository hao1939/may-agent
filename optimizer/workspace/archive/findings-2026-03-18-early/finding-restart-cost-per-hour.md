# Finding: Cost of Not Restarting PID 7

**Date:** 2026-03-18T03:55 UTC
**Process Uptime:** 13h 15m (since ~14:37 UTC Mar 17)
**Status:** 🔴 CRITICAL — Multiple fixes committed but undeployed

## The Problem

PID 7 (the main `launcher.ts` process) has been running for 13+ hours. During that time, 6 significant fixes have been committed to the codebase but **none are active** because the process hasn't been restarted.

## Measured Impact Today (March 18 UTC, ~4 hours)

| Metric | Current (Broken) | Expected (After Restart) |
|--------|-----------------|-------------------------|
| Sessions | 68 in ~4h (17/hr) | ~6-8/hr (with correct 1800s intervals) |
| Completion rate | 12% (8/68 done) | ~40-50% (sessions get time to finish) |
| Idle sessions | 47% (32/68 ≤3 ops) | ~10% (pre-flight check skips empties) |
| Bob sessions | 9 (all idle/error) | 0-1 (circuit breaker stops after 3 failures) |
| May sessions | 13 (11 idle) | ~2-3 (correct interval, pre-flight) |
| Cache hit rate | 0% for Opus | ~40-60% (direct Anthropic API) |

## Committed Fixes Awaiting Restart

| Commit | Age | Fix | Impact |
|--------|-----|-----|--------|
| 440bc6a + f8a481c | 3h 40m | Cron reload (content-hash + timer leak) | 3.33x fewer sessions |
| 7c86665 | 2h 40m | Bypass LiteLLM for Anthropic | $23-47/day savings |
| 4c7cdc3 | 3h 18m | Zombie session cleanup on startup | Clean stale sessions |
| 97f3a503 | 1h 20m | Agent error circuit breaker | Stops Bob waste |
| e7c1cb98 | 1h 50m | Evaluator re-eval age cutoff | Stops re-evaluating 9,974 old evals |
| 2233509 | 31m | finish() evidence guard | Blocks false success claims |

## Quantified Cost Per Hour of Delay

- **Excess sessions:** ~9-11 extra sessions/hour × ~$0.50 avg = **$4.50-5.50/hour wasted**
- **Lost caching savings:** ~$1-2/hour (Opus prompts not cached)
- **Total delay cost: ~$5.50-7.50/hour**

Since first fix committed (3h 40m ago): **~$20-28 wasted** from not restarting.

## Required Action

**Hao: restart PID 7.** This is a single `kill -TERM 7` or container restart. All 6 fixes activate immediately. No configuration needed (cron intervals already updated in `agents/may/cron.json`).

The only possible dependency is `ANTHROPIC_API_KEY` env var for the prompt caching fix (7c86665) — but the other 5 fixes work regardless.

## Data Source

Fresh measurement from session history at 2026-03-18T03:55 UTC:
- 68 sessions today, 8 done (12%), 32 idle (47%)
- Optimizer sessions firing every ~540s (configured: 1800s) — confirmed via consecutive session timestamps
- Bob: 9/9 sessions idle or error (Gemini API issues + no circuit breaker)
- May: 11/13 sessions idle (correct interval + pre-flight would eliminate most)
