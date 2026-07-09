# Reconcile compact jwt-authenticator final carrier warning — 2026-07-09

- Task: `ops/reconcile-compact-jwt-authenticator-final-carrier-warning-20260709t`
- Attempt: `a_ops_reconcile-compact-jwt-authenticator-final-carrier-warning-20260709t_20260709122429`
- Mode: Task Worker Mode
- Runtime task-tree mutation from this worker: none
- Output purpose: exact review/apply note for planner/app-ops so the compact jwt-authenticator frontier keeps one truthful carrier story and stops drifting from the final blocked-infra model verdict

## Executive result

The live compact holder is already on the **right family** but is still not the **final contract match**.

Today the truthful carrier set is:

1. canonical shared wait: `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`
2. feature-local represented compact holder: `hold-compact-jwt-authenticator-package-partial-frontier`

That is the correct shape. No new retry, setup, or duplicate wait should be introduced.

However, the planner packet still emits:

- `project_hygiene_warnings.kind = stale-terminal-retry`
- `taskId = hold-compact-jwt-authenticator-package-partial-frontier`
- `pathId = path.jwt-authenticator.incluster-idp-dex-lifecycle`

So this task's reconciliation outcome is:

- **keep** the shared wait as the only canonical blocked family carrier;
- **keep** the compact holder only as a represented split-frontier carrier for feature-local compact meaning;
- **sharpen the compact holder text to mirror the final model resume contract more literally**, because the current wording is semantically right but still not close enough for the stale-terminal matcher.

## Source facts reviewed

### 1. Final model verdict is already settled

`/app/projects/aks-rp-e2e/model/knowledge-map/model.json` for `path.jwt-authenticator.incluster-idp-dex-lifecycle` now says:

- `status: blocked-infra`
- `terminal: true`
- `verdictFinal: true`
- `remediationStatus: awaiting-execution-surface`
- `resumeCondition:`

> Resume only after the already-routed 2026-07-08 owner ask returns one of these exact same-path signals for the in-cluster Dex ClusterIP issuer boundary: (1) a usable Go e2ev3 or accepted equivalent issuer-reachability surface; (2) authoritative proof that no such surface currently exists; or (3) an exact reroute naming the replacement owner/surface.

The same model entry also records:

- `terminalReason`: structural infra block on the Go e2ev3 `jwt-egress --insecure` surface
- unchanged reruns are not meaningful before one returned owner signal exists

So the path verdict is already final and should not reopen generic compact reruns.

### 2. The canonical shared wait is truthful

`/app/projects/aks-rp-e2e.app/.state/tasks/tree.json` shows `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708` as:

- `state: blocked`
- `blocker.category: external-wait`
- `blocker.owner: human`
- exact scope: `spec.jwt-authenticator.incluster-idp-dex-lifecycle` / `path.jwt-authenticator.incluster-idp-dex-lifecycle`
- accepted outcomes:
  - usable same-path execution surface
  - authoritative no-surface proof
  - exact reroute

That matches the final model verdict family.

### 3. The compact holder is already mostly repaired

`hold-compact-jwt-authenticator-package-partial-frontier` already says:

- it is a `represented split-frontier carrier`
- the exact represented blocker is `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`
- no duplicate environment setup or unchanged compact rerun should reopen
- compact work resumes only when the represented frontier materially changes

So the surviving compact holder is already the right **shape**.

### 4. The warning still exists anyway

Fresh `bun run task-tree packet` output still contains:

- `stale-terminal-retry`
- `taskId: hold-compact-jwt-authenticator-package-partial-frontier`
- `pathStatus: blocked-infra`
- `terminal: true`
- `verdictFinal: true`

This means the current represented-holder wording is not matching the final model `resumeCondition` closely enough for suppression.

## Diagnosis

This is no longer a duplicate-family problem.

It is now a **contract-normalization** problem between:

- the final model path resume contract, and
- the compact holder's represented-frontier wording.

The holder currently says, in effect:

- resume after the shared wait materially changes through returned proof / authoritative no-surface proof / exact reroute

The final model says, more explicitly:

- resume only after the already-routed 2026-07-08 owner ask returns one of three exact same-path signals for the in-cluster Dex ClusterIP issuer boundary

Those are substantively the same, but the planner hygiene matcher is still treating the holder as retry-intent text attached to a terminal path.

## Truthful surviving carrier contract

The exact durable story should be:

- **one canonical blocked family carrier:** `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`
- **one compact represented carrier only:** `hold-compact-jwt-authenticator-package-partial-frontier`
- **no additional jwt compact retry/setup leaf** unless a materially different execution surface is proven

The compact holder should not present its own independent retry story. It should only mirror the final model/shared-wait contract.

## Exact planner/app-ops apply recommendation

Because this worker session was not explicitly authorized to run bounded `task-tree update-text` commands, the exact mutation is left as a reviewed apply packet.

### Keep these ids unchanged

- keep `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`
- keep `hold-compact-jwt-authenticator-package-partial-frontier`

### Do not create

- no new jwt compact wait
- no new environment/setup task
- no unchanged compact rerun task

### Sharpen the compact holder to the final model contract

Planner/app-ops should update the compact holder text so its resume contract tracks the final model wording as literally as possible.

Recommended bounded apply shape:

```bash
cd /app/projects/aks-rp-e2e.app && \
  bun run task-tree update-text hold-compact-jwt-authenticator-package-partial-frontier \
    --goal "Hold compact feature jwt-authenticator only as a represented split-frontier carrier while the exact represented blocker remains wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708 for spec.jwt-authenticator.incluster-idp-dex-lifecycle / path.jwt-authenticator.incluster-idp-dex-lifecycle." \
    --acceptance "This compact holder remains blocked only while wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708 still controls the same final blocked-infra frontier for spec.jwt-authenticator.incluster-idp-dex-lifecycle / path.jwt-authenticator.incluster-idp-dex-lifecycle." \
    --acceptance "The holder is represented-frontier state only. Do not create duplicate environment setup, diagnosis, or unchanged compact rerun work from this holder; the exact canonical family carrier is the shared human-owned Go e2ev3 Dex issuer wait." \
    --acceptance "Resume compact work only after the already-routed 2026-07-08 owner ask returns one of these exact same-path signals for the in-cluster Dex ClusterIP issuer boundary: (1) a usable Go e2ev3 or accepted equivalent issuer-reachability surface; (2) authoritative proof that no such surface currently exists; or (3) an exact reroute naming the replacement owner/surface." \
    --blocker-owner human \
    --blocker-category external-wait \
    --resume-condition "Resume compact work only after the already-routed 2026-07-08 owner ask returns one of these exact same-path signals for the in-cluster Dex ClusterIP issuer boundary: (1) a usable Go e2ev3 or accepted equivalent issuer-reachability surface; (2) authoritative proof that no such surface currently exists; or (3) an exact reroute naming the replacement owner/surface." \
    --blocker "Represented by wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708. This compact leaf is feature-local represented-frontier state only: compact package staging remains partial only because path.jwt-authenticator.incluster-idp-dex-lifecycle remains final blocked-infra on the exact in-cluster Dex ClusterIP issuer boundary and is waiting on the already-routed 2026-07-08 owner ask for one of three same-path returned outcomes: a usable Go e2ev3 or accepted equivalent issuer-reachability surface, authoritative proof that no such surface currently exists, or an exact reroute naming the replacement owner/surface. Do not reopen unchanged compact reruns or create duplicate setup/diagnosis work while that represented frontier remains unchanged." 
```

## Why this is the smallest truthful fix

This repair:

- preserves feature-local compact meaning;
- preserves the existing shared family wait;
- reflects the final `blocked-infra` / `terminal` / `verdictFinal` model verdict directly in the compact holder;
- avoids introducing any second carrier for the same Dex issuer surface; and
- gives the stale-terminal matcher the exact final resume contract instead of a paraphrase.

## Expected result after planner apply

If planner/app-ops applies the above bounded text normalization, the surviving carrier story should be:

- shared wait = canonical owner-return carrier
- compact holder = represented feature-local carrier only
- no new jwt rerun/setup leaf
- stale-terminal warning for `hold-compact-jwt-authenticator-package-partial-frontier` should become reviewable for suppression because the holder now mirrors the final model contract instead of paraphrasing it

## Bottom line

The correct reconciliation is **not** to replace the compact holder with new work.

The correct reconciliation is to keep the already-repaired represented compact holder and normalize its text to the final model resume contract so the compact tree carries exactly one truthful jwt-authenticator Dex issuer story:

- canonical shared wait for the family,
- compact represented holder for feature-local state,
- no duplicate retry/setup work until a materially different same-path surface is proven.
