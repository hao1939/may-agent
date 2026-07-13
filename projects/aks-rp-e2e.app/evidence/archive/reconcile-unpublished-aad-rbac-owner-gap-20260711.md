# Reconcile unpublished aad-rbac owner gap — 2026-07-11

- Task: `ops/reconcile-unpublished-aad-rbac-owner-gap-20260711`
- Attempt: `a_ops_reconcile-unpublished-aad-rbac-owner-gap-20260711_20260711100428`
- Worker: `app-ops`
- Scope: repo-hygiene ownership evidence only; no task-tree mutation from this worker session

## Result

The current `aks-rp-e2e.process.unpublished-change-count` breach is **not** one orphaned model file anymore.
A fresh recompute shows **12** unpublished units, explained by **two slices**:

1. **one coherent uncommitted aad-rbac repair slice** across **11 tracked files**; and
2. **one separate ahead-1 checkpoint commit** (`be707f363`) unrelated to aad-rbac.

The stale claim that "a missing active domain repair already carries this" is no longer truthful as written. The live tree already preserves the **aad-rbac family frontier** through existing blocked holders, but it does **not** yet expose a dedicated domain publication carrier for the current 11-file repo-local aad-rbac writeback slice. In this session, the visible non-blocked carrier is the currently active task `ops/reconcile-unpublished-aad-rbac-owner-gap-20260711` itself.

## Live metric and git-state reconciliation

Fresh recompute from `/app/projects/aks-rp-e2e.app`:

```json
{"measuredAt":1783764415228,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":12}
```

Fresh domain-repo status from `/app/projects/aks-rp-e2e`:

```text
## dev...origin/dev [ahead 1]
 M features/aad-rbac/compact/staging.diagnostics.json
 M features/aad-rbac/compact/staging.plan.json
 M features/aad-rbac/compact/staging.summary.md
 M features/aad-rbac/specs/aad-rbac-run-command-access.json
 M model/knowledge-map/model.json
 M model/knowledge-map/views/evidence-index.md
 M model/knowledge-map/views/evidence-matrix.json
 M model/knowledge-map/views/graph-view.json
 M model/knowledge-map/views/model.generated.md
 M model/knowledge-map/views/path-summary.json
 M model/knowledge-map/views/status-summary.json
```

Count reconciliation:

- `11` tracked modified paths
- `+1` ahead commit from branch header
- `= 12` unpublished units

This proves the latest metric row is real and matches live git state.

## Why the earlier ownership note is stale

The recent alert memo `evidence/archive/20260711-metric-alert-aks-rp-e2e-process-unpublished-change-count-alert3420-waiting.md` described a **different earlier state**:

- metric `current = 1`
- only `model/knowledge-map/model.json` dirty
- no visible owner for that single-file residue

That note is stale against the current worktree. The live breach is now broader and centered on a new aad-rbac wording/writeback slice.

## Inventory of current unpublished surface

### Slice A — coherent aad-rbac repo-local repair (`11` tracked modified paths)

These paths move together and should be treated as **one coherent aad-rbac repair slice**, not multiple unrelated slices:

- `features/aad-rbac/compact/staging.diagnostics.json`
- `features/aad-rbac/compact/staging.plan.json`
- `features/aad-rbac/compact/staging.summary.md`
- `features/aad-rbac/specs/aad-rbac-run-command-access.json`
- `model/knowledge-map/model.json`
- `model/knowledge-map/views/evidence-index.md`
- `model/knowledge-map/views/evidence-matrix.json`
- `model/knowledge-map/views/graph-view.json`
- `model/knowledge-map/views/model.generated.md`
- `model/knowledge-map/views/path-summary.json`
- `model/knowledge-map/views/status-summary.json`

### Why this is one coherent slice

The diffs all align to the same repo-local repair documented in the domain memo:

- `/app/projects/aks-rp-e2e/evidence/archive/repair-aad-rbac-run-command-access-serviceprincipal-wording-drift-20260711.md`

That memo says the change repairs maintained wording so checked-in spec/model/view/compact surfaces stop overstating a source-defined `User` vs `ServicePrincipal` branch split for `spec.aad-rbac.run-command-access`.

Live diff excerpts match that memo exactly:

- `features/aad-rbac/specs/aad-rbac-run-command-access.json`
  - `statusReason` now says mounted source still defines **one unsplit** `Scenario_AAD_RunCommand` lifecycle.
  - `resumeCondition` now reopens only for real carrier-isolation or materially stronger direct ServicePrincipal evidence.
- `features/aad-rbac/compact/staging.summary.md`
  - reviewed-exception wording changed to the same unsplit/User-ceiling framing.
- `features/aad-rbac/compact/staging.plan.json`
  - `reason` for `spec.aad-rbac.run-command-access` now matches the repaired wording.
- `model/knowledge-map/model.json` and generated views
  - remove the overstrong maintained interpretation that there is already a mounted-source executable principal split.

So the **11 dirty paths are one bounded aad-rbac repair slice**.

### Live tree state that already represents the aad-rbac family truth

The current tree already preserves the aad-rbac frontier through visible blocked holders:

- `hold-compact-aad-rbac-package-partial-frontier`
  - `state=blocked`
  - references the aad-rbac compact artifacts
  - explicitly preserves the remaining aad-rbac residual frontier
- `hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706`
  - `state=blocked`
  - exact holder for `spec.aad-rbac.run-command-access`
- `hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705`
  - separate aad-rbac managed-v2 holder already preserved in the tree
- shared capacity holder also still covers `spec.aad-rbac.azure-rbac-automatic-sku`

So the **family** is not missing from the tree.

### What is still missing

What is still missing is not family visibility but **repo-hygiene publication ownership** for the current 11-file local writeback slice.

The blocked holders explain **why aad-rbac remains partial/non-rerunnable**, but they are not a truthful **non-blocked carrier for the unpublished local diff itself**.

## Slice B — separate ahead commit (`+1`)

The extra `+1` in the metric is a different slice:

```text
be707f363 checkpoint: publish rp lifecycle model feedback wording
```

This is already a separate checkpointed publication gap, previously documented in:

- `evidence/archive/ops-reconcile-unpublished-model-knowledge-map-change-20260711.md`

It is **not** part of the aad-rbac 11-file uncommitted slice and should not be mixed into the same explanation.

## Truthful ownership judgment

### Replaced stale claim

The stale explanation "missing active domain repair already carries this" should be replaced with:

> Live unpublished-change-count `12` is currently explained by two slices: one ahead-1 checkpoint commit (`be707f363`) plus one coherent 11-file aad-rbac wording/writeback slice. The aad-rbac feature/spec frontier is already visible through blocked holders, but the repo-local unpublished aad-rbac writeback slice still needs an explicit non-blocked carrier or checkpoint decision.

### Current visible non-blocked carrier

Because this worker session may not reshape the tree, the only current visible non-blocked carrier for the repo-hygiene gap is:

- `ops/reconcile-unpublished-aad-rbac-owner-gap-20260711` (`state=active`)

That means the metric is **no longer explained by a missing task id during this session**. The gap is now explicitly surfaced by this active task and this evidence note.

## Checkpoint vs blocked decision

### Aad-rbac 11-file diff

Judgment: **coherent checkpoint candidate**.

Reason:

- all 11 modified files align to one bounded aad-rbac wording/writeback repair;
- the domain memo already explains the exact maintained-state correction;
- the diff is not random churn across unrelated families.

### Why it is not yet safe to describe the whole metric as one checkpoint

The total metric `12` still includes the separate ahead-1 commit `be707f363`.
So the live breach is **multiple slices overall**, even though the uncommitted dirty-path portion is one coherent aad-rbac slice.

## Planner review output

This worker did **not** mutate the task tree. Planner/app-ops should apply one of these truthful follow-ups after review:

1. **Preferred:** keep `ops/reconcile-unpublished-aad-rbac-owner-gap-20260711` as the visible active carrier until the domain owner either checkpoints/publishes the 11-file aad-rbac slice or records one exact blocker.
2. **Better long-term shape:** replace this temporary ops carrier with one visible active domain publication/checkpoint carrier that explicitly owns these 11 aad-rbac files and cites the domain memo `repair-aad-rbac-run-command-access-serviceprincipal-wording-drift-20260711.md`.
3. Keep the ahead-1 commit `be707f363` represented as its **separate** publication gap; do not collapse it into the aad-rbac slice.

## Bottom line

- The live count is **12**, not `1`.
- The current breach is **not** just one stray model file.
- The dirty worktree portion is **one coherent aad-rbac repair slice** across 11 files.
- The extra `+1` is a **separate ahead commit**.
- The aad-rbac family already has visible blocked frontier holders.
- The currently assigned active task is the present **non-blocked carrier** for the repo-hygiene ownership gap until planner rehomes it to an exact domain publication/checkpoint carrier or accepts a precise blocker.
