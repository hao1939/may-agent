# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.blocked.overdue-unworked-count` alert 3835

- Alert id: `3835`
- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Operation: `fix_root_cause`
- Judged at: `2026-07-15T14:33Z`

## Judgment

This breach was real and safe to repair locally. The prompt snapshot named one stale overdue wait, but a fresh local recompute after clearing that specific stale holder exposed three additional exact ADO waits whose observation windows had silently expired while their queued runs were still nonterminal. The correct action was to repair the blocked-wait stewardship in place: remove the stale blocked state for the already-finished ccp-coredns wait, then refresh the still-truthful queued waits from live ADO facts.

## Evidence checked

### Alert-time metric state from the prompt

```json
{"value":1,"sample_size":1,"measured_at":1784124505582,"measured_by":"agent:may","note":"{\"offenderTaskIds\":[\"wait-ccp-coredns-autoscaler-proportional-ado-run-172324581-result\"]}"}
```

### Live ADO facts for the prompt offender (`172324581`)

`az pipelines runs show` now reports:

```json
{
  "id": 172324581,
  "status": "completed",
  "result": "succeeded",
  "queueTime": "2026-07-15T10:36:48.878037+00:00",
  "startTime": "2026-07-15T12:14:23.502606+00:00",
  "finishTime": "2026-07-15T14:24:33.994298+00:00",
  "lastChangedDate": "2026-07-15T14:24:34.873000+00:00"
}
```

`az pipelines runs artifact list` now reports artifacts `plan-inputs` and `slice-01-test-results`, and the downloaded exact result files show:

- aggregate `runs/test-results/test_20260715121457311_ys3jox_349277/result.json` status: `passed`
- per-spec `tests/ccp-coredns-autoscaler-proportional.json` status: `pass`
- exact artifact ref: `runs/test-results/test_20260715121457311_ys3jox_349277/artifacts/ccp-coredns-autoscaler-proportional/spec-runner/result.json`

So `wait-ccp-coredns-autoscaler-proportional-ado-run-172324581-result` was no longer a truthful blocked wait; the run had already finished and returned a reviewable exact result.

### Fresh local recompute after clearing the stale ccp-coredns wait

```json
{"measuredAt":1784125894278,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":3,"sampleSize":3,"note":"{\"offenderTaskIds\":[\"fix-gpu-skip-driver-install-run-172310278-domain-followup\",\"fix-localdns-lifecycle-run-172310406\",\"wait-rp-regional-quota-public-create-path-ado-run-172346097-result\"]}"}
```

### Live ADO facts for the three current offenders

All three named waits still truthfully represent queued runs, but their blocked-watch windows had aged out:

- run `172335288` (`spec.gpu.skip-driver-install`): `status=notStarted`, `result=null`, artifacts `[]`
- run `172341658` (`spec.localdns.lifecycle`): `status=notStarted`, `result=null`, artifacts `[]`
- run `172346097` (`spec.rp-regional-quota.public-create-path`): `status=notStarted`, `result=null`, artifacts `[]`

## Root cause

The metric was correct. The defect was blocked-wait stewardship timing:

1. one exact wait (`wait-ccp-coredns-autoscaler-proportional-ado-run-172324581-result`) stayed blocked after its run had already completed and published exact results, and
2. three other exact waits remained truthful but had expired `next_check_at` windows with no fresh blocked-watch refresh.

## Change made

I fixed the live task tree through the supported task-tree safe write path.

### 1) Removed the stale blocked state for the completed ccp-coredns wait

I unblocked `wait-ccp-coredns-autoscaler-proportional-ado-run-172324581-result` so it returned to runnable domain consumption, because run `172324581` is terminal and its exact same-spec result artifacts are available.

Readback after the change:

- `trace.unblocked_at = 2026-07-15T14:30:21.409Z`
- `trace.unblock_reason = "Azure DevOps run 172324581 is terminal (completed/succeeded) and its exact ccp-coredns-autoscaler-proportional result artifact is now available, so the stale blocked wait must return to runnable domain consumption."`
- the planner immediately re-dispatched the task, so the current live state is now `active` with `trace.assigned_at = 2026-07-15T14:32:34.506Z` and `trace.current_attempt_id = a_wait-ccp-coredns-autoscaler-proportional-ado-run-172324581-result_20260715143234`

### 2) Refreshed the three still-truthful queued waits

I refreshed these exact waits in place from current `status=notStarted` / no-artifact ADO facts:

1. `fix-gpu-skip-driver-install-run-172310278-domain-followup` for run `172335288`
2. `fix-localdns-lifecycle-run-172310406` for run `172341658`
3. `wait-rp-regional-quota-public-create-path-ado-run-172346097-result` for run `172346097`

Each refresh now carries:

- `blocker.next_check_at = 2026-07-15T15:00:00.000Z`
- `blocker.fallback_at = 2026-07-15T16:30:00.000Z`
- refreshed blocker text stating the run remains `notStarted` with no published artifacts
- `trace.blocked_wait_refresh_summary` linking the refresh directly to metric alert `3835`

## Validation after repair

A fresh direct recompute cleared the metric immediately:

```json
{"measuredAt":1784125985724,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

## Why this is `fix_root_cause`

The alert was neither stale nor noisy. It surfaced real process debt in the live task tree: one wait that should no longer be blocked plus three exact waits whose observation windows had lapsed. Fixing those concrete task states returned the represented frontier to truthful, non-overdue stewardship and locally brought the metric back to zero.

## Next validation

- Preferred: next runtime `metrics-snapshot` for `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Expected: remain `0` with `offenderTaskIds=[]` until one of these same-lineage waits again reaches its next review window or materially changes.
