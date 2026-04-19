# Evaluator Zero-Op Spawns Analysis (Lens C: Dead Weight)

**Date**: 2026-04-19  
**Severity**: Low (not actually dead weight)

## Summary

The ~116 evaluator sessions in ~7h with opCount=0 are **not wasteful zero-op spawns**. They are legitimate LLM evaluation sessions that produce real evaluations. The zero opCount is a measurement artifact: `opCount` only increments for state-changing tools (`src/lib/manager-receipts.ts:275-278`), and evaluator sessions only perform LLM reasoning (reading transcripts, scoring) — no edits, no bash, no writes.

## Spawn Path

1. **Trigger**: `src/app/may.ts:429` — on every `session:done` event with a `parentSessionId`, calls `evaluateTask()`
2. **Guard**: `src/app/may.ts:425-426` — skips if no `parentSessionId` or if `agent === "evaluator"` (prevents infinite loops)
3. **Session creation**: `src/lib/evaluator.ts:553` — `manager.run("evaluator", prompt)` spawns an LLM session with a `"# Task Tree Evaluation"` prompt built at `evaluator.ts:409`
4. **Prompt construction**: `src/lib/evaluator.ts:459-553` — `evaluateTask()` finds unevaluated children, builds transcripts (capped at 10KB/session, 20KB total), and constructs the evaluation prompt

## Evidence

1. **116 evaluator sessions, all zero-op** — DB query: `SELECT COUNT(*) FROM sessions WHERE agent='evaluator' AND opCount=0 AND startedAt > 1776540000000` → 116
2. **207 LLM evaluations produced in same period** — DB query: `SELECT evaluatedByHeuristic, COUNT(*) FROM evaluations WHERE createdAt > 1776540000000 GROUP BY evaluatedByHeuristic` → 207 LLM (heuristic=0), 329 heuristic (heuristic=1). The 116 sessions produce ~207 LLM evals (parent sessions may have multiple children).
3. **All sessions have task text starting with `"# Task Tree Evaluation"`** — sampled 5 recent evaluator sessions, all match this pattern
4. **opCount=0 is expected** — `src/lib/manager-receipts.ts:275-278` only increments opCount for state-changing tool results; evaluator makes zero such calls

## Verdict

**Not dead weight.** These sessions are doing exactly what they should — LLM-evaluating completed task trees. The zero opCount is misleading but not a bug; it accurately reflects that evaluator sessions don't use state-changing tools.

## Minor Observation

The volume (~116 sessions / 7h ≈ 16.6/hr) seems high but tracks with the system's session throughput. Each completed parent session triggers one evaluator session via `may.ts:429`. This is by design.

## Recommended Action

None required. If the zero-op metric causes confusion in dashboards, consider either:
- Excluding `agent='evaluator'` from zero-op alerts
- Adding a separate token-based metric for evaluator sessions (would require schema change)
