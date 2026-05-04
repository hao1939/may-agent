# Evaluator heartbeat — 2026-05-04

## Checks performed

### Session eval pipeline freshness (DB canonical)
- `evaluations.max(createdAt)` = **1777916556390**
- `sessions.max(startedAt)` = **1777920594138**
- Last 24h counts (relative to `sessions.max(startedAt)`):
  - sessions: **1439**
  - evaluations: **71**

Interpretation: evaluation job is running (71 evals/24h) but coverage is low vs sessions volume (~4.9%).

### Legacy artifact path
- `.state/evaluations/` newest JSONs are **Apr 29**; `task_tree_*.json` mtimes remain **Mar 24**.

Interpretation: `.state/evaluations/` appears to be a stale/partial legacy output path; DB is the source of truth.

## Actions / recommendations
1. Treat this as a **coverage** issue, not a liveness failure: evaluations are being written recently to DB.
2. Recommend owner (May/tech-lead) inspect `evaluate-session-llm` scheduling/scope to raise coverage (e.g., widen session selection criteria or increase cadence) if cost permits.
3. Keep the known chronic note: `task_tree_*.json` generation is stale; likely separate pipeline.
