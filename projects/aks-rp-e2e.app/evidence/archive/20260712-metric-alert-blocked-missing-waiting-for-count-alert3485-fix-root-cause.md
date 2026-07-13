# Metric alert triage — `aks-rp-e2e.process.blocked.missing-waiting-for-count` (alert 3485)

- Metric id: `aks-rp-e2e.process.blocked.missing-waiting-for-count`
- Alert id: `3485`
- Owner: `app-ops`
- Chosen operation: `fix_root_cause`
- Triage time: `2026-07-12T22:39Z`

## Judgment

This breach was real and safely repairable by the owner. The metric sampler initially reported three blocked leaves missing a structured `waiting_for` target, and the supported blocked-contract repair tool identified the same three offenders. App-ops then applied that repair to the live task tree, and a fresh metric sample for the same metric returned `value=0` with no offenders.

## Evidence

### 1) Initial live metric sample showed three offenders

```json
{"measuredAt":1783895909628,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":3,"sampleSize":3,"note":"{\"offenderTaskIds\":[\"wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708\",\"focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711\",\"ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711-owner-normalized\"]}"}
```

### 2) Supported repair dry run matched the same three tasks

```json
{
  "dryRun": true,
  "repairedCount": 3,
  "repaired": [
    "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
    "focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711",
    "ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711-owner-normalized"
  ]
}
```

### 3) Repair was applied through the supported task-tree tool

```json
{
  "dryRun": false,
  "repairedCount": 3,
  "repaired": [
    "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
    "focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711",
    "ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711-owner-normalized"
  ]
}
```

### 4) Direct runtime-tree audit after repair showed no blocked leaves missing `waiting_for`

```json
{
  "blockedLeaves": 135,
  "offenderCount": 0,
  "offenderTaskIds": []
}
```

### 5) Fresh metric sample recovered to zero

```json
{"measuredAt":1783895996704,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

## Root cause repaired

The three blocked leaves existed with blocked metadata that was still missing a structured `blocker.waiting_for` object. The supported `repair-blocked-contracts` path backfilled the blocked-contract shape on those exact leaves, including `waiting_for`, observer metadata, and fallback metadata, so the metric sampler and direct task-tree audit now agree.

## Validation

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-waiting-for-count`. Recovery is confirmed if the sampled value remains `0` and alert `3485` auto-resolves.
