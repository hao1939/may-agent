# Evaluator Heartbeat — 2026-04-30

## Checks

### Session Eval pipeline liveness (DB canonical)
- `evaluations MAX(createdAt)=1777591734806`
- `sessions MAX(endedAt)=1777592051182`
- `sessions last24h=2014`
- `evaluations last24h=683`

Interpretation: evaluation writes are recent (pipeline is live). Lag exists but not a total stall.

### Legacy artifacts `.state/evaluations/`
Directory tail shows newest mtimes around **Mar 24**, consistent with known drift/staleness of `task_tree_*.json` artifacts; not a canonical pipeline signal.

## Coverage snapshot
- `sessions total=3361`
- `evaluations total=1544`
- `unevaluated total=2098`
- `evaluations skippedByJs=459` (also `evaluatedByHeuristic=459`)

By agent, unevaluated sessions are dominated by: evaluator (1168), optimizer (437), coach (405).

## Notes / Hypotheses
- Many sessions may be intentionally excluded (e.g., evaluator self sessions, certain kinds/statuses, or JS-side filtering leading to `skippedByJs`).
- If coverage is desired, the next step is to locate the JS evaluator's skip conditions and verify whether the exclusion of evaluator/coach/optimizer sessions is intentional.

## Suggested follow-ups
1. Identify skip logic for `skippedByJs` and enumerate reason codes (currently only boolean in DB).
2. Decide target coverage: which agents/kinds are in-scope for evaluation.
3. If in-scope: add structured `skipReason` to `evaluations` to make coverage actionable (not just “skipped”).
