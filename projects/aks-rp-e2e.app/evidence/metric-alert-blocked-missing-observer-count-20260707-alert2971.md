# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count`

- Alert id: `2971`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Judged at: `2026-07-07T04:41:28Z`
- Chosen operation: `waiting_with_evidence`
- Metric owner: `aks-explorer`

## Judgment

The persisted metric row and open alert still show a breach (`current=2`, threshold `0`), but the current live metric recompute and the runtime task-tree source of truth are already back in range. The supported blocked-contract repair tool reports nothing left to repair, and a direct audit of blocked tasks found zero holders missing the required observer contract fields. In this triage environment there is no safe runtime write path to resolve the stale alert row directly, so the correct final operation is `waiting_with_evidence` until the next metrics refresh either recovers the alert automatically or reproduces a concrete offender.

## Evidence checked

### 1. Persisted metric row and open alert are still breaching

Runtime metric row at triage:

- `current = 2`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `status = active`
- `updated_at = 1783422835775`
- `source_command = bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-observer-count`

Open alert row at triage:

- `id = 2971`
- `resolved_at = NULL`
- message reports `current=2, threshold=0, target=0`

Recent snapshots show the same oscillating persisted pattern seen in earlier wakes:

- `1783422835775 => 2`
- `1783422519440 => 0`
- `1783422201303 => 4`
- `1783421885667 => 0`
- `1783421569573 => 4`
- `1783421250873 => 0`
- `1783420933189 => 1`

### 2. Metric contract still counts blocked tasks missing observer metadata

`projects/aks-rp-e2e.app/scripts/project-metrics.ts` defines:

```ts
"aks-rp-e2e.process.blocked.missing-observer-count": () => ({
  value: tasks.blockedMissingObserver,
}),
```

and `tasks.blockedMissingObserver` counts blocked **leaf** tasks whose blocker lacks any of:

- `observed_by` / `observedBy`
- `observation_method` / `observationMethod`
- `next_check_at` / `nextCheckAt`

So this metric is still intended to alert only when blocked tasks actually lack observer metadata.

### 3. Live metric recompute is already back to zero

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result:

```json
{ "measuredAt": 1783423088696, "value": 0 }
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
  "unchangedCount": 100,
  "repaired": []
}
```

So there is no current blocked holder that the supported repair path can fix now.

### 5. Direct runtime-tree audit finds zero live offenders

Command:

```bash
cd /app/projects/aks-rp-e2e.app && node - <<'NODE'
const fs=require('fs');
const data=JSON.parse(fs.readFileSync('.state/tasks/tree.json','utf8'));
const offenders=[];
for (const [id,t] of Object.entries(data.tasks)) {
  if (t.state!=='blocked') continue;
  const b = t && typeof t.blocker==='object' && t.blocker && !Array.isArray(t.blocker) ? t.blocker : null;
  const missing=[];
  if (!b || !(b.waiting_for || b.waitingFor)) missing.push('waiting_for');
  if (!b || !(b.observed_by || b.observedBy)) missing.push('observed_by');
  if (!b || !((b.observation_method||b.observationMethod) && String(b.observation_method||b.observationMethod).trim())) missing.push('observation_method');
  if (!b || !((b.next_check_at||b.nextCheckAt) && String(b.next_check_at||b.nextCheckAt).trim())) missing.push('next_check_at');
  if (!b || !((b.fallback_at||b.fallbackAt) && String(b.fallback_at||b.fallbackAt).trim()) || !((b.fallback_action||b.fallbackAction) && String(b.fallback_action||b.fallbackAction).trim())) missing.push('fallback');
  if (missing.length) offenders.push({id, missing});
}
console.log(JSON.stringify({count: offenders.length, offenders: offenders.slice(0,20)}, null, 2));
NODE
```

Observed result:

```json
{
  "count": 0,
  "offenders": []
}
```

## Why this is not `fix_root_cause`

`fix_root_cause` would require a current blocked task that still lacks observer metadata and a safe repair to apply now. In this session:

- the official live metric sample is already `0`;
- `repair-blocked-contracts --dry-run` reports `repairedCount: 0`; and
- a direct runtime-tree audit found zero blocked tasks missing the required contract.

There is no truthful repair to apply at this moment.

## Why this is not `resolve_stale`

The remaining issue appears to be stale alert lifecycle state, but this workflow does not expose a safe runtime write path for resolving `metric_alerts` or forcing a metrics refresh. The concrete owner action available here is to leave durable evidence and wait for the next validation signal.

## Conclusion

Choose `waiting_with_evidence`: the live runtime tree is currently compliant with the observer contract, the supported repair path is a no-op, and the next metrics refresh is the correct validation signal for whether alert `2971` auto-recovers or reproduces a real offender.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-observer-count`.

- If the refreshed value stays `0`, alert `2971` should recover as stale/transient state.
- If it returns `>0`, reopen only with exact offender task ids from a fresh `.state/tasks/tree.json` audit.
