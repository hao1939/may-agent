# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 3982)

- Operation: `waiting_with_evidence`
- Alert id: `3982`
- Metric id: `aks-rp-e2e.process.unpublished-change-count`
- Judged at: `2026-07-16T21:50:00Z`

## Why the breach is still real now

The live metric row still shows `current=2`, and a fresh direct recompute from the metric source also returns `2`.

### Runtime metric row

```sql
SELECT id, current, threshold, target, priority, updated_at
FROM metrics
WHERE id = 'aks-rp-e2e.process.unpublished-change-count';
-- current = 2
-- threshold = 0
-- target = 0
-- priority = P0
```

### Fresh recompute

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count --json
# {"measuredAt":1784238546300,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":2}
```

### Current repo truth

```bash
cd /app/projects/aks-rp-e2e && git status --short
#  M features/rp-cluster-lifecycle/specs/rp-cluster-lifecycle-stop-start.json
#  M features/rp-cluster-lifecycle/specs/rp-nodeless-cluster-crud.json
```

There are no current local-only commits on this branch tip; the current breach is the exact two-file dirty spec slice.

## Current contributors are already represented by live review-gated lineage

The two dirty files are exactly the same two files modified by the just-completed domain session `s_task_reconcile-spec-loop-pending-rp-cluster-lifecycle__reconcile-spec-loop-pending-rp-cluster-lifecycle_20260716212851`:

- `features/rp-cluster-lifecycle/specs/rp-cluster-lifecycle-stop-start.json`
- `features/rp-cluster-lifecycle/specs/rp-nodeless-cluster-crud.json`

That session updated the stop-start spec to a verified pass after accepted Azure DevOps run `172481901`, updated the nodeless spec from stale capacity-wait wording to exact rerun-ready wording after same-surface westus2 capacity recovery, and also rewrote app-owned spec-loop state for those same carriers.

Primary-source proof from `/app/projects/aks-rp-e2e.app/agents/owner/last-session.md`:

- session status: `success`
- modified files: exactly those two spec JSONs plus `../aks-rp-e2e.app/.state/spec-loop/state.json`
- summary: "Reconciled the rp-cluster-lifecycle pending spec-loop family by normalizing stop-start to verified pass, reclassifying nodeless as an exact rerun-ready repaired carrier after same-surface capacity recovery..."

The live task tree now already carries one exact publication wait for this slice:

- task id: `domain/hold-rp-cluster-lifecycle-publication-review-gate-20260716`
- state: `blocked`
- owner: `aks-explorer`

Its blocker states:

> Current unpublished-change-count=2 comes from the exact two modified rp-cluster-lifecycle spec JSON files. Fresh app-root domain:checkpoint shows both files are held by live review leaf `reconcile-spec-loop-pending-rp-cluster-lifecycle`, with no separate publication carrier yet. Keep this family-level publication holder blocked until the reviewer emits the structured publication-safe decision for that exact review leaf or an exact successor wait replaces this holder.

So this is not an orphaned or invisible residue anymore. The breach is real, but it is already represented by a live review leaf plus an exact publication gate.

## Why this is not `fix_root_cause`, `resolve_stale`, or `calibrate_metric`

- **Not `fix_root_cause`**: pushing or discarding these domain spec changes before the pending review returns would bypass the exact live review/publication gate already installed for this slice.
- **Not `resolve_stale`**: both the live metric row and fresh recompute are still `2`.
- **Not `calibrate_metric`**: threshold `0` remains correct because these local domain-repo changes are not yet pipeline-visible.
- **Not `upgrade_or_escalate`**: the alert is already P0, there is a safe owner path in flight, and no destructive/human-only action is currently required.

## Why the final operation is `waiting_with_evidence`

`waiting_with_evidence` is the smallest truthful operation because:

1. the breach is still real now (`2`);
2. the two-file slice is exact and bounded;
3. the slice is already attached to a live review leaf (`reconcile-spec-loop-pending-rp-cluster-lifecycle` in `review`);
4. the project already has a live publication gate (`domain/hold-rp-cluster-lifecycle-publication-review-gate-20260716`) with resume and fallback conditions; and
5. app-ops should not ad hoc publish or discard domain-repo review-held content while that exact gate is pending.

This memo therefore records alert 3982 as a represented live wait, not as an unowned publication gap.

## Next validation

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`, or sooner if one of these happens first:

1. `reconcile-spec-loop-pending-rp-cluster-lifecycle` receives a review decision that is publication-safe;
2. `domain/hold-rp-cluster-lifecycle-publication-review-gate-20260716` is replaced by a sharper exact successor; or
3. the two spec JSON files are published or cleared and the direct recompute drops below the threshold.
