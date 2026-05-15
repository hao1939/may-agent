# Calibration Note — 2026-04-13 12:52Z

## Process #5 (Session Evaluation) liveness
- **DB is canonical**: `.state/may.db` shows `MAX(evaluations.createdAt)=1776083814110` (from 2026-04-13 heartbeat check).
- **Legacy artifacts stale**: `.state/evaluations/task_tree_*` newest mtime observed: **2026-03-24** → treat as legacy output path drift, not pipeline failure.

## Process #15 (LLM Eval) liveness
- `.state/may.db` table inventory contains: `evaluations`, `sessions`, `session_digests`, etc.
- **No `llm_*` tables present** (`has llm table? False`) → LLM eval appears **disabled/unimplemented or renamed**.
- Recommendation: open/keep a tracked item to either (a) reintroduce an LLM-eval table/job, or (b) remove/rename documentation implying it exists.

## Runtime monitors
- `monitor-session.cjs --running` flagged **May session** `s_1776084674665_185` as **PROTOCOL_VIOLATION (P114 Experience Replay missing)**.
- `patrol.cjs` remains **CRITICAL** due to missing `agents/shared/compliance-snapshot.json` baseline (known degraded state).
