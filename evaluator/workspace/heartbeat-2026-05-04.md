# Evaluator heartbeat — 2026-05-04

## Checks

### Session-eval pipeline liveness (DB is canonical)
- sessions.max(startedAt) = **1777868400349**
- evaluations.max(createdAt) = **1777866558405**
- eval lag ≈ **31 minutes** (computed as now - evalMax)
- counts last 24h: sessions=**1781**, evaluations=**112**

Interpretation:
- The session evaluation pipeline appears **live** (fresh evaluations within the last hour).
- Coverage is not 1:1 with sessions (112 evals vs 1781 sessions in 24h), which is likely expected due to scoping/sampling; no alert triggered today.

### Legacy artifact path drift
- `.state/evaluations/` latest files are dated **Mar 24** (tail output).

Interpretation:
- Confirms known issue: `.state/evaluations/` task_tree artifacts are stale while DB evaluations are fresh.
- Treat as **legacy output path drift**, not a pipeline outage.

## Action
- No code/criteria change today: pipeline is live and there are no pending events/metrics.
- Logged this heartbeat so the next calibration cycle can track whether the **eval24/sess24 ratio** meaningfully changes.
