# Evaluator heartbeat — 2026-04-30 (eval liveness)

## Checks performed
- Canonical DB liveness: `.state/may.db`
  - `evaluations`: count=1324, max(createdAt)=2026-04-30 13:54:11Z
  - `sessions`: count=2966, max(endedAt)=2026-04-30 13:57:40Z
  - lag between latest session end and latest evaluation: ~209s

- Legacy artifacts: `.state/evaluations/`
  - recent `s_*.json` exist (mtime Apr 29)
  - `task_tree_*.json` mtimes remain Mar 24 (stale)

## Assessment
- Evaluation pipeline is live (DB writes are current; only minutes of lag).
- Stale `task_tree_*` likely reflects legacy-output-path drift or a disabled sub-step, not eval pipeline failure.

## Suggested follow-up
- If any consumer still depends on `task_tree_*.json`, migrate to DB-backed fields (e.g., `evaluations.failureChains`, `issues`) or restore task-tree emission.
