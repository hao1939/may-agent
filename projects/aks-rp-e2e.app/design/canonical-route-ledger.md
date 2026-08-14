# AKS RP E2E Canonical Route Ledger

**Status:** Migration gate
**Applies to:** `projects/aks-rp-e2e.app/app.ts`
**Parent decision:**
[`../../may-agent.app/docs/3-proposals/inbox-scope-reduction.md`](../../may-agent.app/docs/3-proposals/inbox-scope-reduction.md)

## Purpose

This ledger is the behavior contract for replacing the AKS
`defineProjectApp` manifest and imperative `routeAksEvent` router with one
canonical `defineApp` declaration. The cutover is not complete until every
legacy selector, schedule, action, and router branch below has one tested
canonical route and the legacy route has been deleted.

The route classes are:

- **input** — an addressed completion or reply obligation, durably owned by an
  App inbox item;
- **task intent** — a fact from which pure policy derives stable desired work;
- **exact wake** — a canonical `(appId, taskId)` address for one existing task;
- **Condition wake** — an observation matched by Conditions already stored on
  exact tasks;
- **observer** — bounded scheduled collection that publishes facts;
- **projection** — a read model derived by the host/task-state projection path;
  and
- **observation** — a persisted fact with no AKS durable work authority.

An input may deterministically attach a task as its disposition. That remains
one inbox-owned obligation; it is not independent inbox and event-to-task
admission. An untargeted fact may refresh one `TaskIntent` and satisfy stored
Conditions in the same task-family admission.

## Admission identities

| Route                       | Durable replay identity                  |
| --------------------------- | ---------------------------------------- |
| Event subscription to input | `(appId, subscriptionId, eventId)`       |
| Direct action/input         | caller request identity plus App address |
| Input schedule              | `(appId, scheduleId, timeSlot)`          |
| Task intent from event      | `(appId, eventId, resolvedTaskId)`       |
| Exact or Condition wake     | `(appId, eventId, taskId)`               |
| Observer publication        | observer fact's stable source identity   |

Queue entries are deliberately absent: enqueue and coalescing happen only
after the durable continuation exists.

## Addressed inputs

| Legacy source                                     | Canonical route                               | Required result                                                                                                                                         |
| ------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project.owner.requested`                         | subscription -> `owner-review` input          | One inbox item retaining source correlation; route may attach `runtime/owner-review`.                                                                   |
| `project.comment.created`                         | subscription -> `owner-review` input          | One inbox item and a completion/reply path.                                                                                                             |
| `message.created` with `approval-decision` intent | subscription -> `approval-decision` input     | One inbox item. Parsing, task lookup, decision application, and `message.resolved` move out of the event router into bounded App handling.              |
| `project.problem.investigation.requested`         | subscription -> `problem-investigation` input | One inbox item whose deterministic route attaches the stable problem-solver task.                                                                       |
| `project.stall.review.requested`                  | subscription -> `stall-review` input          | One inbox item whose deterministic route attaches `runtime/project-stall-review`.                                                                       |
| `project.approval.requested`                      | subscription -> `approval-dispatch` input     | One inbox item whose deterministic route attaches the packet-keyed approval-dispatch task.                                                              |
| `regular-learning` schedule                       | input schedule -> `owner-review`              | One inbox item per schedule slot; no intermediate event.                                                                                                |
| `app-ops-heartbeat` schedule                      | input schedule -> `owner-review`              | One inbox item per schedule slot; no intermediate event.                                                                                                |
| Disabled focus schedules                          | delete                                        | Disabled compatibility configuration is not copied into the canonical manifest. Reintroduction requires a typed input and an explicit product decision. |

These selectors must not also appear in `tasks.subscriptions`. Any task they
need is attached from the inbox request, preserving one obligation and its
completion path.

## Deterministic task intent

| Event family                                              | Stable desired task                                                                                                                    | Notes                                                                                                                                            |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `aks.resource-migration.requested`                        | `runtime/unified-resource-migration-resource-liveness-v3`                                                                              | Pure migration intent.                                                                                                                           |
| `aks.task-state-migration.requested`                      | `runtime/unified-resource-migration-task-state-v1`                                                                                     | Pure migration intent.                                                                                                                           |
| `aks.task-tick-migration.requested`                       | `runtime/unified-resource-migration-task-tick-v1`                                                                                      | Pure migration intent.                                                                                                                           |
| `aks.repo-ref-condition-migration.requested`              | `runtime/unified-resource-migration-repo-ref-condition-v1`                                                                             | Pure migration intent.                                                                                                                           |
| `aks.project-state-residue-migration.requested`           | `runtime/unified-resource-migration-project-state-v2`                                                                                  | Pure migration intent.                                                                                                                           |
| `aks.spec-loop-ownership-migration.requested`             | `runtime/unified-resource-migration-spec-loop-ownership-v1`                                                                            | Preserve the current stable intent.                                                                                                              |
| `aks.feature-loop-ownership-migration.requested`          | `runtime/unified-resource-migration-feature-loop-current-v1`                                                                           | Preserve the current stable intent.                                                                                                              |
| `aks.feature-loop-history-migration.requested`            | `runtime/unified-resource-migration-feature-loop-history-v<1..5>`                                                                      | The validated batch remains part of the stable ID.                                                                                               |
| `aks.feature-loop-residue-migration.requested`            | `runtime/unified-resource-migration-feature-loop-residue-v<1..2>`                                                                      | The validated batch remains part of the stable ID.                                                                                               |
| `aks.scenario-loop-ownership-migration.requested`         | `runtime/unified-resource-migration-scenario-loop-ownership-v<1..2>`                                                                   | The validated batch remains part of the stable ID.                                                                                               |
| `aks.waiting-frontier-retirement.requested`               | `runtime/waiting-frontier-review`                                                                                                      | Preserve the current stable intent.                                                                                                              |
| `aks.waiting-frontier-migration-cleanup.requested`        | `runtime/unified-resource-migration-waiting-frontier-v1`                                                                               | Preserve the current stable intent.                                                                                                              |
| `aks.finite-holder-migration.requested`                   | `runtime/unified-resource-migration-finite-holders-v<batch>`                                                                           | The numeric batch remains part of the stable ID.                                                                                                 |
| Valid `pipeline.failure.observed`                         | `domain/master-validation-failure/<specId>`                                                                                            | Missing `specId` or fingerprint is observation-only and has a negative route test.                                                               |
| `project.test_run.completed`                              | `runtime/owner-review`                                                                                                                 | A system fact changes the standing review outcome; it does not create a reply obligation.                                                        |
| `project.stall.reviewed`                                  | keyed stall follow-up for `needs-work`/`escalate`; otherwise standing owner review or observation according to the structured judgment | Classification is data-dependent but pure; inbox translation returns `null`.                                                                     |
| `project.problem.resolved`, `.escalated`, `.inconclusive` | `runtime/owner-review`                                                                                                                 | Deterministic follow-through on a bounded workflow result.                                                                                       |
| `coverage.gap.detected`                                   | `runtime/owner-review`                                                                                                                 | Deterministic review desired state.                                                                                                              |
| `escalation.resolved`, `.dismissed` for `aks-explorer`    | `runtime/owner-review`                                                                                                                 | Deterministic review desired state.                                                                                                              |
| `metric.breach`, `metric.recovered` for `app-ops`         | `runtime/owner-review`                                                                                                                 | Stable desired review; unrelated metrics are observation-only.                                                                                   |
| `learning.feedback` for `aks-explorer` or `aks-reviewer`  | `runtime/owner-review`                                                                                                                 | Stable desired review.                                                                                                                           |
| `pipeline.test.nonpassing`                                | `runtime/owner-review`                                                                                                                 | Resolve directly from the progressive fact; delete the intermediate `project.owner.requested` emission.                                          |
| `aks.workspace.integrity.changed`                         | `runtime/owner-review`                                                                                                                 | The owner-review workflow evaluates existing task coverage and may no-op; the router no longer reads the global task tree to suppress admission. |
| `aks.scenario-test-inventory.observed`                    | `scenario-normalization`                                                                                                               | Persist the latest observation in the intent/trigger. Reconciliation performs the unchanged-evidence no-op; the router no longer emits a tick.   |
| `pipeline.queue.overdue`                                  | run-keyed notification task                                                                                                            | Deterministic, idempotent human notification; no App inbox request because no response is required.                                              |

All resolvers are pure. They return intent or `null`; they do not read task
state, emit events, write projections, or enqueue execution.

## Exact task wakes and Conditions

| Legacy source                                                                         | Canonical route                                                                                            | Migration requirement                                                                                                        |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `project.task.tick` with a task ID                                                    | exact wake                                                                                                 | Add `target.appId: "aks-rp-e2e"`; do not run broad resolution and do not manufacture a missing task.                         |
| Spec-loop, feature-compact, master-validation-compact, and repository-skill schedules | exact wake event schedule                                                                                  | Preserve staggered intervals and stable task IDs.                                                                            |
| Master-validation staging schedule                                                    | exact wake event schedule for `master-validation-staging-cycle`                                            | Collapse `aks.master-validation.check` and capacity-pulse hops. The task reconciler owns campaign/cooldown gating.           |
| `pipeline.spec.observed`                                                              | Condition wake(s), plus exact master-cycle Condition when a verified focused fix changes campaign evidence | Express the campaign wait in task state; delete campaign receipt scanning from `routeAksEvent`.                              |
| `pull-request.state`                                                                  | Condition wake(s)                                                                                          | Waiting repair and campaign tasks declare exact PR/head/review Conditions. Delete task-tree carrier scans and emitted ticks. |
| `aks.repo-ref.observed`                                                               | Condition wake(s)                                                                                          | Canonical subject is `repoRef:<ref>` with observed `commit`.                                                                 |
| `aks.repo-ref.changed` for `origin/main`                                              | exact master-cycle wake, preferably emitted directly by the observer                                       | Other refs remain observations unless a stored Condition matches.                                                            |
| `pipeline-run.state`, `pipeline.completed`, `pipeline-artifact.available`             | Condition wake(s)                                                                                          | Task IDs in lifecycle data are correlation subjects, not delivery targets.                                                   |
| `aks.node-image-publication.state`                                                    | Condition wake(s)                                                                                          | No App event handler.                                                                                                        |
| Approval-decision fact after bounded input handling                                   | Condition wake(s)                                                                                          | Waiting tasks declare the approval subject; no raw task-state scan in the subscription translator.                           |
| `project.approval.submitted`                                                          | Condition wake(s)                                                                                          | This is the decision fact produced while handling the original addressed message, not a second inbox obligation.             |

Unknown App IDs, Apps without task capability, missing tasks, and
target/resolver mismatches remain pending admission failures. They never fall
through to owner review or observation acceptance.

## Scheduled observers and published facts

| Legacy check schedule/event                                             | Canonical observer                               | Facts retained                                                                                               |
| ----------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `pipeline-observer` / `aks.pipeline.check`                              | pipeline observer every 60 seconds               | Pipeline run, artifact, spec, failure, progressive nonpassing, test-run completion, and queue-overdue facts. |
| `pull-request-observer` / `aks.pull-request.check`                      | pull-request observer every 300 seconds          | `pull-request.state`.                                                                                        |
| `workspace-integrity-observer` / `aks.workspace.integrity.check`        | workspace-integrity observer every 3,600 seconds | `aks.workspace.integrity.changed`.                                                                           |
| `scenario-test-frontier-observer` / `aks.scenario-test-inventory.check` | scenario-inventory observer every 1,800 seconds  | `aks.scenario-test-inventory.observed`.                                                                      |
| `repo-ref-observer` / `aks.repo-ref.check`                              | repo-ref observer every 600 seconds              | `aks.repo-ref.observed` and `aks.repo-ref.changed`.                                                          |

The check events are deleted. An observer receives bounded read/log ports and
returns facts; it cannot mutate task/inbox state or call an event emitter as a
second side-effect path.

## Projection and observation-only facts

| Fact                                                                                              | Canonical handling                                                                                                                                |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project.task.reconcile.started`, `.skipped`, `.reconciled`, and `project.task.handler.recovered` | Persist as lifecycle evidence. Task/read-model projection owns owner-visible state. Move subject task IDs into event data and remove App routing. |
| `project.task.reconciled` spec-live and feature-compact files                                     | Fold into the task-state projection or the producing task's bounded completion path; do not retain an arbitrary App event callback.               |
| `aks.repo-ref.observed` and non-main `aks.repo-ref.changed` with no Condition                     | Observation only.                                                                                                                                 |
| Pipeline run/artifact/completion facts with no Condition                                          | Observation only.                                                                                                                                 |
| `aks.node-image-publication.state` with no Condition                                              | Observation only.                                                                                                                                 |
| `pipeline.spec.observed` with no Condition/campaign relevance                                     | Observation only.                                                                                                                                 |
| Invalid or unrelated selector inputs                                                              | Observation or explicit rejection according to ingress validity; never generic owner fallback.                                                    |

Projection work is idempotent and derived from canonical task state. Removing
the lifecycle callback is gated on proving that the host/task completion path
updates `project-state.json`, `project.json`, spec-live proof, and compact-loop
projection with equivalent restart recovery.

## Actions

Every canonical action uses `toInput`; no action emits an actionable event.

| Action family                                                                                                                                                                             | Input and disposition                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `execute-run`, `advance-project`, `watch`                                                                                                                                                 | `owner-review` input; deterministic route attaches standing owner-review task while retaining action completion.                                                                                   |
| `investigate-problem`                                                                                                                                                                     | `problem-investigation` input; attach keyed problem-solver task.                                                                                                                                   |
| `review-stall-risk`                                                                                                                                                                       | `stall-review` input; attach standing stall-review task.                                                                                                                                           |
| `dispatch-approval-packet`                                                                                                                                                                | `approval-dispatch` input; attach packet-keyed task.                                                                                                                                               |
| `pulse-spec-loop`, `pulse-feature-compact-loop`, `pulse-master-validation-compact`, `pulse-scenario-frontier`, `pulse-legacy-branch-reconciliation`, `pulse-repository-skill-maintenance` | typed `task-control` input; validate the requested task family, then attach/wake that exact desired task. The inbox item preserves action completion; no independent task event route is admitted. |

## Cutover assertions

The route fixture must cover every row above and prove:

1. each representative event produces exactly one per-App result: inbox,
   task intent, exact wake, Condition wake, observation, or explicit failure;
2. input and task selectors never both admit the same AKS obligation;
3. addressed events preserve source/parent identity and completion delivery;
4. task facts produce no inbox item;
5. replay produces no duplicate inbox item, task generation, trigger, or human
   notification;
6. restart after durable admission but before enqueue still reconciles;
7. one failed durable AKS route prevents composite event acknowledgment;
8. lifecycle subject IDs never act as exact wake addresses; and
9. removing `routeAksEvent` leaves no check-event, emitted-tick, raw task-state
   scan, projection, or human-delivery side effect without a canonical owner.

## Deletion gate

The AKS compatibility descriptor can be deleted only after:

- this ledger is represented by table-driven route tests;
- all observer adapters use canonical bounded contexts;
- `app.ts` exports one `defineApp` manifest;
- production AKS code has no `@may-agent/sdk/legacy` import;
- existing task IDs/state pass the read-only compatibility audit; and
- focused watcher, workflow, route, restart, reload, and task-recovery suites
  pass.
