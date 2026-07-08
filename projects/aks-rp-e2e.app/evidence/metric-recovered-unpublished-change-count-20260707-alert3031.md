# Metric recovery review — `aks-rp-e2e.process.unpublished-change-count` (alert 3031)

- Alert id: `3031`
- Event type: `metric.recovered`
- Metric id: `aks-rp-e2e.process.unpublished-change-count`
- Judged at: `2026-07-07T13:13:10Z`
- Chosen operation: `no_change_needed`

## Recovery assessment

This recovery does **not** require a new task-tree repair, metric-definition change, or owner-context update.

The current state is internally consistent:

- the recovery event reports `current = 0`
- a fresh direct repo check in `/app/projects/aks-rp-e2e` shows branch `dev...origin/dev` with no dirty tracked paths and no `[ahead N]` marker
- `git rev-parse HEAD` in the domain repo matches `origin/dev` at `b2fa0a53e9ebe31f80bde947632fc23a91f8681f`
- the metric sampler implementation in `scripts/project-metrics.ts` still matches the intended rule: count tracked dirty paths plus any branch-ahead marker from `git status --porcelain=v1 --branch`

## Why no project/task-tree change is useful now

Earlier same-day triage already captured the real breach and the reason it was safe to wait:

- `evidence/metric-alert-unpublished-change-count-20260707-alert3031.md`

The live task tree already carries the durable project-level meaning of this recovery in the root rollup/archive history:

- `tasks/tree.json` records the 2026-07-06 `metric.recovered` unpublished-change event as a resolved hygiene-clear event, not a new work branch

Because the domain repo is now clean and in sync with `origin/dev`, the recovered event is best interpreted as confirmation that the earlier compact-summary residue was cleared by normal owner work rather than evidence of a sampler bug or missing holder task.

## Decision

Leave the project/task tree and metric definition unchanged.

- No unpublished domain-repo git changes currently remain
- The metric definition in `scripts/register-project-metrics.ts` still matches the intended process signal
- No new owner memory/context is needed because this is a normal recovery after a documented same-day breach

## Next validation trigger

Only act again if a future nonzero sample appears, or if a future breach is reported while fresh direct `git status --porcelain=v1 --branch` in `/app/projects/aks-rp-e2e` still shows zero dirty paths and no ahead count, which would indicate measurement drift instead of real unpublished repo state.
