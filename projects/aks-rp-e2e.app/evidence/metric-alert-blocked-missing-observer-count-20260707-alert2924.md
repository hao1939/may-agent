# Metric alert triage — aks-rp-e2e.process.blocked.missing-observer-count

- Alert id: `2924`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Judged at: `2026-07-07T04:41:28Z`
- Chosen operation: `waiting_with_evidence`

## Judgment

The persisted metric row and open alert still show a breach (`current=4`, threshold `0`), but the current live metric recompute and the runtime task-tree source of truth are already back in range. The supported blocked-contract repair tool now reports nothing left to repair, and a direct audit of blocked leaf tasks found zero holders missing the required observer contract fields. In this triage environment there is no safe runtime write path to clear the stale alert row directly, so the correct owner action is `waiting_with_evidence` until the next metrics refresh either recovers the alert automatically or reproduces concrete offending task ids.

## Evidence checked

### 1. Metric contract still counts blocked leaves missing observer metadata

`projects/aks-rp-e2e.app/scripts/project-metrics.ts` defines:

```ts
"aks-rp-e2e.process.blocked.missing-observer-count": () => ({
  value: tasks.blockedMissingObserver,
}),
```

So this metric is still intended to alert only when blocked tasks actually lack observer metadata.

### 2. Live metric recompute is already back to zero

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result:

```json
{ "measuredAt": 1783412066768, "value": 0 }
```

### 3. Supported repair path finds nothing left to backfill

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts --dry-run
```

Observed result:

```json
{
  "dryRun": true,
  "repairedCount": 0,
  "unchangedCount": 91,
  "repaired": []
}
```

So there is no current blocked holder that the supported repair path can fix now.

### 4. Direct runtime-tree audit finds zero live offenders

Command:

```bash
cd /app/projects/aks-rp-e2e.app && node <<'NODE'
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('.state/tasks/tree.json', 'utf8'));
const tasks = Array.isArray(data.tasks) ? data.tasks : [];
const offenders = tasks
  .filter(t => t.state === 'blocked' && (!t.children || t.children.length === 0))
  .filter(t => {
    const b = t.blocker || {};
    return !b.observed_by || !b.observation_method || !b.next_check_at;
  })
  .map(t => ({ id: t.id, blocker: t.blocker || null }));
console.log(JSON.stringify({ count: offenders.length, ids: offenders.map(o => o.id) }, null, 2));
NODE
```

Observed result:

```json
{
  "count": 0,
  "ids": []
}
```

### 5. Recent history shows the metric can lag after earlier real breaches

A prior durable note for alert `2892` records a real breach that was repaired via `repair-blocked-contracts`. The current session differs: the live sample is already `0` and the repair path is a no-op, so this specific open alert is waiting on refresh/validation rather than a new safe mutation.

## Why this is not `fix_root_cause`

`fix_root_cause` would require a current blocked leaf that still lacks observer metadata and a safe repair to apply now. The official live sample is already `0`, the dry-run repair tool finds `repairedCount: 0`, and the direct runtime-tree audit found zero offenders.

## Why this is not `resolve_stale`

The remaining problem appears to be stale alert lifecycle state, but this workflow does not expose a safe runtime write path for resolving `metric_alerts` or forcing a metrics refresh. The concrete owner action available here is to leave durable evidence and wait for the next validation signal.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-observer-count`.

- If the refreshed value stays `0`, alert `2924` should recover as stale/transient state.
- If it returns `>0`, reopen only with the exact offender task ids from a fresh `.state/tasks/tree.json` audit.
