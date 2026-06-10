# Project Task Tree

This folder stores the current project execution decomposition for `aks-rp-e2e`.

`tasks/` is not an AKS domain folder. It is the project execution tree: how the
project is broken into bounded tasks that agents can execute, verify, and roll
up.

The task tree is also the project's current structured understanding. A branch
should exist because it explains how the AKS learning goal is being solved, not
because a workflow run, retry, or transient failure happened. Runtime history
lives in May-agent workflow/session history, app-local compact JSONL files when
useful, and linked evidence artifacts.

## Files

- `tree.json` - canonical current task tree.
- `archive/` - historical task-wave files kept for reference only.

May-agent infrastructure owns event, session, workflow-run, and attempt history.
Task nodes in `tree.json` may link to infra trace ids when available, but this
folder does not keep a parallel task event log.

## Rules

- Only leaf tasks are executable.
- Every task should be meaningful as one of: a project/domain responsibility, a
  decomposition of that responsibility, an executable leaf, or a review that
  corrects the decomposition. Avoid vague branches such as "follow up",
  "try again", or per-run root planner tasks.
- Each decomposed parent should make sense to a reviewer: its children should
  explain how the parent will be resolved. If that is no longer true, create a
  review/hygiene task to split, rewrite, or supersede the branch.
- Bad, duplicate, stale, or misleading branches should be marked `superseded`
  with a short reason and replacement link when possible. Do not keep building
  project understanding around them.
- The top-level task tree should follow the project value loop, not workflow
  implementation details: learn feature intent, generate runnable specs,
  execute specs through runner/replays, diagnose evidence, feed results back
  into the model/specs/feature state, then pick the next work.
- The active root lanes are durable responsibilities:
  `feature-knowledge-and-specs`, `spec-runner-and-replays`,
  `evidence-feedback-and-model-update`, and `user-review-workspace`.
- Learning is not terminal by itself. A feature is useful only when source
  knowledge, spec shape, replay execution, evidence diagnosis, and model
  feedback close the loop or expose an exact gate.
- Test-spec design has a standard contract. A spec-ready task is not accepted
  unless the spec has scenario/scope, ordered `testLifecycle`, concrete
  operations, meaningful product assertions, execution variants,
  execution strategy/gates, deduped run artifacts/evidence, and explicit
  non-goals.
- Test-spec names should describe the product behavior, not the environment or
  user surface. For example, use "ManagedSystem pool add-existing lifecycle" as
  the spec title and show REST/CLI/staging/standalone as execution metadata.
- Environment and client surface are variants, not automatic spec boundaries.
  Do not create dedicated specs only because behavior is run in staging vs
  standalone, or through REST vs CLI vs generated clients. Create a separate
  spec only when the product lifecycle, input space, or assertions materially
  differ.
- Repeated parameter rejection checks should usually be one matrix spec when
  they share fixture, REST operation pattern, and preservation assertions. For
  ManagedSystem, mode/vmSize/count/type rejection belongs under one field
  rejection matrix rather than separate human-facing spec cards.
- Weak or misleading spec shape is a domain task. If a spec lacks full
  lifecycle, uses shallow assertions such as `rp.request.accepted=true` as the
  main claim, mixes adjacent scenarios, or shows duplicate run artifacts, create
  a feature-local audit/fix leaf under that feature branch.
- Task leaves that create or revise a test spec should include acceptance
  criteria for the spec contract. Verification should inspect both the spec file
  and the feature page rendering before accepting the task.
- Dry-run is not e2e verification. A runnable spec is verified only after a real
  execution reaches verdict-driving product assertions, records result and
  diagnosis, records cleanup state, and produces evidence that can feed the
  model. Dry-run proves resolution and wiring only.
- Executable spec tasks should use `workflow: "spec-runner"` with task context
  fields such as `specId`, `target`, `surface`, `host`, `active_run_id`, and
  `active_request_id` when known. The project engine handles these tasks
  natively by running or reconciling `bun runner/spec-runner.ts`; it must not
  ask a generic worker session to remember how to run the spec.
- A native spec-runner task is accepted only from terminal live artifacts:
  `result.json`, `diagnosis.json`, `summary.md`, and `steps.jsonl`. A canceled
  dry-run, local check, queued run, or running status keeps the task unverified.
- When a native spec-runner task finishes, model/spec feedback should be a
  separate leaf under `evidence-feedback-and-model-update`; the runner task
  proves what happened, and the feedback task decides how that evidence changes
  the knowledge model, spec, replay, or next work.
- The feature-learning queue is a conveyor. After one selected feature is
  accepted or externally gated, return to `evidence/archive/feature-learning-queue.md`
  and schedule the next safe local feature before treating the project as
  blocked.
- A task can be decomposed into child tasks when it is too large or unclear.
- A blocked task is reviewable. If the ready frontier is empty, create or run a
  blocked-review leaf that classifies the blocker and looks for safe local
  unblock, split, correction, or evidence work.
- Escalation is a task overlay for confirmed ownership-boundary blockers, not a
  new top-level branch. When a blocked task truly needs another owner or human,
  store `escalation_id` and `escalation` on that task and emit
  `escalation.created` with owner, requested action, evidence, dedup key, and
  resume condition. `fixed` or `answered` resolutions move the task back to
  `ready`; rejected/dismissed escalations keep the task visibly blocked for
  review.
- `no_work`, "no safe local work", and "waiting" are not accepted terminal
  claims. Convert them into a concrete ready task, an exact blocked resume
  condition, a human-question task, or a superseded task with its replacement.
- Human-question tasks are explicit input boundaries. Keep them visible in the
  tree, but do not auto-review them as ordinary stale blockers.
- A worker claim is not completion; the claim must be verified before a task is
  accepted.
- The task is the context container. Store compact working context on the task
  itself, and use `tasks/context/<task-id>.md` only as a task-owned spillover
  file when the context becomes too large for `tree.json`.
- Reuse the task's primary session when continuing the same task or handling
  feedback on that task. The session preserves useful working memory that may
  not yet be obvious enough to structure, but important conclusions must be
  promoted into task context, outputs, evidence, or child tasks.
- Ordinary worker tasks store that primary session as `session_id`, with prior
  ids in `session_history`. The picker assigns a stable task-derived
  `s_task_<task-id>` session id before the task becomes active, so the tree can
  show what session owns the work while it is running and later wakes can resume
  the same transcript.
- Child tasks inherit a seed from parent task context. Small recursive child
  work may continue in the parent session; parallel child work should fork a
  new session seeded from the parent and write a completion packet back to the
  parent.
- Workers do not edit `aks-rp-e2e.app/tasks/tree.json` directly. The engine owns task updates,
  parent rollup, review-task creation, and continuation events.
- Parent tasks roll up from verified child state, then get a parent-review leaf
  when the parent needs audit or replanning before acceptance/blocking.
- New or materially changed cloud/staging execution patterns require an
  explicit task gate and a passing gate check. Established spec-runner tasks can
  use `context.live_run_policy: "repeatable-approved"` so the project can rerun
  them without repeated human approval. The runner must still set the exact
  `AKS_RP_E2E_ALLOW_CLOUD_MUTATION=<spec-gate>` value, run on the approved host,
  serialize the relevant `cloud:*` conflict scope, and record terminal
  result/diagnosis/cleanup evidence. Blocked-review tasks must not bypass gates
  or run mutation.
- Recurring responsibilities should not become top-level project work unless
  they directly express the AKS value loop. Planning, task-tree hygiene, and
  blocked-frontier review are engine/workflow behavior; when their output is
  real project work, create or update concrete leaves under one of the durable
  value-loop lanes.
- Planning is control-loop behavior, not dispatchable task work. The
  `project-planner` workflow may run one bounded planner-control pass, record
  the attempt in `planner-runs.jsonl`, and update `tree.json` with concrete
  domain leaves. Do not represent each planner wake, retry, or recovery as a
  normal leaf task.
- Legacy planning/control nodes such as `project-control`,
  `project-planning-loop*`, and `project-frontier-replan-*` are history only.
  They must not be leased by the worker picker, must not consume active
  capacity, and should be superseded when they appear in the executable
  frontier.
- The robust execution loop is: event or timer wakes the planner control loop;
  the planner repairs/rolls up/refills the task tree; `project.tasks.ready`
  wakes the picker; the picker leases ready leaves; workers execute leaves and
  emit completion; completion wakes the planner again. The timer is only a
  safety net for missed events or stale leases.
- Do not create top-level `project-control`, `execution-engine-audit`, or
  `project-frontier-replan-*` branches. Keep planner/engine history in runtime
  traces or archive material, and put current work under the feature/spec,
  runner, evidence-feedback, or user-review lane.
- When the project needs to speed up, create a small number of parallel,
  purpose-shaped leaves under durable lanes. Prefer an audit/design leaf first
  when the next implementation or staging step depends on knowing what is
  already true. Put the implementation/execution follow-up beside it as a gated
  child, not as a new root.
- Parallel feature extraction should use feature-local conflict scopes such as
  `feature:deployment-safeguards` or `feature:kms-etcd-encryption`. Do not put
  independent feature packets under one broad `feature-source-intake` scope,
  because that serializes work that can safely run in parallel.
- Live runner tasks should conflict on the scarce execution surface, for
  example `cloud:staging`, plus their exact `spec:<id>`. Local spec wiring,
  replay implementation, source extraction, and model-feedback tasks should use
  narrower scopes so they can continue while one live run is active.
- Feature-page requested test execution is tracked as a stable runner-backed
  evidence flow, not as one task per run. Keep durable system work in the task
  tree, such as runner ledger, request handler, adapter, UI rendering,
  diagnosis, and model-update proposal. Store individual requests and runs in
  the domain project's `../aks-rp-e2e/runs/` directory and platform workflow
  history.

## Good Shape

Good task breakdowns follow the feedback loop:

```text
project
  -> feature-knowledge-and-specs
    -> managedsystem-pool
      -> build reference packet
      -> extract input/expectation paths
      -> design atomic test spec with lifecycle, operations, assertions, gates
    -> next-feature-frontier review

  -> spec-runner-and-replays
    -> generate REST replay script
    -> dry-run/check replay
    -> run gated staging replay
    -> harden runner/script issues before product verdicts

  -> evidence-feedback-and-model-update
    -> diagnose run result as product/test/environment/source outcome
    -> update model/spec/feature state with cited evidence
    -> create follow-up feature/spec or runner tasks

  -> user-review-workspace
    -> render feature brief, specs, runs, evidence, and model impact
    -> expose task state and human steering on kanban
```

Avoid growing the root with branches like `project-frontier-replan-17`,
`retry-ui-fix`, or `investigate-again`. If that work is real, attach it under
the appropriate value-loop lane with a clear goal and acceptance criteria.

## Current View

Read `tree.json` for the current operational project state. `../project.json`
contains the structured project summary and points to the active task.

As of June 9, 2026, the current top-level tree is intentionally four active
lanes:

- `feature-knowledge-and-specs`
- `spec-runner-and-replays`
- `evidence-feedback-and-model-update`
- `user-review-workspace`

The current executable frontier should keep independent work active across the
value loop:

- feature extraction from Go/source into feature packets and specs
- replay wiring or implementation
- gated live verification through the native spec runner
- model/evidence feedback from completed runs
