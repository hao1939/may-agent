# Metric alert triage — `aks-rp-e2e.process.blocked.missing-waiting-for-count` (alert 3583)

- Metric id: `aks-rp-e2e.process.blocked.missing-waiting-for-count`
- Alert id: `3583`
- Owner: `app-ops`
- Chosen operation: `fix_root_cause`
- Triage time: `2026-07-13T22:29Z`

## Judgment

This breach was real and safely repairable by app-ops. The live metric sample still reported two blocked tasks missing a structured `blocker.waiting_for` target, and the supported `repair-blocked-contracts` task-tree tool identified the same two offenders. App-ops then applied that bounded repair to the live runtime tree, which backfilled `waiting_for`, observer metadata, and blocked timestamps. A fresh metric recompute returned `value=0` with no offenders.

## Evidence

### 1) Live metric sample before repair

```json
{"measuredAt":1783981777296,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":2,"sampleSize":2,"note":"{\"offenderTaskIds\":[\"ops/wait-project-approval-owner-return-primary-blocker-20260713\",\"ops/review-0040-project-approval-owner-return-primary-blocker-lineage-20260714b\"]}"}
```

### 2) Supported repair dry run matched the same offenders

```json
{
  "dryRun": true,
  "treePath": "/app/projects/aks-rp-e2e.app/.state/tasks/tree.json",
  "repairedCount": 2,
  "repaired": [
    "ops/wait-project-approval-owner-return-primary-blocker-20260713",
    "ops/review-0040-project-approval-owner-return-primary-blocker-lineage-20260714b"
  ]
}
```

### 3) Repair was applied through the supported task-tree tool

```json
{
  "dryRun": false,
  "treePath": "/app/projects/aks-rp-e2e.app/.state/tasks/tree.json",
  "repairedCount": 2,
  "repaired": [
    "ops/wait-project-approval-owner-return-primary-blocker-20260713",
    "ops/review-0040-project-approval-owner-return-primary-blocker-lineage-20260714b"
  ]
}
```

### 4) Live task readback after repair shows `waiting_for` on both offenders

- `ops/wait-project-approval-owner-return-primary-blocker-20260713`
  - `blocker.waiting_for = {"type":"blocker.resolved","taskId":"ops/wait-project-approval-owner-return-primary-blocker-20260713"}`
- `ops/review-0040-project-approval-owner-return-primary-blocker-lineage-20260714b`
  - `blocker.waiting_for = {"type":"blocker.resolved","taskId":"ops/review-0040-project-approval-owner-return-primary-blocker-lineage-20260714b"}`

### 5) Fresh metric sample recovered to zero

```json
{"measuredAt":1783981795430,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

## Root cause repaired

These two blocked leaves had structured blocker contracts but were still missing the machine-readable `waiting_for` target required by the blocked-wait hygiene metric. The supported `repair-blocked-contracts` flow repaired the runtime task records in place, so the blocked-wait contract is once again complete and the metric sampler now agrees.

## Validation

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-waiting-for-count`. Recovery is confirmed if the sampled value remains `0` and alert `3583` auto-resolves.
