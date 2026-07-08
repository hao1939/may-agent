# Metric alert triage — waiting_with_evidence — `aks-rp-e2e.task.stale-active-with-gaps`

- Alert id: `3143`
- Metric: `aks-rp-e2e.task.stale-active-with-gaps`
- Triage time: `2026-07-08T02:41Z`
- Chosen operation: `waiting_with_evidence`

## Why this is not a fresh active outage

The runtime `metrics` row and open `metric_alerts` row still show a breach:

- `metrics.current = 1`, `threshold = 0`, `target = 0`, `priority = P0`
- open alert row `3143` remains unresolved

But an immediate local recompute from the app source of truth already returns the metric to in-range:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.task.stale-active-with-gaps --json
{"measuredAt":1783514405781,"value":0}
```

That recompute matches current task-tree frontier state:

- frontier shows no runnable backlog starvation caused by stale active leaves
- task-tree summary reports `counts.active = 12` and `frontier.active` contains only currently represented loop roots and worker leaves
- the task-tree metric implementation still defines this metric as `1` only when `tasks.activeStale > 0 && openGaps > 0`

## Judgment

This looks like a transient/stale alert lifecycle issue rather than a currently-breaching stuck frontier:

1. latest stored snapshot sampled `1`
2. fresh recompute sampled `0`
3. open alert row has not yet been cleared
4. current environment does not provide a safe runtime write path to resolve `metric_alerts` manually

## Deliberate acceptance

I am accepting a short wait for the next runtime metric validator instead of forcing unsafe DB edits.

Expected validator:

- next `metrics-snapshot` (or next owner-triggered metric sample persisted by runtime)

Expected outcome:

- `aks-rp-e2e.task.stale-active-with-gaps` should move from stored `current=1` to `0`
- alert `3143` should then resolve through the normal runtime closure path

If a later persisted snapshot still reports `1`, treat that as renewed evidence of a real stale-active regression or measurement/persistence lag requiring app-side repair.
