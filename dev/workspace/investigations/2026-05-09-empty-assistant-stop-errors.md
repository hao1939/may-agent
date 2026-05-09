# Empty Assistant Stop Errors — 2026-05-09

## Summary

A new high-volume error pattern is distinct from the earlier provider `Connection error` burst: evaluator sessions are starting successfully, the provider returns `stopReason="stop"`, but the assistant message has empty `content` and the session ends `status='error'` with `finishParams=null`.

## Evidence

- Current recent-error query returned five latest `status='error'` sessions, all evaluator-owned, all with `error=NULL`: `s_1778313050805_3`, `s_1778312913888_17`, `s_1778312908159_16`, `s_1778312901518_15`, `s_1778312896135_14`.
- Last-hour grouping showed evaluator errors dominate current failures: `workflow:evaluator-aftermath` has 16 error sessions, `workflow:evaluator-heartbeat` has 2, and `eval-llm-scan` has 1.
- Transcript spot checks show the provider returned normally but with no assistant content:
  - `s_1778313050805_3`: assistant record has `content=[]`, `stopReason="stop"`, no tool calls, then session error.
  - `s_1778312913888_17`: same empty assistant content / normal stop pattern on an evaluator aftermath prompt.
  - `s_1778312908159_16`: same empty assistant content / normal stop pattern on an evaluator aftermath prompt.
  - `s_1778312880067_10`: deep-eval prompt returned empty assistant content, followed by `evaluation.deep_failed` with `reason="missing_or_invalid_artifact"` for target `s_1778311934720_38`.
- Evaluation liveness is not fully broken: last-24h evaluation counts show 3 non-heuristic rows and 509 heuristic rows, and the latest non-heuristic evaluation lag is about 0.777h. This is a quality/reliability regression in evaluator child sessions, not a total LLM-eval outage.

## Judgment

This looks like a runtime/provider contract problem or prompt/model compliance issue where an empty assistant message with `stop` is treated as a session error after the fact. It is not the earlier first-turn provider `Connection error` class, and it is not a handler import failure (`handler.success-rate=1`, `handler.failed-count=0`).

## Impact

- The pattern is currently the largest recent error cluster and can starve evaluator aftermath/deep-eval artifacts even while metrics remain mostly green.
- `eval.llm-coverage-lag-h` remains below threshold for now, but repeated `evaluation.deep_failed` events will eventually reduce deep-eval coverage if successful runs do not continue.
- The lack of an explicit error string in `sessions.error` makes this easy to misclassify as generic evaluator failure unless transcripts are sampled.

## Next Steps

1. Watch whether evaluator errors continue to dominate the last-hour error grouping.
2. If the pattern persists, patch the evaluator/deep-eval prompts or runtime wrapper to reject empty `content=[]` normal-stop responses as retryable, bounded by a small retry count.
3. Consider a metric or event counter for `assistant_empty_stop_error` so this failure mode is visible without manual transcript inspection.
