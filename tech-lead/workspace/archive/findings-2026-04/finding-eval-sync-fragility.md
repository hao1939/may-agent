# Finding: Evaluation Pipeline Error Handling Fragility

**Date**: 2026-04-18  
**Lens**: D (Fragility)  
**Target**: `agents/may/handlers/evaluator-heartbeat.ts`, `src/lib/evaluator.ts`  
**Severity**: Low — existing error handling is adequate but has minor gaps

## Summary

The evaluation pipeline (evaluator-heartbeat.ts) has **reasonable error isolation** — one bad session does NOT poison the entire batch. However, there are a few silent-failure paths and minor fragility points worth noting.

## Findings

### 1. ✅ Good: Top-level try/catch isolates Part 1 from Part 2

The main handler wraps `sampleAndEvaluateTopLevel()` in a try/catch (`evaluator-heartbeat.ts:56-59`). If LLM sampling fails entirely, calibration checks still run. Similarly, the calibration's `callAgent` is wrapped (`evaluator-heartbeat.ts:147-150`).

### 2. ✅ Good: Per-session error isolation in LLM eval loop

The `for (const session of selected)` loop at `evaluator-heartbeat.ts:229-242` wraps each `evaluateStandaloneSession()` call in its own try/catch. One session timing out or erroring does NOT prevent evaluation of remaining sessions. Error is logged and execution continues.

### 3. ⚠️ Minor: Silent swallow in DB query catch blocks

Multiple `catch {}` blocks silently swallow errors with no logging:
- `evaluator-heartbeat.ts:68` (recentEvalCount query)
- `evaluator-heartbeat.ts:81` (unevaluatedCount query)  
- `evaluator-heartbeat.ts:172` (agentRates query — returns early, skipping ALL LLM sampling)
- `evaluator-heartbeat.ts:195` (candidates query — returns early)

If the DB schema changes or a query has a bug, these silently fail and the handler does nothing — no log, no error, no indication anything went wrong. The handler appears healthy but evaluations silently stop.

### 4. ⚠️ Minor: `evaluateStandaloneSession` has no timeout

At `src/lib/evaluator.ts:862`, `manager.waitFor(evalSessionId)` blocks indefinitely. If the evaluator agent hangs, the entire handler blocks. The retry path (`evaluator.ts:872`) could double the hang time. There's no timeout or deadline.

### 5. ⚠️ Minor: Null agentScores silently returns null

At `src/lib/evaluator.ts:887`, if the evaluator LLM returns a response that doesn't contain scores matching the agent name, `evaluateStandaloneSession` returns `null` — no error logged, no upsert. The session stays heuristic-evaluated forever and will be re-selected as a candidate in the next run, wasting LLM cost repeatedly.

### 6. ✅ Good: Retry on double-zero parse

The retry logic at `evaluator.ts:867-878` handles the common "evaluator returned zeros" failure gracefully. If retry also fails, it marks `parse_error` rather than silently persisting bad scores.

### 7. ⚠️ ctx.getDb() vs own Database connection

`evaluator-heartbeat.ts` uses `ctx.getDb()` (shared connection), while `session-sync.ts:31-33` explicitly documents why it uses its own `new Database()` — WAL data doesn't persist between handler calls. If evaluator-heartbeat reads stale data due to the same WAL issue, it could miss sessions that need evaluation. However, since it reads rather than writes, the impact is limited to slightly delayed evaluation.

## Recommended Actions

1. **Add logging to silent catch blocks** (low effort, high value) — At minimum log at debug level in the catch blocks at lines 68, 81, 172, 195 of evaluator-heartbeat.ts. This prevents silent death.
2. **Add timeout to evaluateStandaloneSession** — Wrap `manager.waitFor()` with a timeout (e.g., 120s) to prevent handler hangs.
3. **Log when agentScores is null** — At `evaluator.ts:887`, log which session failed to parse so it can be investigated rather than silently retried forever.

## Non-Actions

- The overall architecture is sound — per-session isolation, retry on parse failure, cost budget cap. No structural redesign needed.
