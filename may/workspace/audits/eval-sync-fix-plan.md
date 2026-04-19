# Evaluation-Sync Handler: Fix Plan

**Date**: 2026-04-12  
**Status**: Actionable — stopgap script ready, permanent fix needs restart

## Root Cause

The `evaluation-sync` handler stopped processing because of a **handler registration gap**:

1. **Running process**: `/usr/local/bin/may-agent` (binary from Apr 8 12:29, started Apr 9)
2. **Old handler**: `evaluate-sessions` was registered at startup (was in cron.json + handler file existed)
3. **Transition (Apr 10)**: `evaluate-sessions.ts` was deleted, `evaluation-sync.ts` was created, cron.json updated
4. **Problem**: The old binary has NO `handlerResolver` — new handler entries added to cron.json after startup are **silently ignored**
5. **Result**: `evaluation-sync` entry exists in cron.json but was never registered as a handler

### Why it worked sporadically (Apr 11)

The handler ran in 3 bursts:
- Apr 10 18:00 — 12 evals (likely from old `evaluate-sessions` before disable)
- Apr 11 05:00 — 246 evals (unknown trigger, possibly cron reload edge case)
- Apr 11 23:00 — 440 evals (last batch, then stopped permanently)

After 23:28 Apr 11: **zero evaluations for 14+ hours**.

## Current Backlog

- **465 unevaluated sessions** (done/error/interrupted with no evaluation row)
- Oldest: Apr 11 23:29 — newest: current (growing ~30-40/hour)
- Handler processes max 50 per run × 10min interval = 300/hour capacity (when working)

## The Fix That Exists But Isn't Deployed

Commit `30a8c9f` (Apr 12 07:24) adds `setHandlerResolver()` to cron.ts — dynamically loads handlers for new cron entries on reload. This fix is:
- ✅ In source (`src/app/cron.ts` line 59-92)
- ✅ Built into new binary (`/app/bundle/may-agent`, Apr 12 09:24)
- ❌ NOT running — process uses old binary at `/usr/local/bin/may-agent` (Apr 8)

### Permanent fix: **Restart the process with the new binary**
```
# Requires Hao / system access:
cp /app/bundle/may-agent /usr/local/bin/may-agent
supervisorctl restart may-agent
```

## Stopgap: Bulk Evaluation Script

Run this to clear the backlog immediately (no restart needed):

```bash
export PATH=".state/.bun/bin:$PATH"
cd /app && bun run agents/may/workspace/audits/bulk-eval.ts
```

The script below reuses the exact same logic from `evaluation-sync.ts` but runs standalone, processing ALL unevaluated sessions in one shot.

## Throughput When Working

| Day | Evals | Sessions |
|-----|-------|----------|
| Apr 5 | 71 | — |
| Apr 6 | 193 | — |
| Apr 7 | 538 | — |
| Apr 8 | 392 | — |
| Apr 9 | 575 | — |
| Apr 10 | 399 | — |
| Apr 11 | 686 | — |
| Apr 12 | **0** | ~400+ |

## Action Items

1. **Immediate**: Run `bulk-eval.ts` to clear 465-session backlog ← can be dispatched
2. **Permanent**: Restart process with new binary ← **BLOCKED on Hao**
3. **Recurring**: Until restart, run bulk-eval daily or on-demand to prevent backlog
