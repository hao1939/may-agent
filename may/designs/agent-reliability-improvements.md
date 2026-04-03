# Agent Reliability Improvements

**Status**: Diagnosis complete, recommendations ready  
**Author**: May  
**Date**: 2026-04-03

## Problem

Agent heartbeat sessions have high failure rates:

| Agent | Done | Interrupted | Error | Success Rate (48h) |
|-------|------|-------------|-------|---------------------|
| amy-kimi (kimi) | 39 | 2 | 1 | 93% |
| evaluator (gpt52) | 11 | 0 | 0 | 100% |
| may (opus) | 53 | 1 | 0 | 98% |
| qa (gpt52) | 4 | 2 | 0 | 67% |
| bob (opus) | 21 | 27 | 6 | 39% |
| coach (opus) | 6 | 7 | 4 | 35% |
| tech-lead (opus) | 8 | 5 | 3 | 50% |
| scout (opus) | 5 | 8 | 5 | 28% |
| optimizer (opus) | 2 | 2 | 19 | 9% |

## Root Causes

### 1. Too Many Concurrent Opus Sessions
Every 30 minutes, up to 9 heartbeats fire with only 0-20min stagger offsets. Since each session takes 5-20 minutes, we get 4-6 simultaneous opus API sessions. This causes:
- API rate limit pressure
- Memory/resource contention
- Cascading slowdowns that trigger watchdog cancellations

### 2. Turn Limit Too Low for Some Agents
Optimizer hits 31/30 turn limit on almost every run (19 errors, most are turn limit). Scout also hits it frequently. These agents do complex multi-step work (web scraping, code analysis) that takes more turns than Bob/May.

### 3. No Concurrency Control
There's no mechanism to prevent all heartbeats from running simultaneously. The `offsetMs` values (240s, 480s, 720s) are too close together — by the time Scout starts (720s offset), May is still running from T+0.

### 4. Watchdog Catches Long-Running Sessions
Sessions that run >30min get killed by the watchdog. This is correct behavior but combined with concurrent resource contention, it means sessions that COULD finish in 25 minutes are slowed to 35 minutes by contention, then killed.

## Recommended Fixes

### Fix 1: Increase Optimizer MaxTurns (Quick Win)
Optimizer's 30-turn limit is the #1 cause of its 91% failure rate. Increase to 40 (matching Coach/Evaluator).

### Fix 2: Spread Heartbeat Offsets Further
Current offsets create a burst within a 20min window. Spread them across the full 30-minute interval:
- May: 0s (0min)
- Bob: 420s (7min) — was 240s  
- Optimizer: 840s (14min) — was 480s
- Scout: 1260s (21min) — was 720s
- Amy-kimi: 1500s (25min) — was 960s
- QA: 1680s (28min) — was 1200s

### Fix 3: Reduce Scout/Optimizer to 60-min Intervals
These agents do deep work that routinely takes 20+ minutes. Running every 30 minutes means sessions overlap with themselves. Moving to 60-min intervals (matching Coach/Tech-lead) would halve concurrency AND they'd be more likely to complete each session.

### Fix 4: Add Concurrency Limiting (Tech-lead task)
Add a `maxConcurrentHeartbeats` setting to cron.ts that queues heartbeats when too many are already running. Target: max 3 simultaneous opus sessions. This is the proper long-term fix.

## Immediate Actions

Applying Fix 1 and Fix 2 now (cron.json changes). Fix 3 requires Hao's approval. Fix 4 requires a tech-lead implementation.
