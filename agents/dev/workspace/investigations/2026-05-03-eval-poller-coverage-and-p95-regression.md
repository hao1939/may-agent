# Investigation: eval-poller coverage gap is now the dominant reliability issue

**Date:** 2026-05-03
**Owner:** dev
**Status:** confirmed regression; code/metric changes needed outside dev workspace

## Summary

The visible failure metrics are green, but the system is still missing the problem that matters most: `eval-poller` is spending ~4 minutes per run while evaluation coverage collapses. In the current DB snapshot, recent terminal non-evaluator sessions are mostly not evaluated, and the eval-poller processed-state file is growing with session IDs that have no matching row in `evaluations`.

This is the highest-impact current failure pattern because it affects quality signals for every agent: the last 24h have **729** terminal non-evaluator sessions, but only **80** have evaluation rows. The last 6h are worse: **169** terminal non-evaluator sessions, **13** evaluated, **156** missing.

## Current metrics and handler health

Active metrics from the snapshot handler are mostly green:

- `handler.success-rate = 1`
- `handler.failed-count = 0`
- `session.error-rate-6h = 0`
- `handler.p95-duration = 244,276 ms` (above target `120,000 ms`, below alert threshold `600,000 ms`)

Recent handler completion data shows no handler failures in the last 6h, but slow completions are concentrated in long-running heartbeats and `eval-poller`:

- Last 6h `eval-poller`: 12 runs, max `258,040 ms`, average `248,195.8 ms`.
- Last 24h non-heartbeat slow tail includes `eval-poller`: 48/48 runs over 120s, average `251,433.1 ms`, max `267,044 ms`.
- Heartbeat handlers dominate total handler duration, but `metrics-snapshot.ts` intentionally excludes `heartbeat-%` from `handler.p95-duration`; therefore the actionable non-heartbeat p95 pressure is still `eval-poller`.

## Evaluation coverage evidence

Readonly DB checks during this heartbeat showed:

```json
{
  "coverage_24h_non_evaluator_terminal": {
    "sessions": 729,
    "evaluated": 80,
    "missing": 649
  },
  "coverage_6h_non_evaluator_terminal": {
    "sessions": 169,
    "evaluated": 13,
    "missing": 156
  }
}
```

Missing 24h evaluations by agent:

```json
[
  {"agent":"optimizer","missing":179},
  {"agent":"amy","missing":96},
  {"agent":"coach","missing":87},
  {"agent":"tech-lead","missing":57},
  {"agent":"scout","missing":48},
  {"agent":"dev","missing":47},
  {"agent":"arc","missing":47},
  {"agent":"may","missing":45},
  {"agent":"bob","missing":43}
]
```

The `.state/eval-poller-processed.json` cross-check is worse than the previous investigation:

```json
{
  "lastRunAt": 1777771175480,
  "processed_count": 3117,
  "processed_with_eval": 2433,
  "processed_without_eval": 684,
  "processed_without_eval_recent7d": 680
}
```

Recent processed-without-evaluation counts by agent:

```json
[
  {"agent":"optimizer","c":202},
  {"agent":"coach","c":96},
  {"agent":"amy","c":90},
  {"agent":"tech-lead","c":56},
  {"agent":"dev","c":50},
  {"agent":"scout","c":48},
  {"agent":"may","c":47},
  {"agent":"bob","c":46},
  {"agent":"arc","c":45}
]
```

The prior 2026-05-02 investigation recorded `processed_without_eval = 552`; it is now **684**. That confirms active regression, not a stale historical artifact.

## Root cause

`agents/may/handlers/eval-poller.ts` still conflates all `null` results from `evaluateStandaloneSession()`:

1. It calls `evaluateStandaloneSession()`.
2. It immediately adds the session ID to `processedSet` and `state.processedSessionIds`.
3. Only after that does it check whether `result` is truthy.
4. If `result` is null, it logs "already evaluated or no messages" even when neither is verified.

That unsafe null handling creates two coupled failures:

- **Coverage loss:** sessions with parse-null or failed LLM evaluation outcomes are marked processed without an evaluation row, so the poller never retries them.
- **Latency pressure:** null results do not count against the LLM budget in the success path, so the handler keeps attempting more sessions until the 240s wall-clock budget expires.

## Required patch

A session allowed to edit handlers should patch `agents/may/handlers/eval-poller.ts` so it:

1. Checks whether an evaluation already exists before invoking `evaluateStandaloneSession()`.
2. Determines whether the session has messages before evaluation.
3. Counts every attempted non-heuristic session against the LLM budget, even when `result` is null.
4. Marks a session processed only when one of these is true:
   - `result` is non-null,
   - an evaluation row exists after the call,
   - an evaluation row existed before the call,
   - the session had no messages,
   - an exception was caught and deliberately classified terminal.
5. Logs unexpected null results separately and leaves them unprocessed for retry or a later typed-failure outcome.

Longer term, `evaluateStandaloneSession()` should return a typed outcome instead of overloading `null` for already-evaluated, no-messages, and evaluation-failed cases.

## Metric gap

Current metrics catch handler latency but not evaluation effectiveness. Add active metrics for:

### `eval.unevaluated-sessions-24h`

```sql
SELECT COUNT(*) AS value
FROM sessions s
LEFT JOIN evaluations e ON e.sessionId = s.sessionId
WHERE s.startedAt > (unixepoch()*1000 - 86400000)
  AND s.status IN ('done','error','failed','interrupted')
  AND s.agent NOT IN ('evaluator','judge')
  AND e.sessionId IS NULL;
```

Suggested target `0`, threshold `50`, alert op `>`.

### `eval.coverage-rate-24h`

```sql
SELECT COALESCE(
  1.0 * SUM(CASE WHEN e.sessionId IS NOT NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
  1.0
) AS value
FROM sessions s
LEFT JOIN evaluations e ON e.sessionId = s.sessionId
WHERE s.startedAt > (unixepoch()*1000 - 86400000)
  AND s.status IN ('done','error','failed','interrupted')
  AND s.agent NOT IN ('evaluator','judge');
```

Suggested target `0.95`, threshold `0.80`, alert op `<`.

### `eval.created-6h`

```sql
SELECT COUNT(*) AS value
FROM evaluations
WHERE createdAt > (unixepoch()*1000 - 21600000);
```

Suggested target depends on traffic; current value was `13` rows covering 169 eligible sessions, so throughput alone is less useful than coverage.

## Why this heartbeat produced an investigation rather than a handler patch

This runtime's scope instruction says the dev workspace is the only directory to write to. The necessary code change is in `agents/may/handlers/eval-poller.ts`, outside the workspace. This file captures current evidence, root cause, and exact remediation so a handler-editing session can apply the patch safely.
