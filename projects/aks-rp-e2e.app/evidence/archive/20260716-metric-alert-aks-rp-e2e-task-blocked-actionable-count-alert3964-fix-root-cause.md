# Metric alert triage — `aks-rp-e2e.task.blocked-actionable-count` — alert `3964`

## Chosen operation

- `fix_root_cause`

## Judgment

The breach was real and app-owned. A live recompute still returned `value=2`, and the only warning task ids were the compact projection holders `hold-compact-cost-analysis-reviewed-exception-frontier` and `hold-compact-trusted-access-ta-gateway-dns-runtime-frontier-20260705`.

Both blocked leaves already had exact structured waits pointing at shared governing waits:

- `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
- `wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711`

So the root cause was not missing owner action. The root cause was warning-classification drift: `workflows/lib/task-tree-tools.ts` only exempted shared-family covered holders when `waiting_for.type = blocker.resolved`, but these current live compact projections now use truthful shared-wait types `project.approval.submitted` and `environment.available`.

## Baseline evidence before the fix

### Live metric recompute

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.task.blocked-actionable-count --json
```

Before the repair in this session:

```json
{
  "value": 2,
  "sampleSize": 2,
  "note": "{\"actionableWarningTaskIds\":[\"hold-compact-cost-analysis-reviewed-exception-frontier\",\"hold-compact-trusted-access-ta-gateway-dns-runtime-frontier-20260705\"],...}"
}
```

### Live packet reproduction

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts packet > /tmp/blocked_action_packet_3964.json && node -e "const o=require('/tmp/blocked_action_packet_3964.json'); console.log(JSON.stringify({warning_count:(o.blocked_action_warnings||[]).length,warnings:o.blocked_action_warnings||[]}, null, 2));"
```

Before the repair in this session:

```json
{
  "warning_count": 2,
  "warnings": [
    {
      "kind": "environment-overblock",
      "taskId": "hold-compact-cost-analysis-reviewed-exception-frontier"
    },
    {
      "kind": "environment-overblock",
      "taskId": "hold-compact-trusted-access-ta-gateway-dns-runtime-frontier-20260705"
    }
  ]
}
```

## Repair applied

Updated `workflows/lib/task-tree-tools.ts` so `isSharedFamilyCoveredHolder()` now also suppresses exact compact projections when all of the following are true:

- the holder is a compact exact wait,
- `blocker.waiting_for.taskId` points at a named `wait-shared-*` governing wait,
- controller-visible `context.frontierTaskIds` / `context.compactFrontierTaskIds` include that same shared wait id,
- and the holder text explicitly says it is a compact/feature-facing projection that should not reopen a feature-local environment blocker or broad rerun.

This keeps the earlier `blocker.resolved` shared-family suppression intact while covering the current live shared-wait projection shapes.

## Regression coverage added

Updated `workflows/task-tree-tools.test.ts` with:

- `planning packet suppresses environment-overblock warning for compact projections governed by exact shared waits even when the shared wait uses approval or environment waiting types`

The fixture covers both live warning shapes from this alert:

- `project.approval.submitted` shared wait projection (`cost-analysis`)
- `environment.available` shared wait projection (`trusted-access`)

while preserving one real environment blocker that must still warn.

## Verification after the fix

### Targeted task-tree tests

```bash
cd /app/projects/aks-rp-e2e.app && bun test workflows/task-tree-tools.test.ts --timeout 30000
```

Result after the repair in this session:

- `93 pass`
- `0 fail`

### Live packet after repair

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts packet > /tmp/blocked_action_packet_3964_after.json && node -e "const o=require('/tmp/blocked_action_packet_3964_after.json'); console.log(JSON.stringify({warning_count:(o.blocked_action_warnings||[]).length,warnings:o.blocked_action_warnings||[]}, null, 2));"
```

After the repair:

```json
{
  "warning_count": 0,
  "warnings": []
}
```

### Live metric recompute after repair

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.task.blocked-actionable-count --json
```

After the repair in this session:

```json
{
  "value": 0,
  "sampleSize": 0,
  "note": "{\"actionableWarningTaskIds\":[],...}"
}
```

## Delivery caveat

I did not commit this repair because `/app` already contains many unrelated pre-existing modified and untracked files outside this alert fix, so the finish guard does not allow claiming a clean committed success from this session.
