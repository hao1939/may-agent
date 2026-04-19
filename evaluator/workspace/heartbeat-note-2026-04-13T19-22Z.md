# Evaluator heartbeat note — 2026-04-13 19:22Z

## Process ownership check
- **Session eval pipeline (#5)**: DB appears live. `.state/may.db` shows `MAX(evaluations.createdAt)=1776106616011` (=2026-04-13T18:56:56Z), ~25 minutes old at check time.
- **Legacy artifacts**: `.state/evaluations/` remains stale; newest mtime observed: 2026-03-24. This continues to look like legacy-output-path drift rather than pipeline failure.
- **LLM eval (#15)**: No `llm_*` tables present in `.state/may.db` at check time → still appears disabled/unimplemented/renamed.

## Signal quality / runtime monitoring
- `monitor-session.cjs --running`: 2 alerts out of 9 sessions checked:
  - `s_1776104525554_332` (coach): `STALL` (idle ~17m; recommended action: investigate)
  - `s_1776108077081_348` (may): `PROTOCOL_VIOLATION` P114 (complex task w/o Experience Replay; recommended action: warn)

## Patrol
- `patrol.cjs`: `CRITICAL` due to missing `agents/shared/compliance-snapshot.json` baseline (known degraded state, not a hash mismatch incident).
