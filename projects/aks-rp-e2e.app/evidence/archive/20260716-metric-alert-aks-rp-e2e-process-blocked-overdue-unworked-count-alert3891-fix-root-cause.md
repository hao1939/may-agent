# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.blocked.overdue-unworked-count` alert 3891

- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Alert id: `3891`
- Operation: `fix_root_cause`
- Judged at: `2026-07-16T03:50:55Z`

## Why the breach was real

A fresh recompute at triage time still showed the metric breaching with the same single offender:

```json
{"measuredAt":1784173783556,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1,"sampleSize":1,"note":"{\"offenderTaskIds\":[\"reconcile-spec-loop-pending-rp-regional-quota\"]}"}
```

The live blocked carrier `reconcile-spec-loop-pending-rp-regional-quota` still represented a truthful external wait on westus2 quota headroom, but its blocked-wait review window had expired:

- previous `blocker.next_check_at = 2026-07-16T03:35:33.203Z`
- current blocker remained the same reviewed run-172346097 diagnosis (`managedClusters 40/161`, target not exhausted)

At the same time, current live work already preserved the same diagnosis in review task `fix-rp-regional-quota-public-create-path-run-172346097`, so the process bug was not a missing diagnosis. The gap was that the exact blocked carrier had not been refreshed after the newer 03:38Z review completed, leaving the wait overdue immediately after the latest accepted same-surface evidence.

## Root cause

`reconcile-spec-loop-pending-rp-regional-quota` was still the right blocked carrier, but its watch window lagged behind the latest accepted review on the same westus2 quota-headroom wait. That stale `next_check_at` made the metric count the task as overdue even though the wait had just been re-validated by the follow-on review chain.

## Fix applied

I refreshed the blocked wait in place through the supported task-tree control plane:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree refresh-blocked-wait reconcile-spec-loop-pending-rp-regional-quota \
  --blocker "Reviewed run 172346097 still proves spec.rp-regional-quota.public-create-path is the only live carrier and that the repaired carrier now stops only because staging subscription 26fe00f8-9173-4872-9134-bb1d2e00343a in westus2 was 40/161 rather than exhausted, so the decisive managedClusters PUT quota-negative assertion still cannot be reached." \
  --resume-condition "Resume only when the same staging subscription+region is again exhausted enough for the decisive managedClusters PUT quota-negative assertion, or when another reviewed same-surface exhausted target is accepted for this exact carrier." \
  --summary "Alert 3891 triage confirmed fix-rp-regional-quota-public-create-path-run-172346097 already refreshed the same 40/161 westus2 quota-headroom diagnosis at 2026-07-16T03:38Z; advance reconcile-spec-loop-pending-rp-regional-quota's blocked-wait review window in place without reopening an unchanged rerun." \
  --next-check-at 2026-07-16T05:50:00Z
```

That left the blocker exact, preserved the same resume condition and fallback, and updated the runtime trace:

- `trace.blocked_wait_refreshed_at = 2026-07-16T03:50:55.277Z`
- `trace.blocked_wait_refresh_summary = Alert 3891 triage confirmed ... advance ... review window in place ...`
- `blocker.next_check_at = 2026-07-16T05:50:00Z`

## Validation

After the refresh, the same metric recomputed cleanly:

```json
{"measuredAt":1784173863475,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

Live readback of `reconcile-spec-loop-pending-rp-regional-quota` now shows:

- `state = blocked`
- `blocker.next_check_at = 2026-07-16T05:50:00Z`
- unchanged exact wait semantics on the same run-172346097 / westus2 quota-headroom blocker

## Why not `waiting_with_evidence`

I did not choose `waiting_with_evidence` because the owner could safely correct the concrete process gap immediately. The alert was not just informational; the blocked carrier's stale review window was the direct cause of the metric breach, and refreshing that exact wait through the supported task-tree path cleared the metric without changing the underlying AKS judgment.

## Next validation

- Preferred: next runtime `metrics-snapshot` for `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Expected: remain `0` until `2026-07-16T05:50:00Z` unless a new overdue blocked wait appears without refreshed coverage.
