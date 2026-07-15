# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 3658)

## Chosen operation

`resolve_stale`

## Why this alert is stale

The persisted runtime metric row still says `current=1`, but the live source of truth no longer breaches:

- `SELECT ... FROM metrics WHERE id='aks-rp-e2e.process.unpublished-change-count'` returned `current=1`, `updated_at=1784028346601`.
- `cd /app/projects/aks-rp-e2e && git status --porcelain=v1 --branch` returned only `## dev...origin/dev` with no dirty paths and no `[ahead N]` marker.
- `cd /app/projects/aks-rp-e2e.app && bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count --json` returned `{"value":0}`.

The metric definition explicitly says this metric measures unpublished changes in the **domain repo** `/app/projects/aks-rp-e2e`, not the app repo. The domain repo is currently clean and not ahead of origin, so the live breach condition is gone.

## Safe action taken

I used the documented safe runtime control shortcut to request a fresh sampler run:

- `cd /app && may-agent --emit trigger.metrics-snapshot '{}'`
- `cd /app && DAEMON_INSTANCE=background may-agent --emit trigger.metrics-snapshot '{}'`

Both commands reported `Event emitted: trigger.metrics-snapshot`.

## Remaining gap

This session has no direct runtime write tool for `metrics` / `metric_alerts`, and the persisted row had not yet caught up at the time of verification:

- `metrics.current` still read `1`
- open alert `3658` still had `resolved_at = null`

So the truthful judgment is that the alert is stale relative to the live repo state, and recovery should be confirmed by the next successful `metrics-snapshot` refresh.

## Next validation

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`.
Recovery is confirmed when:

1. `metrics.current` updates from `1` to `0`, and
2. alert `3658` gains `resolved_at` or disappears from the open-alert query.
