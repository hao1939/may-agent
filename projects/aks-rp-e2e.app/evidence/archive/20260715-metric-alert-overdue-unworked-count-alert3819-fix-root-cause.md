# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.blocked.overdue-unworked-count` alert 3819

- Alert id: `3819`
- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Operation: `fix_root_cause`
- Judged at: `2026-07-15T12:40Z`

## Judgment

This breach was real and safe to repair locally. The original offender sampled on the alert was `hold-compact-secops-package-partial-frontier-20260714`, whose blocked frontier was still truthful but had aged past its watch window. After refreshing that exact holder, a fresh recompute exposed two additional exact ADO waits whose `next_check_at` windows had also silently expired even though their latest observed run statuses were still nonterminal. The correct action was to refresh those same wait contracts in place, not reopen broad reruns, calibrate the metric, or escalate.

## Evidence checked

### Alert-time metric state from prompt

```json
{"value":1,"sample_size":1,"measured_at":1784118620885,"measured_by":"agent:may","note":"{\"offenderTaskIds\":[\"hold-compact-secops-package-partial-frontier-20260714\"]}"}
```

### Fresh local recompute before repair

```json
{"measuredAt":1784119043692,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1,"sampleSize":1,"note":"{\"offenderTaskIds\":[\"hold-compact-secops-package-partial-frontier-20260714\"]}"}
```

### Current authority still preserved the waits

- `../aks-rp-e2e/features/secops/compact/staging.summary.md` still says live compact dispatch is blocked by the represented secops frontier on `hold-compact-secops-package-partial-frontier-20260714` until that exact frontier changes.
- `evidence/archive/20260715-compact-package-partial-runnable-backfill.md` still lists `secops` as represented by `hold-compact-secops-package-partial-frontier-20260714` and shows the broad package remains partial rather than ready for reopen.
- `ops-apply-reconcile-compact-loop-package-partial-task-tree-followup-20260715.md` records that a narrower secops ready-subset follow-up is only planner-proposed, not yet a live replacement for the broad compact holder.
- `wait-network-cni-ready-subset-ado-run-172310203-result` already carried `last_observed_at=2026-07-15T12:27:36.904Z` with `last_observed_status=inProgress` for run `172310203`.
- `fix-ccp-coredns-autoscaler-proportional-run-172310245-domain-followup-domain-followup` already carried `last_observed_at=2026-07-15T12:27:36.904Z` with `last_observed_status=inProgress` for run `172324581`.

## Root cause

The waits were still truthful. The actual defect was stewardship timing: three exact blocked waits had aged past their review windows, so the overdue-unworked metric correctly treated them as uncovered blocked debt even though the represented frontier/run facts themselves had not changed.

## Change made

I refreshed these exact waits through the supported task-tree safe write path (`task-tree refresh-blocked-wait`), preserving their same-lineage meaning while moving the blocked watch windows back into the future:

1. `hold-compact-secops-package-partial-frontier-20260714`
2. `wait-network-cni-ready-subset-ado-run-172310203-result`
3. `fix-ccp-coredns-autoscaler-proportional-run-172310245-domain-followup-domain-followup`

Representative readback after repair:

- `hold-compact-secops-package-partial-frontier-20260714`
  - `blocker.next_check_at = 2026-07-16T12:45:00.000Z`
  - `blocker.fallback_at = 2026-07-17T12:45:00.000Z`
  - `trace.blocked_wait_refresh_summary = "Alert 3819 triage confirmed the same secops compact frontier remains exact; refreshed the blocked-watch window and compact timing in place while the bounded ready-subset follow-up remains planner-pending."`
- `wait-network-cni-ready-subset-ado-run-172310203-result`
  - `blocker.next_check_at = 2026-07-15T13:10:00.000Z`
  - `blocker.fallback_at = 2026-07-15T13:40:00.000Z`
  - `trace.blocked_wait_refresh_summary = "Alert 3819 follow-through found the network-cni exact ADO wait had simply aged past its next-check after a 12:27Z inProgress observation; refreshed the same wait window in place without dispatching duplicate rerun work."`
- `fix-ccp-coredns-autoscaler-proportional-run-172310245-domain-followup-domain-followup`
  - `blocker.next_check_at = 2026-07-15T13:10:00.000Z`
  - `blocker.fallback_at = 2026-07-15T13:50:00.000Z`
  - `trace.blocked_wait_refresh_summary = "Alert 3819 follow-through found the ccp-coredns exact ADO wait had aged past its next-check after a 12:27Z inProgress observation; refreshed the same wait window in place so the current run can finish without duplicate status-check work."`

## Validation after repair

A fresh direct recompute cleared the metric immediately:

```json
{"measuredAt":1784119227832,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

## Why this is `fix_root_cause`

The metric was neither stale nor noisy. It correctly exposed exact blocked waits whose observation windows had lapsed. Refreshing those same waits in place fixed the real process gap — missing blocked-wait stewardship timing — while preserving truthful frontier/run ownership and immediately returning the live metric to zero.

## Next validation

- Preferred: next runtime `metrics-snapshot` for `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Expected: remain `0` with `offenderTaskIds=[]` until one of these same-lineage waits reaches its next review window again or materially changes.
