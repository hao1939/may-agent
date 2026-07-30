# Metric alert triage — resolve_stale — `aks-rp-e2e.process.unowned-work-count`

- Alert id: `4275`
- Metric id: `aks-rp-e2e.process.unowned-work-count`
- Owner: `app-ops`
- Priority: `P0`
- Judged at: `2026-07-30T04:30:59Z`
- Chosen operation: `resolve_stale`

## Judgment

Alert `4275` was real at sampling time but is stale by triage time.

The persisted metric row and open alert still show the breaching snapshot from `2026-07-30T04:23:35Z` (`current=1`), but a fresh owner-side recompute now returns `0` with no contributors. The exact contributor named in the stored snapshot was workflow run `wr_1785385103679_0gr6` for `spec-live-reconciliation` with restart reason `workflow-no-session`; that workflow run now has an attached live `aks-explorer` session `s_1785385477773_447`, so the current live state no longer represents unfinished work without an active owner.

## Evidence checked

### 1. Persisted metric state is still breaching

Runtime DB still shows:

- `metrics.current = 1`
- `metrics.threshold = 0`
- `metrics.target = 0`
- `metrics.priority = P0`
- `metrics.updated_at = 1785385412964` (`2026-07-30T04:23:32.964Z`)
- open alert `metric_alerts.id = 4275` with `resolved_at = null`

The latest stored breaching snapshot cites one contributor:

- `staleWorkflowRuns = [{"runId":"wr_1785385103679_0gr6","workflow":"spec-live-reconciliation","restartReason":"workflow-no-session"}]`

### 2. Fresh live recompute is healthy now

A fresh owner-side metric sample now returns zero contributors:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json
```

Result:

```json
{"measuredAt":1785385853704,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-30T04:30:59.676Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

### 3. The cited workflow run now has an active owner session

Current runtime DB rows for workflow run `wr_1785385103679_0gr6` now show:

- `workflow = "spec-live-reconciliation"`
- `status = "running"`
- attached session `s_1785385477773_447`
- attached session `agent = "aks-explorer"`
- attached session `status = "running"`
- attached session `lastActivityAt = 1785385864045`

So the exact stale workflow-no-session condition from the alert snapshot is no longer present. The workflow run is now actively owned by a running `aks-explorer` session rather than sitting unowned.

## Why `resolve_stale`

There is no current unowned-work contributor left for app-ops to repair safely in this session. The breach came from a transient workflow/session gap that had already recovered by the time of triage. The current authoritative metric source is already back in range (`0`), so the still-open alert row is lagging current reality.

This workflow does not provide a safe runtime write path to resolve `metric_alerts` directly, so the concrete action here is to record the stale-state judgment durably and let the next metrics snapshot / alert lifecycle close the row normally.

## Next validation

Validate on the next `metrics-snapshot` / alert recovery cycle for `aks-rp-e2e.process.unowned-work-count`.

Expected result:

- persisted `metrics.current` updates from `1` to `0`, and
- alert `4275` resolves automatically.
