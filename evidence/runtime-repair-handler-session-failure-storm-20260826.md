# Handler and session failure storm — root-cause baseline

Observed at 2026-08-26 07:03–07:15 UTC from the runtime `metrics`, `events`, and `sessions` tables through the read-only query interface.

## Health baseline

| Signal | Current | Acceptance threshold | State |
|---|---:|---:|---|
| `handler.failed-count` | 520 | below 500 | failing |
| `handler.success-rate` | 0.6711 | at least 0.8 | failing |
| `session.error-rate-6h` | 0.2067 | at most 0.3 | passing |

The raw six-hour window contained 521 `handler.failed`, 1,067 `handler.completed`, and 1,067 `handler.started` events. The most recent 30 minutes still contained 55 failures and 137 completions, so the handler problem is current rather than only historical. Sessions in the same six-hour window were 791 done, 198 interrupted, 7 running, and 2 error (1,002 total); the public session metric counts interrupted outcomes and remains under its threshold.

## Dominant current classes

1. **Stale Task execution race: 180 failures (34.5% of the 521 failures).**
   - 150 terminal and 30 retrying occurrences were the same task: `evaluation/runtime/evaluation-feedback/aks-explorer`.
   - Error: `Task evaluation/runtime/evaluation-feedback/aks-explorer is no longer current`.
   - Source path: `src/app/app-task-runtime.ts`. A Task may become non-current after claim but before `runtimeTaskAttempt()` builds its exact public view. The outer controller currently records this expected supersession race as `handler.failed` and retries it, creating a failure loop even though stale results are already fenced from mutation.
   - Repair requirement: recognize the post-claim non-current race as a stale disposition, safely release/reconcile only a still-live replacement, and do not throw it to the controller failure metric. Add a regression that changes or completes the Task between claim and executor-attempt construction and proves no `handler.failed` retry loop.

2. **Task result admission/validation loop: at least 62 failures.**
   - 36 `Task result conflicts with existing Condition ...` failures.
   - 16 other `Handler result was rejected ...` schema/semantic failures.
   - 10 `Handler actions were rejected ...` failures.
   - The repeated Condition conflicts span multiple tasks and exact `app-request:*` Conditions, not one corrupt task.
   - Source path: `src/app/app-task-runtime.ts`, especially `openTaskAppDependencyConditions()`, `admitTaskAppDependencies()`, and `mergeTaskConditions()` in the waiting-result path. Runtime combines canonical open dependency Conditions, model-returned Conditions, and dependency-derived Conditions. A model that preserves an already-open wait in both representations can collide with the canonical Condition under the same identity; the whole otherwise-valid waiting result is then converted to an error and retried.
   - Repair requirement: keep the canonical open App-dependency Condition authoritative for an existing identity, deduplicate compatible redeclarations without admitting duplicate work, and continue rejecting genuine retargeting or incompatible new Conditions. Add regressions for a preserved exact open request plus a model-returned Condition/dependency redeclaration, and for a genuinely conflicting Condition that must still fail.

## Secondary classes

The six-hour window also contains 53 idempotency-key reuse failures from workflow event emission and 25 incident-intake stable-local-key failures visible in the grouped failure evidence. They are material but are not the two dominant Host mechanics named by this repair goal; the isolated repair should avoid broadening into unrelated App workflow policy unless a targeted regression proves the same Host root cause.

## Required verification and rollout boundary

Implement in an isolated Git task workspace using the existing `verified-coder` workflow. Run the targeted App Task runtime/controller tests plus TypeScript checking. Do not edit runtime databases or deploy/restart from the source-changing child. After the source repair is accepted, this parent must review the diff and regression output, then obtain fresh runtime metrics; activation or deployment is a separate explicit runtime operation if the source is not yet live.

## Repair receipts and fresh health sample

The isolated source-changing workflow produced and verified both repairs:

- `f5069492c0f11173a0f533c86a223e864b5ebfe9` — stale post-claim Task supersession is a fenced stale disposition rather than a handler failure, and compatible authoritative App-dependency Condition echoes deduplicate while genuine conflicts remain rejected.
- `07ae642ec608cad62019f43b5d050f9c0ca48068` — current live Task resources take precedence over older immutable completion receipts with the same Task ID.
- The integration worktree branch `repair/handler-failure-storm-20260826` contains rebased equivalents `7343147a` and `b861419e`. On 2026-08-26 at 16:47 UTC, its focused runtime and reconciler run passed **189 tests, 0 failures, 866 assertions**, and `bun run check` completed with no TypeScript errors.

A fresh read of the live `/api/metrics` projection at 2026-08-26 16:47 UTC showed:

| Signal | Fresh current | Acceptance threshold | State |
|---|---:|---:|---|
| `handler.failed-count` | 656 | below 500 | failing |
| `handler.success-rate` | 0.7405 | at least 0.8 | failing |
| `session.error-rate-6h` | 0.0185 | at most 0.3 | passing |

The handler thresholds remain unmet because neither repair commit is an ancestor of the live source checkout's `main`, and the deployed runtime therefore has not activated the fixes. The primary checkout also has concurrent uncommitted edits in `src/app/app-task-runtime.ts` and `src/app/app-task-runtime.test.ts`, so integrating by overwriting or stashing that checkout would risk another owner's work. **Exact external blocker:** the checkout owner must first reconcile those overlapping edits, merge/cherry-pick the two verified repair commits (or their rebased equivalents), and authorize the separate deploy/restart operation. After that observable activation, trigger a fresh metrics snapshot and re-read the same three live metrics; the rolling six-hour handler window may still need to age out before both thresholds cross.
