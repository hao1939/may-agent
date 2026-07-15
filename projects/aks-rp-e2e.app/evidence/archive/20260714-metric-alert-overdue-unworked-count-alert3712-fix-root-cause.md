# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.blocked.overdue-unworked-count` alert 3712

- Alert id: `3712`
- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Operation: `fix_root_cause`
- Judged at: `2026-07-14T19:20Z`

## Judgment

This breach was real and current. A direct recompute at triage start still returned `value=1` with one offender task, `hold-spec-secops-fips-exact-13spec-mixed-frontier-20260708`.

The wait itself was still truthful. Current compact authority in `../aks-rp-e2e/features/secops/compact/staging.summary.md` still preserves the exact residual five-member secops-fips no-rerun umbrella for:

- `spec.secops-fips.advanced`
- `spec.secops-fips.backwards-compat`
- `spec.secops-fips.ubuntu-compat`
- `spec.secops-fips.mixed-pool-coexistence`
- `spec.secops-fips.base-unaligned-pools-rejection`

and explicitly keeps `upgrade-survival`, `slice2`, `version-gate`, and `blocked-addon-boundary.shared-cluster` outside this holder. No new rerun-ready surface, changed-input target, or owner-approved replacement carrier landed. The root cause was stewardship drift: the blocked-wait review window had expired.

## Evidence checked

### Direct metric sample before repair

```json
{"measuredAt":1784056741892,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1,"sampleSize":1,"note":"{\"offenderTaskIds\":[\"hold-spec-secops-fips-exact-13spec-mixed-frontier-20260708\"]}"}
```

### Live blocked wait before repair

Before repair, `bun run task-tree show hold-spec-secops-fips-exact-13spec-mixed-frontier-20260708` showed:

- `state = blocked`
- `blocker.next_check_at = 2026-07-14T19:15:00Z`
- `blocker.fallback_at = 2026-07-15T19:15:00Z`
- same residual five-member no-rerun umbrella wording still aligned with current compact authority

## Change made

I refreshed the exact same blocked wait through the supported task-tree safe write path:

```bash
bun run task-tree refresh-blocked-wait hold-spec-secops-fips-exact-13spec-mixed-frontier-20260708 \
  --blocker "2026-07-14 19:20Z blocked-frontier review revalidated that the residual secops-fips no-rerun umbrella remains the same exact five-member frontier: spec.secops-fips.advanced, spec.secops-fips.backwards-compat, spec.secops-fips.ubuntu-compat, spec.secops-fips.mixed-pool-coexistence, and spec.secops-fips.base-unaligned-pools-rejection. Current compact authority in ../aks-rp-e2e/features/secops/compact/staging.summary.md still preserves that exact residual-five-member-no-rerun-umbrella and explicitly keeps upgrade-survival, slice2, version-gate, and blocked-addon-boundary.shared-cluster outside this holder. No new rerun-ready surface, changed-input target, or owner-approved replacement carrier has landed, so the safe app-ops repair is to refresh this exact wait in place rather than reopening an unchanged broad FIPS rerun or widening scope." \
  --resume-condition "Resume only when one of the residual five secops-fips members gains a materially different changed-input rerun target, a new exact source signal, or an owner-approved replacement surface that narrows or replaces this umbrella." \
  --summary "Alert 3712 triage confirmed the same residual five-member secops-fips umbrella remains the exact blocker and only its review window expired; refreshed the blocked-wait review window in place without reopening unchanged broad FIPS reruns. Memo: /app/projects/aks-rp-e2e.app/evidence/archive/20260714-metric-alert-overdue-unworked-count-alert3712-fix-root-cause.md" \
  --blocker-category external-wait \
  --blocker-owner human \
  --next-check-at 2026-07-15T19:15:00Z \
  --fallback-at 2026-07-16T19:15:00Z \
  --fallback-action "If the same residual five-member secops-fips umbrella still governs at fallback, refresh this exact wait from current accepted evidence or replace it only with a sharper returned or approved successor; do not pull upgrade-survival, slice2, version-gate, or shared-cluster back under this umbrella or reopen unchanged broad FIPS reruns."
```

The refresh preserved the same wait lineage and recorded app-ops stewardship on the live task:

- `trace.blocked_wait_refreshed_at = 2026-07-14T19:19:55.485Z`
- `trace.blocked_wait_refresh_summary` names alert `3712` and this memo path
- `result` records the alert-3712 blocked-wait refresh summary

Immediately after that refresh, the planner also created `domain/reconcile-secops-fips-residual-frontier-overdue-20260714` and rewrote the holder to point at that active exact reconciliation lane. The final live holder now remains non-overdue with:

- `blocker.next_check_at = 2026-07-15T19:45:00Z`
- `blocker.fallback_at = 2026-07-16T19:45:00Z`
- `blocker.owner = aks-explorer`

## Validation after repair

### Direct metric sample after repair

```json
{"measuredAt":1784056799768,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

### Live task readback after repair

The final live task now shows:

- `trace.blocked_wait_refreshed_at = 2026-07-14T19:19:55.485Z`
- `trace.blocked_wait_refresh_summary` naming alert `3712` and this memo path
- `outputs` include `evidence/archive/20260714-metric-alert-overdue-unworked-count-alert3712-fix-root-cause.md`
- `blocker.next_check_at = 2026-07-15T19:45:00Z`
- `blocker.fallback_at = 2026-07-16T19:45:00Z`
- `blocker.resume_condition` now points at the active exact lane `domain/reconcile-secops-fips-residual-frontier-overdue-20260714`

## Why this is `fix_root_cause`

The metric was not stale or noisy. It correctly identified one exact overdue blocked wait whose stewardship window had lapsed. Refreshing that same truthful wait in place through the supported task-tree tool repaired the actual process gap without widening scope or reopening unchanged broad FIPS reruns.

## Next validation

- Preferred: next runtime `metrics-snapshot` for `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Expected: remain `0` with `offenderTaskIds=[]` until the refreshed review window expires again or the residual secops-fips frontier materially changes.
