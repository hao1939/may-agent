# Metric alert triage — `aks-rp-e2e.process.task.review-not-applied-count` (alert 4003)

- Alert id: `4003`
- Metric id: `aks-rp-e2e.process.task.review-not-applied-count`
- Chosen operation: `fix_root_cause`
- Judged at: `2026-07-17T04:52:45Z`

## Baseline

Live recompute before repair:

```json
{"measuredAt":1784263848709,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1,"sampleSize":1,"note":"{\"reviews\":[{\"taskId\":\"domain/reconcile-rp-cluster-lifecycle-stop-start-overdue-holder-20260717\",\"attemptId\":\"a_domain_reconcile-rp-cluster-lifecycle-stop-start-overdue-holder-20260717_20260717041927\",\"decision\":\"accept\",\"reviewedAt\":\"2026-07-17T04:26:06.239Z\"}]}"}
```

The breach was real:

1. `metrics.current` still read `1` for this metric and open alert `4003` was unresolved.
2. The latest snapshot note named exactly one contributor: `domain/reconcile-rp-cluster-lifecycle-stop-start-overdue-holder-20260717` attempt `a_domain_reconcile-rp-cluster-lifecycle-stop-start-overdue-holder-20260717_20260717041927` with accepted review.
3. `bun run task-tree show domain/reconcile-rp-cluster-lifecycle-stop-start-overdue-holder-20260717` still showed the task in `state = review` before repair.

## Root cause

The reviewer had already accepted the reconciliation memo, but owner review application never closed the memo leaf or the now-obsolete compact holder it proved was superseded.

The accepted memo at `../aks-rp-e2e/evidence/archive/reconcile-rp-cluster-lifecycle-stop-start-overdue-holder-20260717.md` established two facts together:

- historical run `171798563` still lacks app-visible artifacts and the shared-auth return is still absent; but
- the live stop-start branch is already superseded by accepted same-spec pass run `172481901`, so `hold-compact-rp-cluster-lifecycle-split-frontier-20260711` should no longer remain the live frontier.

So the remaining `review-not-applied` debt was an owner-application gap, not an unresolved domain question.

## Applied root-cause repair

I used the supported task-tree control plane, not manual file edits:

1. Closed the accepted review leaf:

```bash
cd /app/projects/aks-rp-e2e.app && \
  bun run task-tree mark-done domain/reconcile-rp-cluster-lifecycle-stop-start-overdue-holder-20260717 \
    --task-revision 0 \
    --attempt-id a_domain_reconcile-rp-cluster-lifecycle-stop-start-overdue-holder-20260717_20260717041927 \
    --summary "Accepted reconciliation memo proved the old run-171798563 shared-auth holder is superseded for stop-start classification by accepted pass run 172481901, so the review task is complete and no further review apply is needed on this memo leaf." \
    --review-decision accept
```

2. Retired the stale compact holder that the accepted memo proved was no longer truthful:

```bash
cd /app/projects/aks-rp-e2e.app && \
  bun run task-tree mark-done hold-compact-rp-cluster-lifecycle-split-frontier-20260711 \
    --task-revision 2 \
    --resolution replaced \
    --summary "Superseded by accepted same-spec pass wait-rp-cluster-lifecycle-stop-start-ado-run-172481901-result: run 171798563 still lacks app-visible artifacts and shared-auth return, but stop-start classification is already resolved by reviewed pass run 172481901, so this dependent compact holder should not remain the live frontier."
```

## Post-repair validation

Live recompute after repair:

```json
{"measuredAt":1784263971760,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"reviews\":[]}"}
```

Post-repair task-tree checks:

- `domain/reconcile-rp-cluster-lifecycle-stop-start-overdue-holder-20260717` is now `state = done`, `resolution = completed`, with `trace.review_summary` recording the accepted supersession reasoning.
- `hold-compact-rp-cluster-lifecycle-split-frontier-20260711` is now `state = done`, `resolution = replaced`, with `trace.review_summary` naming `wait-rp-cluster-lifecycle-stop-start-ado-run-172481901-result` as the controlling same-spec pass.
- The DB metric row and open alert may remain stale until the next runtime `metrics-snapshot`, but the source-of-truth recompute is already back to `0`.

## Judgment

Choosing `fix_root_cause` because the alert represented one real accepted review stranded in `state = review`, and the supported owner apply path safely closed both the review leaf and its obsolete compact holder until a fresh metric recompute returned `0`.
