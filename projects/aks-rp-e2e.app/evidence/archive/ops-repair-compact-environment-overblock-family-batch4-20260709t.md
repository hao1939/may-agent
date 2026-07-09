# Compact environment-overblock family repair — batch 4 (2026-07-09t)

- Task: `ops/repair-compact-environment-overblock-family-batch4-20260709t`
- Attempt: `a_ops_repair-compact-environment-overblock-family-batch4-20260709t_20260709122416`
- Mode: Task Worker Mode
- Runtime tree mutation from this worker: none
- Output purpose: exact planner/app-ops apply packet for one additional compact `environment-overblock` warning family

## Executive result

I reviewed the current highest-signal remaining reviewed-exception/package-partial compact warning holders and selected the **smallest truthful remaining repair candidate** still open in the live tree:

- target holder: `hold-compact-extension-addon-reviewed-exception-frontier`
- exact downstream carrier already present: `wait-spec-extension-addon-execution-identity-permission-response-20260702`
- affected feature/spec subset: `feature:extension-addon`, specifically `spec.extension-addon.enable-upgrade-disable`

This family does **not** need a new rerun, a new broad environment/setup wait, or a new mixed-frontier decomposition. The smallest truthful repair is to **rewrite the existing compact holder into an explicit represented split-frontier carrier** for the already-existing exact human-owned wait.

Under this session's worker-mode constraints, I did **not** mutate the live task tree because the assigned task did not explicitly authorize bounded `task-tree update-text` application against named task ids. This note provides the exact reviewed apply packet for planner/app-ops.

## Sources reviewed

- Live planner packet:
  - `cd /app/projects/aks-rp-e2e.app && bun run task-tree packet`
- Live holder:
  - `cd /app/projects/aks-rp-e2e.app && bun run task-tree show hold-compact-extension-addon-reviewed-exception-frontier`
- Existing exact wait:
  - `cd /app/projects/aks-rp-e2e.app && bun run task-tree show wait-spec-extension-addon-execution-identity-permission-response-20260702`
- Warning heuristic:
  - `/app/projects/aks-rp-e2e.app/workflows/lib/task-tree-tools.ts`
- Current compact summary:
  - `/app/projects/aks-rp-e2e/features/extension-addon/compact/staging.summary.md`
- Prior exact-frontier note:
  - `/app/projects/aks-rp-e2e.app/evidence/archive/rehome-compact-extension-addon-exact-package-frontier-20260707.md`

## Live baseline contributor set before this worker review

Using the live packet as if this worker task did not exist, the current compact `environment-overblock` warning set still includes at least these reviewed-exception/package-partial leaves:

- `hold-compact-aad-rbac-package-partial-frontier`
- `hold-compact-app-routing-package-partial-frontier-202607090657`
- `hold-compact-ccp-vpa-os-arch-variants-reviewed-exception-frontier`
- `hold-compact-defender-profile-reviewed-exception-frontier`
- `hold-compact-egress-lockdown-package-partial-frontier`
- `hold-compact-extension-addon-reviewed-exception-frontier`
- `hold-compact-gpu-package-partial-frontier`
- `hold-compact-hcp-interceptor-reviewed-exception-frontier`
- `hold-compact-net-integration-package-partial-frontier`
- `hold-compact-node-http-proxy-package-partial-frontier`
- `hold-compact-paf-throttling-reviewed-exception-frontier`
- `hold-compact-private-cluster-package-partial-frontier-202607090641-ownerfix`
- `hold-compact-rp-cluster-lifecycle-package-partial-frontier`
- `hold-compact-rp-nodepool-lifecycle-package-partial-frontier`
- `hold-compact-secops-package-partial-frontier`
- `hold-compact-serverless-package-partial-frontier`
- `hold-compact-storage-csi-package-partial-frontier`
- `hold-compact-traffic-alb-controller-package-partial-frontier`
- `hold-compact-upgrade-reviewed-exception-frontier`
- `hold-compact-virtualmachine-prerelease-row60-legacy-addon-disable-scaling-reviewed-exception-frontier`

Current packet sample count from this slice:

- `environment_overblock_count = 22`

For this batch, I selected `extension-addon` because it already has one exact live shared carrier and one compact duplicate holder that can be made truthful by bounded metadata repair alone.

## Why extension-addon is the smallest truthful repair candidate

### 1) The live planner packet still warns on the compact holder

Fresh packet output still includes:

- `kind: environment-overblock`
- `taskId: hold-compact-extension-addon-reviewed-exception-frontier`

So this holder still contributes warning noise today.

### 2) The compact summary already narrows the surviving frontier to one exact spec and one exact wait shape

`features/extension-addon/compact/staging.summary.md` currently says:

- package status: `blocked`
- only quarantined member: `spec.extension-addon.enable-upgrade-disable`
- exact blocker kind: `repo-local-spec-metadata-eligibility-gap`
- authoritative runtime truth is the reviewed PUT permission failure on the same managedClusters/.../extensionaddons/fake path
- no truthful unchanged compact rerun exists until authoritative same-run artifacts/logs are recovered or reviewed metadata/eligibility changes the carrier boundary

So the real open frontier is **not** a broad feature-level environment family. It is one exact spec/path permission-response frontier.

### 3) The compact holder already names the exact downstream wait

Current blocker text on `hold-compact-extension-addon-reviewed-exception-frontier` already says:

- preserve the single exact surviving wait `wait-spec-extension-addon-execution-identity-permission-response-20260702`
- do not rerun unchanged until same-run artifacts/logs are recovered or reviewed metadata/eligibility changes the carrier boundary
- the single active surviving holder is the execution-identity permission-response wait for `spec.extension-addon.enable-upgrade-disable`

That means the holder already knows its truthful downstream carrier. It is just not yet expressed in warning-suppressing represented-frontier form.

### 4) The exact wait already exists live and is still the truthful carrier

`wait-spec-extension-addon-execution-identity-permission-response-20260702` is already live as:

- `state: blocked`
- `blocker.category: external-wait`
- `blocker.owner: human`
- one exact wait for the same extension-addon permission-response surface
- durable send proof already recorded in `evidence/archive/send-extension-addon-execution-identity-permission-ask-20260702.md`
- resume only on returned permission proof or an exact reviewed response that changes the same-path rerun/closure decision

The prior exact-frontier note `rehome-compact-extension-addon-exact-package-frontier-20260707.md` also confirms that this is already the single truthful surviving active holder.

### 5) The current warning heuristic would stop flagging this holder after a represented-frontier rewrite

`workflows/lib/task-tree-tools.ts` suppresses `environment-overblock` when a blocked task is either:

- a human-owned `external-wait`; or
- a represented blocked frontier with signals like:
  - `split-frontier`
  - `represented by`
  - `exact represented blocker`
  - `exact represented carrier`

The current extension-addon compact holder is still `blocker.owner = operator` and does not yet use the represented-frontier wording pattern, so it still warns.

A bounded metadata rewrite matching the earlier SGX / JWT / CCP-agent repair pattern should remove the misleading warning without changing the underlying wait truth.

## Truthful repair for this family

### Selected family

- compact holder to rewrite: `hold-compact-extension-addon-reviewed-exception-frontier`
- exact represented wait to preserve: `wait-spec-extension-addon-execution-identity-permission-response-20260702`
- exact affected subset: `spec.extension-addon.enable-upgrade-disable`

### Repair type

Rewrite the holder into an explicit **represented split-frontier carrier**.

This is preferable to:

- creating a new compact-only wait task,
- reopening unchanged compact reruns,
- or creating a generic environment/setup task.

### Why no rerun should reopen

The compact summary and current holder agree that:

- all active feature-owned specs are already selected into the compact package;
- only `spec.extension-addon.enable-upgrade-disable` remains quarantined;
- local generated check passes do not change the live boundary; and
- the missing truth is still the same-path extension-addon execution-identity permission response or reviewed metadata/eligibility change.

So another unchanged extension-addon compact rerun would only reproduce the same frontier or the same missing authoritative artifact problem.

## Exact planner/app-ops apply packet

Because this worker session is review/proposal output only, planner/app-ops should apply the bounded repair with `task-tree update-text`.

### Recommended command

```bash
cd /app/projects/aks-rp-e2e.app && \
  bun run task-tree update-text hold-compact-extension-addon-reviewed-exception-frontier \
    --goal "Hold compact feature extension-addon only as a represented split-frontier carrier while the exact represented blocker remains wait-spec-extension-addon-execution-identity-permission-response-20260702 for spec.extension-addon.enable-upgrade-disable." \
    --acceptance "This compact holder remains blocked only while wait-spec-extension-addon-execution-identity-permission-response-20260702 still controls the same spec.extension-addon.enable-upgrade-disable / managedClusters/.../extensionaddons/fake permission-response frontier." \
    --acceptance "Do not create duplicate environment setup, diagnosis, or unchanged compact rerun work from this holder; the exact represented carrier is the human-owned extension-addon execution-identity permission-response wait." \
    --acceptance "Resume compact work only after that represented frontier materially changes through returned permission proof, a reviewed response that changes the same-path rerun/closure decision, or reviewed metadata/eligibility changes that replace the carrier boundary." \
    --blocker-owner human \
    --blocker-category external-wait \
    --resume-condition "Resume only after wait-spec-extension-addon-execution-identity-permission-response-20260702 materially changes through returned permission proof, a reviewed response that changes the same-path rerun/closure decision, or reviewed metadata/eligibility changes that replace the carrier boundary for spec.extension-addon.enable-upgrade-disable." \
    --blocker "Represented by wait-spec-extension-addon-execution-identity-permission-response-20260702. This compact leaf is a split-frontier carrier for feature-local state only: compact package staging remains blocked only because spec.extension-addon.enable-upgrade-disable still depends on the exact execution-identity permission-response surface already tracked by that shared human-owned wait. Same-path successor run 28717849459 remains metadata-only and does not create a truthful new compact rerun surface. No duplicate environment setup task or unchanged compact rerun is truthful while the represented frontier remains the same. Resume only after the exact represented blocker materially changes through returned permission proof, a reviewed response that changes the same-path rerun/closure decision, or reviewed metadata/eligibility changes that replace the carrier boundary." 
```

## Why this specific rewrite is safe

It does **not**:

- create or remove any task ids;
- change the exact spec/path boundary;
- reopen any compact/domain active tasks;
- alter the underlying wait contract; or
- pretend that a different environment/setup owner exists.

It only makes the existing compact holder tell the truth more precisely:

- exact represented carrier named,
- exact affected spec named,
- duplicate rerun/setup work forbidden,
- owner aligned with the human-owned exact wait,
- represented-frontier wording aligned with current warning suppression logic.

## Expected post-apply represented set

If planner/app-ops applies the above update-text repair, the truthful represented set for this family becomes:

- `wait-spec-extension-addon-execution-identity-permission-response-20260702`
- `hold-compact-extension-addon-reviewed-exception-frontier` as represented split-frontier carrier only

Operationally, the family then stops presenting as a passive generic environment blocker and instead points directly at its exact same-path permission-response wait.

## Why I did not choose the other sampled holders for this batch's smallest repair

### defender-profile

`hold-compact-defender-profile-reviewed-exception-frontier` is likely warning noise too, but its current truth is owner promotion / compact-eligibility reclassification rooted in accepted note evidence, not one live exact wait id already carrying the same boundary. That makes it a larger contract rewrite than extension-addon.

### upgrade

`hold-compact-upgrade-reviewed-exception-frontier` still references exact wait `wait-compact-upgrade-underlay-control-plane-prereqs-20260703`, but that task id is currently missing from the live tree. So upgrade is not a safe represented-wait rewrite until planner first restores or intentionally replaces that missing exact carrier.

### hcp-interceptor

`hold-compact-hcp-interceptor-reviewed-exception-frontier` is still a real environment/capability boundary around truthful HCP gRPC client/wiring execution surface availability in project staging, not a duplicate passive holder already represented by an existing exact wait.

### ccp-vpa-os-arch-variants

`hold-compact-ccp-vpa-os-arch-variants-reviewed-exception-frontier` is still a real pipeline + ARM64/K8s>=1.34 capacity boundary without one sharper already-live exact wait id to bind to from this session.

## Bottom line

The smallest truthful remaining batch-4 repair candidate is extension-addon:

- keep the exact live wait `wait-spec-extension-addon-execution-identity-permission-response-20260702`;
- rewrite `hold-compact-extension-addon-reviewed-exception-frontier` into a represented split-frontier carrier for that wait;
- do not reopen unchanged reruns;
- do not create a new broad environment blocker.

This session leaves the reviewed apply packet for planner/app-ops because worker mode here did not explicitly authorize the bounded live `task-tree update-text` mutation.
