# Metric alert triage — upgrade_or_escalate — `aks-rp-e2e.task.no-work-with-gaps`

- Alert id: `3720`
- Metric id: `aks-rp-e2e.task.no-work-with-gaps`
- Triage time: `2026-07-14T21:14Z`
- Owner: `app-ops`
- Chosen operation: `upgrade_or_escalate`

## Judgment

Choose `upgrade_or_escalate` because this alert has become a **repeating app-orchestration defect**, not a one-off empty frontier.

The project briefly flips between:
- `value=1` when the repair task finishes into review without changing live state, and
- `value=0` only when the planner assigns yet another retry task on the same lineage.

That oscillation is not durable recovery. The retried task is again being routed through Task Worker Mode even though the required action is canonical planner/app control-plane mutation (`project.approval.requested` emission or exact blocker creation). The just-finished worker explicitly said it could not apply the repair because the worker path forbids the needed mutation, and the newly spawned retry still carries the same contradictory worker instructions. This needs owner-level escalation and routing repair, not another memo-only retry.

## Evidence checked

1. **Persisted metric row is breaching and the alert is still open**
   - `SELECT id, current, threshold, target, priority, project, status, updated_at, alert_op FROM metrics WHERE id = 'aks-rp-e2e.task.no-work-with-gaps'`
   - observed `current=1`, `threshold=0`, `target=0`, `priority=P0`, `status=active`, `updated_at=1784063251103`
   - `SELECT id, metric_id, alert_type, message, resolved_at, created_at FROM metric_alerts WHERE metric_id = 'aks-rp-e2e.task.no-work-with-gaps' ORDER BY created_at DESC LIMIT 5`
   - observed alert `3720` with `resolved_at=NULL`

2. **Recent persisted snapshots show repeated failure, not a one-off spike**
   - `SELECT value, measured_at, measured_by, note FROM metric_snapshots WHERE metric_id = 'aks-rp-e2e.task.no-work-with-gaps' ORDER BY measured_at DESC LIMIT 10`
   - latest values were `1, 1, 1, 0, 0, 0...`

3. **The live metric already demonstrated the same oscillation during triage**
   - `bun run ./scripts/project-metrics.ts aks-rp-e2e.task.no-work-with-gaps --json` first returned `{"measuredAt":1784063420067,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1}` when the frontier had fallen back to review-only
   - the same command later returned `{"measuredAt":1784063499174,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}` only after the planner assigned another retry task

4. **The just-finished repair task did not restore live state**
   - `bun run ./scripts/task-tree.ts show ops-apply-ops-apply-ops-apply-repair-approval-followup-apply-gap-2026071`
   - observed the task already moved to `state=review`
   - its `trace.last_worker_summary` says: `Live state remains unchanged because Task Worker Mode forbids emitting the event or mutating the task tree from this session.`
   - `SELECT sessionId, agent, status, startedAt, endedAt, error, lastActivityAt FROM sessions WHERE sessionId = 's_task_ops-apply-ops-apply-ops-apply-repair-approval-followup-apply-gap-2026071_-apply-repair-approval-followup-apply-gap-2026071_20260714210838'`
   - observed `status='done'`, `endedAt=1784063395306`, `error=NULL`

5. **The planner immediately spawned another retry on the same broken route**
   - `bun run ./scripts/task-tree.ts show ops-apply-ops-apply-ops-apply-ops-apply-repair-approval-followup-apply-g`
   - observed a new active task with the same goal: emit the canonical `project.approval.requested` event or create one exact blocker
   - the new task context feedback explicitly says: `Do not rerun this as another memo-only default-task-worker task; the next step must be planner/app control-plane execution.`
   - despite that, `SELECT sessionId, agent, status, startedAt, endedAt, error, task FROM sessions WHERE projectId = 'aks-rp-e2e' AND agent = 'app-ops' ORDER BY startedAt DESC LIMIT 6` shows the newest session is again running under `Task Worker Mode`

6. **The newest running task still contains contradictory worker instructions**
   - the current session payload in `sessions.task` includes both:
     - `App-ops state repair authority: You may perform the precise repair named by the task using supported app mechanisms.`
     - `Do not emit project or runtime events through the CLI, HTTP API, SDK, or direct database writes.`
   - the assigned task goal requires exactly that forbidden event emission (`project.approval.requested`) unless an exact blocker is created instead
   - this contradiction explains why the lineage keeps generating evidence memos and review leaves instead of durable recovery

7. **Multiple owner sessions have already repeated this pattern**
   - recent app-ops sessions around `ops-followup-disabled-alert-alias-runtime-owner-decision-20260714-follow`, `ops-apply-ops-apply-ops-apply-disabled-alert-alias-runtime-owner-followu`, `ops-apply-ops-apply-ops-apply-repair-approval-followup-apply-gap-2026071`, and the newly spawned `ops-apply-ops-apply-ops-apply-ops-apply-repair-approval-followup-apply-g` all target the same disabled-alert approval-followup lineage
   - each completed attempt produced proposal/review output rather than controller-visible dispatch proof or the exact blocker alternative

## Escalation requested

Needed decision/action from planner/app-control-plane owner (May/project steward):

1. **Immediate containment:** ensure this lineage ends with one truthful durable state, not another memo-only loop:
   - either execute the supported planner/app control-plane step (`project.approval.requested` emission, dispatch proof, in-place wait refresh, residue retirement),
   - or create exactly one blocker for the task-worker execution gap and retire the duplicate review-only residue leaves.
2. **Systemic repair:** stop routing `app-state-repair` tasks that require control-plane mutation into a worker path whose prompt forbids the required event emission.

This triage session cannot safely perform the repair because the current environment provides read-only DB access and no supported runtime event/task-tree mutation tool. Repeating the current worker route is already proven to produce proposal-only output and metric oscillation.

## Why this is not another operation

- Not `fix_root_cause`: the required runtime control-plane mutation is unavailable in this triage environment, and the available worker path is itself the defect under escalation.
- Not `waiting_with_evidence`: the current `0` is only a temporary retry-assignment suppression, not durable recovery; the same lineage already bounced back to `1` during this triage.
- Not `resolve_stale`: the persisted metric row and open alert are still live, and the underlying routing defect is active.
- Not `calibrate_metric` or `downgrade_priority`: the alert correctly exposes a real P0 liveness failure pattern.

## Next validation

Validate after the planner/app-control-plane owner changes the execution path or records the exact blocker alternative.

Expected recovery shape:

- a repair attempt ends with controller-visible dispatch proof or one exact blocker, not another review-only memo
- `bun run ./scripts/project-metrics.ts aks-rp-e2e.task.no-work-with-gaps --json` stays at `{"value":0}` across the next completion instead of bouncing back to `1`
- persisted `metrics.current` moves to `0` and alert `3720` resolves
