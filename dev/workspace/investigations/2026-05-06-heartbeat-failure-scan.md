# 2026-05-06 Heartbeat Failure Scan

## Scope
Dev heartbeat checked the approved work queue, active metrics, recent failed sessions, and recent handler failures.

## Findings

### Work queue
`agents/shared/work-queue.md` has no unchecked items in `## Approved`; all current implementation requests remain in `## Proposed`.

### Metrics health
Readonly DB snapshot showed metrics are being refreshed. Key health values at the scan:

- `session.error-rate-6h`: current `0.057`, target `0.10`, threshold `0.30` (`>` alert) — healthy.
- `handler.success-rate`: current `0.9882`, target `0.95`, threshold `0.80` (`<` alert) — healthy.
- `handler.failed-count`: current `2`, threshold `3` (`>` alert) — near threshold but not breaching.

### Recent session errors
Recent 6h session failures grouped by error:

- `Request was aborted.` — 5
- `The operation was aborted.` — 3
- `401 IDE token expired: unauthorized: token expired` — 2
- `Clean start (fresh)` — 1

The dominant current pattern is aborted sessions, not the older token-expiry failures.

### Recent handler failures
Latest `handler.failed` events included two `metrics-snapshot` failures:

```json
{"handler":"metrics-snapshot","agent":"may","error":"table metrics has no column named config","durationMs":5}
```

Current code in `agents/may/handlers/metrics-snapshot.ts` already gates all `config` column usage behind `hasMetricConfigColumn = metricColumns.has("config")`. A readonly schema check confirmed the production `metrics` table does **not** contain `config`, and later `handler.completed` events show `metrics-snapshot` now succeeds repeatedly with ~1.7s duration. This appears to have been a transient/stale-code failure already fixed before this heartbeat.

## Root cause notes

1. The live metrics schema lacks `metrics.config`, so any unguarded `config` reference in handler SQL fails immediately.
2. The checked-in handler now uses schema introspection and registry fallback config, which is the correct compatibility pattern for mixed schemas.
3. Aborted session errors are the highest-volume current session failure pattern, but the sampled DB data does not expose a single handler/code owner from error text alone.

## Recommendation

- Keep the schema-compatibility pattern in `metrics-snapshot`: use `PRAGMA table_info` before referencing optional columns.
- If aborted sessions continue rising or `session.error-rate-6h` approaches threshold, add/verify a metric grouping session errors by normalized category (`aborted`, `auth`, `rate_limit`, `filesystem`, `other`) so dev can detect dominant failure classes without ad hoc SQL.
