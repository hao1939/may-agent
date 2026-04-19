# Calibration Note — 2026-03-19T06:46Z

## What I checked (evidence)
- `node agents/evaluator/skills/monitor-session.cjs --running` returned **HEALTHY** for 1 running session (this evaluator heartbeat). No anomalies or alerts. (tool output timestamp 2026-03-19T06:45:49Z)
- Sampled recent evaluation artifacts:
  - `.state/evaluations/tasktree_s_1773860700740_136.json` (coach): shows issues with explicit FM tags + concrete evidence references.
  - `.state/evaluations/tasktree_s_1773782628259_142.json` (bob): shows multi-issue chain with FM/FC tags and tool-output evidence.
- Workspace calibration inputs status:
  - `agents/evaluator/workspace/consistency-flags.jsonl`: 0 lines
  - `agents/evaluator/workspace/human-reviews.jsonl`: 0 lines
  - `agents/evaluator/workspace/re-evaluations.jsonl`: 0 lines
  (per `wc -l`)

## Signal quality observations
- Recent evaluations are largely **actionable**: they name specific failure modes (e.g., tool interface misuse, verification failure) and point to concrete evidence (exit codes, file paths).
- Potential gap: workflow-level notes sometimes mix “format/style critique” with “durable artifact exists” (e.g., narrative vs structured report) without a clear threshold for when this impacts quality vs just a minor issue.

## Change made
- None. No new calibration data (human reviews / consistency flags / re-evals) available to justify criteria changes.

## Next calibration action
- When any of the following becomes non-empty: `consistency-flags.jsonl`, `human-reviews.jsonl`, or `re-evaluations.jsonl`, re-calibrate scoring thresholds around (a) verification failures and (b) evidence vs narrative tradeoffs.
