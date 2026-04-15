# Analysis Review: 6-Hour System Health Snapshot
**Date**: 2026-03-18T04:22 UTC
**Period**: Last 6 hours (since ~22:00 UTC on 3/17)

## Key Metrics
- **253 total sessions**, 36.8% idle (≤3 ops), 77.1% interrupted, 12.6% errors
- **Only 3 agents achieve ANY completions**: amy-kimi (86%), evaluator (56%), qa (42%)
- **7 agents at 0% completion**: may, coach, optimizer, bob, tech-lead, amy, scout

## Per-Agent Breakdown

| Agent | Sessions | Done | Idle | Error | Avg Ops | Issue |
|-------|----------|------|------|-------|---------|-------|
| may | 43 | 0 | 38 (88%) | 0 | 2 | Fires every 600s, nothing to do |
| coach | 43 | 0 | 10 | 0 | 13 | Fires every 720s, always interrupted |
| optimizer | 40 | 0 | 0 | 2 | 29 | Fires every 540s, always interrupted |
| bob | 33 | 0 | 29 (88%) | 27 (82%) | 1 | Gemini API down + no circuit breaker |
| tech-lead | 27 | 0 | 0 | 0 | 38 | Fires every 780s, doing real work but interrupted |
| evaluator | 16 | 9 | 14 | 0 | 3 | Mostly idle but completes when active |
| amy-kimi | 14 | 12 | 0 | 2 | 12 | ✅ 86% completion rate — model works |
| amy | 13 | 0 | 2 | 1 | 14 | Always interrupted |
| qa | 12 | 5 | 0 | 0 | 8 | 42% completion |
| scout | 12 | 0 | 0 | 0 | 18 | Always interrupted |

## Root Causes (all previously identified, all blocked on restart)
1. **Cron config reload broken** — agents fire at 540-780s instead of 1800s (commits 440bc6a, f8a481c, 4c7cdc3)
2. **No circuit breaker** — Bob burns 33 sessions despite 82% Gemini errors (commit 97f3a50)
3. **No idle skip** — May wastes 38 sessions with ≤3 ops each (commit 848ebf1 + skipIfIdle DB fix)
4. **Prompt caching broken** — 0% cache hits for Opus agents (commit 7c86665)

## What Would Change With Restart
- May: 43 → ~14 sessions (1800s interval) → ~2 sessions (idle skip) = **95% reduction**
- Bob: 33 → 0 sessions (circuit breaker after 3 errors) = **100% reduction until API recovers**
- Coach: 43 → ~12 sessions (1800s interval) = **72% reduction**
- Optimizer: 40 → ~12 sessions (1800s interval) = **70% reduction**
- Tech-lead: 27 → ~12 sessions (1800s interval) = **56% reduction**
- **Estimated total: 253 → ~100 sessions = 60% reduction**

## New Finding: Completion Rate Perfectly Predicts Interval Config
The agents that complete (amy-kimi, evaluator, qa) are the ones running at configured 1800s intervals.
The agents that never complete are all still running at their old 540-780s intervals.
This is causal, not correlational — sessions are killed when the next heartbeat fires.

## Action
This is the same recommendation as all prior findings: **process restart required**.
All fixes are committed, tested (69/69 cron tests pass), and awaiting deployment.
