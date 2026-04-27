# Design: Health Metrics

**Status**: implemented
**Date**: 2026-04-27
**Source**: `agents/may/handlers/metrics-snapshot.ts`

## Pipeline

```
events table (handler.started/completed/failed, project.*)
projects table (status, updated_at)
  → metrics-snapshot handler (every 5min)
    → metrics table (current value, alert_op, threshold)
    → metric_snapshots table (time series for graphs)
      → web UI dashboard (alerts + sparkline graphs)
```

## alert_op

- `<` — fires when `current < threshold` (value is too low)
- `>` — fires when `current > threshold` (value is too high)

## Metrics

### Handler Health

| ID | What | Window | Target | Threshold | alert_op |
|----|------|--------|--------|-----------|----------|
| handler.completed-count | Handler completions | 6h | 50 | 10 | < |
| handler.failed-count | Handler failures | 6h | 0 | 3 | > |
| handler.success-rate | completed / (completed + failed) | 6h | 0.95 | 0.80 | < |
| handler.heartbeat-coverage | Unique agents with heartbeat | 2h | 8 | 6 | < |
| handler.p95-duration | 95th percentile duration (ms) | 6h | 120000 | 600000 | > |
| handler.fires-per-hour | handler.started count | 1h | 30 | 15 | < |

### Project Health

| ID | What | Window | Target | Threshold | alert_op |
|----|------|--------|--------|-----------|----------|
| project.active-count | Projects with status=active | — | 3 | 1 | < |
| project.blocked-count | Projects with status blocked/waiting | — | 0 | 2 | > |
| project.stale-active-count | Active with no iteration event | 48h | 0 | 2 | > |
| project.iterations-24h | project.iteration events | 24h | 10 | 0* | < |
| project.blocked-rate-7d | blocked / (blocked + productive) | 7d | 0.10 | 0.30 | > |
| project.blocked-over-6h | Blocked/waiting with no update | 6h | 0 | 1 | > |

*Threshold 0 = disabled until project.iteration events are emitted by workflows.

## Events (inputs)

Emitted by `src/app/cron.ts` fireHandler():
```
handler.started   { handler, agent }
handler.completed { handler, agent, durationMs }
handler.failed    { handler, agent, error, durationMs }
```

Emitted by project workflows (TODO: project.iteration not yet emitted):
```
project.iteration { projectId }
project.blocked   { projectId }
project.completed { projectId }
```

## Generic metrics

Metrics with `source_query` or `source_command` set are measured automatically — the handler executes the query/command and records the result. This is for user-defined metrics outside the hardcoded set.
