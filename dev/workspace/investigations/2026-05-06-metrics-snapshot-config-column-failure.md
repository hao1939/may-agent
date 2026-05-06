# Investigation: metrics-snapshot `config` column handler failure

## Summary

Recent `handler.failed` events showed `metrics-snapshot` failing with `table metrics has no column named config` at timestamps `1778087051850` and `1778087351978`.

The live `metrics` table currently does **not** contain a `config` column. The checked-in handler is now schema-compatible: it probes `PRAGMA table_info(metrics)`, only includes `config` in INSERT/UPDATE/SELECT SQL when the column exists, and falls back to registry-local metric configs when it does not.

## Evidence

- Current `metrics` columns from readonly DB:
  - `id`, `name`, `type`, `owner`, `current`, `target`, `threshold`, `unit`, `priority`, `status`, `blocker`, `project`, `source`, `source_query`, `source_command`, `sensitivity`, `measure_interval`, `created_at`, `updated_at`, `closed_at`, `alert_op`, `speed`, `description`, `direction`
- Recent handler failures in DB:
  - `metrics-snapshot`: `table metrics has no column named config` at `1778087351978`
  - `metrics-snapshot`: `table metrics has no column named config` at `1778087051850`
- Last hour handler failures: none.
- Current handler file mtime: `2026-05-06 17:13:35 +0000`.
- Current handler guard points:
  - `hasMetricConfigColumn = metricColumns.has("config")`
  - INSERT/UPDATE metric registry branches separate SQL for schemas with and without `config`
  - alert lifecycle uses `configSelect = hasMetricConfigColumn ? ", config" : ""`
  - alert config falls back to in-code registry config when DB config is unavailable

## Root cause

The handler previously assumed the production `metrics` table had a `config` JSON column. The deployed database schema lacks that column, so unconditional SQL mentioning `config` failed before metric measurement could complete.

## Current status

No new patch was needed in this heartbeat: the working tree already contains the schema-compatibility fix, and there have been no `handler.failed` events in the last hour. This investigation records the root cause and verification trail so the failure pattern is not rediscovered as unresolved.

## Follow-up recommendation

Add a regression test or lightweight handler smoke check that runs `metrics-snapshot` against a `metrics` schema without `config`, because this class of schema-drift failure is otherwise only detected after production handler failures.
