# Skill: Retry-Aware Dispatch

## When to Use
Before dispatching or starting any multi-session task (work that has failed or been interrupted before).

## The Problem
Tasks get re-dispatched every heartbeat with no memory of prior failures. This creates "zombie tasks" — identical work attempted 10-15+ times with zero completions, wasting 70+ sessions per day.

## Protocol

### Step 1: Check for Prior Attempts
Before starting work, check `.state/checkpoints/` for prior progress on this task:
```
ls .state/checkpoints/ | grep <task-keyword>
```
Also check recent session history for interrupted sessions with similar descriptions.

### Step 2: Branch on Attempt Count

| Attempt | Action |
|---------|--------|
| 1st | Normal execution. Checkpoint progress before session ends. |
| 2nd | Read prior checkpoint. Continue from last state, don't restart. |
| 3rd | Simplify scope — do the minimum viable version. |
| 4th | Decompose into 2-3 smaller sub-tasks that can each complete in one session. |
| 5th+ | **STOP.** Write a blocker report explaining WHY this keeps failing. Do NOT re-dispatch. |

### Step 3: Always Checkpoint
Before your session ends (whether success or interruption), call `checkpoint()` with:
- `files_modified`: what you changed
- `decisions`: key choices made
- `next_steps`: exactly what the next session should do
- `attempt_count`: current attempt number

### Step 4: Tag Dispatches
When dispatching recurring work, include attempt count:
```
"[Attempt 3/5] Ship EXP-188 finish-guard to production"
```

## Why This Works
- Prevents infinite retry loops (the #1 source of wasted sessions)
- Forces decomposition of tasks that are too big for one session
- Creates an escalation path instead of silent failure
- Checkpoint continuity means each attempt builds on the last

## Anti-Patterns
- ❌ Re-dispatching the exact same task description after 3 failures
- ❌ Starting from scratch when a checkpoint exists
- ❌ Dispatching large tasks without decomposition after repeated failures
- ❌ Never writing blocker reports — just silently retrying forever

## Tooling: Dispatch Registry

A concrete implementation is available at `shared/tools/dispatch-registry.sh`:

```bash
source shared/tools/dispatch-registry.sh

# Before dispatching:
dispatch_check "agent-name" "task description"   # exits 0=ok, 1=blocked

# After session completes:
dispatch_record "agent-name" "task description" "success|interrupted|error"

# View history:
dispatch_status "agent-name"
```

This implements the 3-strike rule with 6h cooldown and automatic reset on success.

## Evidence
- EXP-860 design: 70+ zombie sessions observed per 24h cycle in production
- Root cause: no retry tracking, no backoff, no escalation path
- Layer 2 implementation: `shared/tools/dispatch-registry.sh` (deployed 2026-05-05)
