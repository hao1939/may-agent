# Lens A: Evaluator 99 Zero-Op Sessions — Expected Behavior

**Date**: 2026-04-19  
**Severity**: None (working as designed)

## Summary

All 99 evaluator sessions in the last 6 hours are genuine zero-op sessions. This is expected: `opCount` only increments for **state-changing tools** (`manager-receipts.ts:275-278`), and the evaluator agent only performs LLM reasoning (reading transcripts, scoring) — it makes no edits, no bash calls, no writes. So opCount stays at 0 for every evaluator session.

## Evidence

1. **Sampled 3 evaluator sessions** — all status `done`, opCount 0, task starts with `"# Task Tree Evaluation"` (`sessions` table, agent=evaluator, last 6h). These are LLM-evaluation sessions spawned to score other agents' work.

2. **opCount tracking** — only incremented for state-changing tools after successful execution (`src/lib/manager-receipts.ts:275-278`). Evaluator sessions involve only reading transcripts and producing scores — no state-changing ops.

3. **Session creation path** — evaluator sessions are created by `evaluator-heartbeat.ts:157` via `ctx.manager.callAgent("evaluator", task, ...)`. Each completed task tree gets an evaluation session.

4. **Volume check** — 99 evaluator sessions vs 146 non-evaluator sessions in 6h (68% ratio). This is reasonable: not every session gets LLM-evaluated (some are heuristic-evaluated by `evaluation-sync.ts`), and task trees may bundle multiple sessions into one evaluation.

## Conclusion

No action needed. The 99 zero-op evaluator sessions are working as designed — they perform LLM evaluation of other agents' transcripts, which requires no state-changing tool calls and therefore correctly reports opCount=0.
