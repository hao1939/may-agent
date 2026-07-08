# Metric alert triage — `aks-rp-e2e.process.blocked.missing-waiting-for-count`

- Alert id: `3083`
- Metric id: `aks-rp-e2e.process.blocked.missing-waiting-for-count`
- Judged at: `2026-07-08T08:18:00Z`
- Chosen operation: `fix_root_cause`
- Metric owner: `app-ops`

## Judgment

This breach was real at triage time. The latest metric sample reported one blocked leaf missing `blocker.waiting_for`, naming:

- `wait-spec-app-routing-rollback-istio-to-nginx-existing-target-return-20260708`

The task existed in the runtime tree as a new blocked holder created by planner repair, but its `blocker` contract omitted `waiting_for` and observer metadata. The supported repair path `bun run ./scripts/task-tree.ts repair-blocked-contracts` safely backfilled the missing blocked-contract fields for that task (and one other unrelated blocked holder already eligible for the same repair path).

After the repair, the runtime task now carries structured `waiting_for`, `observed_by`, `observation_method`, and `blocked_at`. A fresh live metric recompute returned `value=0` with an empty offender list.

Because the alert corresponded to a real, safely repairable task-tree contract gap, the correct final operation is `fix_root_cause`.

## Evidence checked

### 1) Live metric still breached before repair

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-waiting-for-count --json
```

Observed result before repair:

```json
{
  "measuredAt": 1783498533339,
  "value": 1,
  "sampleSize": 1,
  "note": "{\"offenderTaskIds\":[\"wait-spec-app-routing-rollback-istio-to-nginx-existing-target-return-20260708\"]}"
}
```

### 2) Runtime task was missing `waiting_for` before repair

`projects/aks-rp-e2e.app/.state/tasks/tree.json` initially showed this blocked task with a `blocker` containing `condition`, `category`, `owner`, `resume_condition`, `next_check_at`, `fallback_at`, and `fallback_action`, but no `waiting_for` field.

### 3) Supported repair command backfilled the blocked contract

Dry run:

```json
{
  "dryRun": true,
  "repairedCount": 2,
  "repaired": [
    "hold-dev-infra-core-slice03-kms-publickv-invalid-sku-frontier-20260707",
    "wait-spec-app-routing-rollback-istio-to-nginx-existing-target-return-20260708"
  ]
}
```

Applied run:

```json
{
  "dryRun": false,
  "repairedCount": 2,
  "repaired": [
    "hold-dev-infra-core-slice03-kms-publickv-invalid-sku-frontier-20260707",
    "wait-spec-app-routing-rollback-istio-to-nginx-existing-target-return-20260708"
  ]
}
```

### 4) Runtime task now has the repaired contract

Post-repair blocker excerpt:

```json
{
  "condition": "Blocked on the exact existing-cluster target response for spec.app-routing.rollback-istio-to-nginx: the owner ask was already sent and accepted in evidence/archive/request-existing-target-spec-app-routing-rollback-istio-to-nginx-20260627.md, but no returned Istio-enabled App Routing cluster identifiers or authoritative decline/redirect are yet recorded on the current branch.",
  "category": "external-wait",
  "owner": "human",
  "resume_condition": "Resume only when the already-sent existing-cluster target ask returns with exact cluster identifiers, an explicit decline/redirect, or a reviewed replacement carrier that truthfully supports the rollback path.",
  "next_check_at": "2026-07-08T20:00:00Z",
  "fallback_at": "2026-07-09T20:00:00Z",
  "fallback_action": "If no reply exists at fallback, refresh the owner-response status from the accepted send-proof and either renew the ask/escalation or keep this single family wait with fresh evidence.",
  "blocked_at": "2026-07-08T08:08:18.364Z",
  "waiting_for": {
    "type": "environment.available",
    "taskId": "wait-spec-app-routing-rollback-istio-to-nginx-existing-target-return-20260708"
  },
  "observed_by": {
    "workflow": "project-planner",
    "schedule": "blocked-frontier-app-ops-review",
    "trigger": "project.planning.requested"
  },
  "observation_method": "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence."
}
```

### 5) Live metric cleared after repair

Observed result after repair:

```json
{
  "measuredAt": 1783498731654,
  "value": 0,
  "sampleSize": 0,
  "note": "{\"offenderTaskIds\":[]}"
}
```

## Conclusion

Choose `fix_root_cause`: the alert was caused by a real blocked task missing structured wait metadata, the supported repair command fixed that runtime task contract, and the live metric immediately recovered to `0`.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-waiting-for-count`.
