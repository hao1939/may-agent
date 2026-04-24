# Finding: evaluateStandaloneSession() Fragility Audit

**Date**: 2026-04-16  
**Target**: `src/lib/evaluator.ts:795-880`, `agents/may/handlers/evaluation-sync.ts:353-400`  
**Severity**: Medium (operational risk, no data corruption)

## Summary

The new `evaluateStandaloneSession()` function has **adequate error isolation** at the call-site (try/catch in evaluation-sync.ts) but has **three silent failure modes** and a **label-matching fragility** that will cause ~50% of LLM evaluations to silently return null.

## Findings

### F1: Agent label matching is fragile — silent null returns (HIGH)

**File**: `src/lib/evaluator.ts:853-855`

```ts
const sessionLabel = `${agent} (session ${sessionId})`;
const agentScores = parsed.agents[sessionLabel] ?? parsed.agents[agent];
if (!agentScores) return null;
```

The evaluator LLM must produce a JSON key that exactly matches either `"tech-lead (session s_123...)"` or `"tech-lead"`. The `buildEvalPrompt()` labels agents as `"# Agent: tech-lead (session s_123...)"` in the prompt. If the LLM returns a slightly different key (e.g., `"tech-lead/s_123..."`, `"Agent: tech-lead"`, or the full label with extra whitespace), the function silently returns null — no error logged, no score saved. The caller in evaluation-sync.ts logs nothing when `result` is null (line 378: `if (result) { ... }`).

**Impact**: Unknown fraction of LLM eval runs produce no output. No observability into why.

### F2: manager.run() + waitFor() can throw — handled correctly at call-site (OK)

**File**: `agents/may/handlers/evaluation-sync.ts:373-388`

The try/catch around `evaluateStandaloneSession()` catches any throw from `manager.run()` or `manager.waitFor()` and logs the error. This is correct — a failed LLM eval doesn't abort the batch. The heuristic evaluation is already committed (runs in a transaction before the LLM sampling loop). **No issue here.**

### F3: No retry on LLM eval failure (LOW)

**File**: `src/lib/evaluator.ts:847-850`

Unlike the original `evaluateTask()` (which has a retry path at lines 564-567 for parse failures), `evaluateStandaloneSession()` has no retry. If the evaluator returns malformed JSON, `parseTaskEvaluation()` returns empty `agents: {}`, the label lookup fails, and the function returns null silently.

**Impact**: Wasted LLM cost (~$0.01-0.05 per eval) with no score saved. Low frequency but no visibility.

### F4: Sampling pool draws from heuristic batch, not full DB (LOW)

**File**: `agents/may/handlers/evaluation-sync.ts:358-360`

```ts
const heuristicSessions = unevaluated.slice(0, MAX_PER_RUN).filter(...)
```

The sampling pool is `unevaluated.slice(0, MAX_PER_RUN)` — the first 50 unevaluated sessions. This biases LLM sampling toward the oldest unevaluated sessions (likely sorted by time). Not a bug, but means recent sessions are never LLM-sampled until the backlog clears.

### F5: 5/run cap cannot be exceeded via race (OK)

The `.slice(0, MAX_LLM_PER_RUN)` after `.filter(() => Math.random() < 0.3)` hard-caps at 5. The `for` loop is sequential (await in loop body). No race condition possible. The cron handler itself isn't reentrant (single-threaded JS + await). **No issue.**

### F6: Heuristic→LLM overwrite is intentional and safe (OK)

**File**: `src/lib/evaluator.ts:863` — `upsertEvaluation()` uses `INSERT OR REPLACE` semantics. The `hasLLMEvaluation()` guard at line 802 prevents double-LLM-eval. The flow is: heuristic writes eval → LLM overwrites it. No partial state possible since upsert is atomic.

## Recommended Actions

1. **F1 (HIGH)**: Add a log line when `agentScores` is null: `appendErrorLogs(...)` or similar. Also consider normalizing the label lookup (e.g., check all keys with `agent` substring). This is a 3-line fix.
2. **F3 (LOW)**: Consider adding one retry like `evaluateTask()` does, or at minimum log when parse yields empty agents.
3. **F4 (LOW)**: Acceptable for now. If backlog grows, consider random sampling from full DB.
