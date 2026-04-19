# Evaluator heartbeat calibration note — 2026-03-17

## Calibration inputs
- `agents/evaluator/workspace/human-reviews.jsonl`: empty (no new human disagreements)
- `agents/evaluator/workspace/consistency-flags.jsonl`: empty (no new automated consistency flags)
- `agents/evaluator/workspace/re-evaluations.jsonl`: empty (no new re-evaluation disagreements)

## Runtime monitoring (monitor-session --running)
- Found 1 unhealthy active session:
  - `s_1773723236336_67` (agent: `tech-lead`) flagged `PROTOCOL_VIOLATION` with confidence 0.8.
  - Evidence: "P114 Violation: Complex task attempted without Experience Replay (grep ERROR_LOG)." (position 22, path `agents/may/handlers/audit-requests.ts`).
  - Recommended action from monitor: `warn`.

## Notes
- No other calibration sources produced actionable items this heartbeat.
