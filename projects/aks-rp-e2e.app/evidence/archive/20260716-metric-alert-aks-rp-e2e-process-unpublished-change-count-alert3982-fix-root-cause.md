# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 3982)

- Operation: `fix_root_cause`
- Alert id: `3982`
- Metric id: `aks-rp-e2e.process.unpublished-change-count`
- Judged at: `2026-07-17T01:54:00Z`

## Why the breach is still real now

The metric row, recent snapshots, and a fresh direct recompute all agree the breach is current at `14`.

### Runtime metric row

```sql
SELECT id, current, threshold, target, priority, updated_at
FROM metrics
WHERE id = 'aks-rp-e2e.process.unpublished-change-count';
-- current = 14
-- threshold = 0
-- target = 0
-- priority = P0
```

### Recent snapshots

All ten recent snapshots remained `14`, measured by `agent:may`.

### Fresh recompute

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count --json
# {"measuredAt":1784253052432,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":14}
```

### Current repo truth

```bash
cd /app/projects/aks-rp-e2e && git status --short
#  M features/rp-cluster-lifecycle/specs/rp-available-agent-pool-versions.json
#  M features/rp-cluster-lifecycle/specs/rp-cluster-lifecycle-stop-start.json
#  M features/rp-cluster-lifecycle/specs/rp-nodeless-cluster-crud.json
#  M features/rp-regional-quota.yaml
#  M features/rp-regional-quota/notes/public-create-path-target-selection-20260715.md
#  M features/rp-regional-quota/specs/rp-regional-quota-public-create-path.json
#  M features/rp-regional-quota/tests/rp-regional-quota-public-create-path.ts
#  M model/knowledge-map/model.json
#  M model/knowledge-map/views/evidence-index.md
#  M model/knowledge-map/views/evidence-matrix.json
#  M model/knowledge-map/views/graph-view.json
#  M model/knowledge-map/views/model.generated.md
#  M model/knowledge-map/views/path-summary.json
#  M model/knowledge-map/views/status-summary.json
```

So the breach is not stale or transient: the current count is exactly the current dirty-file surface.

## Root-cause split discovered during triage

The `14` current contributors are not one coherent slice.

### 1) Already-represented rp-cluster-lifecycle review slice — 2 files

These are already held behind the live review/publication-gate chain rooted at `wait-rp-cluster-lifecycle-nodeless-cluster-crud-ado-run-172596301-result` plus the publication holder tasks:

- `features/rp-cluster-lifecycle/specs/rp-cluster-lifecycle-stop-start.json`
- `features/rp-cluster-lifecycle/specs/rp-nodeless-cluster-crud.json`

### 2) Already-represented rp-regional-quota exact wait slice — 4 files

These are already held by blocked task `reconcile-spec-loop-pending-rp-regional-quota`, whose blocker explicitly preserves the exact exhausted-target wait for spec `spec.rp-regional-quota.public-create-path`:

- `features/rp-regional-quota.yaml`
- `features/rp-regional-quota/notes/public-create-path-target-selection-20260715.md`
- `features/rp-regional-quota/specs/rp-regional-quota-public-create-path.json`
- `features/rp-regional-quota/tests/rp-regional-quota-public-create-path.ts`

### 3) Unrepresented available-agent-pool-versions pass-writeback slice — 8 files

The remaining dirty slice was the actual process gap that kept this alert unresolved. These files had no live task-tree owner even though focus metadata still referenced one:

- `features/rp-cluster-lifecycle/specs/rp-available-agent-pool-versions.json`
- `model/knowledge-map/model.json`
- `model/knowledge-map/views/evidence-index.md`
- `model/knowledge-map/views/evidence-matrix.json`
- `model/knowledge-map/views/graph-view.json`
- `model/knowledge-map/views/model.generated.md`
- `model/knowledge-map/views/path-summary.json`
- `model/knowledge-map/views/status-summary.json`

Primary-source diff inspection showed these eight files are all about the same slice: promoting `spec.rp.available-agent-pool-versions` / `path.rp.available-agent-pool-versions` from `ready` to `pass` using preserved reviewed artifact `28414720151`.

## Concrete root-cause fix applied

I fixed the process gap by creating and assigning the missing exact owner task:

- task id: `domain/verify-rp-available-agent-pool-versions-ready-carrier-20260716`
- owner: `aks-explorer`
- state after assignment: `active`
- conflict scope:
  - `spec:spec.rp.available-agent-pool-versions`
  - `path:path.rp.available-agent-pool-versions`
  - `repo:model-knowledge-map-views`

The new task explicitly owns the exact eight-file unpublished slice and requires either:

1. publishing/clearing that exact available-agent-pool-versions spec/model/view writeback with commit proof, or
2. reverting/replacing it with a narrower truthful wait.

This changes the alert from “mixed unpublished residue with one missing owner path” to “three exact slices, each with a live owner path.”

## Why this is `fix_root_cause`

The root cause of alert 3982 was not just that the repo was dirty; it was that one counted unpublished slice had no current live task-tree owner even though other counted slices already had exact waits.

Creating and assigning `domain/verify-rp-available-agent-pool-versions-ready-carrier-20260716` is a concrete safe process repair that starts the workflow able to clear or publish that missing eight-file slice. That is a real owner-side change, not an investigation-only memo.

## Why this is not `waiting_with_evidence`, `resolve_stale`, or `calibrate_metric`

- **Not `waiting_with_evidence`**: before this change, the available-agent-pool-versions + model/view slice was not truthfully represented by a live task.
- **Not `resolve_stale`**: fresh recompute still returns `14`.
- **Not `calibrate_metric`**: threshold `0` remains correct because these files are still not pipeline-visible.
- **Not `upgrade_or_escalate`**: the missing-owner process gap was safe for app-ops to repair directly.

## Next validation

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`, or sooner after one of these exact changes:

1. `domain/verify-rp-available-agent-pool-versions-ready-carrier-20260716` publishes or clears its eight-file slice;
2. `wait-rp-cluster-lifecycle-nodeless-cluster-crud-ado-run-172596301-result` resolves and the rp-cluster-lifecycle publication gates clear their two-file slice;
3. `reconcile-spec-loop-pending-rp-regional-quota` gains reviewed exhausted-target recovery or a replacement exact target and clears its four-file slice.
