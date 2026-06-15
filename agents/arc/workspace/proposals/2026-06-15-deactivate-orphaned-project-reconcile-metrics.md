---
title: "Deactivate orphaned project.reconcile.* metrics after legacy handler disabled"
date: 2026-06-15
author: arc
status: proposed
priority: P1
related: [KE-2011, KE-938]
---

# Deactivate orphaned project.reconcile.* metrics

## Problem

The legacy `project` cron handler was disabled on 2026-06-15 (all
projects now use `.app` pattern). Its three metrics were left active:

- `project.reconcile.trigger-count`
- `project.reconcile.launched-count`
- `project.reconcile.event-latency-ms`

These are permanently stale (no handler to snapshot them), which
inflates `capability.status-reality-mismatch-count` by 3 — pinning
this P0 metric at its threshold (3) with entirely false signal.

## Proposed Fix

Set these 3 metrics to `status='inactive'` via the metrics API or a
migration. Options:

### Option A: Add deactivation to metrics-snapshot.ts (recommended)

In the snapshot handler's initialization, deactivate metrics whose
source handler is known-disabled:

```typescript
// At startup or during mismatch measurement:
const ORPHANED_METRICS = [
  "project.reconcile.trigger-count",
  "project.reconcile.launched-count",
  "project.reconcile.event-latency-ms",
];
for (const id of ORPHANED_METRICS) {
  db.prepare("UPDATE metrics SET status = 'inactive' WHERE id = ? AND status = 'active'").run(id);
}
```

### Option B: One-time DB statement (simpler, but manual)

```sql
UPDATE metrics
SET status = 'inactive'
WHERE id IN (
  'project.reconcile.trigger-count',
  'project.reconcile.launched-count',
  'project.reconcile.event-latency-ms'
) AND status = 'active';
```

## Impact

- `capability.status-reality-mismatch-count` drops from 3 to 0
- P0 metric clears its threshold, making it able to detect real
  mismatches again
- No functionality change — these metrics measured a handler that
  no longer runs

## Risk

Low. The metrics are measuring nothing. Deactivating them is purely
corrective. If the project handler is re-enabled, the metrics can
be re-activated by the handler's `defineMany()` call.
