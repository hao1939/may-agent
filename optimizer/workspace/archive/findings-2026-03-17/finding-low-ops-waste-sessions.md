# Finding: 18% of Sessions Are Near-Empty Waste (≤4 ops)

**Date:** 2026-03-17T22:10  
**Severity:** 🟡 MEDIUM  
**Data source:** 300 most recent sessions (last ~6 hours of production)

## Executive Summary

54 of the last 300 sessions (18%) completed ≤4 tool operations before dying (error/interrupted). These sessions still pay full context injection overhead — system prompt, SOUL.md, heartbeat.md, common-sense.md, session history, and pending tasks are all loaded and sent to the LLM even when the session does nothing useful.

## The Numbers

| Agent | Total Sessions | Waste (≤4 ops) | Waste % | Root Cause |
|-------|---------------|-----------------|---------|------------|
| **may** | 44 | **23** | **52%** | Heartbeat finds nothing to do, finishes in 1 op |
| **bob** | 53 | **19** | **36%** | Gemini API errors — session dies before first tool call |
| **evaluator** | 50 | 7 | 14% | Likely no sessions to evaluate, exits early |
| **amy** | 16 | 4 | 25% | No tasks, exits early |
| **coach** | 52 | 1 | 2% | Rare — coach usually has work |

## Root Cause Analysis

### May (52% waste rate) — Most Wasteful
May's heartbeat fires every 30 minutes. In addition, she has 23 enabled cron jobs (some as frequent as 10min). Many May sessions look like this:
1. Wake up (context injected: ~5K-15K tokens)
2. Check requests → nothing pending
3. `finish()` → "No pending tasks"

**These 1-op sessions still cost ~$0.20-0.35 each** (Opus input pricing on the injected context alone). With 23 waste sessions in 6 hours, that's ~$4.60-8.05 in 6h, or **$18-32/day of pure overhead**.

### Bob (36% waste rate) — API Reliability
Bob uses Gemini 3 Pro. 19 of his 53 sessions died with 0-4 ops. Many have `opCount: null` (died before even counting). The Gemini streaming API is unreliable, causing sessions to error out immediately.

**Cost is lower (~$0.05/session)** since Gemini is cheaper, but the pattern wastes cron slots and creates noise.

### Combined Waste
- **May waste:** ~$18-32/day
- **Bob waste:** ~$2-3/day (API errors, cheaper model)  
- **Others:** ~$5-10/day
- **Total estimated waste: ~$25-45/day**

## Proposed Fixes

### Fix 1: Pre-flight Check for May (HIGH IMPACT, LOW EFFORT)
Before spawning a May heartbeat session, check the request DB:
- If no pending requests for May → skip the heartbeat
- This is a **pure JS check** in `cron.ts` — no LLM needed
- Expected savings: Eliminate ~50% of May sessions = ~$16/day

### Fix 2: Bob API Retry with Backoff (MEDIUM IMPACT)
Bob's Gemini errors are a known issue (tracked in todo.md). Options:
- Add retry-with-backoff in the LLM proxy layer
- Switch Bob to a more reliable model during peak errors
- Skip heartbeat if last 3 sessions were API errors (cooldown)

### Fix 3: "Nothing-to-do" Short-Circuit (HIGH IMPACT, MEDIUM EFFORT)
For ALL heartbeat agents: add a lightweight JS pre-check:
1. Check request DB for pending tasks targeting this agent
2. Check if any cron jobs are due for this agent
3. If neither → skip the heartbeat entirely

This generalizes Fix 1 to all agents and could eliminate 30-50% of total waste sessions.

## Priority Recommendation

**Fix 3 is the highest-value change.** It's a systematic solution that applies to all agents. The pre-flight check should run in `cron.ts` before `triggerAgent()` is called. The check is pure JS (no LLM), takes <10ms, and would prevent ~$25-45/day in waste.

## Relationship to Cache Finding

This finding stacks with the Anthropic caching finding (finding-anthropic-cache-zero.md):
- Caching fix: **~$1,476/day** savings (from reducing per-token cost)
- Pre-flight fix: **~$25-45/day** savings (from eliminating empty sessions)
- Both are independent and should be pursued in parallel
