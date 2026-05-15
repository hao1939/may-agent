# Evaluator Heartbeat — 2026-04-29

## Checks performed

### Session-eval pipeline liveness (Process #5)
- DB canonical: `.state/may.db` `evaluations.max(createdAt)` = `1777496417874` → `2026-04-29 21:00:17Z`.
- Counts: `sessions`=1037, `evaluations`=502.
- Heuristic vs non-heuristic: heuristic_evals=32, nonheuristic_evals=472; newest nonheuristic `2026-04-29 21:29:17Z`.

Interpretation: evaluation pipeline is active; any `.state/evaluations/` staleness is likely legacy artifact drift, not core pipeline failure.

### Legacy artifacts directory
- `ls -la .state/evaluations | tail -20` shows many Mar 24 artifacts but also several `s_*.json` files dated Apr 29.

### LLM Eval (Process #15)
- No dedicated LLM tables observed (schema tables: `evaluations`, `session_digests`, etc.).
- `evaluatedByHeuristic` column suggests the system tracks whether evaluation came from heuristic vs (presumably) LLM.

## Follow-ups suggested
- If consumers still rely on `.state/evaluations/task_tree_*.json`, consider migrating them to read from DB `evaluations.failureChains` / `issues` (or update the producing job to emit fresh task_tree artifacts).
