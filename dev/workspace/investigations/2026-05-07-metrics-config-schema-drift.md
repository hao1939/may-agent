# Investigation: metrics.config schema drift keeps typed metric config unreachable

**Date:** 2026-05-07
**Agent:** dev
**Status:** confirmed / awaiting cross-lane migration

## Trigger

Heartbeat check found the latest handler failures were two `metrics-snapshot` crashes:

- `1778087051850`: `table metrics has no column named config`
- `1778087351978`: `table metrics has no column named config`

Current handler metrics are green, so the immediate outage was masked by the runtime guard now present in `agents/may/handlers/metrics-snapshot.ts`.

## Evidence gathered

Readonly schema check on `.state/may.db` shows the production `metrics` table still has no `config` column. Current columns are:

```text
id
name
type
owner
current
target
threshold
unit
priority
status
blocker
project
source
source_query
source_command
sensitivity
measure_interval
created_at
updated_at
closed_at
alert_op
speed
description
direction
```

Readonly handler-failure query shows only the two recent `metrics-snapshot` import/runtime failures:

```json
[
  {"timestamp":1778087351978,"data":"{\"handler\":\"metrics-snapshot\",\"agent\":\"may\",\"error\":\"table metrics has no column named config\",\"durationMs\":5}"},
  {"timestamp":1778087051850,"data":"{\"handler\":\"metrics-snapshot\",\"agent\":\"may\",\"error\":\"table metrics has no column named config\",\"durationMs\":6}"}
]
```

Source inspection confirms the handler currently branches on schema presence:

- It computes `hasMetricConfigColumn` from `PRAGMA table_info(metrics)`.
- If false, built-in metric upserts omit `config`.
- Alert lifecycle selects without `config` and falls back to registry constants via `configByMetricId`.

That prevents further crashes, but means database-backed typed metric config is not actually available in this environment.

## Root cause

The typed metrics code was deployed before the schema migration adding `metrics.config`. A later guard made the handler compatible with the old schema, but that compatibility branch silently preserves the drift: the DB cannot store per-metric alert config, and any architecture/docs that assume `metrics.config` exists are false for production.

## Impact

- The immediate handler outage has stopped because of the guard.
- Metric alert behavior remains source-code-driven for built-ins; per-row config overrides are impossible.
- Follow-on fixes that depend on DB-visible alert mode (for example branch-aware alert messages or dropping rate mode from selected windowed counters by DB config) are blocked or must keep patching source constants.

## Recommended fix

This matches Arc's proposal `agents/arc/workspace/proposals/2026-05-06-add-metrics-config-column-and-drop-runtime-guard.md`:

1. Add a reviewed run-once migration that executes `ALTER TABLE metrics ADD COLUMN config TEXT` against the managed writer path, not from an ad-hoc dev heartbeat.
2. After migration is present in all environments, simplify `metrics-snapshot.ts` to require and use `metrics.config` unconditionally.
3. Add a loud startup assertion if `metrics.config` is missing so future DB restores do not silently reintroduce this drift.

## Why dev did not patch directly

This heartbeat's runtime constraint says `agents/dev/workspace` is the only writable directory. Also, direct production DB schema changes from bash are forbidden without explicit human approval. Therefore this session records the confirmed root cause and the exact migration/code path needed, but does not alter the handler or database.
