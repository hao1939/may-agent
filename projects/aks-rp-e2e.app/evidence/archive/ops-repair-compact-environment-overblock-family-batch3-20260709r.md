# Compact environment-overblock family repair — batch 3 (2026-07-09r)

- Task: `ops/repair-compact-environment-overblock-family-batch3-20260709r`
- Attempt: `a_ops_repair-compact-environment-overblock-family-batch3-20260709r_20260709120810`
- Mode: Task Worker Mode
- Runtime tree mutation from this worker: none
- Output purpose: exact planner/app-ops apply packet for one remaining compact `environment-overblock` warning family

## Executive result

I reviewed the remaining compact warning holders that still present as passive environment blockers and chose the **smallest truthful repair candidate** still open in the live tree:

- target holder: `hold-compact-jwt-authenticator-package-partial-frontier`
- exact downstream carrier already present: `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`
- affected feature/spec subset: `feature:jwt-authenticator`, specifically `spec.jwt-authenticator.incluster-idp-dex-lifecycle`

This family does **not** need a new rerun, new broad environment wait, or a new setup task.
The smallest truthful repair is to **rewrite the existing compact holder into an explicit represented split-frontier carrier** for the already-existing shared exact wait.

Under this session's worker-mode constraints, I did **not** mutate the live task tree because the assigned task did not explicitly authorize bounded `task-tree update-text` application against named task ids. Instead, this note provides the exact reviewed apply packet for planner/app-ops.

## Sources reviewed

- Live planner packet:
  - `cd /app/projects/aks-rp-e2e.app && bun run task-tree packet`
- Live holder:
  - `cd /app/projects/aks-rp-e2e.app && bun run task-tree show hold-compact-jwt-authenticator-package-partial-frontier`
- Existing exact shared wait:
  - `cd /app/projects/aks-rp-e2e.app && bun run task-tree show wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`
- Warning heuristic:
  - `/app/projects/aks-rp-e2e.app/workflows/lib/task-tree-tools.ts`
- Current compact summary:
  - `/app/projects/aks-rp-e2e/features/jwt-authenticator/compact/staging.summary.md`
- Supporting overdue/shared-wait evidence:
  - `/app/projects/aks-rp-e2e.app/evidence/archive/ops-refresh-overdue-jwt-shared-wait-coverage-20260709b.md`

## Live baseline contributor set before this worker review

Using the live packet as if this worker task did not exist, the compact `environment-overblock` warnings still include at least these remaining families:

- `hold-compact-defender-profile-reviewed-exception-frontier`
- `hold-compact-jwt-authenticator-package-partial-frontier`
- `hold-compact-upgrade-reviewed-exception-frontier`

For this batch, I selected `jwt-authenticator` because it already has one exact live shared wait and one compact duplicate holder that can be made truthful by bounded metadata repair alone.

## Why jwt-authenticator is the smallest truthful repair candidate

## 1) The live planner packet still warns on the compact holder

Fresh packet output still includes:

- `kind: environment-overblock`
- `taskId: hold-compact-jwt-authenticator-package-partial-frontier`

So this holder still contributes noise to the compact warning cluster today.

## 2) The compact summary already narrows the surviving frontier to one quarantined spec

`features/jwt-authenticator/compact/staging.summary.md` currently says:

- package status: `partial`
- only quarantined member: `spec.jwt-authenticator.incluster-idp-dex-lifecycle`
- exact blocker kind: `repo-local-live-ready-filter`
- exact boundary: the Go e2ev3 `jwt-egress --insecure` / Dex ClusterIP issuer path
- no unchanged compact rerun is truthful until that exact surface exists or the path is intentionally re-scoped

So the real open frontier is **not** a broad feature-level environment family. It is one exact spec/path boundary.

## 3) The compact holder already names the exact downstream shared wait

Current blocker text on `hold-compact-jwt-authenticator-package-partial-frontier` already says:

- the package remains partial only because `spec.jwt-authenticator.incluster-idp-dex-lifecycle` is still blocked on
  `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`
- do not reopen unchanged compact reruns before reviewed returned proof or exact reroute

That means the holder already knows its truthful downstream carrier. It is just not yet expressed in warning-suppressing represented-frontier form.

## 4) The exact shared wait already exists live and is still the truthful carrier

`wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708` is already live as:

- `state: blocked`
- `blocker.category: external-wait`
- `blocker.owner: human`
- one exact wait for `spec.jwt-authenticator.incluster-idp-dex-lifecycle` / `path.jwt-authenticator.incluster-idp-dex-lifecycle`
- resume only on one of:
  - returned proof for the exact Dex ClusterIP issuer ask,
  - authoritative no-surface proof, or
  - a reviewed replacement execution surface / exact reroute

The overdue-coverage review from `ops-refresh-overdue-jwt-shared-wait-coverage-20260709b.md` also confirms this is still the smallest truthful shared holder and that no returned owner/operator outcome exists yet.

## 5) The current warning heuristic would stop flagging this holder after a represented-frontier rewrite

`workflows/lib/task-tree-tools.ts` suppresses `environment-overblock` when a blocked task is either:

- a human-owned `external-wait`; or
- a represented blocked frontier with signals like:
  - `split-frontier`
  - `represented by`
  - `exact represented blocker`
  - `exact represented carrier`

The current jwt compact holder is still `blocker.owner = operator` and does not yet use the represented-frontier wording pattern, so it still warns.

A bounded metadata rewrite matching the existing SGX / CCP-security-patch repair pattern should remove the misleading warning without changing the underlying wait truth.

## Truthful repair for this family

## Selected family

- compact holder to rewrite: `hold-compact-jwt-authenticator-package-partial-frontier`
- exact represented wait to preserve: `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`
- exact affected subset: `spec.jwt-authenticator.incluster-idp-dex-lifecycle`

## Repair type

Rewrite the holder into an explicit **represented split-frontier carrier**.

This is preferable to:

- creating a new compact-only wait task,
- reopening unchanged compact reruns,
- or creating a generic environment/setup task.

## Why no rerun should reopen

The compact summary and current holder agree that:

- all 4 active feature-owned specs are already selected into the compact package;
- only `spec.jwt-authenticator.incluster-idp-dex-lifecycle` remains quarantined;
- local generated check passes do not change the live boundary; and
- the missing truth is still the exact Go e2ev3 / Dex ClusterIP issuer execution surface or a reviewed same-path reroute.

So another unchanged jwt compact rerun would only reproduce the same quarantine.

## Exact planner/app-ops apply packet

Because this worker session is review/proposal output only, planner/app-ops should apply the bounded repair with `task-tree update-text`.

### Recommended command

```bash
cd /app/projects/aks-rp-e2e.app && \
  bun run task-tree update-text hold-compact-jwt-authenticator-package-partial-frontier \
    --goal "Hold compact feature jwt-authenticator only as a represented split-frontier carrier while the exact represented blocker remains wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708 for spec.jwt-authenticator.incluster-idp-dex-lifecycle." \
    --acceptance "This compact holder remains blocked only while wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708 still controls the same spec.jwt-authenticator.incluster-idp-dex-lifecycle / path.jwt-authenticator.incluster-idp-dex-lifecycle frontier." \
    --acceptance "Do not create duplicate environment setup, diagnosis, or unchanged compact rerun work from this holder; the exact represented carrier is the shared human-owned Go e2ev3 Dex issuer wait." \
    --acceptance "Resume compact work only after that represented frontier materially changes through returned proof, authoritative no-surface proof, or an exact reviewed reroute for the same path." \
    --blocker-owner human \
    --blocker-category external-wait \
    --resume-condition "Resume only after wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708 materially changes through returned proof, authoritative no-surface proof, or an exact reviewed reroute for spec.jwt-authenticator.incluster-idp-dex-lifecycle." \
    --blocker "Represented by wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708. This compact leaf is a split-frontier carrier for feature-local state only: compact package staging remains partial only because spec.jwt-authenticator.incluster-idp-dex-lifecycle still lacks the exact Go e2ev3 jwt-egress --insecure / Dex ClusterIP issuer execution surface already tracked by that shared human-owned wait. No duplicate environment setup task or unchanged compact rerun is truthful while the represented frontier remains the same. Resume only after the exact represented blocker materially changes through returned proof, authoritative no-surface proof, or an exact reviewed reroute for the same path." 
```

## Why this specific rewrite is safe

It does **not**:

- create or remove any task ids;
- change the exact path/spec boundary;
- reopen any compact/domain active tasks;
- alter the underlying shared wait contract; or
- pretend that a different environment/setup owner exists.

It only makes the existing compact holder tell the truth more precisely:

- exact represented carrier named,
- exact affected spec named,
- duplicate rerun/setup work forbidden,
- owner aligned with the human-owned shared wait,
- represented-frontier wording aligned with current warning suppression logic.

## Expected post-apply represented set

If planner/app-ops applies the above update-text repair, the truthful represented set for this family becomes:

- `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`
- `hold-compact-jwt-authenticator-package-partial-frontier` as represented split-frontier carrier only

Operationally, the family then stops presenting as a passive generic environment blocker and instead points directly at its exact same-path shared wait.

## Why I did not choose the other two sampled holders for this batch's smallest repair

## defender-profile

`hold-compact-defender-profile-reviewed-exception-frontier` is likely warning noise too, but it does **not** already point at one live exact wait task id. Its current truth is owner promotion / compact-eligibility reclassification rooted in accepted note evidence, not one existing shared wait leaf. That makes it a larger contract rewrite than jwt-authenticator.

## upgrade

`hold-compact-upgrade-reviewed-exception-frontier` still references exact wait `wait-compact-upgrade-underlay-control-plane-prereqs-20260703`, but that task id is currently missing from the live tree. So upgrade is not a safe represented-wait rewrite until planner first restores or intentionally replaces that missing exact carrier.

## Bottom line

The smallest truthful remaining batch-3 repair is jwt-authenticator:

- keep the exact live shared wait `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`;
- rewrite `hold-compact-jwt-authenticator-package-partial-frontier` into a represented split-frontier carrier for that wait;
- do not reopen unchanged reruns;
- do not create a new broad environment blocker.

This session leaves the reviewed apply packet for planner/app-ops because worker mode here did not explicitly authorize the bounded live `task-tree update-text` mutation.