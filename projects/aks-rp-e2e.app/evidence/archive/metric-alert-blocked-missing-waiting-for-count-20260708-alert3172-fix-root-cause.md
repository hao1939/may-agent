# Metric alert triage — `aks-rp-e2e.process.blocked.missing-waiting-for-count` (alert 3172)

- Alert id: `3172`
- Metric id: `aks-rp-e2e.process.blocked.missing-waiting-for-count`
- Judged at: `2026-07-08T02:41:10Z`
- Chosen operation: `fix_root_cause`

## Judgment

This breach was real in the runtime task tree and safe owner repair already exists. A fresh metric recompute returned `value=3` and named three exact blocked leaf offenders. A dry-run of the supported blocked-contract repair command identified the same three tasks as repairable, and applying that repair added the missing machine-readable `blocker.waiting_for` contract for each blocked wait.

## Evidence checked

### Fresh metric recompute before repair

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-waiting-for-count --json
```

Observed result:

```json
{"measuredAt":1783529116626,"value":3,"sampleSize":3,"note":"{\"offenderTaskIds\":[\"wait-spec-serverless-virtual-nodes-runtime-readiness-family-20260708\",\"wait-shared-azure-devops-publication-auth-capable-runtime-20260708\",\"wait-spec-storage-csi-clone-family-rerun-171389443-return-20260708\"]}"}
```

### Exact repair plan from supported dry-run

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts --dry-run
```

Observed result:

```json
{
  "dryRun": true,
  "repairedCount": 3,
  "repaired": [
    "wait-spec-serverless-virtual-nodes-runtime-readiness-family-20260708",
    "wait-shared-azure-devops-publication-auth-capable-runtime-20260708",
    "wait-spec-storage-csi-clone-family-rerun-171389443-return-20260708"
  ]
}
```

### Safe repair applied

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts
```

Observed result:

```json
{
  "dryRun": false,
  "repairedCount": 3,
  "repaired": [
    "wait-spec-serverless-virtual-nodes-runtime-readiness-family-20260708",
    "wait-shared-azure-devops-publication-auth-capable-runtime-20260708",
    "wait-spec-storage-csi-clone-family-rerun-171389443-return-20260708"
  ]
}
```

## Why this is root-cause repair

All three offenders were blocked leaves with prose blocker contracts but no machine-readable `blocker.waiting_for` object. The supported repair path normalized those blockers instead of merely reclassifying or suppressing the alert. The next validation is the next `metrics-snapshot` or an immediate recompute showing the metric back at `0`.
