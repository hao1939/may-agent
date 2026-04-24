# Finding: Evaluator 0-op Sessions Are Real LLM Calls, Not Artifacts

**Date**: 2026-04-18  
**Lens**: A (System Architecture)  
**Severity**: Low (functional correctness) / Medium (cost awareness)

## Summary

The 129 evaluator sessions with `opCount=0` in the last 6 hours are **real LLM evaluation calls**, not bookkeeping artifacts. They have 0 opCount because the evaluator agent produces only text output (no tool calls), and opCount tracks tool use. These sessions are functioning as designed.

## Evidence

1. **Creation path**: `evaluation-sync.ts:280-286` calls `evaluateStandaloneSession()` for ~30% of heuristic-evaluated sessions each cron run.

2. **Session creation**: `evaluateStandaloneSession()` at `evaluator.ts:858` calls `manager.run("evaluator", prompt)` which creates a real session. The evaluator agent responds with a structured text evaluation (scores, verdicts) but uses **zero tool calls**, hence `opCount=0`.

3. **Volume**: 129 evaluator sessions vs 167 non-evaluator sessions in 6 hours = **77% effective sampling rate**, far exceeding the nominal 30% target (`evaluation-sync.ts:274`: `Math.random() < 0.3`). This is because evaluation-sync runs on cron every cycle, and each run processes a fresh batch of up to 50 unevaluated sessions (`evaluation-sync.ts:222`: `MAX_PER_RUN = 50`), sampling 30% of each batch independently. With enough batches, most sessions eventually get sampled.

4. **DB confirmation**: 88 rows in `evaluations` with `evaluatedByHeuristic=0 AND skippedByJs=0` in the last 6h — these are the successful LLM evaluations. The gap (129 sessions - 88 evals) likely represents evaluator sessions that returned null (e.g., `hasLLMEvaluation` already true at `evaluator.ts:814`, or empty messages at `evaluator.ts:825`).

## Assessment

- **Not a bug**: The 0-op sessions are expected behavior for a text-only agent.
- **Cost note**: 129 LLM evaluator calls in 6 hours is significant. Each includes a transcript (up to 10KB per `evaluator.ts:833-838`). At the current rate, this is ~500+/day.
- **Effective sampling rate drift**: The 30% per-batch sampling compounds across cron runs to ~77%. If the goal is truly 30% of all sessions, the sampling should check whether a session already has an LLM evaluation before including it in the candidate pool — but `evaluateStandaloneSession` already does this check (`evaluator.ts:814`), so the high rate means many sessions genuinely hadn't been LLM-evaluated when sampled.

## Recommended Action

1. **No immediate fix needed** — the system is working as designed.
2. **Optional**: If LLM evaluation cost is a concern, reduce sampling rate from 0.3 to 0.1 at `evaluation-sync.ts:274`, or reduce `MAX_LLM_PER_RUN` from 5 to 2 at `evaluation-sync.ts:271`.
3. **Optional**: Add a `costPerSession` estimate to the evaluation-sync log line so cost impact is visible in logs.
