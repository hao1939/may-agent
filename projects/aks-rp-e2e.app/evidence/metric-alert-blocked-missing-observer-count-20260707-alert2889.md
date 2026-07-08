# Metric alert triage — aks-rp-e2e.process.blocked.missing-observer-count

- Alert id: `2889`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Judged at: `2026-07-07T06:18:34Z`
- Chosen operation: `upgrade_or_escalate`

## Judgment

This alert is not a simple stale-row repeat. During this session, the live runtime tree did contain one blocked leaf missing the observer contract, and the supported repair path successfully backfilled that holder. But the official metric sampler command still returned `1` immediately afterward, while an in-process Bun audit using the same task-tree config and the same blocked-leaf predicate returned `0`. That means the metric now contradicts the verified task-tree state, and I cannot safely prove which runtime measurement path is authoritative from this triage workflow alone.

Because the owner already applied the safe blocked-contract repair and the metric still reports a breach, the correct final action is `upgrade_or_escalate`: treat this as a runtime/tooling contradiction that needs higher-level follow-up on the metric sampler or alert pipeline, not another blind blocked-task edit.

## Evidence checked

### 1. Persisted metric row still shows a breach

The alert payload and metric row for this triage still show:

- `current = 1`
- `threshold = 0`
- `target = 0`
- priority `P0`

### 2. Metric contract definition still counts blocked leaf tasks missing observer metadata

`/app/projects/aks-rp-e2e.app/scripts/project-metrics.ts` defines:

```ts
"aks-rp-e2e.process.blocked.missing-observer-count": () => ({
  value: tasks.blockedMissingObserver,
}),
```

and `tasks.blockedMissingObserver` counts blocked **leaf** tasks whose blocker lacks any of:

- `observed_by`
- `observation_method`
- `next_check_at`

### 3. There was one real live offender in the runtime tree before repair

A direct audit of `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json` found exactly one blocked leaf missing the observer contract before repair:

- `hold-spec-aad-rbac-nonaad-to-aadv2-self-contained-create-frontier-20260707z`

Its blocker only had:

- `condition`
- `category`
- `resume_condition`

and was missing `observed_by`, `observation_method`, `next_check_at`, plus the rest of the blocked-contract metadata.

### 4. The supported repair tool identified and repaired that exact holder

Dry run:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts --dry-run
```

Observed result:

```json
{
  "dryRun": true,
  "repairedCount": 1,
  "repaired": [
    "hold-spec-aad-rbac-nonaad-to-aadv2-self-contained-create-frontier-20260707z"
  ]
}
```

Applied repair:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts
```

Observed result:

```json
{
  "dryRun": false,
  "repairedCount": 1,
  "repaired": [
    "hold-spec-aad-rbac-nonaad-to-aadv2-self-contained-create-frontier-20260707z"
  ]
}
```

### 5. The runtime tree now shows the required observer contract on that holder

After repair, `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json` shows the repaired blocker includes:

- `owner = "aks-explorer"`
- `waiting_for`
- `observed_by.workflow = "project-planner"`
- `observation_method`
- `next_check_at`
- `fallback_at`
- `fallback_action`
- `trace.blocked_contract_repaired_at`

### 6. A direct Bun audit using the same task-tree config now finds zero offenders

This in-process audit:

```bash
cd /app/projects/aks-rp-e2e.app && bun -e 'import { readTaskTree, taskState, isLeaf } from "./workflows/lib/task-tree-store.ts"; import { taskTreeConfig } from "./workflows/lib/task-tree-tools.ts"; const tree=readTaskTree(taskTreeConfig({appDir:process.cwd(),projectDir:"/app/projects/aks-rp-e2e",worker:"aks-explorer",maxConcurrent:1})); const bad=[]; for (const [id,t] of Object.entries(tree.tasks)) { if (!isLeaf(t) || taskState(t)!=="blocked") continue; const b=(t.blocker&&typeof t.blocker==="object"&&!Array.isArray(t.blocker))?t.blocker:{}; const obs=(b.observed_by&&typeof b.observed_by==="object") || (b.observedBy&&typeof b.observedBy==="object"); const method=(typeof b.observation_method==="string"&&b.observation_method.trim()) || (typeof b.observationMethod==="string"&&b.observationMethod.trim()) || ""; const next=(typeof b.next_check_at==="string"&&b.next_check_at.trim()) || (typeof b.nextCheckAt==="string"&&b.nextCheckAt.trim()) || ""; if (!obs || !method || !next) bad.push({id, blocker:b}); } console.log(JSON.stringify({count:bad.length,bad},null,2));'
```

returned:

```json
{
  "count": 0,
  "bad": []
}
```

### 7. But the official metric sampler command still returns `1`

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result after repair:

```json
{ "measuredAt": 1783405114965, "value": 1 }
```

So the supported metric command now disagrees with the verified task-tree state.

## Why this is `upgrade_or_escalate`

- `fix_root_cause` is incomplete because the safe blocked-contract repair was already applied, yet the official metric sampler still reports a breach.
- `resolve_stale` is not safe here because the live source-of-truth and the metric command disagree; I cannot prove the alert row is merely stale.
- `waiting_with_evidence` is too weak because there is now a concrete measurement contradiction after a real repair, which needs runtime/tooling attention rather than passive waiting.

## Required follow-up

Escalate the runtime contradiction to the May/runtime owner lane with this exact decision request:

- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Current persisted value: `1`
- Verified runtime tree state after supported repair: `0` blocked leaf offenders
- Contradiction: `bun run ./scripts/project-metrics.ts ... --json` still returns `1`
- Decision needed: determine whether the metric sampler path is reading stale state, double-counting a non-leaf, or otherwise diverging from the task-tree predicate used in direct audit

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-observer-count`, or sooner if the runtime owner reproduces/fixes the sampler contradiction.
