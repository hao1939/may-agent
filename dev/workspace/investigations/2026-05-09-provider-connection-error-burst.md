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

## 2026-05-09 07:05 UTC heartbeat update

The burst is now directly visible through a P1 metric:

- Open alert `#248` for `session.first-turn-error-count-1h`; metric row shows owner `may`, current `42`, threshold `0`, target `0`, priority `P1`.
- Latest snapshots for `session.first-turn-error-count-1h` both measured `42`.
- Last-hour `sessions` query found `42` total `status='error'` sessions, grouped as: may `20`, evaluator `16`, scout `3`, arc `2`, master `1`.
- Spot checks of current recent transcripts confirm the same two-line, pre-tool-call pattern for `s_1778309976332_10`, `s_1778309955448_7`, `s_1778309919794_3`, and `s_1778309634407_0`: user prompt followed by assistant `stopReason="error"` and `errorMessage="Connection error."`.
- One sampled evaluator aftermath session, `s_1778308950409_10`, instead ended before tools with `401 IDE token expired: unauthorized: token expired`, so the broader first-turn metric is mixing at least two provider/auth failure modes.
- Handler metrics remain healthy (`handler.success-rate=1`, `handler.failed-count=0`), and two successful sessions in the last 10 minutes indicate this is not a total runtime outage.

Judgment: no code patch is indicated from this heartbeat. The alert is May-owned and already in the closed-loop/steward path; dev's action is to preserve the failure pattern evidence and watch for continued growth or a threshold-crossing `session.error-rate-6h` regression.

## 2026-05-09 07:36 UTC heartbeat update

Follow-up on the pending evaluator messages shows three distinct failure classes that were being conflated as "zero-op" runtime failures:

1. **Provider first-turn errors are real but improving.** Current metric row for `session.first-turn-error-count-1h` is `current=12`, `threshold=10`, `target=0`; the alert `#248` remains open, but the count is far below the earlier 42. Last-hour grouping still shows null-error `status='error'` rows across may, evaluator, scout, and master, while `handler.success-rate=1` and `handler.failed-count=0` remain healthy.
2. **`Clean start (fresh)` rows are supervisor reaps, not provider/tool failures.** The cluster around `1778309919xxx–1778309960xxx` has eight `status='interrupted'` rows across evaluator, may, scout, arc/dev later, all stamped `error='Clean start (fresh)'`. Spot checks of `s_1778309960758_9`, `s_1778309960726_8`, `s_1778309936869_4`, and `s_1778309955372_6` show exactly one JSONL line (user prompt only). Existing design doc `agents/may/workspace/DESIGN-child-session-recovery.md` explains this string is written by `resumeStaleSessions({ abort: true, kinds: ["call"] })` when the runtime restarts/reaps stale call sessions. This is already excluded from `session.error-rate-6h` and `session.failed-triage-rate-3h` in `agents/may/handlers/metrics-snapshot.ts`; it should not be interpreted as an agent no-op.
3. **`cc_worker` has a separate Claude CLI/proxy/tool-result path failure.** Master smoke sessions `s_1778311263045_23` and `s_1778311441039_29` successfully invoked `cc_worker`, but the worker CLI initialized and then emitted repeated `api_retry` events with `error="unknown"` before timing out (`exit 143`). Older master session `s_1778308550775_8` also demonstrated direct `curl` to `http://host.docker.internal:4000/v1/messages` works while the Claude CLI retries forever, suggesting a CLI/proxy auth or request-format mismatch. Session `s_1778310041133_0` shows an additional runtime adapter bug: `cc_worker` returned a toolResult with `isError=false` and no `content`, then the assistant loop crashed with `undefined is not an object (evaluating 'content.some')`.

Judgment: no dev-owned code patch is safe from this heartbeat because the direct fix points are outside dev's editable surface (`src` runtime adapter and `agents/master/tools/cc-worker.ts`). The actionable next steps are: keep alert #248 open until the next snapshot drops below threshold, route the `cc_worker` CLI/proxy and empty-toolResult issues to the runtime/master owner, and treat `Clean start (fresh)` clusters as supervisor-lifecycle reaps rather than task failures.
