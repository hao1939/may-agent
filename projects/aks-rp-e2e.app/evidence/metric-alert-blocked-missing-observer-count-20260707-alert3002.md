# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` — alert `3002`

- Judged at: `2026-07-07T13:13Z`
- Chosen operation: `waiting_with_evidence`
- Metric owner: `aks-explorer`

## Judgment

The persisted runtime metric row and open alert still show a breach (`current=1`, threshold `0`), but the live authoritative recompute is already healthy, the supported metric sampler also returns `0`, and the runtime task-tree audit finds no blocked leaf missing the required observer contract fields. There is no current blocked-holder observer defect that I can safely repair in this session, and this workflow does not provide a safe runtime write path to clear the stale alert row directly. The correct final operation is `waiting_with_evidence` until the next metrics refresh reconciles persisted state with the already-healthy live task-tree state.

## Evidence checked

### 1. Persisted metric row still breaches

```sql
SELECT id, current, threshold, target, priority, status, updated_at
FROM metrics
WHERE id = 'aks-rp-e2e.process.blocked.missing-observer-count';
```

Observed row:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `status = active`
- `updated_at = 1783430631292`

### 2. Open alert row is still unresolved

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE id = 3002;
```

Observed row:

- `resolved_at = NULL`
- alert message still reports `current=1`

### 3. Metric contract still measures blocked leaves missing observer metadata

`projects/aks-rp-e2e.app/scripts/project-metrics.ts` defines:

```ts
"aks-rp-e2e.process.blocked.missing-observer-count": () => ({
  value: tasks.blockedMissingObserver,
}),
```

and `tasks.blockedMissingObserver` counts blocked leaf tasks whose `blocker` lacks any of:

- `observed_by`
- `observation_method`
- `next_check_at`

So the alert should still fire only when blocked leaf observer metadata is actually missing.

### 4. Live authoritative recompute is healthy now

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result:

```json
{ "measuredAt": 1783430994099, "value": 0 }
```

### 5. Safe metric sampler is also healthy now

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result:

```json
{ "measuredAt": 1783430994188, "value": 0 }
```

### 6. Direct runtime task-tree audit finds no current offenders

Command:

```bash
cd /app/projects/aks-rp-e2e.app && node - <<'NODE'
const fs=require('fs');
const data=JSON.parse(fs.readFileSync('.state/tasks/tree.json','utf8'));
const missing=[];
for (const [tid, task] of Object.entries(data.tasks||{})) {
  const isLeaf = !Array.isArray(task.children) || task.children.length===0;
  if (task.state==='blocked' && isLeaf) {
    const b=task.blocker||{};
    if (!b.observed_by || !b.observation_method || !b.next_check_at) {
      missing.push({taskId:tid, observed_by:b.observed_by??null, observation_method:b.observation_method??null, next_check_at:b.next_check_at??null});
    }
  }
}
console.log(JSON.stringify({blocked_missing_observer_count:missing.length, missing}, null, 2));
NODE
```

Observed result:

```json
{
  "blocked_missing_observer_count": 0,
  "missing": []
}
```

## Conclusion

Choose `waiting_with_evidence`: the live source of truth is already back in range, there is no safe root-cause repair left to apply now, and the next metrics refresh is the correct validation signal for whether alert `3002` auto-recovers or reproduces a real offender.

## Next validation

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-observer-count`. Recovery is confirmed when the persisted `metrics.current` row updates from `1` to `0` and alert `3002` resolves automatically. If a fresh recompute later returns `>0`, reopen only with concrete offending blocked task ids from a fresh runtime-tree audit.
