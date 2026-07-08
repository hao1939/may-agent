# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` — alert `3142`

- Operation: `upgrade_or_escalate`
- Judged by: `app-ops`
- Judged at: `2026-07-08T02:41Z`

## Decision

Choose `upgrade_or_escalate` because the alert is still breaching after the owner used the supported safe runtime repair path, and the metric sampler now contradicts the repaired runtime task tree.

This is not a simple waiting case:

- the persisted metric row still shows `current = 2`
- the open alert row `3142` is still unresolved
- a fresh direct metric sample still returns `value = 2` and names the same two offender task ids
- `repair-blocked-contracts --dry-run` identified those same tasks as repairable blocked-contract defects
- applying `repair-blocked-contracts` mutated the runtime task tree and added the missing observer metadata to those tasks
- direct inspection of `.state/tasks/tree.json` after repair shows both named tasks now have `observed_by`, `observation_method`, and `next_check_at`
- a direct owner-side predicate replay against `.state/tasks/tree.json` returns `missing = false` for both named tasks
- despite that, a fresh `metrics:sample` still reports those same two ids as missing observer metadata

That means the owner has already applied the safe fix that should have cleared a real blocked-contract defect, but the metric sampler still reports the repaired tasks as offenders. The system is now in a contradiction state: either the metric sampling path is reading stale/incorrect task data, or there is a deeper runtime/tooling bug that the owner cannot safely resolve inside this triage step.

## Evidence checked

### 1) Persisted metric row is actively breaching

```sql
SELECT id, name, owner, current, threshold, target, priority, project, status, updated_at, alert_op, source_command, blocker
FROM metrics
WHERE id = 'aks-rp-e2e.process.blocked.missing-observer-count';
```

Observed at triage time:

- `current = 2`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `owner = app-ops`
- `updated_at = 1783513577079`

### 2) Latest persisted snapshot names two offender tasks

```sql
SELECT value, sample_size, measured_at, measured_by, note
FROM metric_snapshots
WHERE metric_id = 'aks-rp-e2e.process.blocked.missing-observer-count'
ORDER BY measured_at DESC
LIMIT 10;
```

Latest row at triage time:

- `value = 2`
- `sample_size = 2`
- `note = {"offenderTaskIds":["hold-spec-kms-v2-trust-service-node-subnet-http409-post-rerun-frontier-20260708","wait-spec-network-cni-cilium-stop-start-defaultversion-env-return-20260708"]}`

### 3) Open alert row is still unresolved

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE metric_id = 'aks-rp-e2e.process.blocked.missing-observer-count'
  AND resolved_at IS NULL
ORDER BY created_at DESC
LIMIT 10;
```

Observed row:

- `id = 3142`
- `resolved_at = null`
- message reports `current=2`

### 4) Fresh direct sample still reports the breach before and after repair

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result after repair attempt:

```json
{"measuredAt":1783513672060,"value":2,"sampleSize":2,"note":"{\"offenderTaskIds\":[\"hold-spec-kms-v2-trust-service-node-subnet-http409-post-rerun-frontier-20260708\",\"wait-spec-network-cni-cilium-stop-start-defaultversion-env-return-20260708\"]}"}
```

### 5) Supported repair path found exact repairable offenders

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts --dry-run
```

Observed result:

```json
{
  "dryRun": true,
  "repairedCount": 3,
  "repaired": [
    "hold-dev-infra-core-slice03-kms-publickv-invalid-sku-frontier-20260707",
    "hold-spec-kms-v2-trust-service-node-subnet-http409-post-rerun-frontier-20260708",
    "wait-spec-network-cni-cilium-stop-start-defaultversion-env-return-20260708"
  ]
}
```

### 6) Supported repair path was applied to the runtime tree

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts
```

Observed result:

```json
{
  "dryRun": false,
  "repairedCount": 3,
  "repaired": [
    "hold-dev-infra-core-slice03-kms-publickv-invalid-sku-frontier-20260707",
    "hold-spec-kms-v2-trust-service-node-subnet-http409-post-rerun-frontier-20260708",
    "wait-spec-network-cni-cilium-stop-start-defaultversion-env-return-20260708"
  ]
}
```

### 7) Runtime task inspection now shows the observer contract fields present

Commands:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree show hold-spec-kms-v2-trust-service-node-subnet-http409-post-rerun-frontier-20260708
cd /app/projects/aks-rp-e2e.app && bun run task-tree show wait-spec-network-cni-cilium-stop-start-defaultversion-env-return-20260708
```

Observed runtime fields now present on both tasks:

- `blocker.observed_by`
- `blocker.observation_method`
- `blocker.next_check_at`
- `trace.blocked_contract_repaired_at`

### 8) Direct inspection of `.state/tasks/tree.json` agrees the repaired tasks are no longer missing observer metadata

Owner-side replay against the same predicate used by `scripts/project-metrics.ts`:

```bash
cd /app/projects/aks-rp-e2e.app && bun -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(".state/tasks/tree.json","utf8")); const ids=["hold-spec-kms-v2-trust-service-node-subnet-http409-post-rerun-frontier-20260708","wait-spec-network-cni-cilium-stop-start-defaultversion-env-return-20260708"]; const rec=v=>v&&typeof v==="object"&&!Array.isArray(v)?v:null; const s=(r,keys)=>{if(!r)return ""; for(const k of keys){const v=r[k]; if(typeof v==="string"&&v.trim()) return v.trim();} return ""}; const o=(r,keys)=>{if(!r)return null; for(const k of keys){const v=rec(r[k]); if(v) return v;} return null}; for(const id of ids){const task=data.tasks[id]; const blocker=rec(task.blocker); const missing=!o(blocker,["observed_by","observedBy"]) || !s(blocker,["observation_method","observationMethod"]) || !s(blocker,["next_check_at","nextCheckAt"]); console.log(id,{missing}); }'
```

Observed result:

- `hold-spec-kms-v2-trust-service-node-subnet-http409-post-rerun-frontier-20260708 { missing: false }`
- `wait-spec-network-cni-cilium-stop-start-defaultversion-env-return-20260708 { missing: false }`

## Why this is not `fix_root_cause`

I already used the safe fix path that should repair real missing-observer defects in the runtime tree. The runtime tree now shows the observer contract fields present, yet the metric sampler still reports the same tasks as offenders. Without a truthful explanation for that contradiction, claiming the issue is fixed would be inaccurate.

## Why this is not `resolve_stale`

The metric row and fresh sample are still breaching now, so this is not an already-recovered stale alert row. The contradiction is between the sampling result and the repaired runtime task tree, not between an old alert row and a recovered metric.

## Escalation needed

This requires project-maintainer / human judgment on one of two actions:

1. inspect and repair the `scripts/project-metrics.ts` sampling path or runtime tree read path so it stops flagging already-repaired blocked tasks, or
2. if the sampler is authoritative for a reason not visible from current tree inspection, identify the hidden source of truth and update the blocked-contract repair path accordingly.

Until that decision is made, the owner should treat this alert as a real P0 contradiction in observability rather than silently downgrading or resolving it.

## Next validation

Validate on the next maintainer review or after a metric-sampler code/runtime fix. Recovery is confirmed only when:

- a fresh `bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json` returns `value = 0`, and
- alert `3142` resolves or disappears from the open-alert query.
