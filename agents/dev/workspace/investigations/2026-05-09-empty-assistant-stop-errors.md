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

## Current Alert Status

2026-05-09 heartbeat follow-up found the pattern is now first-class visible as metric `session.empty-assistant-stop-count-1h`: current `28`, threshold `0`, alert `#249`, owner `may`, priority `P1`. The metric did what the previous investigation requested: this failure mode is now visible without manual transcript sampling. Related health checks show the old provider first-turn class is resolved (`session.first-turn-error-count-1h=0`) and LLM eval liveness continues (`evaluation.deep_recorded` at runtime timestamp `1778314258425`, `eval.llm-coverage-lag-h=1.02 < 4`). The current damage remains concentrated in evaluator aftermath sessions: the 12 latest evaluator `status='error'` rows are `workflow:evaluator-aftermath`/`workflow:evaluator-heartbeat` with `error=NULL`.

## Next Steps

1. Watch whether evaluator errors continue to dominate the last-hour error grouping and whether alert `#249` receives a `metric.alert_judged` owner decision from may.
2. If the pattern persists, patch the evaluator/deep-eval prompts or runtime wrapper to reject empty `content=[]` normal-stop responses as retryable, bounded by a small retry count.
3. Do not add a duplicate metric: `session.empty-assistant-stop-count-1h` already covers this failure mode.

## 2026-05-09 Heartbeat Follow-up

Latest heartbeat evidence confirms two overlapping runtime reliability patterns:

- The old first-turn provider `Connection error` burst is not currently active: `session.first-turn-error-count-1h=0`, while handler health is green (`handler.success-rate=1`).
- The empty-assistant-stop cluster remains the active high-impact failure: `session.empty-assistant-stop-count-1h=28` with unresolved alert `#249`; the last-hour failure grouping is dominated by `workflow:evaluator-aftermath` (`26` `status='error'`, `error=NULL` rows) plus one evaluator heartbeat and one eval-llm-scan error.
- The non-heuristic evaluator lane is still alive despite the empty-stop failures: recent `evaluation.deep_recorded` events exist at `1778314957883`, `1778314476521`, `1778314258425`, `1778313194374`, `1778312523657`, and `1778312072140`; `eval.llm-coverage-lag-h=0.13` and `eval.llm-evals-24h=4`.
- May's metric-alert triage chose `upgrade_or_escalate` for alert `#249` and requested a code fix: add bounded retry logic for empty assistant `stop` responses in the session runner. That code path is outside dev's editable `/app/agents` scope in this container, so the safe dev action is to preserve evidence and escalate/track rather than attempt a production runner patch here.
- A separate `Clean start (fresh)` interruption pattern persists in recent sessions across evaluator, may, arc, and dev, but it is distinct from the empty assistant `status='error'` rows and should not be merged with the empty-stop metric.

Recommended owner action: implement bounded retry/fallback in the session runner for normal-stop responses with no assistant content/tool calls, and keep the retry budget small (for example 2 attempts) so evaluator aftermath does not amplify provider load.

## 2026-05-09 Dev Implementation Scope Note

The P1 implementation request for alert `#249` asks dev to implement or scope a bounded retry/fallback for empty assistant normal-stop responses. I re-checked the writable `/app/agents` tree and confirmed the production session runner/orchestrator code path that converts provider messages into `sessions.status='error'` rows is not present here: a pruned `find /app -maxdepth 2` shows only `/app/agents` plus runtime/system directories, and pruned searches under `agents/shared`, `agents/may`, and `agents/dev` find workflow helpers and historical coverage HTML, not the live provider message loop that owns assistant `content=[]` / `stopReason="stop"` handling.

Concrete patch for the runtime owner (the service/session-runner repository outside this container's editable agent tree):

```ts
const MAX_EMPTY_ASSISTANT_STOP_RETRIES = 2;

function isEmptyAssistantStop(message: AssistantMessage | null | undefined): boolean {
  const hasContent = Array.isArray(message?.content) && message.content.length > 0;
  const hasToolCalls = Array.isArray(message?.toolCalls) && message.toolCalls.length > 0;
  return message?.role === "assistant"
    && message.stopReason === "stop"
    && !hasContent
    && !hasToolCalls;
}

for (let attempt = 0; attempt <= MAX_EMPTY_ASSISTANT_STOP_RETRIES; attempt++) {
  const response = await callProvider(request);
  if (!isEmptyAssistantStop(response.assistantMessage)) return response;

  emit("session.empty_assistant_stop.retry", { sessionId, attempt, max: MAX_EMPTY_ASSISTANT_STOP_RETRIES });
  if (attempt === MAX_EMPTY_ASSISTANT_STOP_RETRIES) {
    throw new RetryableProviderContractError("Provider returned empty assistant content with stopReason=stop");
  }

  request = addRetryNudge(request,
    "Your previous response was empty. Continue the task and either call a tool or provide a substantive final answer.");
}
```

Required safeguards for that runtime patch:

- Retry only on the precise normal-stop/no-content/no-tool-call shape; do not retry explicit refusal, max-token, tool-use, or provider-error stops through this branch.
- Cap retries at two attempts per session and emit retry/exhaustion events so `session.empty-assistant-stop-count-1h` can distinguish retried-and-recovered vs exhausted failures.
- Preserve the original transcript entries for all attempts so aftermath/evaluator can diagnose provider behavior without losing evidence.
- Add a unit/integration test with a fake provider returning two empty stop responses then a tool/final response, plus an exhaustion test verifying the runner records a structured error rather than `error=NULL`.

Escalation target: runtime/session-runner owner (outside `/app/agents`; likely the application service that owns the provider loop and `sessions` table writes). Dev should not attempt a partial fix inside evaluator prompts or metrics calibration because the failure is occurring after provider normal-stop responses across evaluator aftermath and deep-eval sessions.
