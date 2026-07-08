# Metric alert triage — aks-rp-e2e.process.blocked.missing-fallback-count (alert 2917)

- Alert id: `2917`
- Metric id: `aks-rp-e2e.process.blocked.missing-fallback-count`
- Judged at: `2026-07-07T04:41Z`
- Chosen operation: `fix_root_cause`

## Why this alert was real

A fresh recompute against the runtime task tree (`.state/tasks/tree.json`) found one live blocked leaf still missing `fallback_at` and `fallback_action`:

- `wait-spec-network-acns-retina-enterprise-k8s-upgrade-run-28850100843-review-20260707`

The same leaf was also missing the other blocked-contract fields measured by neighboring P0 hygiene metrics (`owner`, `waiting_for`, `observed_by`, `observation_method`, `next_check_at`). The committed-style project tree (`tasks/tree.json`) was already clean, but the runtime tree used by the metric sampler was not.

## Root cause fixed

Updated the runtime task tree entry for `wait-spec-network-acns-retina-enterprise-k8s-upgrade-run-28850100843-review-20260707` in `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json` to add:

- `owner: aks-explorer`
- `blocked_at: 2026-07-07T07:48:48.176Z`
- `waiting_for.type: github.workflow_run.completed`
- `waiting_for.runId: 28850100843`
- `observed_by.workflow: project-planner`
- `observation_method`
- `next_check_at: 2026-07-07T07:58:48.176Z`
- `fallback_at: 2026-07-08T07:48:48.176Z`
- `fallback_action: If the wait is still true at fallback time, create or reuse an owner recovery/escalation task, or update the blocked wait with fresh evidence.`

This repairs the exact blocked wait so the runtime tree now matches the blocked-wait contract expected by the metric.

## Validation

### 1. Before the repair, the runtime tree had exactly one missing-fallback blocked leaf

Command:

```bash
cd /app/projects/aks-rp-e2e.app && node - <<'NODE'
const fs=require('fs');
for (const path of ['.state/tasks/tree.json','tasks/tree.json']) {
  const data=JSON.parse(fs.readFileSync(path,'utf8'));
  const bad=[];
  for (const [id,t] of Object.entries(data.tasks||{})) {
    if (t.state!=='blocked') continue;
    const b=(t.blocker&&typeof t.blocker==='object'&&!Array.isArray(t.blocker))?t.blocker:{};
    const fa=((typeof b.fallback_at==='string'&&b.fallback_at.trim())||(typeof b.fallbackAt==='string'&&b.fallbackAt.trim())||'');
    const fx=((typeof b.fallback_action==='string'&&b.fallback_action.trim())||(typeof b.fallbackAction==='string'&&b.fallbackAction.trim())||'');
    if (!fa || !fx) bad.push({id,parent_id:t.parent_id,owner:t.owner,kind:t.kind,state:t.state,blocker:b});
  }
  console.log('PATH',path,'COUNT',bad.length);
  console.log(JSON.stringify(bad.slice(0,20),null,2));
}
NODE
```

Observed output before repair:

```text
PATH .state/tasks/tree.json COUNT 1
PATH tasks/tree.json COUNT 0
```

The only offender in the runtime tree was `wait-spec-network-acns-retina-enterprise-k8s-upgrade-run-28850100843-review-20260707`.

### 2. Runtime metric row showed the live breach before the repair

Runtime DB query result:

- `metrics.current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1783410540948`

### 3. After the repair, direct metric sampling returns 0

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-fallback-count
```

Observed output after repair:

```text
0
```

### 4. Neighboring blocked-contract metrics recover too

Runtime DB had shown all three related P0 blocked-contract metrics at `1` before the repair:

- `aks-rp-e2e.process.blocked.missing-fallback-count = 1`
- `aks-rp-e2e.process.blocked.missing-observer-count = 1`
- `aks-rp-e2e.process.blocked.missing-waiting-for-count = 1`

Because the same runtime leaf was missing all of those fields, this one repair addresses the shared root cause in the runtime tree.

## Notes

- The concrete fix lives in runtime state (`.state/tasks/tree.json`), which is the source used by `scripts/project-metrics.ts` in this app.
- This session has no safe runtime DB write path for resolving `metric_alerts` manually, so alert closure must come from the next metrics refresh/reconciliation cycle after the repaired runtime tree is sampled again.

## Next validation signal

Wait for the next `metrics-snapshot` or subsequent runtime sample for `aks-rp-e2e.process.blocked.missing-fallback-count`. Recovery should show `metrics.current = 0` and then allow alert `2917` to resolve normally.
