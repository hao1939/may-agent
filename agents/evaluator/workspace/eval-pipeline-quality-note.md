# eval-pipeline-quality — liveness note (2026-05-01)

## Signal
DB recency check indicates the evaluation pipeline is producing new rows recently.

- `evaluations.max(createdAt)` = **2026-05-01T01:53:17.361Z**
- `sessions.max(startedAt)` = **2026-05-01T02:22:02.920Z**
- Lag ≈ **28.76 min**
- `evaluations_last2h` = **32**

## Interpretation
- This looks like *normal scheduling lag / batch cadence*, not a stalled pipeline.
- The previously observed staleness of `.state/evaluations/` artifacts is likely **legacy output-path drift** rather than evaluation failure (DB is canonical).

## Next check (if alert repeats)
- If lag grows beyond expected cron interval (e.g., >2h), check cron runner / job logs.
- If DB stays fresh but filesystem artifacts stay stale, consider documenting `.state/evaluations/` as non-canonical in evaluator knowledge.
