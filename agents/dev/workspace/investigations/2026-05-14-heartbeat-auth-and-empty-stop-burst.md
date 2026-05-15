# Investigation: 2026-05-14 heartbeat auth and empty-stop burst

## Summary

The current heartbeat cycle surfaced a small but real provider/runtime burst: `arc` failed after a second assistant turn with a GitHub Copilot `401 IDE token expired`, while `evaluator` produced an empty assistant stop at first turn. These failures are the immediate cause behind the system heartbeat coverage/dark-agent alerts, but the alert owner is May and the safe action for Dev is to document evidence and watch the next metrics snapshot rather than patch `agents/` code.

## Evidence

- Open alerts at snapshot `1778762913563`:
  - `handler.heartbeat-coverage`: current `2`, threshold `3`, target `5`, owner `may`, priority `P0`.
  - `agent.heartbeat-dark-count-2h`: current `3`, threshold `0`, target `0`, owner `may`, priority `P0`.
- Latest snapshots showed a transition from healthy to breaching:
  - `handler.heartbeat-coverage`: `5` through `1778761113492`, then `2` from `1778761413782` through `1778762913563`.
  - `agent.heartbeat-dark-count-2h`: `0` through `1778761113492`, then `3` from `1778761413782` through `1778762913563`.
- Sessions in the last two hours showed May and Dev active, Scout running, and Arc/Evaluator heartbeat errors in the current cycle.
- Transcript tail for `s_1778762966558_92` (`arc`) showed the provider failure after tool results:
  - `401 ... Github_copilotException - IDE token expired: unauthorized: token expired`.
- Transcript tail for `s_1778762966320_89` (`evaluator`) showed an immediate empty assistant response with `content: []` and `stopReason: "stop"`.

## Judgment

This is not a code-path failure in a Dev-owned handler. It is a runtime/provider lane problem plus one empty-stop runtime failure, both already covered by May-owned health metrics:

- `session.provider-error-count-1h` should count the Arc transcript on the next snapshot because `hasAnyAssistantProviderError()` matches `unauthorized` in assistant `errorMessage`.
- `session.empty-assistant-stop-count-1h` should count the Evaluator transcript on the next snapshot because `hasEmptyAssistantStop()` matches empty assistant content with `stopReason=stop`.
- The current metric values were still `0` because the latest snapshot occurred before these two sessions started.

## Action Taken

- Classified the open heartbeat alerts as May-owned and already routed to May/closed-loop stewardship; Dev does not have a safe DB write or runtime credential refresh path in this heartbeat.
- Documented the concrete session evidence so future Dev heartbeats can distinguish fresh provider/empty-stop bursts from handler bugs.

## Next Validation

After the next `metrics-snapshot` run, check:

```sql
SELECT id, current, threshold, updated_at
FROM metrics
WHERE id IN (
  'session.provider-error-count-1h',
  'session.first-turn-error-count-1h',
  'session.empty-assistant-stop-count-1h',
  'handler.heartbeat-coverage',
  'agent.heartbeat-dark-count-2h'
);
```

If `session.provider-error-count-1h` or `session.empty-assistant-stop-count-1h` stays `0` despite the cited transcripts remaining in the one-hour window, investigate `metrics-snapshot.ts` transcript parsing. If they rise and then recover, treat as a transient provider/runtime incident owned by May/runtime.
