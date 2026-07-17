# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 3953)

- Operation: `waiting_with_evidence`
- Alert id: `3953`
- Metric id: `aks-rp-e2e.process.unpublished-change-count`
- Judged at: `2026-07-16T14:03:00Z`

## Why the breach is still real now

The alert payload said `current=3`, but the live metric row and a fresh direct recompute both show the breach is currently **15**, so the alert is not stale in the safe-to-resolve sense; it is a larger live breach than the alert body captured.

### Runtime metric row

```sql
SELECT id, current, threshold, target, priority, updated_at
FROM metrics
WHERE id = 'aks-rp-e2e.process.unpublished-change-count';
-- current = 15
-- threshold = 0
-- target = 0
-- priority = P0
```

### Fresh recompute

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count --json
# {"measuredAt":1784210287324,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":15}
```

### Repo truth

```bash
cd /app/projects/aks-rp-e2e && git status --short
# MM evidence/pipelines/virtualmachine-prerelease-coverage.json
# MM evidence/pipelines/virtualmachine-prerelease-coverage.md
# M  features/node-pool-config/compact/staging.plan.json
# M  features/node-pool-config/specs/node-pool-config-disable-ssh-lifecycle.json
# M  features/node-pool-config/tests/node-pool-config-disable-ssh-lifecycle.test.ts
# D  features/node-pool-config/tests/node-pool-config-disable-ssh-lifecycle.ts
# M  features/rp-cluster-lifecycle/tests/rp-preflight-validation.test.ts
# MM model/knowledge-map/model.json
# M  model/knowledge-map/views/evidence-index.md
# M  model/knowledge-map/views/evidence-matrix.json
# M  model/knowledge-map/views/graph-view.json
# M  model/knowledge-map/views/model.generated.md
# MM model/knowledge-map/views/path-summary.json
# M  model/knowledge-map/views/status-summary.json
# M  runner/scenario-lib/disable-ssh-live-carrier.ts

cd /app/projects/aks-rp-e2e && git rev-list --count HEAD --not --remotes=origin
# 0
```

So the current count is entirely dirty-file residue, not local-only commit objects.

## Current contributors are already represented by live domain lineage

The 15 current contributors split cleanly into **three** exact slices, and each slice already has a live task-tree owner.

### 1) Disable-SSH direct-normalization slice — 5 files

Dirty files in this slice:

- `features/node-pool-config/compact/staging.plan.json`
- `features/node-pool-config/specs/node-pool-config-disable-ssh-lifecycle.json`
- `features/node-pool-config/tests/node-pool-config-disable-ssh-lifecycle.test.ts`
- `features/node-pool-config/tests/node-pool-config-disable-ssh-lifecycle.ts` (deleted)
- `runner/scenario-lib/disable-ssh-live-carrier.ts`

Live owner:

- task `domain/normalize-scenario-node-pool-config-disable-ssh-lifecycle`
- state `active`
- owner `aks-explorer`

Primary-source task-tree proof:

- the task goal explicitly says to normalize `spec.node-pool-config.disable-ssh-lifecycle` into one direct `.test.ts` implementation,
- remove the redundant plain carrier,
- update durable `spec/packet/compact` references,
- and preserve the shared live carrier only where still materially needed.

That matches the current dirty file set exactly enough to show the slice is not orphaned.

### 2) RP preflight-validation direct-carrier follow-through — 3 files

Dirty files in this slice:

- `features/rp-cluster-lifecycle/tests/rp-preflight-validation.test.ts`
- `evidence/pipelines/virtualmachine-prerelease-coverage.md`
- `evidence/pipelines/virtualmachine-prerelease-coverage.json`

Live owner:

- task `domain/normalize-scenario-rp-cluster-lifecycle-preflight-validation`
- state `review`
- owner `aks-explorer`

Primary-source task-tree proof:

- the task result says it updated the direct `.test.ts` mode parsing,
- repointed maintained prerelease coverage references away from `replays/rp-preflight-validation.ts`,
- and its recorded evidence/artifacts include exactly:
  - `features/rp-cluster-lifecycle/tests/rp-preflight-validation.test.ts`
  - `evidence/pipelines/virtualmachine-prerelease-coverage.md`
  - `evidence/pipelines/virtualmachine-prerelease-coverage.json`

The current unstaged diffs confirm the same reference rewrite:

```diff
- replays/rp-preflight-validation.ts
+ features/rp-cluster-lifecycle/tests/rp-preflight-validation.test.ts
```

### 3) Planned-maintenance maintained-reference writeback — 7 files

Dirty files in this slice:

- `model/knowledge-map/model.json`
- `model/knowledge-map/views/evidence-index.md`
- `model/knowledge-map/views/evidence-matrix.json`
- `model/knowledge-map/views/graph-view.json`
- `model/knowledge-map/views/model.generated.md`
- `model/knowledge-map/views/path-summary.json`
- `model/knowledge-map/views/status-summary.json`

Live owner:

- task `domain/normalize-scenario-planned-maintenance-configuration-crud-lifecycle-20260716`
- state `active`
- owner `aks-explorer`

Primary-source proof linking the files to this task:

- the task goal explicitly says to repoint every maintained spec/packet/compact/aggregate/generated reference for `spec.planned-maintenance.configuration-crud-lifecycle`;
- the current model/view diff changes `probeRef` from `replays/planned-maintenance-configuration-crud.ts` to `features/planned-maintenance/tests/planned-maintenance-configuration-crud.test.ts`;
- the planner/root readout still lists this task as the live runnable normalization item.

So this seven-file writeback is also represented by a current live owner, even though the exact worker execution is still in progress.

## Why this is not `fix_root_cause`, `resolve_stale`, or `calibrate_metric`

- **Not `fix_root_cause`**: app-ops should not ad hoc publish, discard, or rewrite these domain-repo slices while they are already attached to active/review domain tasks.
- **Not `resolve_stale`**: the fresh recompute is still `15`.
- **Not `calibrate_metric`**: threshold `0` remains correct because these repo-local changes are not yet pipeline-visible.
- **Not `upgrade_or_escalate`**: the breach is already P0 and the current problem is represented, not ownerless or requiring destructive action.

## Why the final operation is `waiting_with_evidence`

`waiting_with_evidence` is the smallest truthful operation because the current breach is real, but every current counted slice is already represented by live domain work:

1. disable-ssh direct-normalization (`active`)
2. rp preflight-validation follow-through (`review`)
3. planned-maintenance reference writeback (`active`)

This memo is the concrete change from triage: it records that alert 3953 is a represented live wait, not an unowned publication gap.

## Next validation

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`, or sooner if any of these land first:

1. `domain/normalize-scenario-node-pool-config-disable-ssh-lifecycle` publishes or clears its five-file slice;
2. `domain/normalize-scenario-rp-cluster-lifecycle-preflight-validation` finishes review and either checkpoints or clears the three-file preflight-validation slice;
3. `domain/normalize-scenario-planned-maintenance-configuration-crud-lifecycle-20260716` lands a reviewed maintained-reference update that clears the seven-file model/view writeback.
