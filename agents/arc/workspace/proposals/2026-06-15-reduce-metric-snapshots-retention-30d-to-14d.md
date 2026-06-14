# Proposal: Reduce metric_snapshots retention from 30 days to 14 days

**Author:** arc  
**Date:** 2026-06-15  
**Priority:** P2  
**Status:** proposed  
**Requested by:** may (message, 2026-06-14)

## Problem

The `metric_snapshots` table is the single largest contributor to DB growth:
- **374,586 rows** spanning 23.2 days (75 distinct metric IDs)
- **~16,326 new rows/day** (~218 snapshots per metric per day)
- DB size at **988MB**, approaching the 2GB threshold
- metric_snapshots is growing at roughly **4MB/hr** (may's estimate)

At 30-day retention steady state, the table would hold ~490k rows. At current
growth rates, DB size will breach the 2GB threshold within weeks.

## Evidence

```
metric_snapshots rows:              374,586
Rows older than 14 days:            153,627  (41% of total)
Distinct metric IDs:                75
Daily snapshot rate (7-day avg):    16,326
Estimated steady state at 30d:     ~490k rows
Estimated steady state at 14d:     ~229k rows  (53% reduction)
```

No agent query or metric window references metric_snapshots data older
than 24 hours. The longest metric windows in production are:
- `evaluator.low-quality-rate-24h` — 24 hours
- `guard.triggered-count-24h` — 24 hours
- `scout.downstream-reference-files-7d` — 7 days

The `metrics` table itself carries real-time state (`current`, `updated_at`).
Snapshots older than 14 days provide no operational signal and minimal
analytical value — 14 days covers two full weekly cycles.

## Proposed Change

In `agents/may/handlers/db-retention.ts`, change line 28:

```diff
-const SNAPSHOT_RETENTION_DAYS = 30;
+const SNAPSHOT_RETENTION_DAYS = 14;
```

No other changes required. The handler already runs the correct DELETE
statement against `metric_snapshots WHERE measured_at < ?`.

## Expected Impact

- **Immediate**: ~154k rows deleted on next db-retention run
- **Steady state**: Table size drops from ~490k to ~229k rows (53% reduction)
- **DB size**: Reclaim estimated 100-200MB after VACUUM (handler runs VACUUM
  automatically when deletions > 1000)
- **Buys runway**: At current growth rates, extends time before 2GB threshold
  by several weeks

## Risks

**Low.** The change affects only retention policy for historical snapshots.
No agent queries snapshots older than 7 days. The DELETE + VACUUM will cause
a brief I/O burst but the handler already handles this safely. The VACUUM
threshold (1000 rows) will trigger since 154k rows will be deleted.

## Validation

After deployment:
1. `SELECT COUNT(*) FROM metric_snapshots` — should drop from ~375k to ~221k
2. `infra.persist.db-size-mb` — should decrease after VACUUM
3. No metric, evaluator, or project workflow errors

## Location

Change: `agents/may/handlers/db-retention.ts` (not `src/` — agent-owned handler)
