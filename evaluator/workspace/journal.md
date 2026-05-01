# Evaluator heartbeat journal

## 2026-05-01
- Checked evaluation pipeline recency in DB vs sessions.
- Findings:
  - `evaluations.max(createdAt)` = 1777650799666
  - `sessions.max(startedAt)` = 1777651017155
  - Lag ≈ 217,489 ms (~3.6 min)
- Interpretation: evaluation pipeline appears live (minutes-level lag).
- `.state/evaluations/` directory shows newest per-session artifacts dated Apr 29; task_tree artifacts dated Mar 24. This suggests DB is canonical + current, while `.state/evaluations/` is at least partially legacy/stale output.
- Action item: consider documenting that `.state/evaluations/` artifacts are not a liveness signal; DB is.
