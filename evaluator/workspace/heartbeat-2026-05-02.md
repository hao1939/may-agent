# Evaluator heartbeat — 2026-05-02

## Checks

### Session evaluation pipeline liveness (DB is canonical)
- `evaluations.max(createdAt)` = **1777679791574**
- `sessions.max(startedAt)` = **1777681599853**
- **Lag** = **1,818,108 ms (~30.3 minutes)**

Interpretation: evaluator cron is running and relatively fresh (sub-hour lag). No immediate action.

### Legacy `.state/evaluations/` artifacts
- Directory contains `task_tree_*.json` with newest mtime **2026-03-24**, consistent with known chronic issue that legacy artifacts are stale.
- Since DB is fresh, treat as **output-path drift** (non-blocking).

## Next
- If lag exceeds ~6h in a future heartbeat, investigate cron/job runner and notify tech-lead with exact lag.
