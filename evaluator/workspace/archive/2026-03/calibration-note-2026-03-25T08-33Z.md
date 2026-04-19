# Calibration Note — 2026-03-25 08:33Z

## Inputs present
- `agents/evaluator/workspace/consistency-flags.jsonl`: **missing** (ENOENT)
- `agents/evaluator/workspace/human-reviews.jsonl`: **missing** (ENOENT)
- `agents/evaluator/workspace/re-evaluations.jsonl`: **missing** (ENOENT)

## Signal quality spot-check (latest evaluations)
- Reviewed the most recent 3 `.state/evaluations/task_tree_*.json` artifacts via shell preview.
- Noted a recurring evidence phrasing pattern: several issues are written as “excerpt provides no evidence …”, which is appropriate if the evaluator truly only had an excerpt, but risks over-penalizing when the full transcript existed but wasn’t structurally cited.
  - Calibration reminder: when transcript is reviewer-truncated, explicitly label **evidence-limited** and avoid strong negative inferences; prefer scoring impact as “unverified claim risk” rather than “did not do X”.

## Environment check
- Confirmed workspace contains calibration notes and `activity.jsonl`, but not the three expected `*.jsonl` inputs.

