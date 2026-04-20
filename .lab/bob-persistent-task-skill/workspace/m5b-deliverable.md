# M5b Deliverable: `direction` column + broadened continuous metric alerting

**Status:** COMPLETE  
**Date:** 2026-04-20

## Changes Made

### 1. `agents/may/handlers/heartbeat-context.ts`
- Added `direction: string | null` to `MetricRow` interface
- Added `m.direction` to the SQL SELECT query
- Updated `getMetricWarning()` to use `direction` column for continuous metric polarity, with fallback to `alert_direction` inference for backward compatibility

### 2. `agents/may/handlers/metrics-snapshot.ts`
- Added `direction: string | null` to `MetricRow` interface (type already had schema migration for the column)
- `checkThresholdAlert()` already broadened to all metric types (not just health) — confirmed working

### 3. `agents/scripts/backfill-metric-direction.sql`
- Extended to cover `workflow.premature-done`
- Added auto-sync: any metric with `alert_direction='above'` gets `direction='lower_is_better'`
- Added catch-all: remaining NULL directions get `'higher_is_better'`

## Why This Matters

Before M5b, `getMetricWarning()` inferred metric polarity from `alert_direction`, which is semantically wrong:
- `alert_direction` = "fire alert when value goes above/below threshold"
- `direction` = "which way is better for this metric"

These are correlated but not identical. The new `direction` column makes polarity explicit. The fallback ensures backward compatibility until all metrics have `direction` backfilled.

## Verification

- Both files build clean with `bun build --no-bundle`
- Schema migration for `direction` column already existed in `ensureTables()`
- Backfill SQL is idempotent and safe to re-run

## To Deploy

```bash
sqlite3 .state/may.db < agents/scripts/backfill-metric-direction.sql
```

The heartbeat-context handler will automatically pick up `direction` on next run.
