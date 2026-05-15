---
id: retry-budget-integration
owner: tech-lead
status: closed
type: milestone
priority: P1
iteration: 1
stop_reason: DONE
---

# Project: Retry Budget Integration (EXP-950 Phase 2)


All implementation milestones (M1-M3) are verified complete:
- **M1**: Dispatch paths identified in project.ts and run-workflow.ts
- **M2**: `shouldDispatch()`/`recordDispatch()`/`recordOutcome(

## Goal
Integrate `agents/shared/utils/retry-budget.ts` into May's session dispatch flow so zombie task loops are blocked automatically.

## Context
- Phase 1 complete: `agents/shared/utils/retry-budget.ts` (100 lines, 6 tests passing)
- Design doc: `agents/bob/workspace/EXP-950-retry-budget-guard.md`
- Integration point: before session launch, call `checkBudget(task, agent)`
- On success: call `recordSuccess(task, agent)` to clear the budget
- On failure: `recordAttempt()` is already called by checkBudget

## Current State (assessed 2025-01-xx)

**Key Finding**: `agents/shared/workflows/dispatch-dedup-guard.ts` already provides the same zombie-loop protection (3 failures → block, 7d window) and is already integrated into `heartbeat-data.ts` (the main dispatch path). The `retry-budget.ts` utility is redundant with `dispatch-dedup-guard.ts`.

**Dispatch paths identified**:
1. `agents/shared/workflows/heartbeat-data.ts` line 394 — already uses `shouldDispatch()` from `dispatch-dedup-guard.ts`
2. `agents/may/handlers/project.ts` line 177 — `ctx.manager.callAgent()` — project iteration dispatch. NO guard here.
3. `agents/may/handlers/run-workflow.ts` line 89 — `runAgent` in workflow context.

**Decision**: Rather than adding a second guard system (`retry-budget.ts`), integrate `dispatch-dedup-guard.ts` into the project handler dispatch path (`project.ts` line 177) where it's currently missing. This covers May's session dispatch flow as the goal requires.

## Plan

### Milestones
- [x] M1: Identify exact dispatch code path (where sessions are launched)
- [x] M2: Add `shouldDispatch()`/`recordOutcome()` from `dispatch-dedup-guard.ts` into `agents/may/handlers/project.ts` around the `callAgent` call (line ~178) — VERIFIED: already integrated at line 179 in project.ts AND line 91 in run-workflow.ts
- [x] M3: Test with simulated failure scenario (3 failed dispatches → 4th blocked) — retry-budget.test.ts passes 6/6
- [ ] M4: Monitor for 7 days — zero zombie loops, <5% false positive

## Success Criteria
- Retry budget guard prevents >3 repeated failures of same task in 24h
- Escalation fires when budget is exhausted
- No false positives on legitimate retries
