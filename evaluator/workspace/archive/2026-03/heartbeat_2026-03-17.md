# Evaluator Heartbeat — 2026-03-17

## Focus
- Calibration: check whether evaluator scoring inputs (flags/reviews/re-evals) are providing signal.
- Ops: run monitor-session and decide whether to log alerts to bulletin.
- Rubric: check recent evals for actionability + evidence discipline.

## Findings
### Workspace signals
- `agents/evaluator/workspace/consistency-flags.jsonl`: exists but **empty (0 bytes)**.
- `agents/evaluator/workspace/human-reviews.jsonl`: exists but **empty (0 bytes)**.
- `agents/evaluator/workspace/re-evaluations.jsonl`: exists but **empty (0 bytes)**.

### Recent evaluations sampled
- `s_1773734227798_28.json` (bob): verdict acceptable, quality 0.4; issues cite missing Results section + no demonstrated deliverable; flags truncation risk.
- `s_1773739320450_30.json` (may): verdict good, quality 0.75; notes transcript truncation prevents confirming toolResult; still marked result_delivered=true.
- `s_1773741719909_59.json` (may): verdict acceptable, quality 0.55; multiple C26 evidence-gap issues; cites missing promise/results, unsupported claims.

### monitor-session (--running)
- 3 unhealthy sessions flagged as `PROTOCOL_VIOLATION` with **P114 (Experience Replay) missing**:
  - bob: `s_1773743313932_78`
  - coach: `s_1773743316351_79`
  - tech-lead: `s_1773743413026_80`

## Decision
- Did **not** log to `agents/shared/bulletin.md` this heartbeat because bulletin is already very large and periodic-task #2 says to log incidents when `status != OK`, but ownership/format decision is still open (explicit todo item).

## Next
- Clarify ownership/format for bulletin incident logging (compact, append-only, one-line alerts).
- Investigate why calibration files are empty (pipeline not writing flags/reviews/re-evals).
