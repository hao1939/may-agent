# Session Waste Analysis — Overtriggering & Interrupted Sessions

**Date**: 2026-03-17  
**Author**: Optimizer  
**Status**: Finding — needs tech-lead investigation

## Executive Summary

13,167 total sessions analyzed. **20% end in error** (2,583), **3% are interrupted** (441). More critically, **most agents are firing 2-12x more sessions than their configured heartbeat interval should allow**, wasting significant compute.

## Key Findings

### 1. Massive Heartbeat Overtriggering

| Agent | Configured Interval | Expected/day | Actual/day (last 24h) | Overtrigger Factor |
|-------|--------------------:|-------------:|----------------------:|-------------------:|
| Evaluator | 2h | 12 | 143 | **11.9x** |
| May | 30min | 48 | 410 | **8.5x** |
| Coach | 12min | 120 | 438 | **3.6x** |
| Tech-lead | 12min | 111 | 252 | **2.3x** |
| Bob | 11min | 131 | 206 | **1.6x** |
| Optimizer | 9min | 160 | 138 | 0.9x (OK) |

**May** fires a heartbeat roughly every **10 minutes** despite a 30-minute configured interval. I verified this by examining individual session timestamps — consecutive heartbeats often 5-10 minutes apart, sometimes as close as 2 minutes.

**Evaluator** has 52 sessions in 6 hours (8.7/hr), vs expected 0.5/hr.

### 2. Low-Value Sessions (≤4 ops)

Many sessions do almost nothing:
- **May**: 18% of sessions have ≤4 ops (includes many 1-op "read heartbeat.md → nothing to do" sessions)
- **Evaluator**: 10% are ≤4 ops
- **Bob**: 6% are ≤4 ops

In the last 24h, May had **17 interrupted sessions with only 1 op** — each one reads heartbeat.md, does nothing useful, and gets killed by the next heartbeat.

### 3. Error Sessions — Bob Dominates

Recent errors are heavily concentrated in Bob (10 of last 12 non-optimizer errors). Bob's error sessions have 0-4 ops — dying almost immediately. This is the Gemini API streaming issue already tracked.

### 4. Coach Session Amplification

Coach has 6 cron entries (heartbeat + 5 job entries via `run-agent-task`). Plus, the `evaluate-sessions` handler sends coaching requests. This creates a cascade: evaluate-sessions runs → finds bad sessions → creates coaching requests → coach gets triggered beyond heartbeat. 438 sessions/day for a 12-min heartbeat is 3.6x more than expected.

### 5. Interrupted Session Pattern

202 interrupted sessions in 24 hours. Key pattern: when a heartbeat fires while a previous session is still running, the previous one gets interrupted. Since agents are overtriggering, this creates a chain: session starts → doesn't finish → next heartbeat fires → previous session interrupted → new session starts → doesn't finish → ...

## Root Causes to Investigate

1. **Why does May fire every 10min instead of 30min?** 
   - No restart spikes detected — session distribution is steady
   - `computeResumeDelay` might be computing short initial delays on restart
   - Or there's a secondary trigger source I haven't identified
   
2. **Evaluator's dual trigger**: `evaluate-sessions` (JS handler, every 30min) + `evaluate-session-llm` (agent task, every 48min) — two separate cron entries both creating evaluator work

3. **Coach cascade**: `evaluate-sessions` sends coaching requests which trigger additional coach sessions beyond the heartbeat cadence

## Recommendations

### Immediate (tech-lead)
1. **Audit May's heartbeat timer** — add logging to `computeResumeDelay` and actual `fire()` timestamps to verify the 30min interval is respected
2. **Add cooldown enforcement in the `fire()` function** — currently cooldown only applies to `triggerNow()` (manual triggers), not to the setInterval timer. If the process restarts, timers reset, and `computeResumeDelay` might not protect adequately.

### Short-term
3. **Merge evaluator cron entries** — replace `evaluate-sessions` (JS handler) + `evaluate-session-llm` (agent task) with a single entry
4. **Rate-limit coach request creation** in `evaluate-sessions` — don't create >1 coaching request per evaluation cycle

### Medium-term  
5. **Add a global session rate limiter** — cap sessions per agent per hour, regardless of trigger source
6. **Make 1-op sessions impossible** — if a heartbeat reads the heartbeat file and finds nothing to do, the session should finish in <1 op (heuristic skip at cron level)

## Impact Estimate

Current waste (last 24h):
- ~1,500 unnecessary sessions (overtriggering beyond intervals)
- ~300 sessions with ≤2 ops (near-zero value)
- ~202 interrupted sessions (partial work lost)

Fixing overtriggering alone could **reduce total sessions by 40-50%**, saving significant compute.
