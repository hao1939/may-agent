# Persistent-workflow recovery trial: implementation map

Source baseline: Host `20049916b79d2ba2d2265edf5eeb605ff0e59c05` (merged PR #226). Design baseline: `docs/proposals/recovery-from-execution-evidence-20260922.md` at Apps commit `c812595d71c35ed27005e4534004c5c32da5c277`.

## Current production path

1. **Input admission and exact caller identity.** `src/app/core/inbox/app-inbox-host.ts` validates App input and calls the configured `AppTaskAttacher`. `src/app/core/state/inbox.ts:admitTaskInput` persists the input-to-Task admission and creator identity. `src/app/core/tasks/app-task-runtime.ts:attachLoadedAppTask` is the installed-runtime adapter. The creator `{appId, taskId}` is the authority used by `tasks update`; it is not inferred from prose.
2. **One fenced attempt.** `src/app/core/tasks/app-task-reconciler.ts:claimObservedAppTask` claims the current Task generation and retains `previousAttempt`. `src/app/core/tasks/attempt-runner.ts` selects the App-authored handler, constructs the Task workspace/context, and settles only the claimed generation/resource version.
3. **Workflow execution and evidence.** `src/app/adapters/executors/workflow.ts:createTaskWorkflowRunner` builds the normal workflow Task prompt and calls `src/lib/workflow-tool.ts:runWorkflowDirect`. A throw becomes `HandlerExecutionFailed`; a `WorkflowExecutionFailure` keeps its workflow-run identity. No structured workflow output is supplied to Task settlement on that path.
4. **Failure settlement and paced recovery.** `src/app/core/tasks/attempt-runner.ts` calls `failAppTaskAttempt` for a non-blocked execution failure. `src/app/core/tasks/app-task-reconciler.ts:failAppTaskAttempt` records the failed attempt, first caller report, and retry deadline. `src/app/core/tasks/app-task-state.ts` and `app-task-recovery.ts` own pacing/recovery; an unchanged deterministic handler is not silently replaced.
5. **Exact caller return.** `src/app/core/tasks/app-task-reconciler.ts:readAppTaskAdmissionOutcome` selects one input's answer or report. `src/app/core/inbox/app-inbox-host.ts:recoverTaskResults` updates only the linked caller input. A report is not a successful answer and does not close the caller assignment.
6. **Real owner judgment.** `src/app/adapters/executors/managed-agent.ts` supplies the original Task, acceptance, prior attempt, waits, children, events, installed App contracts, ordinary tools, and finish schema. `src/app/app-task-read-tool.ts` gives the bound caller `get`, `contract`, and creator-authorized `update`; update is generation-fenced and reuses the existing destination Task.
7. **Authorized correction.** `src/app/core/tasks/task-revision.ts` and the admission mapper apply a creator revision to the same Task. The revision preserves creator, parent, attempts, and unrelated Conditions while invalidating stale execution results. The App mapper—not Host retry policy—selects the revised handler.
8. **Healthy completion and caller answer.** The revised healthy workflow runs through the same production workflow adapter and Task settlement. `AppInboxHost.recoverTaskResults` returns the accepted answer to the original caller input; the checker reads the effect and stores independently.

## Controller, scheduler and lifecycle composition (supervisor correction)

The prior trial called the runtime primitives itself. The automatic trial instead
composes the actual installed Host routes and seeds one initial delegation. These are
source-verified connections at Host `20049916`, not by themselves execution receipts:

1. `app-task-runtime.ts:installConventionTaskControllers` installs `AppTaskController`
   and `AppTaskRecoveryScheduler`. Controller dispatch calls `reconcileTask` and its
   `finally` calls the scheduler's `stateChanged()`. `startAfter` can hold initial
   fixture admission without replacing any later scheduling decision.
2. `attempt-runner.ts` persists `failAppTaskAttempt` and emits
   `project.task.reconciled` with the exact Task, generation, attempt and retry
   deadline. Failed execution returns no accepted handler result. The persisted
   deadline, not harness sleep/dispatch, owns the next workflow attempt.
3. `composition/app-inbox-runtime.ts` consumes that natural lifecycle event and calls
   `host.refreshTaskResults(appId, taskId)`. Its normal startup/missed-notification
   recovery also invokes inbox recovery internally. Neither is a harness-authored
   failure/success wake or manual result projection.
4. The inbox's `onRequestUpdated` publishes `appInputFeedbackEvent`; only App-sourced
   input carries an App caller link. The inbox runtime freezes exact event admission
   and Condition routes, and the Task capability applies the feedback to the original
   caller. The existing Task router/controller provides the owner execution.
5. The owner's ordinary tools expose source/command/contract evidence and authorized
   same-Task update. A source repair is not necessarily a specification revision.
   The recovery scheduler retries the selected workflow from its persisted eligibility;
   the helper's fresh subprocess reads the current executable bytes.
6. Successful settlement emits the same lifecycle event. Exact result projection and
   caller feedback wake the owner for outcome consideration. The independent audit
   Condition must survive that sequence unchanged.

The experiment seeds initial fenced owner delegation synchronously before controller
execution; this stays separate from recovery. After admission it does not call
`reconcileLoadedAppTaskOnce`, `recoverTaskConditions`, or `recoverTaskResults`, nor
emit synthetic failure/success wakes. Read-only observation and bounded shutdown
are not recovery scheduling. No production schedule, live installation or budget
is changed by selecting temporary fixture composition.

## What already works, from retained evidence

- PR #226 repaired the public validation connection. `/app/.state/review-pilots/apps-health-20260922/repair/PR225-ROLLOUT-REVIEW.md` records the prior hidden diagnostic, the exact minimal repair, CI, isolated socket comparison, merge and live activation. That is admission evidence, not model-recovery evidence.
- The rollout itself exercised same-Task retry after restart/stale settlement without duplicate deployment and preserved a separate Evaluation obligation; the proposal cites `recovery-design-task-after.json` and `pr226-live-verification.json`.
- `src/app/core/tasks/conversation-runtime.test.ts` exercises real runtime failure return without closing the caller, but its executor decisions are scripted. It proves mechanics, not agent judgment.
- `/app/.state/review-pilots/task-contract-unification-20260920/paired-owner-revision-probe.ts` exercises real May mapping/Host ingress in isolated stores and verifies same-Task revision plus unrelated-wait preservation, but does not run the scheduler or a model.

## Historical break classification

| Case | First broken boundary | Classification |
| --- | --- | --- |
| PR #225 public admission | `EventInterface` boolean precheck hid shared validator detail | mechanics/connectivity; fixed by #226 |
| Evaluation execution returned `converged` with `evaluator-failed` and no report | workflow semantic result mislabeled required-operation failure | App judgment/contract; runtime could not retry a declared success |
| Literal contract collapsed to `string` before #225 | installed interface omitted enforced alternatives | mechanics/discovery |
| May stopped carrying post-adoption review after two rejected requests | remaining acceptance disappeared from owner result | judgment/obligation tracking |
| Scout rationale correction stayed in May conversation | useful correction never used existing owner-input route | judgment/return-route use |
| Creator provenance changed completed review fingerprint | unrelated reference joined subject identity | mechanics/reference selection |
| Repeated deterministic handler | scheduler retries same method but cannot authorize replacement | authority/judgment, intentionally not automatic Host behavior |

Sources: `/app/.state/review-pilots/apps-health-20260922/repair/WHY-SELF-REVIEW-MISSED.md`, `PR225-ROLLOUT-REVIEW.md`, and the approved proposal.

## Automatic trial result

The corrected `run-unknown-failure-trial.ts` installed controllers, scheduler,
`attachEventPersistence` and `startAppInboxRuntime` with ordinary Task capability
callbacks. Retained production dispatch profiles establish retry enqueued at
`1790062433253` before the owner finished; its single-capacity queue wait was 39,406 ms.
Normal failure and success feedback each led to an actual owner session, the source
repair was model-authored, and original/input/control settled without author scheduling.
Generation and workflow stayed unchanged. No Host candidate follows.

`REPORT.md` retains exact source/evidence identities and post-run oracle corrections.
The executed harness snapshot and hardened final source are different facts; the paid
trial was not rerun to erase that distinction. Seeded delegation, one slot, local
fresh-helper activation and the in-process Host composition remain seams.

## Earlier manually advanced unfamiliar-code trial

The earlier `run-unknown-failure-trial.ts` reused the production path above but provides ordinary
coding/search/command tools and one `deliver-order` workflow invoking a fresh helper
process. A generic error returns to the exact owner. Source, order contract and command
stderr are discoverable rather than injected as diagnosis. The owner performed the
one-line source repair; production retry used those new bytes on the **same generation**.
Its unchanged `tasks.update` was not a requirement revision despite the model's prose.
No `implementationRevision` input field, new Task, selected alternate method or Host
fallback was needed. Final owner inspection and a fresh-order worker control passed.

See `REPORT.md` for durable exact evidence, source hashes, 2 model sessions/costs,
independent supervisor verification, and both harness-only corrections. The author
resumed the exact store after correcting an overly broad prompt check, then audited
existing completion after correcting a root-group/task-row count. These interventions
limit the claim to bounded restoration, not a clean unattended run. The operation did
not touch live state; its source repair was not applied to any installation.

Existing optional Evaluation ongoing-failure review is an additional reasoning route
(`evaluation.app/app.ts` → automatic review/publication → May message intake). It is
opt-in, allowance/capacity limited, and not proved by this fixture; no new monitor is
justified. Route audit: `/app/.state/review-pilots/apps-health-20260922/repair/RECOVERY-REASONING-ROUTES.md`.

## Prior mechanical prerequisite disposition

The harness retained exact prompts/transcripts; workflow run and Task attempt IDs; the first caller report; parent and child generations; unrelated Condition identity before and after; effect and Task/input counts; elapsed time/model configuration; pre-execution source hashes; and every unsuccessful run. See `REPORT.md` for current-first results and exact hashes.

The earlier failure-before-effect case passed a prepared-alternative path, not unknown-failure repair: the agent discovered the failed child from ordinary evidence, used creator-authorized update on the same child, preserved explicit workflow selection and the unrelated wait, and the revised workflow produced the same externally checked one-marker effect as the worker control. This did not prove automatic scheduling because reconciliation was manually driven.

The acknowledgment-loss baseline then produced two markers even though the owner read the first effect before selecting method B. The demonstrated correction is a fixture operation guard—exclusive create of a stable target plus exact expected-content verification—not a Host recovery or model-judgment change. Under that guard the retry/fallback returned `reused:true`, the same child converged, the original input became done, and the count stayed one. Direct operation checks rejected malformed or inaccessible existing evidence without writing.

The harness mocks the controlled business effect and deterministic workflow bodies. Admission, Task stores, attempts, workflow adapter, workflow evidence, agent provider call, creator update, settlement, caller report, and caller answer use production code. Initial dependency admission is seeded from a fenced owner claim and exact reconciliations are manually driven. No live Task, service, credentials, deployment, or production database was mutated.

No Host recovery code change follows from these results. The file guard is bounded to a single-host fixture and is not a universal exactly-once mechanism; real operations need their own supported idempotency or current-state contract.
