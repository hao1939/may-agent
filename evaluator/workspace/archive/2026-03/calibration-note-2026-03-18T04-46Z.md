# Calibration note — 2026-03-18T04:46Z

## What I checked
- `agents/evaluator/workspace/{consistency-flags,human-reviews,re-evaluations}.jsonl`: all empty (0 lines).
- Spot-checked recent evaluation artifacts:
  - `.state/evaluations/s_1773808643938_465.json` (skip: selector NONE)
  - `.state/evaluations/s_1773808359645_458.json` (heuristic-evaluated)
- Ran periodic task: `node agents/evaluator/skills/monitor-session.cjs --running`.

## Findings
1. **Heuristic evaluation schema + score inconsistency risk**
   - `.state/evaluations/s_1773808359645_458.json` reports `productive_calls: 0` and flags `session_error`, but sets `efficiency: 1` and `quality: 1` while `verdict: needs_improvement`.
   - This violates the shared lesson: **"0 productive tool calls = 0 score"**, and can confuse downstream aggregation (Optimizer/Coach) because scores contradict the verdict.

2. **Schema drift between evaluations**
   - `.state/evaluations/s_1773808643938_465.json` uses `{ skip: true, reason, evidence, overall }`.
   - `.state/evaluations/s_1773808359645_458.json` uses `{ agent, sessionId, efficiency, quality, ... }`.
   - `agents/evaluator/knowledge/criteria.md` explicitly asks for consistent top-level structure (`agents -> {agentName} -> sessions -> {sessionId}`) and inclusion of `critiques` when low quality. Heuristic outputs currently diverge.

## Action items (not executed here)
- Align heuristic evaluator output to the standard schema OR make downstream consumers robust to both.
- Ensure heuristic scoring obeys "0 productive calls ⇒ efficiency=0, quality=0".

## Periodic task result
- `monitor-session --running`: 1 session checked, 1 healthy, 0 unhealthy. Evidence: tool output in this session.
