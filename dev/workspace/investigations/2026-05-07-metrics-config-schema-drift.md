# Investigation: metrics.config schema drift still present

**Date:** 2026-05-07
**Owner:** dev
**Signal:** heartbeat DB check; recent `handler.failed` rows for `metrics-snapshot`.

## Summary

The `metrics-snapshot` handler crashed twice because code attempted to use `metrics.config` before the production SQLite schema had that column. A runtime guard was added in `agents/may/handlers/metrics-snapshot.ts`, so the handler is currently green, but the underlying schema drift remains: `PRAGMA table_info(metrics)` still shows no `config` column.

This means typed per-metric config remains unreachable in DB, despite `ALL_METRICS` defining config for counter/rate metrics. The guard is now masking the migration debt rather than fixing it.

## Evidence

Readonly DB checks on 2026-05-07:

- Active metrics are refreshing; `handler.success-rate = 1`, `handler.failed-count = 0` in the current 6h window.
- Historical handler failures include two `metrics-snapshot` crashes:
  - `1778087051850`: `table metrics has no column named config`
  - `1778087351978`: `table metrics has no column named config`
- `PRAGMA table_info(metrics)` contains columns through `direction`, but no `config` column.
- `SELECT COUNT(*) FROM events WHERE event_type='handler.failed' AND json_extract(data,'$.handler')='metrics-snapshot'` returned `2`.

File evidence:

- `agents/may/handlers/metrics-snapshot.ts` still contains:
  - `const hasMetricConfigColumn = metricColumns.has("config");`
  - dual insert/update branches that omit `config` when the column is absent.
- Arc proposal `agents/arc/workspace/proposals/2026-05-06-add-metrics-config-column-and-drop-runtime-guard.md` already identifies the same migration gap and proposes the right structural fix.

## Root cause

Code for v2 typed metric configs landed before the DB migration adding `metrics.config`. The follow-up runtime guard restored handler availability but left architecture/runtime drift in place. Because the handler can now succeed without the column, the system has no active failure signal for the missing schema feature.

## Impact

- Per-metric DB-driven alert config is unavailable; alert behavior remains source-code-only.
- Proposed fixes that depend on branch-specific/rate-mode config remain harder or impossible to implement safely at the row level.
- Future maintainers may assume both schemas are supported because the handler has an explicit compatibility branch.

## Recommended fix

When approved for schema work:

1. Add/run a migration script that executes `ALTER TABLE metrics ADD COLUMN config TEXT;` against `.state/may.db` through the system's safe migration path, not ad-hoc write access from a heartbeat.
2. Remove the compatibility branch in `metrics-snapshot.ts` and always read/write `config`.
3. Add a loud startup assertion if `metrics.config` is missing, so future DB restores fail visibly instead of silently disabling typed config.

## Why not patched in this heartbeat

The current heartbeat environment explicitly restricts writes to `agents/dev/workspace`. Production DB schema changes and `agents/may/handlers/` edits are outside this session's write lane, and destructive/direct DB writes are prohibited. I therefore preserved the evidence and root cause here for approval/owner action.

## Metric gap

The handler is green after the guard, but the schema capability is still absent. Add a schema drift metric or startup assertion for required columns so this class of drift is visible before a feature silently downgrades.
