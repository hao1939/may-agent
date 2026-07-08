# Metric alert triage — `aks-rp-e2e.process.blocked.missing-waiting-for-count` (alert 3094)

- Alert id: `3094`
- Metric id: `aks-rp-e2e.process.blocked.missing-waiting-for-count`
- Judged at: `2026-07-08T08:51:00Z`
- Chosen operation: `upgrade_or_escalate`
- Metric owner: `app-ops`
- Escalation task: `ops-escalate-blocked-missing-waiting-metric-contradiction-20260708`

## Judgment

This alert is **not safely fixable by another blocked-task edit**. The metric breach is still reported as `value=4`, but the supported blocked-contract repair path already backfilled `waiting_for`/observer fields on the four named offenders, and direct runtime-tree audits now show **0 blocked leaves missing `waiting_for`**.

Because the measurement still contradicts the repaired runtime state after a safe owner repair attempt, the correct final operation is `upgrade_or_escalate`: leave a durable blocked escalation task for human/maintainer judgment on whether the runtime metric sampler path needs reload, source patching, or temporary contradiction handling guidance.

## Evidence checked

### 1) Live metric still breaches and names the same 4 offenders

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-waiting-for-count --json
```

Observed result:

```json
{
  "measuredAt": 1783500443911,
  "value": 4,
  "sampleSize": 4,
  "note": "{\"offenderTaskIds\":[\"hold-spec-storage-csi-csidrivers-source-only-frontier-20260708\",\"hold-spec-storage-csi-file-nfs-unmount-boundary-source-scaffold-frontier-20260708\",\"wait-spec-egress-lockdown-vm-prerelease-vhd-matrix-run-28602948762-review-surface-20260708\",\"hold-compact-package-partial-residual-overlap-frontier-20260708\"]}"
}
```

### 2) Supported repair path finds and repairs those same 4 tasks

Dry run:

```json
{
  "dryRun": true,
  "repairedCount": 5,
  "repaired": [
    "hold-dev-infra-core-slice03-kms-publickv-invalid-sku-frontier-20260707",
    "hold-spec-storage-csi-csidrivers-source-only-frontier-20260708",
    "hold-spec-storage-csi-file-nfs-unmount-boundary-source-scaffold-frontier-20260708",
    "wait-spec-egress-lockdown-vm-prerelease-vhd-matrix-run-28602948762-review-surface-20260708",
    "hold-compact-package-partial-residual-overlap-frontier-20260708"
  ]
}
```

Applied run:

```json
{
  "dryRun": false,
  "repairedCount": 5,
  "repaired": [
    "hold-dev-infra-core-slice03-kms-publickv-invalid-sku-frontier-20260707",
    "hold-spec-storage-csi-csidrivers-source-only-frontier-20260708",
    "hold-spec-storage-csi-file-nfs-unmount-boundary-source-scaffold-frontier-20260708",
    "wait-spec-egress-lockdown-vm-prerelease-vhd-matrix-run-28602948762-review-surface-20260708",
    "hold-compact-package-partial-residual-overlap-frontier-20260708"
  ]
}
```

### 3) Runtime task tree now shows `waiting_for` on the named offenders

Read-back from `.state/tasks/tree.json` shows, for example:

- `hold-spec-storage-csi-csidrivers-source-only-frontier-20260708`
  - `waiting_for: {"type":"evidence.available","taskId":"hold-spec-storage-csi-csidrivers-source-only-frontier-20260708"}`
- `hold-spec-storage-csi-file-nfs-unmount-boundary-source-scaffold-frontier-20260708`
  - `waiting_for: {"type":"evidence.available","taskId":"hold-spec-storage-csi-file-nfs-unmount-boundary-source-scaffold-frontier-20260708"}`
- `wait-spec-egress-lockdown-vm-prerelease-vhd-matrix-run-28602948762-review-surface-20260708`
  - `waiting_for: {"type":"github.workflow_run.completed","runId":"28602948762","taskId":"wait-spec-egress-lockdown-vm-prerelease-vhd-matrix-run-28602948762-review-surface-20260708"}`
- `hold-compact-package-partial-residual-overlap-frontier-20260708`
  - `waiting_for: {"type":"environment.available","taskId":"hold-compact-package-partial-residual-overlap-frontier-20260708"}`

Each repaired task also carries `trace.blocked_contract_repaired_at: "2026-07-08T08:47:23.049Z"`.

### 4) Direct runtime audit returns zero missing-`waiting_for` blocked leaves

Direct audit command over the runtime tree:

```bash
cd /app/projects/aks-rp-e2e.app && bun -e '...read .state/tasks/tree.json and count blocked leaves missing blocker.waiting_for...'
```

Observed result:

```json
{
  "count": 0,
  "ids": []
}
```

A second audit using `readTaskTree(taskTreeConfig(...))` returned `[]` as well.

## Durable outcome

Created a blocked escalation task in the live task tree:

- `ops-escalate-blocked-missing-waiting-metric-contradiction-20260708`

This task records the contradiction, names the decision needed from a human/maintainer, and preserves the exact resume/fallback contract for parity restoration.

## Decision needed

Human/maintainer should decide one of:

1. reload or restart the runtime path that is still sampling stale blocked-contract data,
2. land a targeted app-local metric sampler patch if the CLI path is reading stale/alternate state,
3. or explicitly classify this alert family as sampler contradiction until parity is restored.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-waiting-for-count`, or after the escalation task receives a maintainer decision.