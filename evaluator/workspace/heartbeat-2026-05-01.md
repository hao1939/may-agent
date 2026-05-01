# Evaluator Heartbeat — 2026-05-01

## Inbox / Alerts handled

### Event: agent.notification — P1 stale project `eval-pipeline-quality`
**Action**: act (triage + concrete diagnosis notes)

- DB liveness is **good**: `evaluations.maxCreatedAt = 2026-05-01 01:23:17 UTC`.
- Legacy `.state/evaluations/` folder is **not** a reliable freshness indicator (it contains `task_tree_*.json` artifacts last dated ~2026-03-24, plus a few `s_*.json` dated 2026-04-29). This matches previously-known output-path drift.

## Process health checks (owned)

### #5 Session Evaluation — liveness
Evidence (from `.state/may.db`):
- `evaluations.count = 1604`
- `sessions.count = 3460`
- `evaluations.maxCreatedAt = 2026-05-01 01:23:17 UTC`

Conclusion: evaluation pipeline is running recently.

### #15 LLM Evaluation — heuristic vs LLM signals
I re-checked the heuristic-quality anomaly (quality clustering at 0.20) using DB evidence:
- `quality == 0.2` count: **535 / 1604**
- Top qualities: 0.2 (535), 0.55 (106), 0.25 (98), 0.35 (97), 0.75 (75)
- Flag combos across all evaluations:
  - `(skippedByJs=0, evaluatedByHeuristic=0)`: **1144**
  - `(skippedByJs=1, evaluatedByHeuristic=1)`: **460**
  - No other combos exist.

Interpretation:
- `evaluatedByHeuristic=1` appears to be coupled to `skippedByJs=1` (no `(1,0)` rows), suggesting the heuristic evaluator isn’t producing persisted rows for non-skipped sessions (or its writes are overwritten / not emitted).
- The 0.20 score is likely a default/min-score for “skipped” or an error path, but it is **too frequent** and will distort any quality-based alerts.

## Calibration artifacts availability
The workspace calibration streams are placeholders (symlink targets missing):
- `consistency-flags.jsonl`, `human-reviews.jsonl`, `re-evaluations.jsonl` all contain placeholder text.

This blocks normal calibration tasks until the canonical sources are restored or regenerated.

## Recommended next steps (for delegation)
1) Identify where `skippedByJs` and `evaluatedByHeuristic` are written and why only `(0,0)` and `(1,1)` combos exist.
2) Locate the constant `0.20` path and verify intended semantics.
3) Decide whether to:
   - decouple “skipped” from “heuristic ran”, or
   - remove heuristic-run flag entirely and replace with a more accurate provenance model.
