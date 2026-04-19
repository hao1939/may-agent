# Evaluator Calibration Note — 2026-04-13T16:52Z

## Process #5 (Session Evaluation) — Liveness
- DB canonical check: `.state/may.db` has table `evaluations`.
- `MAX(evaluations.createdAt)=1776098815746` (recent), and recent rows include:
  - `('s_1776097322766_280','bob',1776098815746,'good')`
  - `('s_1776097409960_284','coder',1776098215749,'good')`
  - `('s_1776097370343_283','coach',1776098215748,'good')`

Interpretation: session-eval pipeline is live in DB.

## Legacy `.state/evaluations/` artifacts
- Directory exists but appears stale (newest observed mtime in tail: 2026-03-24).

Interpretation: legacy file-output path is not updated; treat as output drift, not pipeline failure.

## Process #15 (LLM Evaluation) — Liveness
- No `llm_evaluations` (or any `*eval*` other than `evaluations`) table exists in `.state/may.db`.

Interpretation: LLM evaluation appears disabled/unimplemented or renamed; docs/process ownership should be reconciled.

## Runtime monitoring (L2 kinetic defense)
`node agents/evaluator/skills/monitor-session.cjs --running` reported 3 sessions needing attention:
- `s_1775311714523_3` (may): `PROTOCOL_VIOLATION` (P114 Experience Replay missing)
- `s_1776095566061_268` (bob): `PROTOCOL_VIOLATION` (P114 Experience Replay missing)
- `s_1776097325366_281` (coach): `STALL` (idle ~20m)

Follow-up suggestion: warn May/Bob about P114 gating and ping Coach about the stalled work session.
