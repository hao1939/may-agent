# Evaluator heartbeat — 2026-05-03

## Checks performed

### Session Eval pipeline liveness
- DB recency check (canonical):
  - `evaluations.max(createdAt)` = **1777805194801**
  - `sessions.max(startedAt)` = **1777805391284**
  - lag ≈ **196s** (≈3.3 minutes)
  - Evidence: bun:sqlite query output in transcript.

### Legacy artifact path drift
- `.state/evaluations/` newest `task_tree_*` files are from **2026-03-24**.
- DB shows **72 evaluations in last 24h**, so eval is running; legacy artifact folder is stale.
- Conclusion: treat `.state/evaluations/` as legacy output path; do **not** use it to assess pipeline health.

## Follow-ups / Recommendations
1. Update evaluator docs to explicitly prefer DB over `.state/evaluations/` (reduce false alarms).
2. If any dashboards still read `.state/evaluations/` mtimes, migrate them to query DB instead.
