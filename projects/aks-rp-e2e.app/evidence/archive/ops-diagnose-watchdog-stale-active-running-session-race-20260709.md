# Watchdog stale-active running-session race diagnosis — 2026-07-09

## Summary
The false-positive did not come from the watchdog session-row check itself. It came from planner no-op logic that only treated a stale-active watchdog wake as obsolete when the cited task ids were already non-active. In the observed Fleet case, the task had already been requeued and freshly reassigned back onto the same `session_id`, so the planner saw the cited task still active and ran a second planning pass even though the runtime `sessions` row for that same `session_id` was already `running`.

I fixed the app-side guard in `workflows/project-planner.ts` so a `watchdog-stale-active-review` wake now short-circuits as a false positive when every cited stale-active task still has a currently running runtime session after live-tree revalidation.

## Correlated timeline

All times below are from runtime events and task/session traces for `verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607090822`.

1. **08:22:29Z** — planner assigned the Fleet task with attempt `a_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607090822_20260709082229` and session id `s_task_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607090822`.
2. **08:25:35Z** — watchdog emitted `project.planning.requested` with `reason=watchdog-stale-active-review` and `staleActiveTasks=[{taskId: verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607090822, reason: session-not-running}]`.
3. **08:32:26Z** — metric triage requeued that active task as stale because the old session row was absent and wrote the fix-root-cause note in `evidence/archive/metric-alert-stale-active-with-gaps-20260709-alert3259-fix-root-cause.md`.
4. **08:32:28Z** — planner re-assigned the same Fleet task with a fresh attempt `a_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607090822_20260709083228`, but preserved the same stable task session id `s_task_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607090822`.
5. **08:34:03Z** — the new worker session actually started (`trace.worker_started_at=2026-07-09T08:34:03.947Z`).
6. **08:34:50Z+** — runtime `sessions` contained `s_task_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607090822` as `running` with live `opCount` and recent activity, proving the stale-active wake had become obsolete.
7. **Before this fix** — planner false-positive no-op detection only checked whether stale-active cited ids were now non-active. Because Fleet was active again, the wake was not short-circuited even though the runtime session had recovered.

## Exact failing path

### Watchdog behavior
`workflows/project-execution-watchdog.ts` was not the root bug for this case.

- `activeTaskRestartReason()` checks runtime session state through `restartReasonForSession()`.
- It already has a `sessionStartGraceMs` guard for `session-not-running` immediately after assignment/start.
- The observed stale-active packet was truthful for the **old** attempt at the moment it was emitted.

### Planner behavior that caused duplicate churn risk
The problematic logic was in `workflows/project-planner.ts` inside `settledActiveNoopResult()`:

- it parsed `staleActiveTasks` from the watchdog trigger,
- built `citedStillActive` by checking whether the cited task ids were still active in the current tree,
- and only returned the stale-active false-positive no-op when `citedStillActive.length === 0`.

That means a watchdog stale-active wake remained “actionable” whenever the same task id was active again, even if that active row already had a healthy running runtime session. This is exactly what happened to Fleet after fresh reassignment/start.

## Repair applied

File changed:
- `workflows/project-planner.ts`

What changed:
1. Added `runtimeSessionRow()` helper so planner can inspect the current runtime session row safely.
2. Added `runtimeSessionIsRunning()` helper that treats a session as live only when:
   - the row exists,
   - `status === 'running'`, and
   - `endedAt` is not set.
3. Extended `settledActiveNoopResult()` so `watchdog-stale-active-review` returns a no-op not only when cited tasks became non-active, but also when every cited still-active task has a currently running runtime session after live-tree revalidation.

New invariant:
- A stale-active watchdog wake must not trigger another planner remediation pass when the cited task is still active **and** its current `session_id` already maps to a running runtime session row.

## Why this is the smallest safe fix
- It does not relax watchdog stale-active detection globally.
- It does not change task assignment, requeue, or worker completion semantics.
- It only teaches planner to treat an already-recovered stale-active packet as obsolete, which prevents duplicate retries/requeues from an out-of-date wake.

## Verification

### Runtime/event evidence used in diagnosis
- `project.task.assigned` events show Fleet first assigned at **08:22:29Z** and freshly reassigned at **08:32:28Z** on the same stable `session_id` with a new attempt id.
- `session.start` for `s_task_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607090822` occurred at **08:34:03Z** for the fresh worker.
- Later runtime query showed that same session row as `running`/then terminal `done`, proving the false-positive pattern was “stale packet after recovery,” not “missing live session.”
- `metric-alert-stale-active-with-gaps-20260709-alert3259-fix-root-cause.md` captures the requeue that happened before the fresh reassignment.

### Automated regression coverage added
`workflows/project-planner.test.ts` now includes:
- existing stale-active false-positive tests for cited ids already settled/non-active,
- **new test**: `skips owner session for stale-active watchdog review when the cited task still has a running runtime session`.

That new test verifies planner returns a false-positive no-op, dispatches no extra work, and logs the `settled-active-noop` planner run when the cited task remains active but its runtime session row is already `running`.

## Planner guidance
Planner should not create duplicate retries or requeues for this pattern anymore:

- watchdog cites stale-active task id from an older attempt,
- planner/metric repair already requeued and reassigned it,
- worker has already started a fresh session on the same task,
- runtime `sessions` shows that `session_id` is currently `running`.

In that situation, the stale-active wake is obsolete and should no-op.
