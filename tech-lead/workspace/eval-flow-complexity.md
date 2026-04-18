# Eval Flow Complexity Analysis

**Date**: 2026-04-16  
**Lens**: B (Flow Complexity)

## Summary

There are **3 independent evaluation paths** that fire for different session types, with **redundant LLM sampling** in two of them. The flow is more complex than necessary.

## End-to-End Flow Map

### Path 1: Child session completion → `evaluateTask()` (may.ts ~L431)
- **Trigger**: `session_end` event on the bus
- **Guard**: `if (!info.parentSessionId) return` — only child sessions
- **Action**: Calls `evaluateTask()` which spawns an evaluator LLM agent for the parent's children
- **Scope**: Only sessions with a parentSessionId

### Path 2: Cron → `evaluation-sync.ts` (404 lines)
- **Trigger**: Cron schedule
- **Action**: 
  1. Heuristic-evaluates ALL unevaluated sessions (up to 50/run) — pure JS, no LLM
  2. Then samples ~30% of those for LLM upgrade via `evaluateStandaloneSession()` (up to 5/run)
- **Scope**: All done/error/interrupted sessions except evaluator agent

### Path 3: Cron → `evaluator-heartbeat.ts` (313 lines)
- **Trigger**: Cron schedule
- **Action**:
  1. **LLM sampling**: Finds heuristic-only top-level sessions, upgrades up to 3/run to LLM eval via `evaluateStandaloneSession()`
  2. **Calibration**: Spawns evaluator LLM agent if pipeline is stale or workspace is old
- **Scope**: Top-level sessions (no parentSessionId), excludes evaluator/may agents

## Redundancy Found

### 🔴 Duplicate LLM sampling (severity: medium)
Both `evaluation-sync.ts` (L340-380) and `evaluator-heartbeat.ts` (L181-290) independently sample heuristic sessions for LLM evaluation upgrade. They use the same function (`evaluateStandaloneSession`) but different selection strategies:

| | evaluation-sync.ts | evaluator-heartbeat.ts |
|---|---|---|
| Budget | 5/run | 3/run |
| Selection | Random 30% of current batch | Priority by lowest LLM rate per agent |
| Scope | Current batch only (just-evaluated) | All heuristic-only top-level sessions |
| Dedup | None — could re-evaluate same session | Queries `evaluatedByHeuristic=1` |

**Risk**: A session could be LLM-evaluated by evaluation-sync, then picked again by evaluator-heartbeat before the DB flag updates (race condition on the `evaluatedByHeuristic` column).

### 🟡 Three layers for what could be two (severity: low)
- Path 1 (evaluateTask) handles child sessions via event → makes sense, real-time
- Path 2 (evaluation-sync) handles bulk heuristic + LLM sampling → the heuristic part is necessary
- Path 3 (evaluator-heartbeat) duplicates the LLM sampling from Path 2, adding calibration logic

The LLM sampling in evaluation-sync.ts (added later) overlaps with evaluator-heartbeat.ts's original purpose.

## Recommended Action

**Consolidate LLM sampling into one location** (evaluator-heartbeat.ts). Remove the LLM sampling block from evaluation-sync.ts (L340-380). evaluation-sync should remain pure JS/heuristic-only — that was its original design intent per its own docstring ("Pure JS — no LLM calls, no cost").

This would:
1. Eliminate the race condition
2. Keep evaluation-sync fast and cheap
3. Centralize LLM eval budget control in one place
4. Reduce evaluation-sync from 404 → ~360 lines

**Do NOT fix in this session** — this is a separate task.
