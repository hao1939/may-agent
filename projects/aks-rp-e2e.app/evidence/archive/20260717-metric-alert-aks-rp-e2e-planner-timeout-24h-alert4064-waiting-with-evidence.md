# Metric alert judgment — `aks-rp-e2e.planner.timeout-24h` (alert 4064)

## Decision
- Operation: `waiting_with_evidence`
- Judged at: `2026-07-17T21:46:50Z`
- Metric owner: `app-ops`
- Alert id: `4064`

## Why this alert is real now
The metric is still breaching in current runtime state:

- `metrics.current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P1`
- direct recompute from the registered source command still returns `1`:
  - `bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.planner.timeout-24h --json`
  - output at triage time: `{"measuredAt":1784323346951,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1}`

Recent snapshots show the new breach is current, not stale residue from the earlier 2026-07-16 prompt-budget lineage:

- `2026-07-17T20:48:38Z` → `0`
- `2026-07-17T20:53:54Z` → `1`
- `2026-07-17T20:59:22Z` → `1`
- `2026-07-17T21:04:34Z` → `1`
- `2026-07-17T21:09:39Z` → `1`
- `2026-07-17T21:14:39Z` → `1`

## Exact contributor and attribution judgment
The metric implementation counts trailing-24h `planner_wake` rows that both:

1. touch owner steps (`event-review` or `planning-update`), and
2. have `result` text containing `timed out after`.

In `projects/aks-rp-e2e.app/scripts/project-metrics.ts`, that is the `plannerTimeoutCount24h()` path driven by `plannerTouchesOwnerSteps()` + `plannerTimedOut()`.

Current contributor set for this breach is exactly one planner-run row:

- planner-run row timestamp: `2026-07-17T20:52:10.102Z`
- `steps = ["event-review", "planning-update"]`
- `result = "Agent step \"app-ops\" timed out after 360000ms"`
- active task ids included:
  - `ops/recover-serverless-shared-subnet-authorization-owner-return-overdue-20260717`
  - `domain/fix-forward-rp-agentpool-delete-ignore-pdb-system-pool-taint-write-run-172734021-20260717`

However, the underlying timed-out lineage is not a distinct new planner-root-cause family. The directly timed-out session was the app-ops task-worker session:

- `s_task_ops_recover-serverless-shared-subnet-authorization-owner-return-overdue-20260717_ubnet-authorization-owner-return-overdue-20260717_20260717204425`
- `source = workflow:task-worker`
- `status = error`
- `error = Request timed out.`

The nearby planner planning-update session was only interrupted after that child timeout:

- `s_project_planner_planning_update_20260717204523_p7jn47`
- `status = interrupted`
- `error = Request was aborted.`

So the breach is **substantively real** but **operator-facing attribution is indirect**: the metric points first to the planner wake row, while the actual failed lineage is the shared-subnet owner-return worker.

## Why `waiting_with_evidence` is the right operation
A truthful exact carrier already exists and was refreshed in place after the timed-out worker attempt. The live blocked holder is:

- `wait-serverless-virtual-nodes-shared-subnet-authorization-family-20260703`
- `state = blocked`
- `owner = aks-explorer`
- `blocker.category = external-wait`
- `blocker.owner = human`
- `trace.blocked_wait_refreshed_at = 2026-07-17T20:56:47.770Z`
- `blocker.next_check_at = 2026-07-18T18:00:00Z`
- `blocker.resume_at = 2026-07-18T18:00:00Z`
- `blocker.fallback_at = 2026-07-19T18:00:00Z`

That holder explicitly covers the shared create-time subnet authorization blocker for:

- `spec.serverless-virtual-nodes.addonv2-aci-connector`
- `spec.serverless-virtual-nodes.virtual-node-addon`
- `spec.network-cni.vm-prerelease-overlay-cilium-dualstack`

The refreshed blocker text says the same-surface `LinkedAuthorizationFailed` on `Microsoft.Network/virtualNetworks/subnets/join/action` remains unchanged and that unchanged reruns should not proceed until reviewed authorization-surface evidence changes.

That means this alert does **not** require:

- a duplicate planner-timeout repair lane,
- a metric threshold change,
- a stale resolve, or
- a human emergency escalation.

The concrete state change that already happened on the owning lineage is the in-place refresh of the exact blocked wait, with next observation and fallback timestamps recorded. The truthful alert judgment is to keep waiting on that evidence-backed holder while tracking the timeout metric separately.

## What would make this stop being a wait case
This judgment should be replaced if either of these becomes true:

1. a new `planner_wake` timeout contributor lands after `2026-07-17T20:52:10.102Z`; or
2. the metric remains `> 0` after the current counted row ages out of the trailing 24h window.

If either happens, this becomes a new repair/escalation family rather than the current carried wait.

## Next validation
Primary metric validation: first `metrics-snapshot` after `2026-07-18T20:52:10.102Z`, when the single current timeout contributor should age out if no new timeout rows appear.

Secondary lineage validation already recorded on the live holder:

- next blocked-holder review: `2026-07-18T18:00:00Z`
- fallback review: `2026-07-19T18:00:00Z`

## Evidence used
- Runtime DB `metrics` row for `aks-rp-e2e.planner.timeout-24h` → `current=1`, `priority=P1`, `updated_at=1784322895444`
- Runtime DB recent `metric_snapshots` showing `0 -> 1` transition at `2026-07-17T20:53:54Z`
- Direct metric recompute command returning `value: 1`
- `projects/aks-rp-e2e.app/scripts/project-metrics.ts` readback showing `plannerTimedOut()` + `plannerTimeoutCount24h()` logic
- Existing attribution memo `evidence/archive/ops-repair-planner-timeout-metric-attribution-20260717.md`
- Live task-tree show output for `wait-serverless-virtual-nodes-shared-subnet-authorization-family-20260703` confirming refreshed blocked-wait timestamps and exact wait contract
