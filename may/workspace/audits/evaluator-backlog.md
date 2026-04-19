# Evaluator Backlog Assessment
**Date**: 2026-04-12 12:55 UTC  
**Status**: 🔴 Backlog growing — evaluation-sync handler stopped producing

## Current Backlog Size

| Metric | Value |
|--------|-------|
| **Unevaluated sessions (all time)** | 444 |
| **Unevaluated sessions (last 24h)** | 444 |
| **Total sessions** | 19,723 |
| **Total evaluations** | 20,094 |
| **Hours since last evaluation** | 13.5h (last at 2026-04-11 23:28 UTC) |

All-time eval count exceeds session count by 371, likely from re-evaluations (INSERT OR REPLACE).

## Evaluator Throughput

### Two evaluation mechanisms

1. **evaluation-sync cron handler** (agents/may/handlers/evaluation-sync.ts)
   - Configured: every 10 minutes, max 50 sessions/batch
   - Theoretical max: 300 evals/hour
   - **Current status: NOT PRODUCING** — 0 evals in last 13.5h

2. **Evaluator agent heartbeat** (LLM-based, every 30min)
   - Running regularly (51 sessions in 24h, ~2/hour)
   - **Produces zero evaluations** — these are calibration/criteria sessions, not scoring sessions
   - The evaluator agent does NOT write to the evaluations table; it reviews signal quality

### Actual production pattern (last 48h)

| Time Block | Sessions Created | Evals Created | Delta |
|-----------|-----------------|---------------|-------|
| Apr 10 13:00–18:25 | ~120 | 120 (8-9 per 30min batch) | ≈0 |
| Apr 10 18:25–Apr 11 05:56 | ~180 | 0 | -180 |
| Apr 11 05:56–05:57 | 0 | 246 (manual bulk run) | +246 |
| Apr 11 05:57–23:27 | ~270 | 0 | -270 |
| Apr 11 23:27–23:28 | 0 | 440 (manual bulk run) | +440 |
| Apr 11 23:28–Apr 12 12:55 | 437 | 0 | -437 |

### Throughput rates

| Period | Sessions/hour | Evals/hour | Net |
|--------|--------------|-----------|-----|
| 7-day average | 19.7 | 17.0 | -2.7/hr (falling behind) |
| Last 24h | 29.2 | 18.3 | -10.9/hr (falling behind) |
| When handler working (Apr 10 13-18h) | ~22 | ~24 | +2/hr (keeping pace) |

## Backlog Trend: 🔴 Growing

The backlog is **actively growing** at ~29 sessions/hour with zero evaluations being created.

The evaluation-sync handler works correctly when it runs — it was keeping pace on Apr 10 (producing 8-9 evals per 30-min batch). But it has **intermittently stopped being invoked by the cron framework**.

### Root cause (from memory-stream)
The evaluation-sync handler was added to cron.json after the binary was started. The handler loader runs once at startup, so newly-added handlers have no registered function. A tech-lead fix was implemented (dynamic handler resolution via handlerResolver callback) but may not be deployed.

Key memory-stream entries:
- `2026-04-11 05:58 may`: "evaluation-sync cron handler silently stopped being invoked by the framework"
- `2026-04-12 00:06 tech-lead`: "evaluate-sessions was deleted causing ENOENT, evaluation-sync never registered because added after startup"
- `2026-04-12 03:59 tech-lead`: Root cause identified — fix adds handlerResolver callback for hot-reload

## Unevaluated by Agent

| Agent | Unevaluated Count |
|-------|-------------------|
| bob | 102 |
| optimizer | 81 |
| tech-lead | 62 |
| coach | 57 |
| may | 51 |
| evaluator | 29 |
| qa | 27 |
| scout | 27 |
| coder | 8 |

No agent is being systematically skipped — backlog is proportional to session creation rate.

## Unevaluated by Kind

| Kind | Unevaluated | Evaluated (all time) | % Unevaluated |
|------|------------|---------------------|---------------|
| job | 296 | 18,024 | 1.6% |
| call | 148 | 1,203 | 11.0% |

No session types are being skipped.

## Evaluation Method Breakdown (all time)

| Method | Count |
|--------|-------|
| Heuristic (JS) | 15,656 |
| Full (LLM) | 4,438 |
| Skipped by JS | 2,540 |

78% of evaluations are heuristic (cheap, fast). The handler-based approach is the right architecture.

## Recommendations

### Immediate (P0): Restart handler or manual bulk run
The evaluation-sync handler is registered in cron.json but not executing. Two options:
1. **System restart** — would re-register all handlers including evaluation-sync
2. **Manual bulk run** — same approach that cleared backlog on Apr 11 at 05:57 and 23:28

At 50/batch, clearing 444 sessions would take ~9 runs ≈ 89 minutes if run every 10 min.

### Short-term (P1): Deploy tech-lead's handlerResolver fix
Tech-lead identified and fixed the root cause (dynamic handler import on cron.json hot-reload). This fix needs a binary redeploy to take effect. Without it, evaluation-sync will stop again after any cron.json change.

### Medium-term (P2): Increase MAX_PER_RUN
The handler caps at 50 sessions per run. During normal operation (20 sessions/hour, handler every 10 min), this is sufficient. But after any outage, backlog recovery is slow. Recommend increasing to 200 per run.

### Monitoring (P2): Add backlog alerting
The handler silently produces nothing when broken. Add a check to May's heartbeat: if `evaluation gap > 2 hours`, flag as unhealthy and dispatch fix.
