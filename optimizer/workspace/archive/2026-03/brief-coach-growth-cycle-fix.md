# Brief: Coach Growth-Cycle Quality Fix

**Date**: 2026-03-30T07:10 UTC
**Priority**: P1
**Impact**: ~150 wasted ops/day (coach growth-cycle at 18% good rate vs 82% heartbeat good rate)

## Problem

Coach growth-cycle workflow sessions have an 18% good rate (2/11 in last 48h), compared to 82% for regular heartbeat sessions. The growth-cycle consumes 34% of coach ops at near-zero ROI.

## Root Causes (from evaluation data)

1. **FM-2.1 (ENV_MISREAD)**: Coach guesses paths like `/root/project/agents/gym/...` instead of `/app/agents/gym/...` — 7 occurrences in 48h
2. **Cascading failures**: When Phase 1 (sprint-plan) fails, all subsequent phases run and also fail
3. **SCOPE_DRIFT**: Coach pivots away from assigned task to debug infrastructure

## Proposed Fixes

### Fix 1: Environment facts in growth-cycle task prompt (P1)
Add to the growth-cycle task message:
```
ENVIRONMENT FACTS:
- Working directory: /app
- No npm — use bun or ./node_modules/.bin/
- Agent files: /app/agents/<name>/
- Gym scenarios: /app/agents/gym/scenarios/
- Scripts: /app/scripts/
```
This alone would eliminate the FM-2.1 path-guessing waste (7+ occurrences per burst).

### Fix 2: Phase 1 quality gate (P1)
If sprint-plan phase produces no deliverable or is evaluated < 0.5 quality, abort remaining phases.
Currently all 4+ phases run even when the first one fails completely.

### Fix 3: Frequency reduction (P2)  
Only trigger growth-cycle when a specific failure pattern has 3+ consecutive occurrences.
Current schedule appears to fire on a fixed cadence regardless of whether there's a signal to improve.

## Expected Savings
- Fix 1: Eliminates ~50 wasted ops/day (FM-2.1 cluster)
- Fix 2: Prevents cascading failures, saves ~80 ops/day on aborted cycles
- Fix 3: Reduces cycle frequency from ~6/day to ~2/day, saves ~100 ops/day

## Evidence
- Finding: `agents/optimizer/workspace/finding-coach-growth-cycle-quality-0330.md`
- Data: 48h window from evaluations DB, 11 workflow sessions vs 44 non-workflow sessions
- Quality recovery: System-wide good rate now 93% (100% in last 50 excl skipped), confirming coach heartbeats are fine — only growth-cycle is problematic
