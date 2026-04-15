# Finding: Zero Completion Rate for 6 of 9 Agents

**Date:** 2026-03-18T02:58 UTC
**Severity:** Critical
**Root Cause:** Cron reload broken (known — see finding-cron-reload-broken.md)
**New insight:** Quantified impact on output quality, not just cost

## The Data (last 3 hours, 130 sessions)

| Agent | Done | Interrupted | Error | Completion % | Avg Duration |
|-------|------|-------------|-------|-------------|--------------|
| amy-kimi | 6 | 0 | 0 | **100%** | 326s |
| qa | 2 | 4 | 0 | 33% | 133s |
| evaluator | 7 | 3 | 0 | 70% | 17s |
| bob | 0 | 2 | 14 | **0%** | 17s (err) |
| may | 0 | 21 | 0 | **0%** | 30s |
| coach | 0 | 26 | 0 | **0%** | 119s |
| optimizer | 0 | 19 | 0 | **0%** | 359s |
| tech-lead | 0 | 14 | 0 | **0%** | 368s |
| scout | 0 | 6 | 0 | **0%** | 331s |
| amy | 0 | 6 | 0 | **0%** | 384s |

**Summary: 15 done out of 130 sessions = 11.5% system-wide completion rate**

## Why This Matters

Previous findings focused on **cost waste** ($394-441/day). This finding shows the **output quality** impact:

1. **6 agents produce zero completed work** — coach, optimizer, tech-lead, scout, amy, may all have 0% completion in 3 hours
2. **Only amy-kimi reliably completes** — likely because Kimi model responds faster
3. **Bob is a special case** — 100% Gemini API errors, not even starting work
4. **115 of 130 sessions (88.5%) produced no finished output**

## Mechanism

The 540s actual cron interval (vs 1800s configured) means:
- Agent starts heartbeat at T=0
- Next heartbeat fires at T=540s (9 min)
- System kills previous session (maxConcurrency=1, autoClose=immediate)
- Any agent needing >9 min to complete useful work gets killed every time

Agents that DO complete (amy-kimi, evaluator) succeed because:
- **evaluator**: Very fast handler-based work (avg 17s)
- **amy-kimi**: Kimi model fast enough to complete within ~5.5 min on average

## Impact

The system is running but producing almost nothing. 88.5% of compute spend generates zero deliverables. This is worse than a cost problem — it's a **capability problem**. The team effectively has 3 working agents out of 9.

## Fix

Same as prior finding: **restart PID 7** to pick up the committed cron config fixes (1800s intervals). This single action would:
1. Give agents 30 min instead of 9 min → completion rate should jump from 11.5% to ~80%+
2. Reduce session count from 43/hr to ~12/hr → 72% cost reduction
3. Stop Bob error spam → 14 fewer error sessions per 3 hours

## Previously Reported

- Cron reload bug: req:939d944c (restart request)
- Cost quantification: finding-restart-urgency-quantified.md
- Bob errors: finding-bob-gemini-circuit-breaker.md
- **NEW in this finding**: Completion rate impact — proves system is functionally broken, not just expensive
