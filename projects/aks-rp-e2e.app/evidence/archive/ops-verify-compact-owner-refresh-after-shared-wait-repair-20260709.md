# ops-verify-compact-owner-refresh-after-shared-wait-repair-20260709

Date: 2026-07-09
Task: `ops-verify-compact-owner-refresh-after-shared-wait-repair-20260709`

## Scope

Verify one bounded feature-compact controller refresh after the shared-wait regeneration repair and check whether the surviving exact compact holders for:

- `hold-compact-app-routing-package-partial-frontier-202607090657`
- `hold-compact-cluster-autoscaler-package-partial-frontier-202607090657`

retain a non-empty `task.owner` or are truthfully replaced by an existing shared/spec wait.

## Bounded refresh executed

Ran one direct bounded controller pulse against the live app/runtime task tree:

```sh
cd /app/projects/aks-rp-e2e.app && bun -e '
import { execute } from "./workflows/feature-compact-loop-controller.ts";
const event = { type: "project.task.tick", action: "feature-compact-loop", project: "aks-rp-e2e", taskId: "aks-feature-compact-loop", target: { taskId: "aks-feature-compact-loop" } };
const task = [
  "app: /app/projects/aks-rp-e2e.app",
  "project: /app/projects/aks-rp-e2e",
  "agent: aks-explorer",
  "maxConcurrent: 1",
  "## Trigger Event",
  "```json",
  JSON.stringify(event),
  "```",
].join("\n");
const result = await execute({
  task,
  agent: "aks-explorer",
  done: (message) => ({ status: "done", message }),
  escalate: (message) => ({ status: "escalated", message }),
  emit() {},
  dispatchEvent() {},
  runAgent: async () => ({ status: "success" }),
  summarize: () => "",
});
console.log(JSON.stringify(result, null, 2));
'
```

Controller result:

```json
{
  "status": "done",
  "message": "Feature compact loop aks-feature-compact-loop pulse complete. Created 0 child task(s). Assigned 0 child task(s). Repaired 0 task projection field(s) and 22 compact state projection field(s). Active Azure DevOps pipeline runs: 0/5. Recorded 117 compact branch pass(es) in the spec loop. Tracked features: 84."
}
```

## Post-refresh holder verification

### 1) `hold-compact-app-routing-package-partial-frontier-202607090657`

Post-pulse task inspection still shows a surviving exact holder with **blank `task.owner`**:

- `task.owner = ""`
- `state = blocked`
- `blocker.owner = "product-owner"`
- `blocker.waiting_for.type = "owner.decision"`

Relevant runtime facts:

- task id remained `hold-compact-app-routing-package-partial-frontier-202607090657`
- compact state still points `features["app-routing"].taskId` at this same holder
- compact state still carries exact cross-loop frontier links:
  - `hold-spec-app-routing-default-domain-istio-hello-world-on-tls-product-gap-20260705`
  - `wait-spec-app-routing-default-domain-tls-secret-product-gap-return-20260705`
  - `wait-spec-app-routing-rollback-istio-to-nginx-existing-target-return-20260708`

This holder was **not** replaced by a truthful shared/spec wait during this bounded refresh.

### 2) `hold-compact-cluster-autoscaler-package-partial-frontier-202607090657`

Post-pulse task inspection still shows a surviving exact holder with **blank `task.owner`**:

- `task.owner = ""`
- `state = blocked`
- `blocker.owner = "aks-explorer"`
- `blocker.waiting_for.type = "pipeline.result.or.artifact.available"`

Relevant runtime facts:

- task id remained `hold-compact-cluster-autoscaler-package-partial-frontier-202607090657`
- compact state still points `features["cluster-autoscaler"].taskId` at this same holder
- compact state still carries exact cross-loop frontier links:
  - `hold-spec-cluster-autoscaler-provisioning-request-http400-environment-frontier-20260709`
  - `hold-spec-cluster-autoscaler-vm-prerelease-long-unregistered-alias-row53-frontier-20260709b`
  - `hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708`
  - `hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708`
  - `wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708`
  - `wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708`

This holder was **not** replaced by a truthful shared/spec wait during this bounded refresh.

## Conclusion

The repaired shared-wait regeneration logic did stop duplicate shared-wait recreation for the previously repaired family, but it did **not** clear the pre-repair blank-owner residue on these two surviving exact compact holders.

Result for this verification task:

- `app-routing`: surviving exact holder still present, `task.owner` still blank
- `cluster-autoscaler`: surviving exact holder still present, `task.owner` still blank
- neither holder was replaced by an existing shared/spec wait during this pulse

So the remaining issue is a **known owner-backfill gap**, not unexplained drift.

## Exact runtime/code blocker

### Blocker statement

Existing `featureCompactExactWait` holders can survive later controller pulses with a blank `task.owner` because the current refresh/projection paths do not backfill or repair `task.owner` on already-existing blocked holders.

### Affected live task ids

- `hold-compact-app-routing-package-partial-frontier-202607090657`
- `hold-compact-cluster-autoscaler-package-partial-frontier-202607090657`

### File-level evidence

#### 1) New exact holders get an owner only at creation time

`workflows/feature-compact-loop-controller.ts` shows the exact-wait creation path computing an owner and passing it into `createTask(...)`:

- `compactWaitOwner(reason)` at `workflows/feature-compact-loop-controller.ts:1936`
- `const owner = compactWaitOwner(reason);` at `workflows/feature-compact-loop-controller.ts:2081`
- `createTask(config, { ... owner, ... })` at `workflows/feature-compact-loop-controller.ts:2099-2158`

This proves new holders can be created with an owner.

#### 2) Existing-holder refresh updates blocker/state metadata, but not `task.owner`

In the same exact-wait materialization path, the post-create mutation block rewrites:

- `task.state`
- `task.status`
- `task.blocker`
- `task.trace`
- compact state via `updateFeatureCompactItem(...)`

but does **not** assign `task.owner` for an already-existing surviving task.

That is the direct code path consistent with the observed runtime residue: the holder survives with:

- blank `task.owner`
- non-blank `blocker.owner`

#### 3) Runtime projection repair does not model `task.owner` repair

`workflows/lib/feature-compact-runtime-projection.ts` defines task repairs only for:

- `blocker.waiting_for`
- `task.projection`
- `task.replacement`

and state repairs only for:

- `waitingFor`
- `taskId`
- `frontierTaskIds`

There is no repair shape for `task.owner`, which matches the pulse result:

- `Repaired 0 task projection field(s)`
- `Repaired 22 compact state projection field(s)`

So current refresh logic can repair projection/state drift without ever repairing blank task ownership on a surviving exact holder.

## Why this should not be treated as unexplained drift anymore

This session reproduced the issue under one bounded controller pulse and tied it to a specific app-side limitation:

- shared-wait regeneration repair is active
- surviving exact holders remain represented and blocked truthfully
- `blocker.owner` is present
- `task.owner` blank residue persists because existing-holder refresh does not backfill it

That makes this a **known app runtime repair gap**.

## Recommended planner/app-ops follow-up

If the planner wants this residue removed, the next app repair should be:

1. backfill `task.owner` for surviving `featureCompactExactWait` blocked leaves during controller pulse and/or runtime projection reconciliation, using the same owner derivation already used for exact-wait creation; and
2. add a regression test that starts from a pre-existing blank-owner exact holder, runs one bounded controller pulse, and verifies `task.owner` becomes non-empty without replacing the truthful holder unnecessarily.

Until that repair lands, blocked-frontier reviews should classify these two holders as **known blank-owner residue on surviving exact compact waits**, not as unexplained owner-integrity drift.
