# Metric alert triage — aks-rp-e2e.process.blocked.missing-fallback-count (alert 3047)

- Alert id: `3047`
- Metric id: `aks-rp-e2e.process.blocked.missing-fallback-count`
- Judged at: `2026-07-08T02:55Z`
- Chosen operation: `fix_runtime_tree_only`

## Decision

No project/task-tree (`tasks/tree.json`) schema or metric-definition change is needed.
The breach was caused by four new blocked compact-holder tasks existing only in the runtime tree (`.state/tasks/tree.json`) without the required blocked-wait fallback contract fields.

The smallest useful action was to repair those four runtime task entries in place so the metric sampler sees a complete blocked contract again.

## Why this alert was real

Direct audit results before the repair:

- committed tree `tasks/tree.json`: `0` blocked tasks missing fallback
- runtime tree `.state/tasks/tree.json`: `4` blocked tasks missing fallback
- direct metric recompute: `4`

The four offending runtime-only blocked leaves were:

1. `hold-compact-virtualmachines-agentpool-auto-zone-invalidavailabilityzones-frontier-20260708`
2. `hold-compact-virtualmachines-agentpool-accelerated-networking-approval-frontier-20260708`
3. `hold-compact-virtualmachines-agentpool-row61-oldest-branch-runtime-frontier-20260708`
4. `hold-compact-virtualmachines-agentpool-row75-row76-node-readiness-frontier-20260708`

Each had only a minimal blocker object:

- `condition`
- `category`
- `owner`
- `resume_condition`

and was missing the blocked-contract fields expected by the metric family:

- `blocked_at`
- `waiting_for`
- `observed_by`
- `observation_method`
- `next_check_at`
- `fallback_at`
- `fallback_action`

## Repair applied

Updated `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json` for all four blocked leaves to add the missing blocked-contract metadata.

Added fields:

- `blocked_at: 2026-07-08T02:55:00.000Z`
- `waiting_for.type: evidence.available`
- `waiting_for.taskId: <same task id>`
- `observed_by.workflow: project-planner`
- `observed_by.schedule: blocked-frontier-owner-review`
- `observed_by.trigger: project.planning.requested`
- `observation_method: Scheduled blocked-frontier owner review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.`
- `next_check_at: 2026-07-08T03:05:00.000Z`
- `fallback_at: 2026-07-09T02:55:00.000Z`
- `fallback_action: If the wait is still true at fallback time, create or reuse an owner recovery/escalation task, or update the blocked wait with fresh evidence.`

## Validation

### 1. Runtime-tree audit after the repair

Command:

```bash
cd /app/projects/aks-rp-e2e.app && node - <<'NODE'
const fs=require('fs');
const path='.state/tasks/tree.json';
const data=JSON.parse(fs.readFileSync(path,'utf8'));
const bad=[];
for (const [id,t] of Object.entries(data.tasks||{})) {
  if (t.state!=='blocked') continue;
  const b=(t.blocker&&typeof t.blocker==='object'&&!Array.isArray(t.blocker))?t.blocker:{};
  const fa=((typeof b.fallback_at==='string'&&b.fallback_at.trim())||(typeof b.fallbackAt==='string'&&b.fallbackAt.trim())||'');
  const fx=((typeof b.fallback_action==='string'&&b.fallback_action.trim())||(typeof b.fallbackAction==='string'&&b.fallbackAction.trim())||'');
  if (!fa || !fx) bad.push({id,parent_id:t.parent_id,kind:t.kind,owner:t.owner,keys:Object.keys(b)});
}
console.log(JSON.stringify({path,count:bad.length,bad:bad.slice(0,20)},null,2));
NODE
```

Observed output:

```json
{
  "path": ".state/tasks/tree.json",
  "count": 0,
  "bad": []
}
```

### 2. Direct metric recompute after the repair

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-fallback-count
```

Observed output:

```text
0
```

## Conclusion

This alert did not require changing the committed project tree, the metric definition, or owner context.
It was a runtime-state contract gap on four newly created blocked compact holders, now repaired.

## Next validation signal

Allow the next metrics snapshot / alert reconciliation cycle to resample the repaired runtime tree. Reopen only if a future breach names new runtime blocked tasks missing `fallback_at` or `fallback_action`.
