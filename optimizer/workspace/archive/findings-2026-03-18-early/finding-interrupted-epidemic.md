# Finding: 76.7% Session Interruption Rate

**Date**: 2026-03-18T05:04 UTC
**Severity**: HIGH — Systemic waste
**Status**: Root cause known, fix committed but undeployed

## Summary

Analysis of the last 30 sessions (most recent ~2 hours) shows:
- **23/30 (76.7%)** — interrupted
- **5/30 (16.7%)** — error (Bob's Gemini API)
- **2/30 (6.7%)** — done (completed normally)

**Only 2 out of 30 sessions completed successfully.** 93.3% are wasted or incomplete.

## Per-Agent Breakdown

| Agent | Sessions | Interrupted | Error | Done | Avg Ops |
|-------|----------|-------------|-------|------|---------|
| may | 6 | 6 | 0 | 0 | 4.2 |
| bob | 5 | 0 | 5 | 0 | 0.4 |
| tech-lead | 4 | 4 | 0 | 0 | 21.8 |
| coach | 4 | 4 | 0 | 0 | 7.3 |
| optimizer | 4 | 4 | 0 | 0 | 27.3 |
| qa | 2 | 1 | 0 | 1 | 10.0 |
| evaluator | 2 | 2 | 0 | 0 | 4.0 |
| amy-kimi | 1 | 0 | 0 | 1 | 11.0 |
| amy | 1 | 1 | 0 | 0 | 23.0 |
| scout | 1 | 1 | 0 | 0 | 14.0 |

## Key Observations

1. **Productive work is being lost**: Tech-lead (21.8 avg ops), optimizer (27.3 avg ops), and amy (23 ops) sessions are doing significant work but getting killed before `finish()`.

2. **Session durations vary widely** (12s to 465s), confirming interruptions come from new heartbeats firing, not fixed timeouts.

3. **May has 100% interruption rate** with only 4.2 avg ops — most sessions are idle.

4. **Bob has 100% error rate** — still the Gemini API issue.

## Root Cause

The cron config hot-reload is broken (known issue, fix committed at 440bc6a, f8a481c, 4c7cdc3). Intervals are stuck at their original short values (540-780s) instead of the configured 1800s. New heartbeats fire while previous sessions are still running, causing interruptions.

## Impact

- **~28 wasted sessions per 30** (including interrupted + error)
- At ~$0.40-1.00/session avg, this is **$11-28/hour in waste**
- Productive work is discarded when interrupted sessions don't call `finish()`
- Agent state/context from interrupted sessions is lost

## Fix Required

**Process restart** — PID 7 (bun src/app/launcher.ts) has been running since Mar 17 with 42+ undeployed commits including:
- Cron interval hot-reload fix
- Heartbeat preflight (skip idle sessions)
- Error circuit breaker
- Read-dedup guard
- finish() evidence guard
- Evaluator re-eval fix

All fixes are committed and tested. Deployment is blocked on a manual process restart.
