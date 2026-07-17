# Metric alert triage — `aks-rp-e2e.task.no-work-with-gaps` (alert 3894)

- Alert id: `3894`
- Metric id: `aks-rp-e2e.task.no-work-with-gaps`
- Judged at: `2026-07-16T00:37:50Z`
- Chosen operation: `resolve_stale`

## Current judgment

Alert `3894` is stale now.

The alert opened on a real sampled breach (`current=1`), but the persisted metric row has already recovered to `current=0`, a fresh owner-side recompute also returns `0`, and the current project frontier already has active executable work. The remaining problem is the still-open alert lifecycle row, not a live no-work condition.

## Evidence checked

### 1. The alert opened on a transient sampled breach

Runtime alert row:

```json
{"id":3894,"metric_id":"aks-rp-e2e.task.no-work-with-gaps","alert_type":"consecutive_failures","message":"AKS RP E2E no executable work while verification gaps remain is above threshold: current=1, threshold=0, target=0","resolved_at":null,"created_at":1784175093924}
```

### 2. The persisted metric has already recovered

Runtime metric row now shows:

```json
{"id":"aks-rp-e2e.task.no-work-with-gaps","current":0,"updated_at":1784175695047}
```

Latest sampled snapshots confirm recovery after the alert-opening samples:

```json
[
  {"value":0,"measured_at":1784175695047,"measured_by":"agent:may"},
  {"value":1,"measured_at":1784175367606,"measured_by":"agent:may"},
  {"value":1,"measured_at":1784175040274,"measured_by":"agent:may"}
]
```

### 3. A fresh owner-side recompute is healthy

I reran the registered source command directly:

```bash
cd /app/projects/aks-rp-e2e.app && bun ./scripts/project-metrics.ts aks-rp-e2e.task.no-work-with-gaps
```

Result:

```text
0
```

### 4. The current frontier already has executable work

Current task-tree frontier:

```json
{
  "runnable": [],
  "waiting": [],
  "active": [
    "domain/author-egress-lockdown-windows-baseline-20260716",
    "fix-network-acns-retina-enterprise-run-172450674",
    "ops-apply-repair-overdue-review-wait-escalation-resume-closure-20260716-state-repair",
    "ops-apply-retry-project-root-frontier-review-parity-after-auth-expiry-20260716-task-tree-followup",
    "wait-traffic-api-proxy-enable-lifecycle-ado-run-172463356-result"
  ]
}
```

So the project does not currently satisfy a truthful "no executable work" condition.

### 5. I attempted the supported refresh path, but the stale alert row remained open

I emitted the safe control-plane refresh twice:

```bash
cd /app && may-agent --emit trigger.metrics-snapshot '{}'
cd /app && DAEMON_INSTANCE=background may-agent --emit trigger.metrics-snapshot '{}'
```

Both commands returned:

```text
Event emitted: trigger.metrics-snapshot
```

After that, alert `3894` still had `resolved_at = null` while the metric row remained at `current = 0`.

## Why `resolve_stale`

The currently authoritative metric state is already back in range, the source command agrees, and the project frontier has active work in progress. There is no live owner-side starvation defect left to fix.

This triage environment still does not provide a safe runtime write path to edit `metric_alerts` directly, so the concrete action available here is to record the stale-state judgment durably and let the next safe metrics/alert lifecycle step reconcile alert `3894`.

## Next validation signal

Validate on the next `metrics-snapshot` / alert recovery cycle for `aks-rp-e2e.task.no-work-with-gaps`.

Expected result: the metric stays at `0` and alert `3894` clears as recovered.
