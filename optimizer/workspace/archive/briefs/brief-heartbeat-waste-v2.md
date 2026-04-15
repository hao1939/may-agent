# Brief: Heartbeat Waste Analysis v2 — Interval Mismatch + Idle Skip Status

**Date**: 2026-03-17T22:30  
**Author**: Optimizer  
**Status**: Finding — two-part fix needed  
**Priority**: HIGH — $27.52/day waste, 344 heartbeats/day

## Executive Summary

344 heartbeat sessions fire per day at ~$0.08 each = **$27.52/day**. Two issues compound the waste:

1. **Interval mismatch** (config bug): 4 agents have intervalMs 3-4x shorter than their descriptions claim
2. **Idle skip deployed but not live**: Code committed at 22:22 UTC but server hasn't restarted

## Finding 1: Interval Mismatch

| Agent | Description | `intervalMs` | Actual Interval | Sessions/Day |
|-------|-------------|-------------|-----------------|-------------|
| optimizer | "30min" | 540,000ms | **9 min** | 160 |
| bob | "30min" | 660,000ms | **11 min** | 131 |
| coach | "30min" | 720,000ms | **12 min** | 120 |
| tech-lead | "30min" | 780,000ms | **13 min** | 111 |
| may | "30min" | 1,800,000ms | 30 min ✓ | 48 |
| scout | "30min" | 1,800,000ms | 30 min ✓ | 48 |
| amy | "1h" → 30min | 1,800,000ms | 30 min | 48 |
| amy-kimi | "30min" | 1,800,000ms | 30 min ✓ | 48 |
| qa | "30min" | 1,800,000ms | 30 min ✓ | 48 |
| evaluator | "2h" | 7,200,000ms | 2h ✓ | 12 |

**Impact**: If these 4 agents were at their intended 30min (1,800,000ms), we'd save ~330 sessions/day = **~$26.40/day**.

### Likely Cause
The short intervals may have been set during development/debugging and never reverted. Or they were set intentionally to get faster iteration. Either way, the descriptions are out of sync with reality.

## Finding 2: Idle Skip Code Not Active

Commit `848ebf1` ("feat: idle heartbeat pre-flight skip") was pushed at 2026-03-17T22:22:17 UTC. The server process (PID 7) started at 14:22 UTC — **8 hours before the code change**. The idle-skip logic exists in source but isn't running.

Evidence: **0 idle skips** across 344 heartbeats in 24h.

When active, the idle-skip should reduce ~66% of heartbeats (based on the initiative cadence of 3: 2 out of 3 idle heartbeats are skipped).

## Recommendations

### Fix 1 (Config — Low Risk): Correct interval mismatch
Update `agents/may/cron.json`:
- `heartbeat-bob`: 660000 → 1800000
- `heartbeat-optimizer`: 540000 → 1800000  
- `heartbeat-coach`: 720000 → 1800000
- `heartbeat-tech-lead`: 780000 → 1800000

**Est. savings: ~$26.40/day**

### Fix 2 (Server restart): Activate idle-skip code
The code in `cron.ts` already handles this. Just needs the server to restart or the cron module to reload.

**Est. savings: ~$12/day on top of Fix 1** (skipping idle heartbeats for all agents)

### Combined Impact
From $27.52/day → ~$3-5/day heartbeat cost. **~$24/day savings = ~$720/month**.

## Data Sources
- `.state/may.db` request tracking table
- `agents/may/cron.json` configuration
- `src/app/cron.ts` source code
- `git log` commit history
