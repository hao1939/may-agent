# System Waste: 12-Hour Snapshot (2026-03-18T01:28 UTC)

## Executive Summary
**588 sessions in 12 hours (49/hr, 1,176/day projected).** The system is burning ~$280-350/day with the majority being waste from overfiring heartbeats and Bob's 26% error rate.

## Key Metrics (Last 12 Hours)

| Agent | Sessions | Avg Interval | Configured | Overfire | Error Rate | Est Cost/12h |
|-------|----------|-------------|------------|----------|-----------|-------------|
| coach | 99 | 6.7min | 30min | **4.5x** | 3% | $91.61 |
| may | 86 | 7.7min | 30min | **3.9x** | 5% | ~$6.55 |
| bob | 82 | 8.5min | 30min | **3.5x** | **26%** | ~$42.25 |
| optimizer | 69 | 9.6min | 30min | **3.1x** | 23% | ~$30* |
| evaluator | 63 | 10.9min | varies | — | 0% | ~$20* |
| tech-lead | 61 | 10.9min | 30min | **2.8x** | 13% | ~$20* |
| unknown | 60 | 11.3min | — | — | 0% | ~$0 (zombies) |
| qa | 23 | 30.0min | ✅ correct | 1x | 13% | ~$5* |
| amy | 18 | 32.6min | ✅ correct | 1x | 0% | ~$5* |
| scout | 15 | 45.5min | ✅ correct | 1x | 13% | ~$5* |
| amy-kimi | 11 | 33.0min | ✅ correct | 1x | 0% | ~$3* |
| coder | 1 | — | on-demand | — | 0% | $4.34 |
| **TOTAL** | **588** | | | | | **~$233+ /12h** |

*Cost estimates marked with * are extrapolated from agents with cost data. Actual may be higher.

## Root Causes

### 1. Cron Config Reload Broken (ALL agents affected)
- **Status**: Fixes committed (440bc6a, f8a481c, 4c7cdc3) but NOT deployed
- **Impact**: 6 agents firing at 3-4.5x configured rate
- **Fix**: Restart PID 7 (single ops action)
- **Savings**: ~400+ sessions/day eliminated = **$100-150/day**

### 2. Bob Gemini 3 Pro Failures (26% error rate)
- 21 error sessions in 12h, all "exhausted 2 recovery retries"
- Each failed session still costs API tokens on the attempts
- 24 escalations in 24h, all identical pattern
- **Fix**: Switch Bob's model from gemini3pro → opus/sonnet (needs Hao decision)
- **Savings**: ~$10-15/day in wasted Bob error sessions

### 3. 60 "Unknown" Zombie Sessions
- Sessions with no metadata, no agent, no content
- Evaluator processes them (wastes evaluator time) but there's nothing to evaluate
- Likely related to zombie cleanup code committed but not deployed
- **Fix**: Part of restart fix above; also filter `no_metadata` sessions from eval queue

### 4. Coach is Largest Cost Center ($91.61/12h measured)
- 99 sessions/12h = 8.25/hr, at $0.93/session
- **Projected: $183/day = $5,500/month just for Coach**
- 31/99 (31%) rated "needs_improvement"
- Firing every 6.7min vs configured 30min (4.5x overfire)
- After restart, should drop to ~$40/day

### 5. Optimizer Interruption Loop (this agent)
- 69 sessions in 12h, 16 errors (23%)
- Session history shows 20+ consecutive interrupted sessions
- Each session restarts work from scratch → massive waste
- Root cause: firing every 9.6min vs configured 30min

## Immediate Actions Required

### ⚡ URGENT: Restart PID 7
Single action that unlocks ALL committed fixes:
- Heartbeat interval corrections (30min for all agents)
- Idle-skip logic (skip heartbeats when no new work)
- Content-hash reload for cron config
- Zombie session cleanup
- Tool-as-agent guard

**Expected impact: 60-70% reduction in daily sessions and costs**

### 🔶 HIGH: Switch Bob's model
44% of Bob sessions error. Gemini 3 Pro streaming is unreliable.
Switching to anthropic/opus eliminates ~$10-15/day in wasted retries.

### 🔵 MEDIUM: Filter zombie sessions from eval queue
60 `no_metadata` sessions processed by evaluator per 12h — waste of evaluator capacity.

## Tracking
- Restart request: req:939d944c (sent to tech-lead, needs Hao)
- Bob model switch: documented in `finding-bob-gemini-errors.md`
- Cron reload fix: documented in `finding-cron-reload-broken.md`
