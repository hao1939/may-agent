# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.blocked.overdue-unworked-count`

- Alert id: `3161`
- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Chosen operation: `fix_root_cause`
- Triage time: `2026-07-08T14:24:33Z`

## Current facts

- The runtime metric row that opened the alert breached at `current=1`, `threshold=0`, and `target=0`.
- The two newest stored snapshots before repair both named the same sole offender task id: `wait-dev-infra-core-slice03-kscr-winp1-optout-recovery-20260707`.
- A direct task-tree read shows that offender is a real blocked wait, not a measurement bug: it preserves the exact KSCR Windows opt-out update surface from Azure DevOps run `171186535`, where `spec.runtime-container.kscr-rotation-matrix` failed with HTTP `409` after prolonged Windows 2025 pool churn.
- The breach was overdue stewardship: the wait had passed its fallback window without active or review recovery work explicitly covering that exact wait.

## Concrete change made

I refreshed the blocked wait contract through task-tree tooling, and the live task tree now carries exact follow-up coverage for the overdue wait:

- the blocker text is refreshed with 2026-07-08 owner-review wording,
- `next_check_at` is now `2026-07-08T18:30:00Z`,
- `fallback_at` is now `2026-07-09T14:30:00Z`,
- `fallback_action` now requires an exact escalation/owner-return packet or fresh same-surface evidence,
- the blocked wait now references the concrete follow-up `recover-dev-infra-core-slice03-kscr-winp1-optout-fallback-review-20260708` as the single active recovery path.

## Why `fix_root_cause`

The metric definition says this breach exists only when an overdue blocked wait lacks active recovery, handoff, escalation, or refreshed exact stewardship. That process gap is now repaired: the live blocked contract is refreshed and the wait is explicitly covered by a concrete recovery follow-up.

This is not `resolve_stale` because the original breach was real when sampled.

This is not `waiting_with_evidence` because the process defect has been concretely corrected enough for a fresh recompute to return in-range.

## Validation after repair

A fresh local recompute now returns:

- `value = 0`
- `sampleSize = 0`
- `note = {"offenderTaskIds":[]}`

That is the expected validation signal for this fix.

## Next validation

- Preferred: next `metrics-snapshot` for `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Expected: remain `value = 0` with `offenderTaskIds = []`.
