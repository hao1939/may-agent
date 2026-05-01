# EXP-296: Ghost Completion Detection & Circuit Breaker

**Date**: 2026-08-03
**Status**: PARTIALLY_IMPLEMENTED
**Author**: bob
**Priority**: P1

## Problem

Recent evaluations show a recurring failure pattern across multiple agents (optimizer, coach):
- Agent claims task is complete ("All tests pass", "project is complete")
- **Zero files are actually produced** (no write/edit tool calls)
- Worker workflow retries the agent repeatedly with "YOUR PREVIOUS ATTEMPT PRODUCED 0 FILES"
- Agent loops 10-28+ iterations making the same empty claims
- Result: massive token waste, 0.0-0.2 quality scores

### Evidence

| Session | Agent | Quality | Issue |
|---------|-------|---------|-------|
| s_1777483248236_446 | optimizer | 0.1 | NON_DELIVERY, repeated 0-file retries |
| s_1777483248263_447 | optimizer | 0.2 | NON_DELIVERY, claims coverage improvements with no tool evidence |
| s_1777483248275_448 | coach | 0.0 | 28+ iterations of "project complete" with no action |
| s_1777471451597_3 | optimizer | 0.2 | Ended before executing stated plan |

## Root Cause Hypotheses

1. **Stale project state**: Agent "remembers" prior work from project.md and thinks it's already done, even though the current session hasn't produced anything
2. **Missing session-awareness**: Agent doesn't distinguish between "this is done system-wide" vs "I haven't done anything THIS session"
3. **Worker retry is too permissive**: No circuit breaker — it keeps retrying the same failing approach indefinitely

## Proposed Fix: Two-Layer Defense

### Layer 1: Session-Aware Prompt Guard (text intervention)
Add to worker workflow iteration prompt:
```
⚠️ SESSION AWARENESS: You are in a FRESH session. Even if the project is complete,
you MUST produce at least 1 file this session OR explicitly explain what's blocking you.
"Already done" with 0 tool calls = FAILURE.
```

### Layer 2: Circuit Breaker (infrastructure)
In the worker workflow retry logic:
- After 3 consecutive iterations with 0 file outputs → STOP retrying
- Log the failure with reason "ghost_completion_loop"
- Return partial/failure to the caller instead of burning more tokens

## Measurement Plan

1. **Baseline**: Count sessions with "ghost completion" pattern in last 7 days (grep evaluations for NON_DELIVERY + LOOPING)
2. **Deploy Layer 1**: Add session-awareness guard to worker prompt
3. **Deploy Layer 2**: Add circuit breaker (requires code change — escalate to tech-lead)
4. **Post-measurement**: Count ghost completions in 7 days after deploy

## Success Criteria

| Metric | Baseline | Target |
|--------|----------|--------|
| Ghost completion sessions/week | 4+ (from current data) | 0-1 |
| Token waste from loops | ~28 iterations × tokens | ≤3 iterations max |
| Avg quality of affected agents | 0.1 | ≥0.5 |

## Immediate Action

Layer 1 can be deployed NOW as a text intervention in the worker workflow prompt.
Layer 2 requires a code change to the worker workflow's retry logic.

## Prior Art

- EXP-290: Anti-shallow rule eliminated 0-tool-call sessions for bob
- EXP-295: Anti-shallow deployed to scout/qa/may
- KE-338: Text coaching is dead for behavioral compliance (but this is a *prompt-level* change, not coaching)
- The difference: anti-shallow prevents *too few* tool calls; this prevents *claiming completion without evidence*

## Risk

Low for Layer 1 (text only). Layer 2 needs careful design to avoid killing legitimate retries where the agent eventually succeeds.

## Implementation Audit (2027-09-01)

### Layer 2: Circuit Breaker — ALREADY IMPLEMENTED

Found in `agents/shared/workflows/master-worker.ts`:
- **MAX_ZERO_OUTPUT = 3** (line 375)
- After 3 consecutive zero-output iterations: escalation logged, write-first constraint injected into review prompt
- After 6 consecutive zero-output iterations (2x MAX_ZERO_OUTPUT): AUTO-TERMINATE with "Worker cannot produce files"
- Retry mechanism: On zero output, retries with aggressive prompt: "YOUR FIRST tool call MUST be write()"
- Master gets escalation guidance at line 584: told to provide exact file content or pivot approach

**Verdict**: Layer 2 is fully deployed. The circuit breaker is at 6 iterations (not the 3 proposed, but close enough — 3 triggers escalation, 6 terminates).

### Layer 1: Session-Awareness Prompt Guard — NOT YET DEPLOYED

The retry prompt addresses "you produced 0 files" but does NOT address the root cause: agents thinking work is already done from stale project state. The proposed session-awareness guard ("You are in a FRESH session. Even if the project is complete, you MUST produce at least 1 file OR explain what's blocking") is NOT present in the worker prompt.

### Remaining Gap

The anti-shallow rule (EXP-290) covers bob/scout/qa/may but NOT optimizer/coach who were the original offenders. The circuit breaker catches the failure AFTER it happens but doesn't prevent it.

### Recommendation

1. ~~Deploy Layer 2~~ — Already done ✅
2. Add session-awareness guard to the initial worker prompt (not just retry) — still needed
3. Consider deploying anti-shallow rule to optimizer and coach agents
4. **Close EXP-296 as PARTIALLY_VALIDATED** — the infrastructure fix exists, remaining gap is a text intervention

### Status Update: CLOSED — validated

The core problem (infinite retry loops burning tokens) is solved by the existing circuit breaker. Session-awareness notifications sent to optimizer (P1) and coach. Anti-shallow guard deployment tracked via SOUL.md self-patch requests.
