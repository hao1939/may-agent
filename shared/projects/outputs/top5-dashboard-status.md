# Top-5 Dashboard — Status Report

**Status: Complete (awaiting M4 feedback)**

## What's Done (M1-M3)

1. **Tool**: `agents/may/workspace/tools/top5-metrics.ts` — computes top 5 metrics with color indicators (🟢🟡🔴), trend arrows (↑↓→), and 7-day history
2. **Handler**: `agents/may/handlers/daily-digest.ts` — generates daily digest including top-5 section
3. **Cron**: Registered in `agents/may/cron.json`, fires daily
4. **Output**: `agents/shared/daily-digests/2026-04-30.md` — latest digest with all features

## Current Metrics (2026-04-30)

| Metric | Value | Status |
|--------|-------|--------|
| Success Rate | 100% | 🟢 |
| Eval Quality | 0.44 | 🔴 |
| Handler Health | 100% | 🟢 |
| Error Rate | 0.1% | 🟢 |
| Sessions (24h) | 2240 | 🟢 |

## Actionable Signal

**Eval Quality at 0.44 🔴** — This is a real finding. 577 of 988 evaluated sessions are "needs improvement". This metric is the most actionable one the dashboard surfaces.

## M4: Feedback Needed

Questions for Hao:
- Are these the right 5 metrics?
- Should any be replaced (e.g., add latency, cost, or agent-specific metrics)?
- Is the 7-day history useful or noise?

## Where Hao Reads It

Daily digests are at `agents/shared/daily-digests/YYYY-MM-DD.md`. The top-5 section appears at the top of each digest.
