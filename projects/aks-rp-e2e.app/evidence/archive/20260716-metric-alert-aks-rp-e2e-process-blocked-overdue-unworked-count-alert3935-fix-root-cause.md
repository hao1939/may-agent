# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.blocked.overdue-unworked-count` alert 3935

- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Alert id: `3935`
- Operation: `fix_root_cause`
- Judged at: `2026-07-16T12:09:06Z`

## Why the breach was real

A fresh recompute at triage time still showed the metric breaching with one offender:

```json
{"measuredAt":1784203683080,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1,"sampleSize":1,"note":"{\"offenderTaskIds\":[\"wait-egress-lockdown-windows-baseline-ado-run-172493879-result\"]}"}
```

The live blocked leaf `wait-egress-lockdown-windows-baseline-ado-run-172493879-result` still represented a truthful exact wait on Azure DevOps run `172493879` for `spec.egress-lockdown.windows-baseline`, and the watchdog had already observed the run as still `inProgress` at `2026-07-16T11:55:42.774Z`. The process defect was that the wait's fallback window had already expired:

- previous `blocker.fallback_at = 2026-07-16T11:49:33.284Z`
- previous `blocker.next_check_at = 2026-07-16T11:55:01.551Z`
- `blocker.owner = ado`
- `blocker.condition_id = condition:pipeline:ado:172493879:terminal`

## Root cause

The wait itself was still correct, but its stewardship window lagged behind the latest watchdog observation. Because the exact same blocked carrier remained in place after the run was re-observed as `inProgress`, the overdue metric legitimately counted it as an unworked overdue blocked wait.

## Fix applied

I refreshed the exact blocked wait in place through the supported task-tree control plane:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree refresh-blocked-wait wait-egress-lockdown-windows-baseline-ado-run-172493879-result \
  --blocker "Wait for Azure DevOps run 172493879 for spec.egress-lockdown.windows-baseline queued by accepted task fix-egress-lockdown-windows-baseline-aks-subnet-route-table-association." \
  --resume-condition "Azure DevOps run 172493879 is terminal and its artifacts are available." \
  --summary "Alert 3935 triage confirmed the same exact ADO run 172493879 wait is still truthful, watchdog last observed it inProgress at 2026-07-16T11:55:42.774Z, and only the blocked-wait review window had expired; refresh this same task id in place without widening beyond the current single-spec rerun lineage." \
  --blocker-category external-wait \
  --blocker-owner ado \
  --next-check-at 2026-07-16T14:15:00Z \
  --fallback-at 2026-07-16T18:15:00Z \
  --fallback-action "If the run is still not reviewable at fallback, refresh this exact wait with current ADO status or escalate the artifact/reachability issue."
```

That preserved the same exact wait semantics and updated the live task trace with:

- `trace.blocked_wait_refreshed_at = 2026-07-16T12:09:06.944Z`
- `trace.blocked_wait_refresh_summary = Alert 3935 triage confirmed ... only the blocked-wait review window had expired ...`
- `blocker.next_check_at = 2026-07-16T14:15:00Z`
- `blocker.fallback_at = 2026-07-16T18:15:00Z`

## Validation

After the refresh completed, the same metric recomputed cleanly:

```json
{"measuredAt":1784203795197,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

Live readback of `wait-egress-lockdown-windows-baseline-ado-run-172493879-result` now shows:

- `state = blocked`
- `blocker.next_check_at = 2026-07-16T14:15:00Z`
- `blocker.fallback_at = 2026-07-16T18:15:00Z`
- unchanged exact `condition_id = condition:pipeline:ado:172493879:terminal`

## Why not `waiting_with_evidence`

I did not choose `waiting_with_evidence` because the owner could safely correct the specific process gap immediately. The breach was caused by stale blocked-wait stewardship on a still-truthful wait, and refreshing that exact wait through the supported task-tree path removed the overdue condition without changing the AKS/product judgment.

## Next validation

- Preferred: next runtime `metrics-snapshot` for `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Expected: remain `0` until `2026-07-16T14:15:00Z` unless the ADO run stays nonterminal past the refreshed watch window or a different blocked wait becomes overdue.
