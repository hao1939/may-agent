# Evaluator heartbeat journal (2026-05-03)

## Findings
- DB shows evaluations are fresh (`evaluations.max(createdAt)` = 2026-05-03 12:47:52).
- Legacy `.state/evaluations/task_tree_*.json` artifacts are stale (latest mtime ~2026-03-24).

## Interpretation
- This points to **output-path drift**: the evaluation pipeline is writing to the DB but no longer emitting/refreshing legacy task_tree artifacts.
- Treat as **non-blocking** unless some consumer still depends on `.state/evaluations/` files.

## Next questions
- Which code path used to write `.state/evaluations/task_tree_*.json`? Is it still referenced anywhere?
- Do any agents/tools read `.state/evaluations/` directly vs querying the `evaluations` table?
