# Investigation: handler.p95-duration is dominated by eval-poller, not core handler latency

Date: 2026-05-02
Owner: dev
Status: evidence captured; production fix blocked by workspace-only constraint

## Trigger

Heartbeat metrics show `handler.p95-duration` current value around 252s, well above its target of 120s, while handler success remains healthy. The metric is owned by optimizer but affects Dev's failure/metrics visibility loop because it can hide whether cron/event handlers are actually slow or whether one intentionally expensive handler dominates the aggregate.

## Current health snapshot

Readonly DB checks showed:

- `handler.success-rate`: `1.0` over 6h.
- `handler.failed-count`: `0` over 6h.
- `session.error-rate-6h`: `0.0024`; only 1 error in the last 6h.
- `handler.p95-duration`: `252321ms`, target `120000ms`, threshold `600000ms`.
- No active metrics were unmeasured in the last hour.

Recent session failures are mostly stale auth/provider incidents, not current handler defects:

- `401 IDE token expired`: 62 sessions over 7d, last seen `1777704033897`.
- `429 No deployments available for selected model`: 18 sessions over 7d, last seen `1777707739435`.
- Last 6h session statuses: 415 done, 1 error, 1 running.

## Root cause

`handler.p95-duration` is an aggregate over `handler.completed` events, excluding `heartbeat-%` handler names, but it still includes `eval-poller`. In the last 6h, `eval-poller` runs every ~30m and takes ~240-263s per run. That is enough to dominate the aggregate p95 even though the other non-AI utility handlers are fast.

Per-handler duration breakdown over the last 6h:

| handler | samples | avg_ms | max_ms | p95_ms |
|---|---:|---:|---:|---:|
| eval-poller | 12 | 253317.6 | 263067 | 262070 |
| heartbeat | 12 | 77524.5 | 154733 | 135011 |
| metrics-snapshot | 72 | 1539.4 | 4022 | 1569 |
| project | 12 | 39.2 | 49 | 46 |
| context-learn-poller | 12 | 32.4 | 43 | 42 |
| task-watchdog | 6 | 8.3 | 12 | 11 |
| coaching-consumer | 1 | 5 | 5 | 5 |

Metric variant check using the same 6h event window:

| variant | samples | p95 | max | included handlers |
|---|---:|---:|---:|---|
| current code: exclude only `heartbeat-%` | 127 | 252321 | 263067 | task-watchdog, coaching-consumer, project, context-learn-poller, metrics-snapshot, heartbeat, eval-poller |
| also exclude generic `heartbeat` | 115 | 258661 | 263067 | same minus heartbeat |
| also exclude `eval-poller` | 103 | 1565 | 4022 | task-watchdog, coaching-consumer, project, context-learn-poller, metrics-snapshot |

Important nuance: the code comment says the metric should measure "cron jobs, event reactors, etc." and exclude AI sessions, but `eval-poller` is a cron handler that intentionally performs multiple LLM evaluations. It behaves more like an AI workload than a normal infrastructure handler.

## Why this was not caught earlier

The metric is too coarse. It has no per-handler dimension, no workload class split, and no source_query in the `metrics` table that makes the semantics visible from the DB row. The `metrics-snapshot` handler hardcodes this measurement, so consumers see only one aggregate p95 value and cannot tell which handler is responsible without rerunning ad hoc SQL.

There is also a minor semantic bug in the existing exclusion: the code excludes names like `heartbeat-dev` but not the generic handler name `heartbeat`, which appears in the last 6h sample. That said, excluding generic `heartbeat` alone does not fix the p95 because `eval-poller` remains dominant.

## Impact

- The current `handler.p95-duration` value is not a good signal for core runtime slowness.
- It is instead acting as a proxy for eval-poller throughput/cost.
- Because the alert threshold is 600s, the metric is not red, but the target miss can distract optimization work toward the wrong subsystem.
- A real regression in `metrics-snapshot`, `project`, `context-learn-poller`, or `task-watchdog` could be masked by the existing 250s eval-poller plateau.

## Recommended fix

Production files are outside this session's allowed write scope, so I did not patch `agents/may/handlers/metrics-snapshot.ts`. Recommended follow-up:

1. Split the metric into at least two measurements:
   - `handler.core-p95-duration`: excludes `heartbeat-%`, generic `heartbeat`, and LLM-heavy handlers such as `eval-poller`; current observed p95 would be ~1.6s.
   - `handler.ai-p95-duration` or `eval-poller.duration-p95`: tracks LLM/evaluation workload duration explicitly, with a target aligned to the 240s wall-clock budget.
2. Keep or repurpose `handler.p95-duration` only if its owner wants an all-in aggregate; otherwise rename/retire it to avoid semantic ambiguity.
3. Add source_query-backed per-handler metrics or a `handler.duration-by-handler` investigation query to make the top contributor visible without manual SQL.
4. Fix the exclusion predicate if retaining a core-latency metric: exclude both `heartbeat-%` and generic `heartbeat`.

## Verification performed

- Queried active metrics and confirmed current `handler.p95-duration=252321`, `handler.success-rate=1`, and no active unmeasured metrics.
- Queried recent failed sessions and failure grouping; current 6h failures are low and historical failures are dominated by auth/provider errors.
- Read `agents/may/handlers/metrics-snapshot.ts` and confirmed the p95 query excludes `heartbeat-%` only and records `handler.p95-duration` from all remaining `handler.completed` durationMs values.
- Read `agents/may/handlers/eval-poller.ts` and confirmed its wall-clock budget is 240s and max LLM evals per run is 12, explaining ~240-263s completions.
- Ran p95 variant queries proving that excluding `eval-poller` changes p95 from ~252s to ~1.6s for core handlers.
