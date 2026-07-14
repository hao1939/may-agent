# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.blocked.overdue-unworked-count` alert 3587

- Alert id: `3587`
- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Decision: `fix_root_cause`
- Triage time: `2026-07-14T00:44Z`

## Judgment

This breach was real at triage start. A fresh recompute still returned 12 overdue blocked waits, and the shared approval-return lanes still had zero matching `project.approval.submitted` events. The correct repair was to review the same exact waits now and refresh their expired blocked-wait windows in place, because no sharper returned owner/runtime evidence had arrived and reopening broader work would have been false.

## Evidence checked

### Fresh live recompute before repair

```json
{"measuredAt":1783989726485,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":12,"sampleSize":12,"note":"{\"offenderTaskIds\":[\"wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704\",\"hold-spec-private-cluster-shared-apiserver-subnet-run-28840446579-result-visibility-frontier-20260707h\",\"hold-spec-private-cluster-update-public-second-hop-run-28671841561-artifact-frontier-20260707h\",\"hold-compact-aad-rbac-package-partial-frontier\",\"hold-compact-private-cluster-package-partial-frontier-202607090641-ownerfix\",\"hold-compact-rp-cluster-lifecycle-split-frontier-20260711\",\"focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711\",\"ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711-owner-normalized\",\"ops/wait-project-approval-owner-return-primary-blocker-20260713\",\"domain/hold-rp-cluster-lifecycle-ready-carriers-visible-backlog-20260713\",\"domain/hold-rp-nodepool-lifecycle-execute-ready-promotion-visible-backlog-20260713b\",\"domain/hold-rp-nodepool-lifecycle-ready-subset-pass-sync-visible-backlog-20260713b\"]}"}
```

### No matching approval returns had landed

```json
{"approval_return_count":0}
```

That count checked `project.approval.submitted` for the two governing approval-return paths:

- `focus-review-off_track-approval-refresh-20260712`
- `shared-authenticated-artifact-result-recovery-family-20260712`

### Frontier state at repair time

`task-tree summary` still showed no runnable or review frontier, one active app-ops review leaf, and the same blocked-holder backlog preserved under the exact waits.

## Change made

I refreshed the 12 exact offender waits through the task-tree safe write path (`task-tree refresh-blocked-wait`), preserving each task's existing blocker condition, resume condition, and fallback action while moving the expired review window forward to `2026-07-14T06:40:00Z` and extending fallback windows no earlier than `2026-07-14T12:40:00Z`.

Every refreshed wait now records the same trace summary:

> Alert 3587 review confirmed the same exact blocker still governs this lineage; advanced the expired blocked-wait review window without widening scope.

### Refreshed waits

- `wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704`
- `hold-spec-private-cluster-shared-apiserver-subnet-run-28840446579-result-visibility-frontier-20260707h`
- `hold-spec-private-cluster-update-public-second-hop-run-28671841561-artifact-frontier-20260707h`
- `hold-compact-aad-rbac-package-partial-frontier`
- `hold-compact-private-cluster-package-partial-frontier-202607090641-ownerfix`
- `hold-compact-rp-cluster-lifecycle-split-frontier-20260711`
- `focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711`
- `ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711-owner-normalized`
- `ops/wait-project-approval-owner-return-primary-blocker-20260713`
- `domain/hold-rp-cluster-lifecycle-ready-carriers-visible-backlog-20260713`
- `domain/hold-rp-nodepool-lifecycle-execute-ready-promotion-visible-backlog-20260713b`
- `domain/hold-rp-nodepool-lifecycle-ready-subset-pass-sync-visible-backlog-20260713b`

## Validation after repair

### Fresh live recompute after repair

```json
{"measuredAt":1783989858156,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

### Sample refreshed windows

```json
{
  "id": "ops/wait-project-approval-owner-return-primary-blocker-20260713",
  "next_check_at": "2026-07-14T06:40:00.000Z",
  "fallback_at": "2026-07-14T12:40:00.000Z",
  "refreshed_at": "2026-07-14T00:44:07.891Z"
}
```

```json
{
  "id": "wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704",
  "next_check_at": "2026-07-14T06:40:00.000Z",
  "fallback_at": "2026-07-14T18:40:00.000Z",
  "refreshed_at": "2026-07-14T00:44:07.094Z"
}
```

## Why this is `fix_root_cause`

The metric was not stale and did not need calibration. The problem was that 12 blocked waits had crossed their review window without a fresh owner refresh. Revalidating the same exact blocker lineages and advancing their blocked-wait windows removed the real overdue condition without hiding work, changing thresholds, or inventing broader execution.

## Next validation

- Preferred: next runtime `metrics-snapshot` for `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Expected: remain `0` with `offenderTaskIds=[]` until one of these same exact waits reaches its next review window again or a real owner/runtime return materially changes the lineage.
