# Task-tree follow-up evidence — app-routing overdue blocked-frontier runtime follow-through

- Task: `domain/apply-app-routing-overdue-blocked-frontier-reconciliation-runtime-followthrough-20260717`
- Attempt: `a_domain_apply-app-routing-overdue-blocked-frontier-reconciliation-runtime-followthrough-20260717_20260717050008`
- Scope: planner/app-owned task-tree follow-up evidence only. This worker did **not** mutate the live task tree because the assigned task did not explicitly authorize specific `task-tree` mutation commands.

## Executive result

The same-surface repo-visibility gate is already clear:

- the published app-routing cleanup is checkpointed on branch `aks-explorer/checkpoint-app-routing-unpublished-change-20260717`
- `aks-rp-e2e.process.unpublished-change-count` now samples as `0`

Fresh primary-source review shows the remaining runtime follow-through is narrowly defined and still unapplied:

1. `wait-spec-app-routing-default-domain-tls-secret-product-gap-return-20260705` remains the exact same-surface owner wait, but its live task metadata still points at the generic stranded-residue output instead of this follow-through memo and does not yet carry the sharper unblock/fallback wording from the 2026-07-17 domain reconciliation.
2. `hold-spec-app-routing-default-domain-istio-hello-world-on-tls-product-gap-20260705` remains the correct dependent-only holder, but likewise still points at the generic stranded-residue output and does not yet say explicitly that no unchanged standalone rerun is authorized.
3. `wait-spec-app-routing-rollback-istio-to-nginx-source-model-reconciliation-20260705` is now stale passive residue: the active spec/test are gone from live repo surfaces, the spec-loop state no longer maps that spec to any task, and the only remaining repo carrier is the superseded historical alias under `features/app-routing/superseded/`.

So the truthful post-follow-through represented set should be:

- keep `wait-spec-app-routing-default-domain-tls-secret-product-gap-return-20260705`
- keep `hold-spec-app-routing-default-domain-istio-hello-world-on-tls-product-gap-20260705` as dependent-only on the TLS-secret holder
- retire `wait-spec-app-routing-rollback-istio-to-nginx-source-model-reconciliation-20260705`

No unchanged live AKS rerun was launched or queued in this session.

## Primary sources checked

1. `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`
2. `/app/projects/aks-rp-e2e.app/.state/spec-loop/state.json`
3. `bun run task-tree show wait-spec-app-routing-default-domain-tls-secret-product-gap-return-20260705`
4. `bun run task-tree show hold-spec-app-routing-default-domain-istio-hello-world-on-tls-product-gap-20260705`
5. `bun run task-tree show wait-spec-app-routing-rollback-istio-to-nginx-source-model-reconciliation-20260705`
6. `/app/projects/aks-rp-e2e/evidence/archive/apply-app-routing-overdue-blocked-frontier-reconciliation-20260717.md`
7. `/app/projects/aks-rp-e2e/evidence/archive/ops-close-app-routing-unpublished-change-visibility-20260717.md`
8. `/app/projects/aks-rp-e2e/features/app-routing/specs/app-routing-default-domain-tls-secret.json`
9. `/app/projects/aks-rp-e2e/features/app-routing/specs/app-routing-default-domain-istio-hello-world.json`
10. `/app/projects/aks-rp-e2e/features/app-routing/superseded/app-routing-rollback-istio-to-nginx.json`
11. `grep`/file-existence checks over active app-routing feature, compact, model-view, and spec-loop surfaces
12. `bun run metrics:sample aks-rp-e2e.process.unpublished-change-count --json`

## Current live represented set

### Pre-follow-through represented set in app state

- `wait-spec-app-routing-default-domain-tls-secret-product-gap-return-20260705` — blocked
- `hold-spec-app-routing-default-domain-istio-hello-world-on-tls-product-gap-20260705` — blocked, depends on TLS-secret holder
- `wait-spec-app-routing-rollback-istio-to-nginx-source-model-reconciliation-20260705` — blocked

### Spec-loop mapping reality

`/app/projects/aks-rp-e2e.app/.state/spec-loop/state.json` still maps:

- `spec.app-routing.default-domain-tls-secret` -> `wait-spec-app-routing-default-domain-tls-secret-product-gap-return-20260705`
- `spec.app-routing.default-domain-istio-hello-world` -> `hold-spec-app-routing-default-domain-istio-hello-world-on-tls-product-gap-20260705`

But it no longer contains any row for:

- `spec.app-routing.rollback-istio-to-nginx`
- `wait-spec-app-routing-rollback-istio-to-nginx-source-model-reconciliation-20260705`

### Truthful post-action represented set

After planner/app-ops applies the runtime follow-through, the represented set should be:

- `wait-spec-app-routing-default-domain-tls-secret-product-gap-return-20260705` — still blocked, refreshed with current same-surface cert-material evidence and explicit future unblock/fallback criteria
- `hold-spec-app-routing-default-domain-istio-hello-world-on-tls-product-gap-20260705` — still blocked as a dependent holder on the TLS-secret wait and explicitly not a standalone unchanged rerun candidate
- rollback wait removed from the live blocked frontier because repo-local retirement already satisfied the only remaining same-surface follow-through

## Facts that matter

### 1) Repo-visibility is already repaired for this app-routing slice

`/app/projects/aks-rp-e2e/evidence/archive/ops-close-app-routing-unpublished-change-visibility-20260717.md` records the domain cleanup as published on commit `1065d8569f3a4d7cb11ef7d9540d6d73206e1981` on branch `aks-explorer/checkpoint-app-routing-unpublished-change-20260717`.

Fresh metric sample from the app project returned:

```json
{"measuredAt":1784264632489,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

That means the repo-visibility conflict is no longer the open gate for this surface; only app-owned metadata follow-through remains.

### 2) The TLS-secret wait is still the exact same-surface owner hold, but its metadata is stale

`bun run task-tree show wait-spec-app-routing-default-domain-tls-secret-product-gap-return-20260705` currently shows:

- `state = blocked`
- `outputs = ["evidence/archive/ops-apply-reconcile-spec-loop-stranded-pending-residue-20260717-state-repair.md"]`
- blocker text still says active recovery "now lives in domain/reconcile-app-routing-overdue-blocked-frontier-20260717"

That is no longer the freshest same-surface evidence trail. The 2026-07-17 domain reconciliation memo already narrowed the truthful criteria further:

1. a same-surface app-routing operator or CCP fix materially changes `DefaultDomainCertificate` reconciliation,
2. a known-good build proves `DefaultDomainCertificate` reaches `Available=True` and creates `default/default-domain-tls`, or
3. owner-provided same-surface diagnostics materially narrow or replace the current cert-material precondition.

The domain spec file agrees with keeping this as the owner wait:

- `features/app-routing/specs/app-routing-default-domain-tls-secret.json`
- `status = product_gap`
- `specState = reviewed-exception`
- `next_action = No blind rerun...`
- `retestCondition = App-routing operator fix for CCP cert material unavailability, or owner-confirmed CCP/default-domain cert-material precondition change.`

### 3) The hello-world holder is still dependent-only on the TLS-secret gate, but its metadata is stale

`bun run task-tree show hold-spec-app-routing-default-domain-istio-hello-world-on-tls-product-gap-20260705` currently shows:

- `state = blocked`
- `depends_on = ["wait-spec-app-routing-default-domain-tls-secret-product-gap-return-20260705"]`
- `outputs = ["evidence/archive/ops-apply-reconcile-spec-loop-stranded-pending-residue-20260717-state-repair.md"]`
- blocker text still frames the task as waiting for the older recovery task rather than the now-published same-surface reconciliation result

The maintained spec file confirms this should remain dependent-only:

- `features/app-routing/specs/app-routing-default-domain-istio-hello-world.json`
- precondition `dependsOnFeature = app-routing-default-domain-tls-secret`
- `currentStatus = fail`
- compatibility requirement says `Currently blocked by known app-routing-default-domain-tls-secret failure; do not execute until that gate clears.`
- `status = product_gap`
- `specState = reviewed-exception`

So this row should stay open only as a dependent hold on the TLS-secret surface and should say explicitly that no unchanged standalone rerun is authorized until the shared TLS/material surface changes.

### 4) The rollback wait is now passive residue and should not remain an open blocked leaf

`bun run task-tree show wait-spec-app-routing-rollback-istio-to-nginx-source-model-reconciliation-20260705` still shows a blocked wait whose inputs reference the old active spec path:

- `features/app-routing/specs/app-routing-rollback-istio-to-nginx.json`

But file checks now show:

- `features/app-routing/specs/app-routing-rollback-istio-to-nginx.json` -> missing
- `features/app-routing/tests/app-routing-rollback-istio-to-nginx.ts` -> missing
- `features/app-routing/superseded/app-routing-rollback-istio-to-nginx.json` -> present
- `features/app-routing/superseded/app-routing-rollback-istio-to-nginx.ts` -> present

The live repo surfaces also no longer carry this spec id anywhere active:

- no match in `features/app-routing.yaml`
- no match in `features/app-routing/compact/staging.plan.json`
- no match in `features/app-routing/compact/staging.diagnostics.json`
- no match in `features/app-routing/compact/staging.summary.md`
- no match in `model/knowledge-map/views/path-summary.json`
- no match in `runner/generated/spec-catalog.json`

The surviving spec file under `features/app-routing/superseded/app-routing-rollback-istio-to-nginx.json` is explicit:

- `status = superseded`
- `specState = superseded`
- `nextAction = Do not rerun.`
- `resumeCondition = No automatic resume.`
- `supersededBy = spec.app-routing.nginx-to-istio-migration.zero-downtime`

So the open blocked wait is no longer representing a live spec-loop or active feature surface. It should be retired from the live blocked frontier rather than left as passive residue.

## Exact planner-owned mutation required

The smallest truthful repair is an app-owned metadata refresh for the two TLS-family holders plus retirement of the rollback passive wait.

I did **not** apply these commands from this worker session.

### Preferred bounded command sequence

```bash
cd /app/projects/aks-rp-e2e.app && \
  bun run task-tree set-outputs wait-spec-app-routing-default-domain-tls-secret-product-gap-return-20260705 \
    --output evidence/archive/apply-app-routing-overdue-blocked-frontier-reconciliation-runtime-followthrough-20260717.md

cd /app/projects/aks-rp-e2e.app && \
  bun run task-tree update-text wait-spec-app-routing-default-domain-tls-secret-product-gap-return-20260705 \
    --acceptance "One blocked leaf truthfully carries the reviewed product-gap wait for spec.app-routing.default-domain-tls-secret." \
    --acceptance "This leaf cites the current 2026-07-17 app-routing reconciliation evidence, preserves the exact no-unchanged-standalone-rerun posture, and resumes only when the same app-routing operator / CCP cert-material surface materially changes." \
    --blocker "Blocked on the reviewed app-routing default-domain TLS product-gap. Fresh same-surface evidence in evidence/archive/apply-app-routing-overdue-blocked-frontier-reconciliation-20260717.md plus the published repo-visibility closure in evidence/archive/ops-close-app-routing-unpublished-change-visibility-20260717.md confirm no repo-local repair changed the underlying app-routing operator / CCP default-domain cert-material surface; this task remains the exact owner wait for spec.app-routing.default-domain-tls-secret." \
    --resume-condition "Resume only after a reviewed same-surface product or environment change makes DefaultDomainCertificate reconciliation materially different: (1) a same-surface app-routing operator or CCP fix materially changes DefaultDomainCertificate reconciliation, (2) a known-good build proves DefaultDomainCertificate reaches Available=True and creates default/default-domain-tls, or (3) owner-provided same-surface diagnostics materially narrow or replace the current cert-material precondition. Then re-run the exact local policy gates and the truthful carrier selected for this path before changing verdict surfaces." \
    --fallback-action "If the wait is still true at fallback time, keep this exact owner wait and refresh it with fresh same-surface evidence; do not launch an unchanged standalone rerun."

cd /app/projects/aks-rp-e2e.app && \
  bun run task-tree set-outputs hold-spec-app-routing-default-domain-istio-hello-world-on-tls-product-gap-20260705 \
    --output evidence/archive/apply-app-routing-overdue-blocked-frontier-reconciliation-runtime-followthrough-20260717.md

cd /app/projects/aks-rp-e2e.app && \
  bun run task-tree update-text hold-spec-app-routing-default-domain-istio-hello-world-on-tls-product-gap-20260705 \
    --acceptance "One blocked leaf truthfully carries the reviewed dependent product-gap wait for spec.app-routing.default-domain-istio-hello-world." \
    --acceptance "This leaf remains dependent-only on wait-spec-app-routing-default-domain-tls-secret-product-gap-return-20260705, preserves that no unchanged standalone rerun is authorized, and resumes only after the shared TLS/material surface materially changes or the owner approves a different truthful live carrier for this exact branch." \
    --blocker "Blocked on the reviewed prerequisite default-domain TLS product-gap. Fresh same-surface evidence in evidence/archive/apply-app-routing-overdue-blocked-frontier-reconciliation-20260717.md plus the published repo-visibility closure in evidence/archive/ops-close-app-routing-unpublished-change-visibility-20260717.md confirm spec.app-routing.default-domain-istio-hello-world still depends on the shared TLS-secret gate and gains no new truthful standalone coverage until that gate clears." \
    --resume-condition "Resume only after the shared default-domain TLS holder materially changes in one of these ways: (1) a same-surface app-routing operator or CCP fix materially changes DefaultDomainCertificate reconciliation, (2) a known-good build proves DefaultDomainCertificate reaches Available=True and creates default/default-domain-tls, or (3) owner-provided same-surface diagnostics materially narrow or replace the current cert-material precondition; alternatively the owner approves a different truthful live carrier for this exact Istio hello-world branch after the same TLS/material surface changes. Then re-evaluate the exact local policy gates and the chosen carrier before any dispatch." \
    --fallback-action "If the wait is still true at fallback time, keep this task as a dependent holder on the TLS-secret wait and do not dispatch an unchanged standalone rerun."

cd /app/projects/aks-rp-e2e.app && \
  bun run task-tree mark-done wait-spec-app-routing-rollback-istio-to-nginx-source-model-reconciliation-20260705 \
    --summary "Repo-local retirement is now published and app state no longer needs a passive blocked wait for spec.app-routing.rollback-istio-to-nginx: the active spec/test were removed from live repo surfaces, the spec-loop state no longer maps this spec to a task, the active feature/compact/model surfaces no longer carry the spec id, and the only remaining carrier is the superseded historical alias under features/app-routing/superseded/. No unchanged live rerun remains authorized or useful." \
    --resolution completed \
    --review-decision accept
```

## Structured planner proposal

PLANNER_MUTATION_PROPOSAL:
```json
{
  "workflow": "task-tree-followup",
  "intent": "refresh-two-tls-family-holders-and-retire-rollback-passive-wait",
  "representedSetBefore": [
    "wait-spec-app-routing-default-domain-tls-secret-product-gap-return-20260705",
    "hold-spec-app-routing-default-domain-istio-hello-world-on-tls-product-gap-20260705",
    "wait-spec-app-routing-rollback-istio-to-nginx-source-model-reconciliation-20260705"
  ],
  "representedSetAfter": [
    "wait-spec-app-routing-default-domain-tls-secret-product-gap-return-20260705",
    "hold-spec-app-routing-default-domain-istio-hello-world-on-tls-product-gap-20260705"
  ],
  "keepBlocked": [
    {
      "taskId": "wait-spec-app-routing-default-domain-tls-secret-product-gap-return-20260705",
      "role": "same-surface owner wait",
      "output": "evidence/archive/apply-app-routing-overdue-blocked-frontier-reconciliation-runtime-followthrough-20260717.md",
      "resumeCriteria": [
        "same-surface app-routing operator or CCP fix materially changes DefaultDomainCertificate reconciliation",
        "known-good build proves DefaultDomainCertificate reaches Available=True and creates default/default-domain-tls",
        "owner-provided same-surface diagnostics materially narrow or replace the cert-material precondition"
      ],
      "noStandaloneRerun": true
    },
    {
      "taskId": "hold-spec-app-routing-default-domain-istio-hello-world-on-tls-product-gap-20260705",
      "role": "dependent-only holder",
      "dependsOn": "wait-spec-app-routing-default-domain-tls-secret-product-gap-return-20260705",
      "output": "evidence/archive/apply-app-routing-overdue-blocked-frontier-reconciliation-runtime-followthrough-20260717.md",
      "noStandaloneRerun": true
    }
  ],
  "retire": {
    "taskId": "wait-spec-app-routing-rollback-istio-to-nginx-source-model-reconciliation-20260705",
    "reason": "repo-local retirement already removed the reverse-row spec/test from active feature-owned surfaces, removed the spec id from active compact/model coverage, and left only a superseded historical alias with no automatic resume"
  },
  "evidence": [
    "/app/projects/aks-rp-e2e/evidence/archive/apply-app-routing-overdue-blocked-frontier-reconciliation-20260717.md",
    "/app/projects/aks-rp-e2e/evidence/archive/ops-close-app-routing-unpublished-change-visibility-20260717.md",
    "/app/projects/aks-rp-e2e/features/app-routing/specs/app-routing-default-domain-tls-secret.json",
    "/app/projects/aks-rp-e2e/features/app-routing/specs/app-routing-default-domain-istio-hello-world.json",
    "/app/projects/aks-rp-e2e/features/app-routing/superseded/app-routing-rollback-istio-to-nginx.json",
    "/app/projects/aks-rp-e2e.app/.state/spec-loop/state.json"
  ]
}
```

## Why this is the smallest truthful repair

- It preserves the two exact app-routing default-domain TLS-family holders already reflected in spec-loop state.
- It sharpens both holders to the current same-surface evidence without inventing any new live carrier.
- It keeps the hello-world row dependent on the TLS-secret owner wait instead of reviving it as a standalone unchanged rerun.
- It removes the rollback wait only after the repo-local retirement is already published and controller-visible active surfaces no longer carry that row.
- It launches no unchanged live rerun.
