# Metric alert triage — resolve_stale — `aks-rp-e2e.task.stale-active-with-gaps`

Date: 2026-07-18T23:31Z  
Alert id: `4149`  
Metric id: `aks-rp-e2e.task.stale-active-with-gaps`

## Judgment

Choose `resolve_stale` because the open alert still exists, but the runtime metric row and a fresh owner-side recompute both already show the signal recovered to `0`. There is no current stale active task for app-ops to repair; alert `4149` is now a stale lifecycle row waiting for the normal recovery/alert-close path to catch up.

## Evidence checked

### Persisted runtime state has already recovered

Runtime DB now shows:

- `metrics.current = 0`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `status = active`
- `updated_at = 1784417208989`

Recent snapshots for this metric show the breach cleared after the alert was created:

- `1784417208989 -> 0`
- `1784416908529 -> 1`
- `1784416607741 -> 1`
- `1784416308373 -> 1`

Open alert row still exists and is therefore stale relative to the current metric value:

- `metric_alerts.id = 4149`
- `resolved_at = null`
- `created_at = 1784416459495`

### Fresh metric-source recompute agrees there is no current breach

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.task.stale-active-with-gaps --json
# => {"measuredAt":1784417388126,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

Supporting signals agree the stale-active condition is absent now:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.task.stale-active-count --json
# => {"measuredAt":1784417431914,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json
# => value=0, sampleSize=0, staleActiveTaskIds=[]
```

## Why this is `resolve_stale`

- The alert measured a real breach earlier.
- The source of truth no longer shows that breach.
- The persisted runtime metric row has already moved back into range.
- What remains open is the alert lifecycle row, not an active stuck-work condition.

## Next validation

Accept the next normal metrics snapshot / alert recovery cycle as the validator.

Expected outcome:

- `aks-rp-e2e.task.stale-active-with-gaps` stays at `0`, and
- alert `4149` is cleared by the runtime recovery path.

If a later snapshot returns to `1`, re-triage as a new stale-active breach against the then-current active frontier instead of treating this alert row as the same incident.
