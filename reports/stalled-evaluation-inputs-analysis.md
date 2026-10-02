# Stalled Evaluation input recovery analysis

Host baseline: `dc92e4f516a848fc0a506c59b04952fe5e7bccdd` (`/app/worktrees/deploy-metrics-20261002`). This is source/read-only analysis; no live database mutation was performed.

Affected retained inputs:

- `app_5171df85-b351-4b15-b997-d3ee1550f4cf`
- `app_17420ad9-7363-40e1-8ade-5101ca98a2d6`
- `app_8558acbf-80fc-40b9-a120-08a807840bb7`

Each row's exact admission key is `task:<input-id>` and its target is Evaluation Task `runtime/task-outcome-selector`.

## Root cause and ownership

There are two connected gaps.

1. `AppInboxHost.#projectTaskResult` treats a successful read of a non-reviewable Task state as recovery of the earlier *read failure*. When `observeTaskDependency` returns pending without a selected report, lines 663-667 of `src/app/core/inbox/app-inbox-host.ts` call `resolveAppInboxRecovery(..., "input-result", ...)` and return. That stamps `recovery_json["input-result"].recoveredAt` and clears pacing, but it does not call `completeTaskInput`, does not notify a caller, and does not re-admit or reattach the input. `recoveredAt` therefore means only “the dependency read worked again,” not “this input has a result or a durable Task obligation.”

2. The exact Task dependency reader in `src/app/core/tasks/app-task-capability.ts` (lines 148-190) returns ordinary `pending` whenever the Task exists and the exact admission has no answer, closure, or selected report. It does not verify that the admission is represented by a pending trigger, the current attempt, or `status.inputWaits`. Meanwhile `resultInputKeys` in `app-task-reconciler.ts` (lines 663-690) permits an exact key only when it is assigned to the current attempt or is already in `inputWaits`. Thus an admitted key that has fallen out of all those ownership locations is readable as pending forever but cannot be selected truthfully by a later attempt. Newer selector inputs can continue while these exact keys remain stranded.

The owning correction belongs to common Task admission/reconciliation, not to an App policy and not to `recoveredAt`. App Inbox owns the exact caller row and result projection; Task reconciliation owns preserving and re-presenting every admitted, unanswered key.

## Smallest correction

Add one idempotent Task-admission integrity repair to the existing Task startup/recovery path:

- Scope candidates from retained App Inbox links: `status='handling'`, `waiting_on_kind='task'`, exact `waiting_on_id`, and exact `task_admission_key`.
- Load that exact admission and require all of: matching App/Task identity, admission generation no newer than the current Task, no `resultAttemptId`, and a retained `inputEvent`.
- Treat the admission as healthy if its key is already in a pending Task trigger, the current running attempt's `events`/`continuedInputKeys`, or `resource.status.inputWaits`.
- Only when it is in none of those locations, atomically add `inputWaits[key] = { taskGeneration: admission.taskGeneration, conditions: [], pending: true }` through the existing `retainTaskInputWait` semantics, mark/enqueue the same Task pending as appropriate, and retain the original admission and inbox row unchanged.
- Do not synthesize an answer/report, do not clear `recovery_json`, do not complete/delete the inbox row, and do not create a new admission. The next claim already knows how to render a continued input from `app_task_admissions.inputEvent` (`app-task-context.ts` lines 49-57).

This preserves exact input identity and makes the three existing keys selectable again. A subsequent honest `report:true` binds `reportAttemptId`/`reportRevision` while retaining the obligation; a true answer binds `resultAttemptId`, after which App Inbox can atomically project the result to the same row with `completeTaskInput`.

The repair should also stop resolving `input-result` diagnostics from being interpreted operationally as settlement. No schema change is needed: `recoveredAt` may remain a read-recovery marker, but tests and diagnostics must not use it as evidence of caller return or Task attachment.

## Existing candidate assessment

Branch `fix/recovery-host-mechanics-20261002` (`e7f36567`, base change `2f096fa6`) does **not** cover this state. Its Task change allows an honest incomplete report to advance its already-claimed bounded event batch while preserving later events. Its regression begins with intact events 1-36. It does not change App Inbox result recovery, does not scan unresolved admissions, and does not recreate an `inputWait` for an already admitted key absent from trigger/attempt/waits.

That candidate prevents the demonstrated future backlog loop and should remain; the orphan-admission repair is a small complementary candidate, not a replacement.

## Focused regression tests

1. `app-task-runtime.test.ts`: **repairs an exact admitted inbox input absent from trigger, attempt, and input waits**. Create a synthetic admitted input with saved `inputEvent`; construct the legacy orphan state; run installed Task recovery; assert the same admission key appears once in `inputWaits` as pending, no result/report is fabricated, the inbox row remains handling, and the next claim receives that exact input through `continuedInputs`.
2. Same suite: **does not duplicate healthy ownership**. Cover each healthy location (pending trigger, running attempt event/continued key, existing input wait), plus answered and closed admissions; assert no duplicate trigger/admission and no unrelated Task mutation.
3. `app-inbox-host.test.ts`: **input-result read recovery is not input settlement**. First dependency read throws `database is locked`, second returns pending/no report, then Task repair exposes the key and a later exact report/answer arrives. Assert `recoveredAt` alone leaves the row handling with no result; report delivery uses the same key; answer changes only that row to done.
4. `test/integration/task-input-feedback.test.ts`: admit three synthetic inputs to one reused selector, process newer inputs, orphan the three via the supported fixture/state boundary, restart recovery, and prove all three exact keys reappear and can independently receive report/result without deleting other obligations.

Run the focused tests, `bun run check:ci`, then full `bun run ci` on the candidate revision. Existing baseline checks run during this investigation: `bun test src/app/core/inbox/app-inbox-host.test.ts src/app/core/tasks/app-task-common-lifecycle.test.ts` passed 75 tests / 0 failures, but those tests do not cover the orphan state.

## Live post-deploy evidence

Use read-only canonical reads; do not edit SQLite:

1. For each exact input ID, confirm the same inbox row and `task_admission_key` remain (no replacement input/admission), initially handling.
2. Read Evaluation `runtime/task-outcome-selector`; each `task:<input-id>` must be visible either in the active attempt's exact assigned/continued inputs or in `currentObligations.inputWaits`. Record generation/resourceVersion and attempt ID.
3. Verify each admission remains one row and acquires either a `reportAttemptId`/incremented `reportRevision` (truthful blocked return, inbox still handling) or a `resultAttemptId` (accepted answer). `recoveredAt` without one of these is not success.
4. Verify App Inbox projects an accepted answer onto the same input ID (`status=done`, non-null exact result/completed time), while report-only inputs remain retained and visible. Confirm unrelated selector obligations and newer inputs are unchanged.
5. Re-read `may.evaluation-unfinished-review-age-seconds` after its normal sample. A decrease is corroboration only; exact row/admission/Task evidence above is the acceptance evidence. If a report rather than final review is truthful, the metric may remain elevated and must not be gamed by deleting or closing the input.

## Candidate and review status (2026-10-02)

The complementary Host candidate is now branch `fix/orphaned-task-input-recovery-20261002`, HEAD `d2b5343712eac6c765e882ae71922c1b6fb72a63`, based on deployed `dc92e4f5`. Its four focused commits are:

- `2b7b90f5` — restore exact unanswered orphan admissions through the existing Task input-wait mechanism;
- `19bd141c` — add cancellation/reopen fencing after independent review found historical cancellation resurrection;
- `84b38463` — match canonical pending-trigger and running-attempt ownership shapes;
- `d2b53437` — drain more than the first 512 eligible admissions with a finite snapshot-population bound.

The final independent Bob review approved the complete `dc92e4f5..d2b53437` diff. It confirmed both earlier blockers are resolved, exact admission identity and generation are preserved, existing mutation/action fences remain in force, and the repair fabricates neither settlement nor deletion. Review session: `/app/.state/sessions/s_1790919979962_ac3c392f-c16e-45df-acf0-2fe344c8fd64`.

Verified checks on final HEAD:

- focused runtime regression: 167 passed, 0 failed, including 513 genuine orphan admissions drained in one ordinary recovery invocation;
- independent review suite: 243 passed, 0 failed, 3,044 assertions;
- `bun run check:ci`: passed;
- `git diff --check dc92e4f5..HEAD`: passed.

A previous full `bun run ci` progressed through the broad suite but was terminated by the attempt timeout, so it is **not** a pass. Full Host CI, publication/integration, authorized deployment, and live proof on the three retained Evaluation rows remain separate gates. No live database or installed runtime state was changed by this candidate work.
