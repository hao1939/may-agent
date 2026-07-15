# Metric alert triage — fix_root_cause — `aks-rp-e2e.task.no-work-with-gaps`

- Alert id: `3736`
- Metric id: `aks-rp-e2e.task.no-work-with-gaps`
- Triage time: `2026-07-14T23:21Z`
- Owner: `app-ops`
- Chosen operation: `fix_root_cause`

## Judgment

This was a **real current no-work breach**, not a stale alert row.

At triage time the live owner-side sampler still returned `value=1`, and the
frontier had fallen to a single review leaf with no runnable or active work.
That is exactly the condition this metric is meant to catch: verification gaps
still exist, but app-ops had allowed the project to drain into review-only
residue.

The safe owner fix was to convert the review-only residue into concrete
executable work:

1. accept the completed review leaf that audited the managedNATGatewayV2 BYO
   family, and
2. create one runnable apply task that turns that accepted review into live
   task-tree mutation work.

## Baseline evidence

Before repair:

- `bun run ./scripts/project-metrics.ts aks-rp-e2e.task.no-work-with-gaps --json`
  returned `{"value":1}`.
- `bun run task-tree frontier aks-rp-e2e` showed:
  - `runnable: []`
  - `active: []`
  - `review: ["ops/reconcile-spec-final-disposition-frontier-20260714"]`

That proved the breach was live: the project had open gaps but no executable
frontier.

## Repair applied

Used supported task-tree mutations only.

### 1) Created a runnable apply task

Added:

- `ops/apply-net-integration-managednatgatewayv2-terminal-retirement-20260714`

Purpose:

- retire `wait-spec-net-integration-managednatgatewayv2-byo-request-shape-support-20260702`
  if the maintained terminal product-gap evidence still holds; and
- refresh `hold-compact-net-integration-package-partial-frontier` so compact
  lineage stops naming the retired managedNATGatewayV2 frontier member.

This restored executable backlog instead of leaving the accepted review parked
in `review` state.

### 2) Closed the review-only residue leaf

Marked done/replaced:

- `ops/reconcile-spec-final-disposition-frontier-20260714`

Review summary recorded:

> Accepted the managedNATGatewayV2 BYO final-disposition review and replaced
> this review-only residue with runnable apply task
> `ops/apply-net-integration-managednatgatewayv2-terminal-retirement-20260714`
> so the review can be folded into live task-tree mutations instead of leaving
> the project with no executable work.

## Post-repair verification

After the task-tree repair:

- `bun run ./scripts/project-metrics.ts aks-rp-e2e.task.no-work-with-gaps --json`
  returned `{"value":0}`.
- `bun run task-tree frontier aks-rp-e2e` now shows:
  - `runnable: ["ops/apply-net-integration-managednatgatewayv2-terminal-retirement-20260714"]`
  - `review: []`
  - `active: []`

`bun run task-tree summary` also shows `backlog: 1` and no review frontier.

## Why this is fix_root_cause

The root cause of this alert was not a bad threshold or stale metric row. It
was the app allowing a real project frontier to collapse into review-only state
while verification gaps remained. Converting that residue into a runnable apply
step restored truthful executable work immediately, which is the direct process
fix this P0 metric expects.

## Next validation

The next `metrics-snapshot` should persist the healthy state by moving the
runtime metric row from `current=1` to `current=0` and naturally recovering
alert `3736`. The runnable apply task should then either complete the
managedNATGatewayV2 retirement/holder refresh or be replaced by an equally
truthful successor without letting the frontier drain back to review-only.
