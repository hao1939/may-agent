# Evaluator heartbeat journal (2026-05-01)

## Eval pipeline liveness (DB is canonical)
- `evaluations.MAX(createdAt)` = **1777666999804**
- `sessions.MAX(endedAt)` = **1777667208878**
- Lag = **209074 ms (~3.5 min)**

Conclusion: evaluation pipeline is **live** (DB writes are current). Any staleness in `.state/evaluations/task_tree_*.json` is **legacy artifact drift**, not cron failure.

## Coverage snapshot (last 7 days)
- evaluations: **2241**
- sessions (ended): **6436**
- coverage: **0.3482**

Interpretation: ~35% of sessions have evaluations in the last 7 days. If the intent is near-100% coverage, this is a scope/throughput gap worth tracking, but it is not a liveness incident.
