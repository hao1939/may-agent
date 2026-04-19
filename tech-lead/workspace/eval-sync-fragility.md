# Lens D: evaluation-sync.ts Fragility — Mid-Batch Throw Recovery

**Date**: 2026-04-19  
**Severity**: None (safe by design)  
**Verdict**: No fragility — unevaluated sessions are retried on the next cron tick.

## Question

If `evaluation-sync.ts` throws mid-batch (e.g., on session 25 of 50), do the remaining unevaluated sessions get permanently skipped or retried?

## Findings

### 1. Query re-fetches unevaluated sessions each run

Each cron tick independently computes the unevaluated set:

- `evaluation-sync.ts:272-273` — Queries `SELECT sessionId FROM evaluations` to build an `evaluatedIds` Set.
- `evaluation-sync.ts:280-281` — Queries all sessions with `status IN ('done', 'error', 'interrupted')`.
- `evaluation-sync.ts:283` — Filters to `unevaluated = sessions.filter(s => !evaluatedIds.has(s.sessionId))`.

No session is marked "in progress" or pre-claimed. The unevaluated set is computed fresh every run.

### 2. Batch runs inside a single SQLite transaction

- `evaluation-sync.ts:299` — `const transaction = db.transaction(() => { ... })` wraps the entire batch loop.
- `evaluation-sync.ts:382` — `transaction()` executes it atomically.

If any exception occurs inside the transaction (e.g., on session 25), **the entire transaction rolls back**. Zero evaluations are persisted. The next cron tick sees the same unevaluated sessions and retries all of them.

### 3. LLM sampling runs outside the transaction

- `evaluation-sync.ts:389-391` — LLM evaluation sampling runs AFTER `transaction()`, outside the atomic block. If the LLM sampling throws, the heuristic evaluations are already committed. If the transaction throws, LLM sampling never runs. This ordering is correct.

### 4. MAX_PER_RUN caps batch size

- `evaluation-sync.ts:295` — `MAX_PER_RUN = 50` limits each tick to 50 sessions. If >50 are pending, the remainder is processed on subsequent ticks (`evaluation-sync.ts:385` logs remaining count).

## Conclusion

The design is safe. There is no mark-before-evaluate anti-pattern. Failed runs leave no trace, and the next tick retries the same sessions. No action needed.
