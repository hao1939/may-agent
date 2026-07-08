# Metric alert triage — aks-rp-e2e.process.blocked.missing-waiting-for-count

- Alert id: `2915`
- Metric id: `aks-rp-e2e.process.blocked.missing-waiting-for-count`
- Judged at: `2026-07-07T07:46:40Z`
- Chosen operation: `fix_root_cause`

## Judgment

This breach was real in the controller-authoritative runtime task tree, and the safe owner repair path existed. A direct runtime audit first found one blocked leaf in `.state/tasks/tree.json` missing `blocker.waiting_for`. Running the supported blocked-contract repair command added the missing wait-target contract, and a fresh runtime audit plus metric recomputation returned the count to `0`.

## Evidence checked

### 1) Open alert and breaching snapshot

Runtime DB still showed the open alert row:

```json
{
  "id": 2915,
  "metric_id": "aks-rp-e2e.process.blocked.missing-waiting-for-count",
  "resolved_at": null,
  "created_at": 1783410277707
}
```

Latest snapshots before repair included:

```json
[
  { "value": 1, "measured_at": 1783410228840 },
  { "value": 0, "measured_at": 1783409915505 },
  { "value": 0, "measured_at": 1783409605666 }
]
```

### 2) Direct runtime-tree audit found the current offender

```json
{
  "count": 1,
  "bad": [
    {
      "id": "hold-spec-rp-cluster-lifecycle-new-vnet-runner-variant-pipeline-only-frontier-20260707",
      "blocker": {
        "condition": "Blocked on the reviewed pipeline-only nonlive frontier for spec.rp-cluster-lifecycle.new-vnet-runner-variant: accepted 2026-07-02 evidence keeps Scenario_New_VNET_Runner as runner-harness lineage only, with execute mode intentionally blocked and no distinct standalone live product assertion remaining. Resume only when mounted/source review proves distinct row-local assertions beyond harness lineage or the owner intentionally reroutes this carrier out of standalone nonlive admission.",
        "category": "external-wait",
        "owner": "human",
        "resume_condition": "Resume only when mounted/source review proves distinct row-local assertions beyond harness lineage or the owner intentionally reroutes this carrier out of standalone nonlive admission."
      }
    }
  ]
}
```

### 3) Supported repair command fixed the first missing contract

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts
```

Observed result:

```json
{
  "dryRun": false,
  "repairedCount": 1,
  "repaired": [
    "hold-spec-rp-cluster-lifecycle-new-vnet-runner-variant-pipeline-only-frontier-20260707"
  ]
}
```

### 4) A second direct audit exposed another newly-created blocked leaf missing `waiting_for`

```json
{
  "count": 1,
  "bad": [
    {
      "id": "hold-spec-network-acns-performance-cilium-upgrade-run-28849780940-result-frontier-20260707",
      "blocker": {
        "condition": "Waiting for repaired rerun 28849780940 to reach terminal state so the same-path result/artifact surface can be reviewed after the published LocalDNS-compatible size fix.",
        "category": "external-wait",
        "owner": "human",
        "resume_condition": "Resume when GitHub workflow run 28849780940 reaches terminal state and the returned same-path result/artifact surface can be classified."
      }
    }
  ]
}
```

### 5) Supported repair command fixed the second missing contract

Observed result:

```json
{
  "dryRun": false,
  "repairedCount": 1,
  "repaired": [
    "hold-spec-network-acns-performance-cilium-upgrade-run-28849780940-result-frontier-20260707"
  ]
}
```

Readback from `.state/tasks/tree.json` then showed structured wait metadata on that task:

```json
{
  "waiting_for": {
    "type": "github.workflow_run.completed",
    "runId": "28849780940",
    "taskId": "hold-spec-network-acns-performance-cilium-upgrade-run-28849780940-result-frontier-20260707"
  },
  "observed_by": {
    "workflow": "project-planner",
    "schedule": "blocked-frontier-owner-review",
    "trigger": "project.planning.requested"
  },
  "next_check_at": "2026-07-07T07:55:48.789Z",
  "fallback_at": "2026-07-08T07:45:48.789Z"
}
```

### 6) Final runtime audit and metric recomputation both recovered

Final direct audit:

```json
{
  "count": 0,
  "bad": []
}
```

Final metric sample:

```json
{ "measuredAt": 1783410389860, "value": 0 }
```

## Next validation signal

Next `metrics-snapshot` / alert refresh should observe `aks-rp-e2e.process.blocked.missing-waiting-for-count = 0` and auto-recover alert `2915`.
