# Metric alert triage — aks-rp-e2e.process.unpublished-change-count (alert 2956)

- Alert id: `2956`
- Metric id: `aks-rp-e2e.process.unpublished-change-count`
- Judged at: `2026-07-07T04:41:28Z`
- Chosen operation: `resolve_stale`

## Current measurement

Direct checks during this triage show the open alert is stale rather than current:

- runtime metric sample via `bun scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count` in `/app/projects/aks-rp-e2e.app` returned `0`
- `git status --porcelain=v1 --branch` in `/app/projects/aks-rp-e2e` returned only `## dev...ado/dev`
- `git diff --name-only` in `/app/projects/aks-rp-e2e` returned no paths

The sampler implementation in `scripts/project-metrics.ts` counts one point per dirty status line plus any `[ahead N]` marker from the branch header. With no dirty lines and no ahead marker in the branch header, the live value is `0`.

## Why the alert is stale

The persisted metric/alert state still shows a previous breach:

- `metrics.current = 14`, `threshold = 0`, `updated_at = 1783419982597`
- open alert row `2956` says `current=14`
- the last snapshots oscillated between `14`, `6`, and `0`, so this metric can recover quickly as repo-local writebacks settle

But the current source-of-truth checks now show the project repo is clean enough for this metric's own implementation to report `0`. That means the open alert row is stale/recovered and should clear on the next runtime metrics refresh or manual safe alert-resolution path.

## Concrete state change made by this triage

This triage records the stale-resolution judgment in:

- `projects/aks-rp-e2e.app/evidence/metric-alert-unpublished-change-count-20260707-alert2956.md`

Because this workflow only has read-only runtime DB access, it does not directly edit `metric_alerts`. The durable judgment should therefore be validated by the next `metrics-snapshot` or by the steward resolving the stale alert through the safe runtime write path.

## Resume condition

Validate at the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`.

Expected result: metric remains `0` and alert `2956` can be treated as recovered/stale rather than a live P0 hygiene breach.
