# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count`

- Alert id: `2939`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Judged at: `2026-07-07T04:41:28Z`
- Chosen operation: `waiting_with_evidence`
- Metric owner: `aks-explorer`

## Judgment

The persisted metric row and open alert still show a breach (`current=1`, threshold `0`), but the current live metric recompute and the runtime task-tree source of truth are already back in range. The supported blocked-contract repair tool reports nothing left to repair, and a direct audit of blocked tasks found zero holders missing the required observer contract fields. In this triage environment there is no safe runtime write path to resolve the stale alert row directly, so the correct final operation is `waiting_with_evidence` until the next metrics refresh either recovers the alert automatically or reproduces a concrete offender.

## Evidence checked

### 1. Persisted metric row is still breaching

Runtime metric row at triage:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `status = active`
- `alert_op = >`
- `updated_at = 1783415569496`

Open alert row at triage:

- `id = 2939`
- `resolved_at = NULL`
- message reports `current=1, threshold=0, target=0`

### 2. Metric contract still counts blocked tasks missing observer metadata

`projects/aks-rp-e2e.app/scripts/project-metrics.ts` defines:

```ts
"aks-rp-e2e.process.blocked.missing-observer-count": () => ({
  value: tasks.blockedMissingObserver,
}),
```

So this metric is still intended to alert only when blocked tasks actually lack observer metadata.

### 3. Live metric recompute is already back to zero

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result:

```json
{ "measuredAt": 1783415893435, "value": 0 }
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
  "unchangedCount": 93,
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
  const b = typeof t.blocker === 'object' && t.blocker ? t.blocker : null;
  const missing=[];
  if (!b || !b.waiting_for) missing.push('waiting_for');
  if (!b || !b.observed_by) missing.push('observed_by');
  if (!b || !b.observation_method) missing.push('observation_method');
  if (!b || !b.next_check_at) missing.push('next_check_at');
  if (!b || !(b.fallback_at || b.fallback_action)) missing.push('fallback');
  if (missing.length) offenders.push({id, missing});
}
console.log(JSON.stringify({count:offenders.length, offenders:offenders.slice(0,20)},null,2));
NODE
```

Observed result:

```json
{
  "count": 0,
  "offenders": []
}
```

### 6. Naive top-level observer scans overstate the problem

A broad scan of `tasks/tree.json` that looks only for top-level `observer` or `observers` fields reported many blocked tasks as missing observer data. That does **not** match the actual metric contract. The supported repair tool and direct audit above both read the structured `blocker` contract (`waiting_for`, `observed_by`, `observation_method`, `next_check_at`, fallback fields), and both show zero current offenders.

## Why this is not `fix_root_cause`

`fix_root_cause` would require a current blocked task that still lacks observer metadata and a safe repair to apply now. In this session:

- the official live metric sample is already `0`;
- `repair-blocked-contracts --dry-run` reports `repairedCount: 0`; and
- a direct runtime-tree audit found zero blocked tasks missing the required contract.

There is no truthful repair to apply at this moment.

## Why this is not `resolve_stale`

The remaining issue appears to be stale alert lifecycle state, but this workflow does not expose a safe runtime write path for resolving `metric_alerts` or forcing a metrics refresh. The concrete owner action available here is to leave durable evidence and wait for the next validation signal.

## Conclusion

Choose `waiting_with_evidence`: the live runtime tree is currently compliant with the observer contract, the supported repair path is a no-op, and the next metrics refresh is the correct validation signal for whether alert `2939` auto-recovers or reproduces a real offender.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-observer-count`.

- If the refreshed value stays `0`, alert `2939` should recover as stale/transient state.
- If it returns `>0`, reopen only with exact offender task ids from a fresh `.state/tasks/tree.json` audit.
