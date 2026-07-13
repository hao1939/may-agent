# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.blocked.overdue-unworked-count` alert 3570

- Alert id: `3570`
- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Decision: `fix_root_cause`
- Triage time: `2026-07-13T18:50Z`

## Judgement

The stored alert opened on a `43` sample, but a fresh live recompute at triage time showed the spec-loop portion had already been re-covered by newer active overdue review tasks. The live breach was still real, but narrowed to `3` uncovered waits:

- `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`
- `wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711`
- `hold-compact-trusted-access-ta-gateway-dns-runtime-frontier-20260705`

Both owning recovery tasks were already active, but neither carried metric-recognized `blockedTaskIds` coverage metadata, so the overdue-unworked metric still counted those waits as uncovered.

## Evidence checked

### Fresh live recompute before repair

```json
{"measuredAt":1783968631197,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":3,"sampleSize":3,"note":"{\"offenderTaskIds\":[\"wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708\",\"wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711\",\"hold-compact-trusted-access-ta-gateway-dns-runtime-frontier-20260705\"]}"}
```

### Active recovery tasks before repair

- `ops/review-overdue-jwt-authenticator-shared-owner-return-20260713` was `active` but only carried conflict scope `ops:shared-jwt-authenticator-egress-gate`.
- `ops/review-overdue-trusted-access-ta-gateway-family-waits-20260713` was `active` but only carried conflict scope `feature:trusted-access`.

Those scopes are truthful for humans, but `project-metrics.ts` only treats overdue waits as covered when an active/review task either:

1. explicitly names the blocked wait via structured `blockedTaskIds`/`auditedBlockedTaskIds`, or
2. carries a recognized `ops:blocked-overdue:*` scope alias.

## Change made

Using the task-tree safe write path (`saveTaskTreeWithKanbanSnapshot` under tree lock), I updated the two already-active app-ops recovery tasks to carry exact structured coverage metadata:

### Applied task coverage metadata

```json
{
  "repairedAt": "2026-07-13T18:50:48.520Z",
  "evidencePath": "evidence/archive/20260713-metric-alert-overdue-unworked-count-alert3570-fix-root-cause.md",
  "jwtCarrier": {
    "id": "ops/review-overdue-jwt-authenticator-shared-owner-return-20260713",
    "state": "active",
    "blockedTaskIds": [
      "wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708"
    ]
  },
  "trustedCarrier": {
    "id": "ops/review-overdue-trusted-access-ta-gateway-family-waits-20260713",
    "state": "active",
    "blockedTaskIds": [
      "hold-compact-trusted-access-ta-gateway-dns-runtime-frontier-20260705",
      "wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711"
    ]
  }
}
```

## Validation after repair

### Fresh live recompute after repair

```json
{"measuredAt":1783968649558,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

## Why this is `fix_root_cause`

The issue was not that these waits needed a new human escalation or metric calibration. The app already had the correct active recovery tasks; they were simply missing the exact structured coverage fields that the overdue-unworked metric uses to decide whether a blocked wait has active work. Updating those active tasks fixed the real process gap and returned the live metric to zero.

## Next validation

- Preferred: next runtime `metrics-snapshot` for `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Expected: remain `0` with `offenderTaskIds=[]` unless a new blocked wait reaches its next review window without an exact active/review coverage task.
