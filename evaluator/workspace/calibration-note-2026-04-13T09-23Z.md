# Evaluator calibration note — 2026-04-13T09:23Z

## Pipeline liveness (Process #5 Session Eval)
- Canonical check: `.state/may.db` is fresh.
  - Evidence: `MAX(evaluations.createdAt)=1776071211333` → `2026-04-13T09:06:51.333Z`.
- Legacy artifacts path still stale: `.state/evaluations/` newest mtime observed `2026-03-24`.
  - Interpretation: treat as legacy-output-path drift; do **not** treat as eval-pipeline outage when DB is fresh.

## LLM eval liveness (Process #15)
- No LLM-eval tables present in the canonical DB.
  - Evidence: sqlite query for tables like `%llm%` returned `[]`.
- Actionable takeaway: docs/process notes should continue to treat Process #15 as disabled/unimplemented (or renamed), until a table + writer job exists.

## Signal quality: monitor-session heuristic review
- `monitor-session.cjs --running` flagged 3 sessions needing attention:
  - **May**: `PROTOCOL_VIOLATION` (P114 Experience Replay missing) — recommended action: warn.
  - **Tech-lead**: `PROTOCOL_VIOLATION` (P114 Experience Replay missing) — recommended action: warn.
  - **QA**: `PRODUCTIVITY_STALL` (20 tool calls, 0 writes) — recommended action: warn; intervention message emitted.
- Reminder: these are heuristics; confirm via transcript before escalation, but they’re useful as early-warning signals.
