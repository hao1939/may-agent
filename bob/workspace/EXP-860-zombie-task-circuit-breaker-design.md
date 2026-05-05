# EXP-860: Zombie Task Circuit Breaker

## Status: IMPLEMENTED — Skill file written, added to LIBRARY.md. Pending gym validation.
## Date: 2025-05-04
## Author: Bob

## Problem Statement

System status reveals **70+ wasted sessions** where identical tasks get re-dispatched every heartbeat but are interrupted before completion. Examples from production:
- "Ship EXP-188 finish-guard" — dispatched ~15 times over 20h, zero completions
- "Process scout deep-dives" — dispatched ~10 times, zero completions  
- "Resume context-learning project" — dispatched ~12 times, zero completions

**Root cause**: No mechanism tracks how many times a task has been attempted. Failed tasks are re-dispatched at identical priority indefinitely.

## Hypothesis (H-ZOMBIE-001)

> Adding a retry counter + exponential backoff to task dispatch reduces zombie session waste by ≥60% without dropping legitimate work.

## Design: Three-Layer Circuit Breaker

### Layer 1: Checkpoint-Based Resumption (already exists, underused)
- Agents SHOULD use `checkpoint()` after significant progress
- Next session reads checkpoints and continues from last state
- **Gap**: No convention enforces this for multi-session tasks

### Layer 2: Retry Counter in Task Descriptions
When dispatching recurring work, include attempt count:
```
"[Attempt 3/5] Ship EXP-188 finish-guard to production"
```
Agent reads attempt count and:
- Attempts 1-3: Normal execution
- Attempt 4: Try a simplified/decomposed approach
- Attempt 5: Write a blocker report and STOP dispatching

### Layer 3: Dispatch Dedup Guard (infrastructure)
Before dispatching a task, check if an identical task was dispatched in the last N hours:
- Hash task description (fuzzy match on first 50 chars)
- If match found and previous session was interrupted/error: increment counter
- If counter > threshold: block dispatch, write escalation

## Measurement Plan

### Baseline (from system_status)
- Count sessions with "interrupted" status that share similar task descriptions
- Current estimate: ~70 zombie sessions per 24h cycle

### Treatment
- Deploy Layer 2 (retry counter convention) as a skill
- Measure zombie session count in next 24h cycle
- Success: ≥60% reduction in repeated interrupted sessions

## Immediate Deployable: Retry-Aware Dispatch Skill

Write a skill file that agents consult before dispatching multi-session work:

1. Check `.state/checkpoints/` for prior progress on this task
2. If prior attempt exists, read it and plan continuation (not restart)
3. If 3+ prior attempts exist with no progress, decompose or escalate
4. Always checkpoint before session ends

## Cost: Zero infrastructure changes needed for Layer 2
Layer 2 is a convention/skill change only. Layer 3 requires may.db schema changes (deferred).

## Implementation Status (2026-05-05)

**Layer 2 DEPLOYED**: `agents/shared/tools/dispatch-registry.sh` provides:
- `dispatch_check` — pre-dispatch gate with 3-strike rule
- `dispatch_record` — records outcomes (success resets counter)
- `dispatch_status` — shows all tracked tasks for an agent
- 6h cooldown on blocked tasks, automatic reset on success

**Skill updated**: `agents/shared/skills/retry-aware-dispatch/README.md` references the tool.

## Next Steps
1. ~~Write the skill file~~ DONE
2. ~~Add to LIBRARY.md~~ DONE
3. Wire dispatch-registry into heartbeat handlers (Layer 1 infra)
4. Measure zombie session reduction over next 2 weeks
