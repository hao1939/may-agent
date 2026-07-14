# Metric alert triage — `aks-rp-e2e.process.blocked.overdue-unworked-count` — alert `3549`

- Judged at: `2026-07-13T15:33:30Z`
- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Alert id: `3549`
- Chosen operation: `waiting_with_evidence`

## Judgment

This alert is real at the sampled instant, but it is already under active owner repair through the live project-planner wake that the breach triggered.

The persisted metric row still shows a breach (`current=9`), and the newest stored snapshot names nine overdue blocked waits. But current runtime evidence also shows two app-ops planner sessions now running for the same breach, with the live planner packet explicitly carrying `blockedOverdueCount = 9`, the same nine overdue task ids, and an instruction to treat the overdue blocked frontier before ordinary backlog refill.

That means the correct process state is not "unowned overdue waits with no active work" anymore. It is "overdue waits already handed to the authoritative planner mutation path, waiting for that in-flight repair wake and the next metrics refresh to confirm recovery or leave a smaller residual offender set."

I do not have the task-tree mutation tools or a safe runtime write path in this triage session, so starting a second overlapping repair or manually resolving the alert would be wrong. The truthful final operation is `waiting_with_evidence`.

## Evidence checked

### 1. Persisted metric row still shows the breach

`metrics` row for `aks-rp-e2e.process.blocked.overdue-unworked-count`:

- `current = 9`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1783956618435`
- `source_command = bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.process.blocked.overdue-unworked-count --json`

### 2. Latest persisted snapshot names the nine current offenders

Newest snapshot:

```json
{"value":9,"sample_size":9,"measured_at":1783956618435,"measured_by":"agent:may","note":"{\"offenderTaskIds\":[\"wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708\",\"hold-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260708\",\"hold-compact-aad-rbac-package-partial-frontier\",\"hold-compact-serverless-schedulerctrl-live-workflow-frontier\",\"hold-compact-cost-analysis-reviewed-exception-frontier\",\"hold-compact-upgrade-underlay-runtime-input-frontier-20260712\",\"ops/review-1530-shared-underlay-runtime-input-family-lineage-20260713b\",\"ops/review-1530-aad-rbac-compact-projection-trio-lineage-20260713b\",\"ops/wait-shared-azure-devops-auth-capable-runtime-provider-response-20260713\"]}"}
```

### 3. The authoritative planner repair wake is already running now

Current runtime `sessions` table shows two active app-ops planner sessions for this same metric-breach handling window:

- `s_project_planner_planning_update_20260713153022_gxkvlk` — `status = running`
- `s_project_planner_event_review_20260713153159_9qoap4` — `status = running`

These are project-scoped app-ops planner sessions, not unrelated background work.

### 4. The live planner packet carries the same overdue set and explicit recovery instruction

The running planner session payload includes:

- `metricId = aks-rp-e2e.process.blocked.overdue-unworked-count`
- `alertId = 3549`
- `blockedOverdueCount = 9`
- `overdueOwnerActionCount = 9`
- `instruction = "A blocked wait passed its next-check/resume/fallback window without active/review recovery or handoff work. Treat this before ordinary review/backlog refill: verify the wait, create recovery/handoff/escalation work, refresh it with new evidence and next check, or close a stale holder."`

It also lists the same nine `sampledOverdueTaskIds` as the persisted metric snapshot.

### 5. The design contract says the metric emits a planner signal; code does not mutate the task tree by itself

`design/project-observability.md` defines this metric as:

- `aks-rp-e2e.process.blocked.overdue-unworked-count` = `blocked waits passed fallback with no active recovery/handoff`

and states:

- metric breach does not mutate the task tree by itself;
- it emits `metric.breach`, which routes to the planner; and
- the consumer should decide the repair from current state.

That current-state consumer path is already active now.

## Why `waiting_with_evidence`

This is not `fix_root_cause` because the authoritative runtime fix path is the already-running planner wake, and this session does not have the task-tree mutation tools needed to safely perform a concurrent second repair.

This is not `resolve_stale` because the metric row is still truly breaching and the live planner packet independently confirms the same nine overdue waits.

This is not `upgrade_or_escalate` because the breach is already being handled at `P0` by app-ops, with a concrete planner repair wake in flight right now.

`waiting_with_evidence` is therefore the truthful operation: the alert is real, the owner has already started the bounded recovery path, and the next validation signal should come from planner mutation plus the next metrics refresh.

## Concrete action taken by this session

This session recorded the judgment in this evidence file and explicitly accepted one exact wait condition:

- **wait target:** completion of the in-flight app-ops planner repair wake for alert `3549`
- **owner:** `app-ops`
- **check method:** watch the running planner sessions and the next `metrics-snapshot` for recovery or a smaller residual offender set
- **fallback:** if the planner wake completes and the next sample still shows `>0`, reopen triage against the then-current offender ids instead of reusing the current snapshot blindly

## Next validation

Watch the next `metrics-snapshot` / persisted metric refresh for:

- `metrics.current = 0` on `aks-rp-e2e.process.blocked.overdue-unworked-count`, or
- a reduced/new offender set after planner-driven task-tree mutation if recovery is only partial.
