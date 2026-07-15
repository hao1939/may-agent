# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.blocked.overdue-unworked-count` alert 3699

- Alert id: `3699`
- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Operation: `fix_root_cause`
- Judged at: `2026-07-14T17:50Z`

## Judgment

This breach was real and current. A direct recompute at triage start still returned `value=1` with one offender task, `focus-blocked-frontier-writeback-and-holder-normalization-20260714`. The wait itself remained truthful: it is still governed by the same owner approval tuple and there is still no returned `project.approval.submitted` decision. The root cause was stewardship drift — its blocked-wait review window had expired again.

## Evidence checked

### Direct metric sample before repair

```json
{"measuredAt":1784051405378,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1,"sampleSize":1,"note":"{\"offenderTaskIds\":[\"focus-blocked-frontier-writeback-and-holder-normalization-20260714\"]}"}
```

### Current blocked wait before repair

The live task-tree readout showed:

- `blocker.next_check_at = 2026-07-14T17:47:49.296Z`
- `blocker.fallback_at = 2026-07-15T17:37:49.296Z`
- no returned `project.approval.submitted` decision for path `focus-terminal-frontier-finality-reconciliation-20260714`
- governing wait still `ops/wait-project-approval-owner-return-primary-blocker-20260713`

## Change made

I refreshed the exact same blocked wait through the supported task-tree CLI:

- task id: `focus-blocked-frontier-writeback-and-holder-normalization-20260714`
- command path: `bun run task-tree refresh-blocked-wait ...`
- summary written to task trace:

> Alert 3699 triage confirmed the same governing focus approval tuple remains exact and only the review window expired; advanced the blocked-wait watch window by 24h without duplicating the approval lineage.

The refresh preserved the same approval lineage and moved the watch window forward:

- `blocker.next_check_at = 2026-07-15T17:50:20Z`
- `blocker.fallback_at = 2026-07-16T17:50:20Z`
- `trace.blocked_wait_refreshed_at = 2026-07-14T17:50:20.164Z`

## Validation after repair

### Direct metric sample after repair

```json
{"measuredAt":1784051428315,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

### Live task readback after repair

The refreshed task now shows:

- `blocker.condition` timestamped at `2026-07-14T17:50:19Z`
- `blocker.next_check_at = 2026-07-15T17:50:20Z`
- `blocker.fallback_at = 2026-07-16T17:50:20Z`
- `trace.blocked_wait_refresh_summary` naming this alert and memo path

## Why this is `fix_root_cause`

The metric was not stale or noisy. It correctly identified one exact overdue blocked wait whose review window had lapsed. Refreshing that same wait in place through the supported task-tree tool repaired the actual process gap without inventing a duplicate approval request or changing the wait meaning.

## Next validation

- Preferred: next runtime `metrics-snapshot` for `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Expected: remain `0` with `offenderTaskIds=[]` until the refreshed review window expires again or the governing focus approval tuple materially changes.
