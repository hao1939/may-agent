# Calibration Note — 2026-04-13T20:52Z

## Process #5 (Session Eval) liveness
- **DB canonical check**: `.state/may.db` `evaluations MAX(createdAt)=1776112616496` (=2026-04-13T20:36:56Z) → eval pipeline is **live**.
- **Legacy artifacts**: `.state/evaluations/` newest mtime observed: **2026-03-24** → treat as legacy-output-path drift, not pipeline failure.

## Process #15 (LLM Eval) liveness
- `.state/may.db` table inventory contains `evaluations`, `sessions`, `session_digests`, etc. and **no** `llm_evaluations` / `llm_evals` tables (see table list output in this heartbeat).
- Conclusion: Process #15 appears **disabled/unimplemented or renamed**; docs/heartbeat should continue treating it as such until a canonical table/queue is found.

## Signal quality / kinetic defense
- `monitor-session.cjs --running` flagged **May heartbeat session** `s_1776113477103_384` as `PROTOCOL_VIOLATION` (P114: complex task attempted without Experience Replay). Recommended action: **warn** (do not interrupt).

## Follow-ups
- Consider adding a lightweight policy in evaluator criteria for how to treat `monitor-session` returning code 1 but with only PROTOCOL_VIOLATION (warning-level) findings (avoid treating as pipeline failure).
