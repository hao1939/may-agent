# Metric alert triage — aks-rp-e2e.process.unowned-work-count (alert 2806)

- Alert id: `2806`
- Metric id: `aks-rp-e2e.process.unowned-work-count`
- Judged at: `2026-07-07T02:27:50Z`
- Chosen operation: `waiting_with_evidence`

## Current measurement

The alert is still open and the latest metric row is still breaching:

- metric current: `1`
- threshold / target: `0`
- priority: `P0`
- metric updated_at: `1783381757652`
- latest snapshot time: `1783381757652` (`2026-07-06T23:49:17.652Z`)
- snapshot contributor note: `recoveryUnownedSpecIds=["spec.aad-rbac.run-command-access"]`

This is a **real current breach**, not a stale recovered alert.

## Exact contributing mismatch

The only current contributor is `spec.aad-rbac.run-command-access`.

### Spec-loop runtime state

Current `.state/spec-loop/state.json` for `spec.aad-rbac.run-command-access` shows:

- `status: pending`
- `attempts: 19`
- `taskId: null`
- `terminalDisposition: true`
- `successorDisposition: user-ceiling-serviceprincipal-mixed-no-same-path-successor`
- `resumeCondition:` owner-approved repo-local branch split/wording repair or materially new ServicePrincipal evidence
- `successorEvidencePath: /app/projects/aks-rp-e2e/evidence/archive/bound-spec-aad-rbac-run-command-access-user-vs-serviceprincipal-branch-20260703.md`

So the spec has accepted reviewed-exception / ceiling metadata, but **no exact live owner task id** in controller-visible state.

### Live task-tree state

Current `tasks/tree.json` has live aad-rbac holders, but none that name the exact spec id:

- `wait-spec-aad-rbac-nonaad-to-aadv2-shared-create-recovery-review-20260703` — exact blocked holder for `spec.aad-rbac.nonaad-to-aadv2-migration`
- `hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705` — exact blocked holder for `spec.aad-rbac.managed-v2-lifecycle`
- `hold-compact-aad-rbac-mixed-frontier-20260705b` — blocked compact umbrella whose acceptance text says `run-command-access remains only a truthful wait ceiling`, but it does **not** include the exact string `spec.aad-rbac.run-command-access`

Because the metric's owner-detection logic requires either:

1. an exact owning task id in spec-loop state, or
2. a live task whose conflict scope or text explicitly represents `spec.aad-rbac.run-command-access`,

this spec is currently controller-visible as recovery-unowned even though the family-level compact wait exists.

## Why `waiting_with_evidence`

This is a real ownership-linkage breach, but this triage session is not the safest place to rewrite live planner/controller state because:

1. there are already active `aks-explorer` planner/task-worker sessions immediately after the alert,
2. the required repair is a state-linkage repair, not new domain diagnosis,
3. the truthful fix must happen in the planner/controller path by either:
   - assigning `spec.aad-rbac.run-command-access` an exact live holder, or
   - updating an existing live holder so it explicitly represents this exact spec id.

So the concrete action taken here is to record the exact contributor and the exact safe repair condition, while leaving the alert visible until planner/controller state converges.

## Required root-cause repair

The next owner-safe repair should do **one** of these exact things:

1. create or restore an exact blocked holder for `spec.aad-rbac.run-command-access`, with owner `aks-explorer` and a structured blocker matching the accepted User-vs-ServicePrincipal ceiling; or
2. update the existing live holder `hold-compact-aad-rbac-mixed-frontier-20260705b` so its live text or conflict scope explicitly includes `spec.aad-rbac.run-command-access`; or
3. set the spec-loop state's `taskId` to a live exact holder that already truthfully owns this spec.

Any of those would make the work controller-visible as owned on the next metric recompute.

## Next validation signal

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.unowned-work-count` after the active planner/controller path either restores exact spec ownership for `spec.aad-rbac.run-command-access` or the metric remains at `1` with the same contributor.
