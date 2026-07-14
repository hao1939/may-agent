# Spec-loop blocked-frontier recovery coverage repair — 2026-07-13

- Task: `ops/repair-spec-loop-blocked-frontier-recovery-coverage-20260713`
- Attempt: `a_ops_repair-spec-loop-blocked-frontier-recovery-coverage-20260713_20260713184926`
- Mode: Task Worker Mode

## Incident linkage

The 2026-07-13 blocked-frontier incident was not that watchdog failed to notice the spec-loop family. Watchdog and the overdue metric did notice it, and `ops/review-1825-spec-loop-overdue-blocked-frontier-wave-20260713` was created as grouped recovery coverage for the exact 37-wait spec-loop residue.

The gap reopened later when that carrier lineage was judged closable after only `fallback_at` moved forward, even though the same waits still had overdue `next_check_at` / `resume_at` values. That let the only controller-visible coverage disappear until ad hoc repair/restoration work recreated it.

## App/process cause

The planner's accept-side overdue check in `workflows/project-planner.ts` used a non-canonical overdue timestamp rule:

- old behavior: prefer `fallback_at`, else `resume_at`
- canonical behavior used by `scripts/project-metrics.ts` and watchdog: earliest finite of `next_check_at`, `resume_at`, and `fallback_at`

That mismatch meant an overdue-wait audit could be accepted when only `fallback_at` was pushed into the future, even though the wait was still overdue by the earlier watch timestamps. In the 2026-07-13 spec-loop incident, that is exactly the shape described by the later incorrect `ops/review-1825...` addendum and by the `ops/review-1900...` restoration memo.

## Durable repair landed

I changed `workflows/project-planner.ts` so `blockedWaitOverdueAt()` now computes overdue time from the earliest finite value across:

- `next_check_at` / `nextCheckAt`
- `resume_at` / `resumeAt`
- `fallback_at` / `fallbackAt`

This aligns planner accept invariants with the canonical metric/watchdog rule.

Resulting process effect:

- a grouped overdue-family carrier can no longer be accepted away merely because its waits got a later `fallback_at`
- future overdue families keep their active/review coverage until the exact waits are either
  - refreshed out of overdue status on the earliest watch timestamp,
  - replaced by real active/review successors, or
  - otherwise covered by truthful controller-visible recovery work

## Regression coverage landed

I added a planner test in `workflows/project-planner.test.ts`:

- `accepted overdue-wait audits stay open when only fallback_at moved forward`

The test creates a blocked spec-loop wait with:

- overdue `next_check_at`
- overdue `resume_at`
- future `fallback_at`

and verifies that an `accept` review is rejected with `Overdue-wait accept cannot close`.

That is the exact failure shape behind the 2026-07-13 carrier-retirement regression.

## Verification

### Source readback

`workflows/project-planner.ts` now shows `blockedWaitOverdueAt()` sorting all three watch timestamps and taking the earliest finite value.

### Test run

```bash
cd /app/projects/aks-rp-e2e.app && bun test ./workflows/project-planner.test.ts --timeout 30000
```

Observed result:

- 73 tests passed
- includes pass for `accepted overdue-wait audits stay open when only fallback_at moved forward`

## Why this addresses future blocked-frontier coverage

The recurring recovery gap was not lack of a family-level repair task creator; the app already created grouped blocked-frontier recovery tasks.

The gap was that planner acceptance could retire the only carrier using a looser overdue clock than the metric/watchdog used. With the planner now enforcing the same earliest-watch rule, future grouped recovery coverage will be maintained until the underlying waits are truly no longer overdue or have real successor coverage.

## Remaining follow-up

- Low-risk cleanup: factor the earliest-watch-timestamp rule into a shared helper so planner, metrics, and any future audit scripts cannot drift again.
- The current fix is sufficient to stop this specific accept-side carrier-retirement regression.
