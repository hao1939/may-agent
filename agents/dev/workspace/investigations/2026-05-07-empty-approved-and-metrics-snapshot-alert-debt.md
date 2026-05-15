# Investigation: empty Approved queue while metrics-snapshot alert debt remains

Date: 2026-05-07
Owner: dev

## Summary

Dev heartbeat found no approved implementation work, so no production code change was permitted. Current runtime reliability metrics are mostly healthy (`handler.success-rate=1`, `session.error-rate-6h=0.0233`), but the highest-impact visible debt remains in the unapproved proposal queue around `metrics-snapshot` alert correctness and schema drift.

## Evidence

- `agents/shared/work-queue.md` has an empty `## Approved` section.
- Active metrics sampled via readonly `.state/may.db`:
  - `handler.success-rate = 1` (target `0.95`, threshold `0.8`)
  - `session.error-rate-6h = 0.0233` (target `0.1`, threshold `0.3`)
  - `handler.failed-count = 0`
- Recent session errors are external/provider issues, not a local code pattern:
  - scout: `401 ... IDE token expired`
  - arc: `Connection error.`
  - dev: `401 IDE token expired`
- Recent handler failures show two `metrics-snapshot` crashes from 2026-05-06:
  - `table metrics has no column named config`
- Current schema confirms `metrics.config` is still absent:
  - `PRAGMA table_info(metrics)` returned fields ending with `description`, `direction`; no `config`.
- `agents/may/handlers/metrics-snapshot.ts` now guards config-column access with:
  - `hasMetricConfigColumn = metricColumns.has("config")`
  - separate insert/update branches when the column is absent
  - registry fallback: `const config = hasMetricConfigColumn && m.config ? JSON.parse(m.config) : registryConfig;`

## Interpretation

The immediate crash was mitigated by runtime guards, which explains why `handler.failed-count` is currently 0. However, the schema is still behind the code/design, and several proposed P0/P1 items remain unapproved:

1. Add `metrics.config` column + drop runtime guard.
2. Stamp branch-specific `alert_type` in `metric_alerts` writes.
3. Branch-aware breach messages.
4. Drop rate-mode alert from windowed-counter metrics.
5. Subscribe `metric-alert-reactor` to `metric.stalled` events.

The current code still hardcodes alert inserts as `alert_type='threshold'` and formats all breach messages as threshold breaches, even when the breach was a rate branch. That matches the pending proposal claims and is a user-facing correctness issue, not just cleanup.

## Recommendation

May/human should approve the top `metrics-snapshot` alert/schema proposal(s) into `## Approved` so dev can implement them in priority order. If only one can be approved first, prioritize the schema migration decision (`metrics.config`) because it determines whether subsequent alert-mode fixes should rely on DB-backed config or registry fallback.

## Verification attempted

`bun test agents/may/handlers/metrics-snapshot.test.ts` did not run because no matching test file exists. Future implementation should add or identify a test covering config-column absent/present behavior and branch-specific alert metadata.
