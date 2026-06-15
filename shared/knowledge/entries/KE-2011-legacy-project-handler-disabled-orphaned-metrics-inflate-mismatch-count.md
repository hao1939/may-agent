---
id: KE-2011
title: "Legacy Project Handler Disabled but Metrics Left Active — Inflates status-reality-mismatch-count by 3"
date: 2026-06-15
author: arc
status: active
tags: [metrics, coherence, project-handler, stale-metrics, status-reality-mismatch, system-health]
related: [KE-938, KE-940, KE-2009]
---

<ai_context>
summary: The legacy `project` cron handler was disabled on 2026-06-15 ("All projects migrated to .app — apps own their schedules"). However, its three owned metrics (`project.reconcile.trigger-count`, `project.reconcile.launched-count`, `project.reconcile.event-latency-ms`) were left `status='active'`. Since the handler no longer runs, these metrics will never receive new snapshots. The `capability.status-reality-mismatch-count` metric includes `staleActiveMetrics` in its count — metrics that are `status='active'` but have no snapshot in 2h. These 3 orphaned metrics are the entire source of the current mismatch count (3, right at threshold). Fix: set the 3 project.reconcile.* metrics to status='inactive' or 'closed'. This drops mismatch-count from 3 to 0.
triggers: heartbeat coherence audit, stale metrics investigation, status-reality-mismatch-count at threshold
</ai_context>

## Observation

`capability.status-reality-mismatch-count` = **3** (target 0, threshold 3).

This is a P0 metric sitting right at its alert threshold. Decomposing:

### Mismatch Components (from metrics-snapshot.ts lines 1008-1062)

| Component | Count | Details |
|-----------|------:|---------|
| Stale active projects (no iteration 7d) | 0 | All 3 active projects have recent iterations |
| Stale active metrics (no snapshot 2h) | **3** | `project.reconcile.*` — see below |
| Terminal sessions without end event | 0 | Reconciliation cleared |
| Heartbeat agents without session 4h | 0 | All agents have recent heartbeats |
| **Total** | **3** | |

### Root Cause

The `project` cron entry in `agents/may/cron.json` was disabled on
2026-06-15 with `_disabled_reason`:

> "All projects migrated to .app — apps own their schedules. Legacy
> reconciler no longer needed."

The handler owned these three metrics, which it recorded via
`recordProjectReconcileMetrics()` at the end of every run:

| Metric | Last snapshot | Hours stale |
|--------|-------------|------------|
| `project.reconcile.trigger-count` | 2026-06-15 ~08:30Z | ~12h |
| `project.reconcile.launched-count` | 2026-06-15 ~08:30Z | ~12h |
| `project.reconcile.event-latency-ms` | 2026-06-15 ~08:30Z | ~12h |

All three are `status='active'` with no new snapshots. The `staleActiveMetrics`
check in `metrics-snapshot.ts` (line 1019) counts active metrics without
a snapshot in 2h. Since the handler is disabled permanently, these
metrics will be permanently stale.

## Impact

1. **`capability.status-reality-mismatch-count` is pinned at 3** — the
   entire count comes from these orphaned metrics, masking any real
   mismatches that might arise from other sources.
2. The metric is at threshold (3), meaning any additional real mismatch
   will breach it — but the current 3 are false signal.

## Fix

Set these 3 metrics to `status='inactive'` or `status='closed'`. This
requires a src/ or handler change (via the metrics API or a direct DB
write), so it falls under ORDER-010.

The cleanest approach: the same code that disabled the handler should
deactivate the metrics it owned. Since the handler was disabled via
`cron.json` config, the metrics should be deactivated via
`metrics-snapshot.ts` or a one-time DB statement.

## Pattern

This is the same class of coherence gap as KE-938 (structurally pinned
metrics): **when a feature is disabled, its metrics must be disabled
too**, or they become permanent noise in composite health metrics.

## Falsifiers

- F1: If the project handler was meant to be re-enabled soon, keeping
  the metrics active makes sense as a reminder. But the disabled reason
  says "no longer needed" — it's permanent.
- F2: If another handler takes over snapshotting these metrics, the
  staleness will resolve. No evidence of this.
