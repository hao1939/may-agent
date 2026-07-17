# Repair secops FIPS Ubuntu compat provider cluster-create blocked-wait activation — 2026-07-17

Task: `wait-secops-fips-ubuntu-compat-provider-cluster-create-return-172628524-20260717`
Attempt: `a_wait-secops-fips-ubuntu-compat-provider-cluster-create-return-172628524-20260717_20260717042219`
Mode: Task Worker Mode

## Result

I verified that the live app task tree does **not** yet satisfy this task's acceptance:

- the only current task with `ado-run:172628524` / `spec:spec.secops-fips.ubuntu-compat` is `wait-secops-fips-ubuntu-compat-provider-cluster-create-return-172628524-20260717`
- that task is still `state = active`
- that task currently has **no** `blocker` object
- kanban still shows it in `in-progress`, not `blocked`

Under Task Worker Mode, I did not mutate the runtime task tree directly. The truthful completion from this session is therefore an exact **planner/app-ops in-place blocked-wait activation proposal** for the existing task id, backed by the already-prepared domain evidence packet.

## Current controller-visible state

From `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json` and `/app/projects/aks-rp-e2e.app/.state/tasks/kanban.json`:

- `wait-secops-fips-ubuntu-compat-provider-cluster-create-return-172628524-20260717`
  - `state = active`
  - `goal = Create and activate the exact external/provider blocked wait for spec.secops-fips.ubuntu-compat run 172628524 ...`
  - `conflict_scope = [ado-run:172628524, feature:secops-fips-ubuntu-compat, runtime:secops-fips-ubuntu-compat-cluster-create, spec:spec.secops-fips.ubuntu-compat]`
  - no `blocker` field exists yet
- `kanban.card_ids_by_column["in-progress"]` still includes `wait-secops-fips-ubuntu-compat-provider-cluster-create-return-172628524-20260717`
- no separate blocked leaf for this exact run/spec surface is currently visible

That means the reviewed follow-up task exists, but the exact blocked-wait activation still has to be applied.

## Evidence packet already prepared and ready to attach

Domain evidence already preserves the exact blocker lineage and fallback packet:

- `../aks-rp-e2e/evidence/archive/diagnose-secops-fips-ubuntu-compat-cluster-create-http-500-run-172628524-20260717.md`
- `../aks-rp-e2e/evidence/archive/wait-secops-fips-ubuntu-compat-ado-run-172628524-result-20260717.md`
- `../aks-rp-e2e/evidence/archive/repair-secops-fips-ubuntu-compat-host-validation-daemonset-yaml-20260717.md`
- `../aks-rp-e2e/evidence/archive/record-secops-fips-ubuntu-compat-provider-cluster-create-blocker-run-172628524-20260717.md`
- `../aks-rp-e2e/evidence/archive/prepare-secops-fips-ubuntu-compat-provider-cluster-create-escalation-packet-172628524-20260717.md`

Those memos already preserve the required blocker facts:

- `runId = 172628524`
- `specId = spec.secops-fips.ubuntu-compat`
- `resourceGroup = rg-plan-001-4426-n454fb-046184`
- `clusterName = aks-plan-001-4426-n454fb-046184`
- cluster create step `op.create-k8s135-plus-fips-ubuntu-cluster`
- create failure `http=500 provisioningState=(missing); pools=[]`
- terminal summary `Get resource group MC_rg-plan-001-4426-n454fb-046184_aks-plan-001-4426-n454fb_westus2 failed`
- `nextCheckTime = 2026-07-17T18:00:00Z`
- `fallbackTime = 2026-07-18T18:00:00Z`

## Exact planner/app-ops apply proposal

Apply this as an **in-place conversion** of the existing task id `wait-secops-fips-ubuntu-compat-provider-cluster-create-return-172628524-20260717` rather than creating a duplicate sibling wait.

PLANNER_APPLY_PROPOSAL:
```json
{
  "taskId": "wait-secops-fips-ubuntu-compat-provider-cluster-create-return-172628524-20260717",
  "applyKind": "in-place-blocked-wait-activation",
  "expectedPreconditions": {
    "matchingTaskCount": 1,
    "currentState": "active",
    "currentHasBlocker": false,
    "conflictScope": [
      "ado-run:172628524",
      "feature:secops-fips-ubuntu-compat",
      "runtime:secops-fips-ubuntu-compat-cluster-create",
      "spec:spec.secops-fips.ubuntu-compat"
    ]
  },
  "targetState": {
    "state": "blocked",
    "goal": "Hold the exact external/provider blocker for spec.secops-fips.ubuntu-compat run 172628524 while awaiting provider/RP guidance on the AKS cluster-create HTTP 500 / MC resource-group Get failure, with one governed fallback window and no duplicate unchanged reruns.",
    "outputs": [
      "../aks-rp-e2e/evidence/archive/diagnose-secops-fips-ubuntu-compat-cluster-create-http-500-run-172628524-20260717.md",
      "../aks-rp-e2e/evidence/archive/wait-secops-fips-ubuntu-compat-ado-run-172628524-result-20260717.md",
      "../aks-rp-e2e/evidence/archive/repair-secops-fips-ubuntu-compat-host-validation-daemonset-yaml-20260717.md",
      "../aks-rp-e2e/evidence/archive/record-secops-fips-ubuntu-compat-provider-cluster-create-blocker-run-172628524-20260717.md",
      "../aks-rp-e2e/evidence/archive/prepare-secops-fips-ubuntu-compat-provider-cluster-create-escalation-packet-172628524-20260717.md"
    ],
    "blocker": {
      "condition": "Blocked on the reviewed live create surface for spec.secops-fips.ubuntu-compat run 172628524: resource group rg-plan-001-4426-n454fb-046184 was created successfully, but cluster step op.create-k8s135-plus-fips-ubuntu-cluster failed with http=500 provisioningState=(missing); pools=[] and terminal summary Get resource group MC_rg-plan-001-4426-n454fb-046184_aks-plan-001-4426-n454fb_westus2 failed. The earlier daemonset-YAML defect is already fixed in this lineage, so the current frontier is external/provider create-path guidance, not a new proven repo-local repair.",
      "category": "external-wait",
      "owner": "human",
      "blocked_at": "2026-07-17T04:22:18.966Z",
      "waiting_for": {
        "type": "azure.provider.guidance",
        "taskId": "wait-secops-fips-ubuntu-compat-provider-cluster-create-return-172628524-20260717"
      },
      "observed_by": {
        "workflow": "project-planner",
        "schedule": "blocked-frontier-owner-review",
        "trigger": "project.planning.requested"
      },
      "observation_method": "Scheduled blocked-frontier owner review checks the stated provider/RP wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
      "next_check_at": "2026-07-17T18:00:00Z",
      "resume_condition": "Resume only when authoritative provider/RP guidance, an exact owner reroute, or reviewed fallback evidence changes the same create-path surface enough to justify one bounded successor. Do not reopen unchanged reruns early.",
      "fallback_at": "2026-07-18T18:00:00Z",
      "fallback_action": "If no provider/RP guidance is available by fallback time, attach any returned guidance if present; otherwise allow exactly one same-slice staging rerun of spec.secops-fips.ubuntu-compat if a provider route exists, or escalate to human/operator using ../aks-rp-e2e/evidence/archive/prepare-secops-fips-ubuntu-compat-provider-cluster-create-escalation-packet-172628524-20260717.md if no provider route exists.",
      "resume_at": "2026-07-17T18:00:00Z"
    },
    "result": "Activate the existing secops FIPS Ubuntu compatibility provider cluster-create follow-up as the single blocked external/provider wait for run 172628524 with next-check 2026-07-17T18:00:00Z, fallback 2026-07-18T18:00:00Z, attached diagnosis/terminal-review/repaired-lineage memos, and prepared fallback escalation packet."
  }
}
```

## Why in-place conversion is the correct repair

1. The exact task id already exists and already owns the correct conflict scope.
2. Creating a new sibling blocked leaf would violate the acceptance requirement that the live tree contain **exactly one** blocked wait for this run/spec surface.
3. The domain blocker packet is already complete; the missing action is only the app-owned state transition from active follow-up work to blocked wait representation.
4. The fallback packet is already prepared, so no additional domain investigation is needed before the wait can be activated.

## Exact post-apply verification expected

After planner/app-ops applies the wait activation, recheck for all of these exact facts:

1. `wait-secops-fips-ubuntu-compat-provider-cluster-create-return-172628524-20260717` is present exactly once.
2. That task now has `state = blocked`.
3. That task now has a `blocker` object with:
   - `category = external-wait`
   - `next_check_at = 2026-07-17T18:00:00Z`
   - `fallback_at = 2026-07-18T18:00:00Z`
4. `kanban.card_ids_by_column["blocked"]` includes `wait-secops-fips-ubuntu-compat-provider-cluster-create-return-172628524-20260717` and `in-progress` no longer includes it.
5. The wait output/evidence set includes the diagnosis memo, terminal run review memo, repaired-lineage memo, blocker-record memo, and prepared fallback escalation packet.
6. No second blocked or active sibling wait appears for the same `ado-run:172628524` / `spec:spec.secops-fips.ubuntu-compat` tuple.

## Worker conclusion

The bounded worker task is complete as evidence/proposal work: the exact blocker lineage is already preserved, the live tree gap is identified precisely, and the planner/app-ops boundary now has an exact in-place blocked-wait activation payload to apply unchanged. No runtime event or direct task-tree mutation was emitted from this session.