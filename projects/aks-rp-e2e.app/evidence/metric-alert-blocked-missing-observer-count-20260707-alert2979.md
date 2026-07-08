# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count`

- Alert id: `2979`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Judged at: `2026-07-07T04:41:28Z`
- Chosen operation: `waiting_with_evidence`
- Metric owner: `aks-explorer`

## Judgment

The persisted metric row and open alert still show a breach (`current=1`, threshold `0`), but the current live metric recompute and the current task-tree source of truth are already back in range. The supported blocked-contract repair path is a no-op, so there is no truthful root-cause fix to apply in this session. This workflow also has no safe runtime write path to resolve the stale alert row directly. The correct final operation is therefore `waiting_with_evidence`: record the recovery evidence durably and wait for the next metrics snapshot / alert refresh to clear the stale alert or reproduce a real offender.

## Evidence checked

### 1. Persisted metric row and alert still show a breach

Alert payload at triage time reported:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `resolved_at = null`

Recent snapshots supplied with the alert show the same oscillating pattern seen in earlier wakes, including:

- `1783424755930 => 1`
- `1783424435858 => 0`
- `1783424119631 => 0`
- `1783423787526 => 2`

### 2. Live metric recompute is already back to zero

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result:

```json
{ "measuredAt": 1783425062357, "value": 0 }
```

### 3. Direct task-tree audit finds zero blocked leaves missing observer contract fields

Command:

```bash
cd /app/projects/aks-rp-e2e.app && node - <<'NODE'
const fs=require('fs');
const obj=JSON.parse(fs.readFileSync('tasks/tree.json','utf8'));
function taskState(task){const raw=task.state ?? task.status ?? 'backlog'; if(raw==='accepted') return 'done'; if(raw==='ready'||raw==='proposed') return 'backlog'; if(raw==='superseded'||raw==='cancelled') return 'done'; if(raw==='decomposed') return 'backlog'; if(raw==='claimed_done'||raw==='rejected') return 'review'; return raw;}
function isLeaf(task){return (task.children??[]).length===0;}
function recordValue(v){return v && typeof v==='object' && !Array.isArray(v) ? v : null;}
function stringRecordField(record, keys){ if(!record) return ''; for(const key of keys){ const value=record[key]; if(typeof value==='string' && value.trim()) return value.trim(); } return ''; }
function objectRecordField(record, keys){ if(!record) return null; for(const key of keys){ const value=record[key]; const nested=recordValue(value); if(nested) return nested; } return null; }
const offenders=[];
for (const [id,task] of Object.entries(obj.tasks??{})) {
  if (!isLeaf(task) || taskState(task)!=='blocked') continue;
  const blocker=recordValue(task.blocker);
  const missing=[];
  if(!objectRecordField(blocker,['observed_by','observedBy'])) missing.push('observed_by');
  if(!stringRecordField(blocker,['observation_method','observationMethod'])) missing.push('observation_method');
  if(!stringRecordField(blocker,['next_check_at','nextCheckAt'])) missing.push('next_check_at');
  if(missing.length) offenders.push({id, parent_id:task.parent_id, owner:task.owner, missing});
}
console.log(JSON.stringify({count:offenders.length, offenders}, null, 2));
NODE
```

Observed result:

```json
{
  "count": 0,
  "offenders": []
}
```

### 4. Supported repair path finds nothing left to backfill

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts --dry-run
```

Observed result:

```json
{
  "dryRun": true,
  "repairedCount": 0,
  "unchangedCount": 104,
  "repaired": []
}
```

## Why this is not `fix_root_cause`

`fix_root_cause` would require a current blocked task that still lacks observer metadata and a safe repair to apply now. In this session:

- the official live metric sample is already `0`;
- a direct task-tree audit found zero blocked leaves missing the observer contract; and
- `repair-blocked-contracts --dry-run` reports `repairedCount: 0`.

There is no truthful repair to apply right now.

## Why this is not `resolve_stale`

The remaining problem is the stale alert lifecycle state, but this workflow does not expose a safe runtime write path for resolving `metric_alerts` or forcing a refresh. The concrete action available here is to leave durable evidence and wait for the next validation signal.

## Conclusion

Choose `waiting_with_evidence`: the live runtime measurement is currently healthy, the supported repair path is a no-op, and the next metrics snapshot is the correct validation signal for whether alert `2979` auto-recovers or reproduces a real offender.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-observer-count`.

- If the refreshed value stays `0`, alert `2979` should recover as stale/transient state.
- If it returns `>0`, reopen only with exact offender task ids from a fresh task-tree audit.
