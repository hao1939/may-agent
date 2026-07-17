# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.unowned-work-count`

- Alert id: `3840`
- Metric id: `aks-rp-e2e.process.unowned-work-count`
- Judged at: `2026-07-15T15:03:00Z`
- Chosen operation: `fix_root_cause`

## Why this was a real breach

The latest stored sampled breach was still live when I re-ran the metric locally:

```json
{"measuredAt":1784127556661,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":2,"sampleSize":2,"note":"{\"sampledAt\":\"2026-07-15T14:59:16.852Z\",\"staleActiveTaskIds\":[\"fix-network-acns-retina-enterprise-update-acns-cilium-run-172310203\",\"fix-network-cni-azure-overlay-dual-stack-windows2022-run-172310203\"],\"staleActiveTaskSessions\":[{\"taskId\":\"fix-network-acns-retina-enterprise-update-acns-cilium-run-172310203\",\"sessionId\":\"s_task_fix-network-acns-retina-enterprise-update-acns-cilium-run-172310203_etina-enterprise-update-acns-cilium-run-172310203_20260715140902\",\"restartReason\":\"session-no-activity\"},{\"taskId\":\"fix-network-cni-azure-overlay-dual-stack-windows2022-run-172310203\",\"sessionId\":\"s_task_fix-network-cni-azure-overlay-dual-stack-windows2022-run-172310203_zure-overlay-dual-stack-windows2022-run-172310203_20260715140903\",\"restartReason\":\"session-no-activity\"}],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

Both contributors were active fix-forward leaves owned by `aks-explorer`, but their bound worker sessions were stale with `restartReason = session-no-activity`.

## Fix applied

I used the supported task-tree control-plane operation to reclaim both stale active slots and force fresh worker sessions:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree requeue-active fix-network-acns-retina-enterprise-update-acns-cilium-run-172310203 --reason "metric-alert unowned-work-count alert3840: task-worker session-no-activity beyond 10m; reclaim stale active slot for fresh truthful retry" --fresh-session
cd /app/projects/aks-rp-e2e.app && bun run task-tree requeue-active fix-network-cni-azure-overlay-dual-stack-windows2022-run-172310203 --reason "metric-alert unowned-work-count alert3840: task-worker session-no-activity beyond 10m; reclaim stale active slot for fresh truthful retry" --fresh-session
```

Each command returned the exact task id it requeued.

The planner immediately refilled both reclaimed slots with fresh attempts:

- `fix-network-acns-retina-enterprise-update-acns-cilium-run-172310203`
  - `trace.stale_active_requeued_at = 2026-07-15T15:01:15.539Z`
  - `trace.previous_attempt_id = a_fix-network-acns-retina-enterprise-update-acns-cilium-run-172310203_20260715140902`
  - `trace.current_attempt_id = a_fix-network-acns-retina-enterprise-update-acns-cilium-run-172310203_20260715150122`
  - `session_id = s_task_fix-network-acns-retina-enterprise-update-acns-cilium-run-172310203_etina-enterprise-update-acns-cilium-run-172310203_20260715150122`
- `fix-network-cni-azure-overlay-dual-stack-windows2022-run-172310203`
  - `trace.stale_active_requeued_at = 2026-07-15T15:01:15.441Z`
  - `trace.previous_attempt_id = a_fix-network-cni-azure-overlay-dual-stack-windows2022-run-172310203_20260715140903`
  - `trace.current_attempt_id = a_fix-network-cni-azure-overlay-dual-stack-windows2022-run-172310203_20260715150122`
  - `session_id = s_task_fix-network-cni-azure-overlay-dual-stack-windows2022-run-172310203_zure-overlay-dual-stack-windows2022-run-172310203_20260715150122`

## Post-fix validation

Fresh runtime session rows now show live recent activity for both replacement sessions:

```json
{"sessionId":"s_task_fix-network-acns-retina-enterprise-update-acns-cilium-run-172310203_etina-enterprise-update-acns-cilium-run-172310203_20260715150122","status":"running","startedAt":1784127696124,"lastActivityAt":1784127784342,"endedAt":null}
{"sessionId":"s_task_fix-network-cni-azure-overlay-dual-stack-windows2022-run-172310203_zure-overlay-dual-stack-windows2022-run-172310203_20260715150122","status":"running","startedAt":1784127706388,"lastActivityAt":1784127780961,"endedAt":null}
```

A fresh recompute after the requeue/reassignment returns zero contributors:

```json
{"measuredAt":1784127698454,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-15T15:01:38.694Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

I also emitted `trigger.metrics-snapshot` from the control plane so the persisted metric row can catch up on the next measurement cycle:

```bash
cd /app && may-agent --emit trigger.metrics-snapshot '{}'
```

At the time of writing, the persisted `metrics.current=2` / open alert row still lag the live recompute, so the remaining validation signal is the next snapshot/recovery cycle rather than another process repair.

## Next validation signal

Use the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.unowned-work-count`. Recovery is confirmed when persisted `metrics.current` updates from `2` to `0` and alert `3840` resolves automatically.
