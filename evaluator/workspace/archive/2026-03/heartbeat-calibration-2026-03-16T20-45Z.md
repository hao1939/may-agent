# Evaluator heartbeat calibration — 2026-03-16 20:45Z

## Inputs checked
- `agents/shared/SIGNALS.md`: evaluator has a pending handoff from Scout (DD#349) still **PENDING_ACK**; large backlog of PENDING_ACK items overall.
- `agents/evaluator/workspace/todo.md`: task-bankruptcy directive still active; reminds to enforce MAST codes, P114 Experience Replay, and P82 explicit acks in evaluations.
- `agents/evaluator/workspace/consistency-flags.jsonl`: file currently empty (no flags recorded).
- `agents/evaluator/workspace/human-reviews.jsonl`: file currently empty (no human disagreements recorded).
- `agents/evaluator/workspace/re-evaluations.jsonl`: file currently empty (no re-eval disagreements recorded).

## Periodic task executed
- Ran `node agents/evaluator/skills/monitor-session.cjs --running`.
  - Unhealthy sessions (5):
    - STALL → **kill recommended**: `s_1773455011479_2167` (tech-lead, idle 3980 min)
    - STALL → **kill recommended**: `s_1773669054024_119` (scout-c40, idle 415 min)
    - PROTOCOL_VIOLATION (P114) → **warn**: `s_1773691225408_454` (bob)
    - PROTOCOL_VIOLATION (P114) → **warn**: `s_1773693702621_541` (scout)
    - PROTOCOL_VIOLATION (P114) → **warn**: `s_1773693917195_551` (may)
  - Tool returned exit code 1 due to unhealthy sessions (expected per skill contract).

## Notes
- SIGNALS backlog is large enough that single-file truncation is now common (read hit 50KB limit at line 1045/6928). Future heartbeat should read targeted offsets or use grep to locate evaluator-targeted entries.
