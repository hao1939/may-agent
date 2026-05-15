# DESIGN: Dispatch Deduplication Guard

**Author**: Bob | **Date**: 2025-05-01 | **Status**: Proposal

## Problem

System status shows **50+ interrupted bob sessions** over 2 weeks, all repeating 3 stale tasks:
1. "Ship EXP-188 finish-guard" — ~20 attempts (EXP-188 already CONCLUDED)
2. "Resume context-learning project" — ~15 attempts (project already closed)
3. "Process scout deep-dives" — ~10 attempts (already processed)

This pattern is not unique to Bob. Findings exist for:
- `bob-duplicate-task-dispatch.md` — 11 identical human dispatches in 12 minutes
- `evaluator-duplicate-dispatches.md` — same pattern
- `stale-request-queue-bloat.md` — queue fills with unresolvable tasks

**Root cause**: No mechanism to detect that a dispatched task has already been completed or is permanently blocked. Tasks re-dispatch every heartbeat cycle.

## Proposed Solution: Three-Layer Guard

### Layer 1: Completion Signal Check (Heartbeat)
Before dispatching any recurring task, the heartbeat handler checks:
```
IF task_output_file EXISTS AND task_status IN (CONCLUDED, SHIPPED, CLOSED):
  → Skip dispatch, log "task already complete"
```

For Bob's specific cases:
- EXP-188: Check `experiments/EXP-188/results.md` contains "CONCLUDED" → skip
- context-learning: Check project status is "closed" → skip
- scout deep-dives: Check processing timestamp > latest deep-dive timestamp → skip

### Layer 2: Duplicate Window (Request Queue)
Before creating a new request, check if an identical task (fuzzy match on description) was created in the last N hours:
```
IF similar_request EXISTS AND age < 2h AND status IN (CREATED, IN_PROGRESS):
  → Reject new request, log "duplicate suppressed"
```

### Layer 3: Interrupt Counter (Circuit Breaker)
Track consecutive interrupts per task pattern:
```
IF same_task_pattern interrupted >= 3 times in 24h:
  → Quarantine task, notify operator
  → Reason: "Task interrupted 3+ times — likely permanently blocked"
```

## Implementation Plan

1. **Immediate (this session)**: Update `agents/bob/todo.md` to remove stale tasks
2. **Short-term**: Add completion checks to heartbeat prompt template
3. **Medium-term**: Propose Layer 2+3 to tech-lead for may handler integration

## Impact Estimate
- **50+ wasted sessions/week** → near-zero with Layer 1 alone
- **30% of bob session budget** recovered for productive work
- Generalizes to all agents (optimizer, evaluator have same patterns)

## Decision Rules
- Ship Layer 1 if: stale task re-dispatch drops to <2/week
- Ship Layer 2 if: Layer 1 insufficient, duplicate rate >5%
- Ship Layer 3 if: interrupt loops persist after Layers 1+2

## Related
- `.state/findings/bob-duplicate-task-dispatch.md`
- `.state/findings/stale-request-queue-bloat.md`
- `agents/bob/workspace/ANALYSIS-session-dormancy-2025-05-01.md`
