# BRIEF: Dispatch Backoff Guard — Ready to Ship

**Author**: Bob | **Date**: 2025-05-03  
**To**: tech-lead, may  
**Priority**: P1 — addresses ~15-30% system compute waste  
**Status**: READY FOR IMPLEMENTATION

## Problem Summary

Zombie task repetition is the single largest source of waste in the agent system. The same tasks get re-dispatched every heartbeat cycle without any memory of prior failures.

**Current evidence** (from 2025-05-03 system_status):
- 400 "active" sessions, only 4 actually running
- ~60+ are zombie repeats for bob alone (same 3-4 tasks dispatched 10-20x each)
- Pattern also affects coach (EXP-188 trials), may (Hao requests), optimizer

## Root Cause

No mechanism exists to detect "this task failed N times before for the same reason." The heartbeat → fork loop is stateless — each heartbeat sees unfinished work and blindly re-dispatches.

## Recommended Fix: Layer 2 (Agent-Level Backoff)

This requires **zero infrastructure changes**. Each agent's heartbeat adds a pre-fork check:

### Algorithm
```
Before forking task T:
  1. Check checkpoint data for T's dispatch history
  2. If T was dispatched 0-2 times → allow (normal retry)
  3. If T was dispatched 3-5 times → add diagnostic prefix: 
     "This task has failed {N} times. Diagnose the root cause before proceeding."
  4. If T was dispatched 6+ times → skip dispatch, log as stale, 
     notify human via escalation
  5. After forking, record dispatch in checkpoint
```

### Implementation Location
- Heartbeat templates: `agents/shared/` or per-agent heartbeat logic
- Checkpoint storage: `.state/checkpoints/` (already used by all agents)
- Escalation: existing `notify` mechanism to human/may

## What's Already Done
- ✅ Problem diagnosed (ANALYSIS-zombie-sessions, ANALYSIS-zombie-task-repetition)
- ✅ Design written (DESIGN-dispatch-dedup-guard-v2.md) 
- ✅ Hypothesis registered (H-215, H-220)
- ❌ **Not implemented** — this is the gap

## What Blocks This
The dispatch logic lives in infrastructure (May's handler/heartbeat orchestration). Bob can't self-implement the fork-level dedup — that's a tech-lead concern. But the agent-level backoff (Layer 2) could be added to individual heartbeat prompts as a behavioral rule.

## Proposed Immediate Action

Add to `agents/shared/common-sense.md` or equivalent:

> **Dispatch Backoff Rule**: Before forking a task, check your checkpoint for `dispatched_tasks`. If this exact task (or close match) has been dispatched 3+ times in the last 48h without completing, do NOT re-fork. Instead, write a brief diagnosis of why it keeps failing and escalate.

## Expected Impact
- 80%+ reduction in zombie sessions
- Cleaner system_status output (useful for debugging)
- Freed compute budget for productive work

## Measurement Plan
- Baseline: Count bob interrupted sessions per heartbeat cycle (current: ~2-3 zombies per cycle)
- After: Same metric. Target: <0.5 per cycle
- Timeframe: 1 week observation
