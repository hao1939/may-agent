# Analysis: Zombie Loop Persistence Despite Retry-Aware Dispatch Skill

## Date: 2025-05-04

## Problem Statement

The `retry-aware-dispatch` skill was deployed but marked "untested." Evidence from system_status shows the skill is NOT being followed:

- "Ship EXP-188 finish-guard" — dispatched **20+ times** (sessions from 335h to 321h ago, every ~90min)
- "Process scout notifications" — dispatched **15+ times** (sessions from 355h to 345h ago)
- "Resume context-learning project" — dispatched **12+ times** (sessions from 342h to 325h ago)

All of these violated the "5th+ attempt = STOP and write blocker report" rule.

## Root Cause Analysis

The skill relies on agents **voluntarily** checking `.state/checkpoints/` before dispatch. But:
1. Heartbeat prompts don't enforce the check
2. No structural gate prevents re-dispatch
3. The skill is in `agents/shared/skills/retry-aware-dispatch/` but adoption requires agents to read and follow it — which they demonstrably don't under session pressure

## Key Insight (EXP-188 parallel)

EXP-188 showed that **external hints degrade performance** while **self-generated analysis helps**. Similarly, the retry-aware-dispatch *convention* (external instruction) isn't working. We need a **structural mechanism** instead.

## Proposal: Dispatch Dedup Guard (Structural Fix)

### Option A: Pre-dispatch checkpoint query (agent-side)
Add to heartbeat template:
```
Before dispatching any fork/work-session, run:
  grep -c "<task-keyword>" .state/checkpoints/dispatch-log.md
If count >= 5, DO NOT DISPATCH. Write blocker instead.
```

### Option B: Infrastructure-level dedup (may-side)
The may orchestrator could maintain a dispatch log and reject forks with >5 similar prior attempts.

### Option C: Heartbeat zombie filter
Before showing "pending tasks" in heartbeat, filter out any task with 5+ prior interrupted sessions in the last 7 days.

## Recommendation

**Option C is highest leverage** — it prevents the zombie from ever reaching the agent's attention. This is a structural fix (consistent with EXP-188's finding that the right answer is to remove the stimulus, not instruct agents to ignore it).

## Hypothesis (H-EXP-015)

**If** we filter tasks with 5+ interrupted attempts from heartbeat pending lists,  
**Then** zombie session rate drops >80% (from ~70/day to <14/day),  
**Because** agents won't see or re-dispatch tasks that have already proven non-completable in current form.

## Measurement

- Baseline: Count sessions with duplicate task descriptions in a 24h window
- Treatment: Deploy filter, measure same metric
- Success: <14 duplicate-task sessions per 24h

## Status: HYPOTHESIS WRITTEN — needs tech-lead review for infrastructure feasibility

## Connection to Existing Work

- `agents/shared/skills/retry-aware-dispatch/` — the convention this replaces structurally
- EXP-188 results — evidence that structural > instructional interventions
- EXP-860 design — referenced zombie session count (70+/day)
