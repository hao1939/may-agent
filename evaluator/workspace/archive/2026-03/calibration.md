# Calibration notes (2026-03-12)

## Missing calibration artifacts
During heartbeat, the expected calibration files were not present:
- `agents/evaluator/workspace/consistency-flags.jsonl`
- `agents/evaluator/workspace/human-reviews.jsonl`
- `agents/evaluator/workspace/re-evaluations.jsonl`

These reads returned ENOENT, so no calibration against flags/human disagreements/re-evals could be performed in this pass.
