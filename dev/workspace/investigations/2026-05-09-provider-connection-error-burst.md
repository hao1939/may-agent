# Provider Connection Error Burst — 2026-05-09

## Summary

During dev heartbeat triage, the highest-impact live failure pattern was not a handler import error or metric gap. It was a burst of agent sessions terminating before any tool call with provider `Connection error`.

## Evidence

- Last-hour `sessions` breakdown showed errors across multiple agents: evaluator 18, may 14, scout 2, dev 2, arc 2.
- Grouping by source showed the largest clusters were `workflow:evaluator-aftermath` (15), may `workflow:project` (5), `closed-loop-steward` (4), and heartbeat workflows for arc/may/scout.
- Spot checks of recent heartbeat failures showed two-line transcripts only:
  - `s_1778308217989_8` (may heartbeat): user prompt plus assistant `errorMessage="Connection error."`.
  - `s_1778308205178_7` (arc heartbeat): user prompt plus assistant `errorMessage="Connection error."`.
  - `s_1778308168122_6` (scout heartbeat): user prompt plus assistant `errorMessage="Connection error."`.
- Recent evaluator aftermath reviews independently escalated the same pattern for may sessions `s_1778307962923_0` and `s_1778308116153_4`.

## Judgment

This is a runtime/provider reliability burst rather than a code-level handler regression. The failures happen before agent logic runs, with no tool calls and no application stack trace. The correct immediate action is to record the evidence and escalate/track, not to patch workflow code.

## Impact

- `session.error-rate-6h` remains below alert threshold but is elevated (`0.1489` vs target `0.1`, threshold `0.3`).
- `handler.success-rate` remains healthy (`1.0`) and `handler.failed-count` is `0`, so handler metrics will not catch this provider failure mode directly.
- The burst also causes generated runtime dirty state in multiple `*/last-session.md` files without corresponding deliverables.

## Next Validation

Watch the next 30–60 minutes of sessions for recurrence:

```sql
SELECT agent, source, COUNT(*) AS errors
FROM sessions
WHERE status='error'
  AND startedAt > unixepoch()*1000 - 3600000
GROUP BY agent, source
ORDER BY errors DESC;
```

If the count continues rising or crosses the session error alert threshold, escalate to May/Hao as provider/runtime instability with this artifact and the cited session IDs.
