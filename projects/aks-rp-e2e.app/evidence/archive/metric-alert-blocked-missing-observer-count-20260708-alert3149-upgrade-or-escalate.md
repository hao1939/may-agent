# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` — alert `3149`

- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Alert id: `3149`
- Chosen operation: `upgrade_or_escalate`
- Time: `2026-07-08T02:41:10Z` session

## Judgment

This alert started as a real blocked-contract defect, and I applied the supported owner repair path. That repair cleared the two original offender waits named by the alert (`wait-spec-cluster-autoscaler-mincount-recovery-rerun-171364167-return-20260708` and `wait-spec-secops-fips-slice2-ado171368541-return-20260708`) by backfilling `blocker.waiting_for`, `blocker.owner=ado`, `blocker.observed_by`, and `blocker.observation_method`.

But after that safe repair, the system entered a contradiction I cannot safely resolve in this workflow:

- direct reads of `.state/tasks/tree.json` show the remaining offender `wait-spec-storage-csi-blob-verify-nfs-rerun-171368715-return-20260708` now has `observed_by`, `observation_method`, and `next_check_at`
- a direct blocked-task audit of `.state/tasks/tree.json` finds `0` blocked tasks missing observer metadata
- yet a fresh metric sample still returns `value=1` and still names that same task id as the offender
- and `repair-blocked-contracts --dry-run` still claims it would "repair" that same task again even after the fields are present

That means the alert is no longer a simple tree-data defect. It is now a tooling/runtime contradiction between the supported repair path, the direct runtime tree, and the metric sampler. Because I cannot prove which implementation is authoritative from this triage surface, and because changing the metric or runtime DB directly would be unsafe, the correct final operation is `upgrade_or_escalate`.

## Concrete evidence

### 1. Live metric still breached at triage start

`bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-observer-count --json`

```json
{"measuredAt":1783516236445,"value":2,"sampleSize":2,"note":"{\"offenderTaskIds\":[\"wait-spec-cluster-autoscaler-mincount-recovery-rerun-171364167-return-20260708\",\"wait-spec-secops-fips-slice2-ado171368541-return-20260708\"]}"}
```

### 2. Supported repair path found and repaired the original offender waits

`bun run ./scripts/task-tree.ts repair-blocked-contracts`

```json
{
  "dryRun": false,
  "repairedCount": 3,
  "repaired": [
    "hold-dev-infra-core-slice03-kms-publickv-invalid-sku-frontier-20260707",
    "wait-spec-cluster-autoscaler-mincount-recovery-rerun-171364167-return-20260708",
    "wait-spec-secops-fips-slice2-ado171368541-return-20260708"
  ]
}
```

### 3. The two original alert offenders now show full observer metadata in the runtime tree

`bun run ./scripts/task-tree.ts show wait-spec-cluster-autoscaler-mincount-recovery-rerun-171364167-return-20260708`

Key fields after repair:

```json
{
  "owner": "ado",
  "waiting_for": {"runId": "171364167"},
  "observed_by": {
    "workflow": "project-planner",
    "schedule": "blocked-frontier-app-ops-review",
    "trigger": "project.planning.requested"
  },
  "observation_method": "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
  "next_check_at": "2026-07-08T14:00:00Z"
}
```

`bun run ./scripts/task-tree.ts show wait-spec-secops-fips-slice2-ado171368541-return-20260708`

Key fields after repair:

```json
{
  "owner": "ado",
  "waiting_for": {"runId": "171368541"},
  "observed_by": {
    "workflow": "project-planner",
    "schedule": "blocked-frontier-app-ops-review",
    "trigger": "project.planning.requested"
  },
  "observation_method": "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
  "next_check_at": "2026-07-08T14:30:00Z"
}
```

### 4. Fresh metric sample moved, but still named one remaining offender

`bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-observer-count --json`

```json
{"measuredAt":1783516446342,"value":1,"sampleSize":1,"note":"{\"offenderTaskIds\":[\"wait-spec-storage-csi-blob-verify-nfs-rerun-171368715-return-20260708\"]}"}
```

### 5. That remaining offender was also missing observer metadata before repair

`bun run ./scripts/task-tree.ts show wait-spec-storage-csi-blob-verify-nfs-rerun-171368715-return-20260708`

Before repair, its blocker had only:

```json
{
  "condition": "Blocked only on Azure DevOps standalone rerun 171368715 returning terminal same-path evidence for spec.storage-csi.blob-verify-nfs; the rerun is already queued and no further repo-local action is truthful until returned artifacts exist.",
  "category": "external-wait",
  "resume_condition": "Resume when run 171368715 is terminal and its exact returned artifacts/result are available for owner review.",
  "next_check_at": "2026-07-08T14:30:00Z",
  "fallback_at": "2026-07-08T18:00:00Z",
  "fallback_action": "If run 171368715 still is not terminal or artifacts are missing, create/route an exact follow-up to recover run status or artifact access rather than rerunning unchanged."
}
```

### 6. Supported repair path added the missing observer contract to that task too

After `bun run ./scripts/task-tree.ts repair-blocked-contracts`, `task-tree show` now reports:

```json
{
  "owner": "ado",
  "waiting_for": {"runId": "171368715"},
  "observed_by": {
    "workflow": "project-planner",
    "schedule": "blocked-frontier-app-ops-review",
    "trigger": "project.planning.requested"
  },
  "observation_method": "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
  "next_check_at": "2026-07-08T14:30:00Z"
}
```

### 7. Direct runtime-tree audit now finds zero blocked tasks missing observer metadata

Direct `.state/tasks/tree.json` audit result:

```json
{
  "count": 0,
  "missing": []
}
```

### 8. Contradiction: metric sampler and dry-run repair still report the same task as missing observer metadata

Fresh metric sample after repair still says:

```json
{"measuredAt":1783516462376,"value":1,"sampleSize":1,"note":"{\"offenderTaskIds\":[\"wait-spec-storage-csi-blob-verify-nfs-rerun-171368715-return-20260708\"]}"}
```

And `bun run ./scripts/task-tree.ts repair-blocked-contracts --dry-run` still reports:

```json
{
  "dryRun": true,
  "repairedCount": 2,
  "repaired": [
    "hold-dev-infra-core-slice03-kms-publickv-invalid-sku-frontier-20260707",
    "wait-spec-storage-csi-blob-verify-nfs-rerun-171368715-return-20260708"
  ]
}
```

## Escalation request

Human/project-owner decision needed:

1. Treat this as a tooling bug in blocked-contract detection / metric sampling and assign a bounded fix in app code, or
2. Provide an approved runtime write/workflow that can safely recompute and reconcile persisted metric state after validating which reader is authoritative.

Do **not** resolve this by editing the runtime DB ad hoc. The safe owner repair path for tree data has already been used; what remains is a contradiction between the repair logic and the measurement logic.

## Next validation

- Next `metrics-snapshot` for `aks-rp-e2e.process.blocked.missing-observer-count`
- Or a code-level fix that makes `repair-blocked-contracts --dry-run`, direct runtime-tree audit, and `project-metrics.ts` agree on the same offender set
