# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.blocked.overdue-unworked-count` alert 3644

- Alert id: `3644`
- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Decision: `fix_root_cause`
- Triage time: `2026-07-14T10:35Z`

## Judgment

This breach is real, current, and narrow. The latest metric snapshot names exactly one offender, `wait-compact-app-routing-vm-prerelease-environment-quartet-return-20260709`, and the live task still had `blocker.next_check_at = 2026-07-14T10:30:00Z`, which was already overdue at triage time. The current compact authority in `../aks-rp-e2e/features/app-routing/compact/staging.summary.md` still preserves the same exact accepted environment-blocked quartet, so the safe repair is to refresh this exact blocked wait in place instead of widening scope or reopening unchanged reruns.

## Evidence checked

### Metric still breaching

Latest snapshot before repair:

```json
{"value":1,"sample_size":1,"note":"{\"offenderTaskIds\":[\"wait-compact-app-routing-vm-prerelease-environment-quartet-return-20260709\"]}"}
```

### Live blocked wait was overdue

Before repair, `bun run task-tree show wait-compact-app-routing-vm-prerelease-environment-quartet-return-20260709` showed:

- `state = blocked`
- `blocker.next_check_at = 2026-07-14T10:30:00Z`
- `blocker.fallback_at = 2026-07-15T10:30:00Z`
- `blocker.owner = human`
- `waiting_for.type = frontier.changed`

### Same exact quartet still governs the blocker

`../aks-rp-e2e/features/app-routing/compact/staging.summary.md` still lists the accepted environment-blocked frontier as exactly:

- `spec.app-routing.vm-prerelease.default-acnginx-internal`
- `spec.app-routing.vm-prerelease.default-external-nginx.external-public`
- `spec.app-routing.vm-prerelease.default-internal-nginx.internal-private`
- `spec.app-routing.vm-prerelease.osm-external-nginx.internal`

and states that each preserved frontier must resume only through its own exact owner action, gate change, evidence promotion, or policy repair.

## Change made

Refreshed the exact live blocked wait through the supported task-tree safe write path:

```bash
bun run task-tree refresh-blocked-wait wait-compact-app-routing-vm-prerelease-environment-quartet-return-20260709 \
  --blocker "2026-07-14 10:35Z blocked-frontier owner review revalidated that the compact app-routing VM-prerelease environment boundary remains the same exact quartet: spec.app-routing.vm-prerelease.default-acnginx-internal, spec.app-routing.vm-prerelease.default-external-nginx.external-public, spec.app-routing.vm-prerelease.default-internal-nginx.internal-private, and spec.app-routing.vm-prerelease.osm-external-nginx.internal. Current compact authority in ../aks-rp-e2e/features/app-routing/compact/staging.summary.md still preserves these four members as the accepted environment-blocked frontier, and the separate non-environment residue holder remains outside this exact wait. Keep this existing wait as the single truthful compact-facing carrier. Do not restore the retired broad request-shape wait and do not reopen unchanged broad compact reruns." \
  --resume-condition "Resume only when reviewed same-surface environment or capability evidence, owner-approved promotion, or intentional compact-eligibility reclassification materially changes one or more members of this exact quartet." \
  --summary "Alert 3644 triage confirmed the same app-routing VM-prerelease quartet remains the exact compact-facing blocker; refreshed the expired blocked-wait review window in place without widening scope. Memo: /app/projects/aks-rp-e2e.app/evidence/archive/20260714-metric-alert-overdue-unworked-count-alert3644-fix-root-cause.md" \
  --blocker-category external-wait \
  --blocker-owner human \
  --next-check-at 2026-07-15T10:30:00Z \
  --fallback-at 2026-07-16T10:30:00Z \
  --fallback-action "If the same quartet remains the compact environment boundary at fallback, refresh this exact compact-facing wait from current same-surface evidence or replace it only with a sharper returned/declined successor; do not reopen unchanged reruns."
```

## Validation after repair

### Live wait now has a future review window

After repair, `task-tree show` reports:

- `blocker.next_check_at = 2026-07-15T10:30:00Z`
- `blocker.fallback_at = 2026-07-16T10:30:00Z`
- `trace.blocked_wait_refreshed_at` updated on `2026-07-14`
- `result` records the alert-3644 refresh summary

### Fresh metric recompute is now clear

A direct metric sample after the refresh returned:

```json
{"value":0,"sample_size":0,"note":"{\"offenderTaskIds\":[]}"}
```

## Why this is `fix_root_cause`

The metric is not stale and does not need calibration. One exact blocked wait crossed its review window without active work. Refreshing that same truthful wait from current compact authority evidence removes the real overdue condition while preserving the exact lineage and keeping unchanged reruns closed.

## Next validation

- Preferred: next runtime `metrics-snapshot` for `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Expected: remain `0` with `offenderTaskIds=[]` until this exact wait reaches its next review window again or its compact frontier materially changes.
