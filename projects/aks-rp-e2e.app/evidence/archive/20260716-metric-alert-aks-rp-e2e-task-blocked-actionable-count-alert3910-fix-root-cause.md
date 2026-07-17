# Metric alert triage — `aks-rp-e2e.task.blocked-actionable-count` — alert `3910`

## Chosen operation

- `fix_root_cause`

## Judgment

The breach was real but app-owned. The only actionable warning task id was
`domain/publish-rp-regional-quota-review-visible-20260716`, and a live packet
showed it was still being misclassified as an `environment-overblock` even
though the task is a reviewer-gated publication holder. The current runtime
holder text drifted away from the earlier suppression heuristic, so the
classifier no longer recognized this truthful wait shape.

## Baseline evidence before the fix

### Runtime metric recompute

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.task.blocked-actionable-count --json
```

Output before the edit in this session:

```json
{
  "value": 1,
  "sampleSize": 1,
  "note": "{\"blockedLeafCount\":122,\"durableExactHolderCount\":121,\"actionableWarningTaskIds\":[\"domain/publish-rp-regional-quota-review-visible-20260716\"],...}"
}
```

### Live planning packet

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts packet > /tmp/blocked_packet.json && node -e "const o=require('/tmp/blocked_packet.json'); console.log(JSON.stringify({warning_count:(o.blocked_action_warnings||[]).length,warnings:o.blocked_action_warnings||[]}, null, 2))"
```

Output before the edit in this session:

```json
{
  "warning_count": 1,
  "warnings": [
    {
      "kind": "environment-overblock",
      "taskId": "domain/publish-rp-regional-quota-review-visible-20260716",
      "parentId": "project"
    }
  ]
}
```

### Root cause from primary source

Current live `.state/tasks/tree.json` wording for the holder uses these phrases:

- `Reviewer-gated publication holder only.`
- `reviewer decision`
- `project.task.reviewed decision`
- `publication-safe decision`

The existing suppression helper in
`workflows/lib/task-tree-tools.ts` only matched older phrasing like
`review-gated publication wait` / `task-reviewer decision` / `live review
leaves`, so the truthful holder stopped matching the classifier exemption.

## Fix applied

Updated `workflows/lib/task-tree-tools.ts` so
`isReviewGatedPublicationWait()` now also recognizes the current live holder
shape, including:

- `reviewer-gated publication holder`
- `publication holder only`
- `publication-safe decision`
- `reviewer decision`
- `project.task.reviewed decision`
- `review chain`

Updated `workflows/task-tree-tools.test.ts` so the regression test now mirrors
this current live rp-regional-quota holder wording instead of the older text.

## Verification after the fix

### Targeted tests

```bash
cd /app/projects/aks-rp-e2e.app && bun test workflows/task-tree-tools.test.ts
```

Post-edit result in this session:

- `85 pass`
- `0 fail`

### Live packet after the edit

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts packet > /tmp/blocked_packet_after_fix.json && node -e "const o=require('/tmp/blocked_packet_after_fix.json'); console.log(JSON.stringify({warning_count:(o.blocked_action_warnings||[]).length,warnings:o.blocked_action_warnings||[]}, null, 2))"
```

Post-edit output:

```json
{
  "warning_count": 0,
  "warnings": []
}
```

### Live metric recompute after the edit

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.task.blocked-actionable-count --json
```

Post-edit output in this session:

```json
{
  "value": 0,
  "sampleSize": 0,
  "note": "{\"blockedLeafCount\":121,\"durableExactHolderCount\":121,\"actionableWarningTaskIds\":[],...}"
}
```

## Delivery caveat

I did not commit this fix because `/app` already contains a large set of
pre-existing unrelated dirty and untracked paths, including many files in
`projects/aks-rp-e2e.app` and other projects. Under the finish guard, that
means this session must stop at `partial` rather than claiming a clean committed
success.
