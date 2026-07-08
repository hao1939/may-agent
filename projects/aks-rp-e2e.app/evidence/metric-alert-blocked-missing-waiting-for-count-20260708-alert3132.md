# Metric alert triage — `aks-rp-e2e.process.blocked.missing-waiting-for-count`

- Alert id: `3132`
- Metric id: `aks-rp-e2e.process.blocked.missing-waiting-for-count`
- Judged at: `2026-07-08T11:53:39Z`
- Chosen operation: `fix_root_cause`
- Metric owner: `app-ops`

## Judgment

This breach was real at triage time. The metric sampler returned `value=1` and named exactly one current offender:

- `hold-spec-loop-serverless-schedulerctrl-missing-underlay-kubeconfig-frontier-20260708`

That blocked holder had been created in the runtime task tree by planner work, but its `blocker` object lacked the machine-readable `waiting_for` contract required by the metric. The supported owner repair path `bun run ./scripts/task-tree.ts repair-blocked-contracts` safely backfilled the missing blocked-contract fields on that runtime task.

After the repair, the runtime task now carries structured `waiting_for`, `observed_by`, and `observation_method`, a direct runtime audit found zero blocked leaves missing `waiting_for`, and a fresh metric recompute returned `value=0` with no offender ids.

Because the alert corresponded to a real, safely repairable blocked-task contract gap and the owner applied the supported repair directly, the correct final operation is `fix_root_cause`.

## Evidence checked

### 1) Live metric breached before repair

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-waiting-for-count --json --verbose
```

Observed result before repair:

```json
{"measuredAt":1783511534762,"value":1,"sampleSize":1,"note":"{\"offenderTaskIds\":[\"hold-spec-loop-serverless-schedulerctrl-missing-underlay-kubeconfig-frontier-20260708\"]}"}
```

### 2) Supported repair path identified the offender

Dry run:

```json
{
  "dryRun": true,
  "repairedCount": 2,
  "repaired": [
    "hold-dev-infra-core-slice03-kms-publickv-invalid-sku-frontier-20260707",
    "hold-spec-loop-serverless-schedulerctrl-missing-underlay-kubeconfig-frontier-20260708"
  ]
}
```

### 3) Supported repair path was applied

Applied run:

```json
{
  "dryRun": false,
  "repairedCount": 2,
  "repaired": [
    "hold-dev-infra-core-slice03-kms-publickv-invalid-sku-frontier-20260707",
    "hold-spec-loop-serverless-schedulerctrl-missing-underlay-kubeconfig-frontier-20260708"
  ]
}
```

### 4) Repaired runtime task now has structured `waiting_for`

Post-repair runtime task excerpt from `.state/tasks/tree.json`:

```json
{
  "id": "hold-spec-loop-serverless-schedulerctrl-missing-underlay-kubeconfig-frontier-20260708",
  "state": "blocked",
  "blocker": {
    "condition": "Exact run 28656258055 still shows all four serverless-schedulerctrl lifecycle specs blocked before mutation by the same missing underlay kubeconfig prerequisite; no bounded repo-local repair or truthful unchanged rerun exists until that prerequisite is supplied or replaced.",
    "category": "external-wait",
    "owner": "human",
    "resume_condition": "Resume when the underlay kubeconfig prerequisite for the same serverless-schedulerctrl lifecycle path is supplied, restored, or replaced with a reviewed equivalent access path.",
    "resume_at": "2026-07-08T18:00:00Z",
    "next_check_at": "2026-07-08T18:00:00Z",
    "fallback_at": "2026-07-09T18:00:00Z",
    "fallback_action": "If the prerequisite is still absent at fallback, escalate the shared underlay-kubeconfig dependency as one family-level wait rather than reopening the broad pending-family leaf.",
    "blocked_at": "2026-07-08T11:46:50.790Z",
    "waiting_for": {
      "type": "environment.available",
      "taskId": "hold-spec-loop-serverless-schedulerctrl-missing-underlay-kubeconfig-frontier-20260708",
      "sourceRunId": "28656258055"
    },
    "observed_by": {
      "workflow": "project-planner",
      "schedule": "blocked-frontier-app-ops-review",
      "trigger": "project.planning.requested"
    },
    "observation_method": "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence."
  },
  "trace": {
    "blocked_contract_repaired_at": "2026-07-08T11:52:34.539Z"
  }
}
```

### 5) Direct runtime audit is now clean

Post-repair audit:

```json
{
  "missingCount": 0,
  "bad": []
}
```

### 6) Live metric cleared after repair

Observed result after repair:

```json
{"measuredAt":1783511619409,"value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

## Conclusion

Choose `fix_root_cause`: the alert corresponded to a real blocked leaf missing `blocker.waiting_for`, the supported owner repair command repaired that runtime task safely, the direct runtime audit is now clean, and a fresh live metric recompute returned `0`.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-waiting-for-count`.