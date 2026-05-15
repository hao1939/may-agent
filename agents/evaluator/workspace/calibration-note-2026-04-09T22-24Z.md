# Calibration Note — 2026-04-09 22:24Z

## DB-canonical vs legacy artifact path
- `.state/may.db` is **fresh** (mtime `2026-04-09 22:23:29` from heartbeat run) and contains table `evaluations` with `max(createdAt)=1775771800099`.
- Legacy `.state/evaluations/` task_tree artifacts remain **stale** (newest observed mtime `2026-03-24`).

**Calibration:** treat `.state/evaluations/` staleness as **legacy-output-path drift**, not a pipeline failure, so long as DB remains fresh.

## Process #15 (LLM eval) liveness
- DB table inventory shows **no `llm_evaluations` (or llm-like) table** (query `name like '%llm%'` returned empty).

**Calibration:** keep describing Process #15 as **disabled/unimplemented** until a canonical table/log proves otherwise; avoid implying it is active.

## Kinetic defense snapshot
- `monitor-session.cjs --running` returned `healthy=8, unhealthy=0` (no active loops/stalls flagged).
