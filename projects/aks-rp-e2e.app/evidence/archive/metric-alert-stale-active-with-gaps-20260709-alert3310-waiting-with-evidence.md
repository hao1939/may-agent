# Metric alert triage — `waiting_with_evidence` — `aks-rp-e2e.task.stale-active-with-gaps`

- Alert id: `3310`
- Metric id: `aks-rp-e2e.task.stale-active-with-gaps`
- Triage time: `2026-07-09T11:43:09Z`
- Chosen operation: `waiting_with_evidence`

## Why this alert is being treated as stale and waiting for lifecycle closure

Fresh runtime state now shows the metric itself has already recovered, but the alert row is still open:

- `metrics.current = 0`
- `threshold = 0`
- `target = 0`
- `metrics.updated_at = 1783639321875`
- open `metric_alerts` row `3310` still has `resolved_at = null`

Fresh owner-side validation matches that recovered metric state:

- `cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.task.stale-active-with-gaps` returned `0`
- `cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-health.ts --json --lookback-minutes 60` reported `"staleActiveTaskIds": []`
- the same health snapshot still shows active and review frontier movement, so verification gaps remain but there is no current stale active leaf to repair

## Current theory

This looks like alert-lifecycle / persisted-metric lag, not a fresh root-cause break:

1. The open alert was created from the persisted sample at `1783639014192` with `value = 1`.
2. Fresh owner-side recompute now returns `0`.
3. The live health snapshot shows the project is in `attention`, not `stalled`, with active frontier items and no stale-active task ids.

## Why not another final operation

I am **not** choosing `fix_root_cause` because there is no current stale-active leaf left to repair safely.

I am **not** choosing `resolve_stale` because this triage environment only provides read-only runtime DB access, so there is no safe write path to mutate `metric_alerts` directly.

## Concrete evidence accepted now

The durable change from this session is this evidence note recording that alert `3310` is being judged as recovered in the live source state and is now waiting for the next supported runtime validation signal.

## Next validation

Accept the next `metrics-snapshot` / alert refresh cycle as the validator.

Expected result:

- metric `aks-rp-e2e.task.stale-active-with-gaps` persists from stored `current = 1` to `0`
- alert `3310` resolves through the normal runtime recovery path

If the next persisted snapshot still reports `1`, re-open this as a real metric-state-sync or measurement regression because the current source command and health snapshot already show no stale active task ids.
