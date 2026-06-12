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

Project-specific operating knowledge belongs in task context, especially on the
root project node or durable lane nodes. Planner prompts and workflow code
should stay generic: they wake the project owner and expose tools, while
`tasks/tree.json` carries progress signals, completion criteria, standing
reconciliation tasks, live execution assumptions, and current user steering.

## Files

- `tree.json` - canonical current task tree.
- `archive/` - historical task-wave files kept for reference only.

May-agent infrastructure owns event, session, workflow-run, and attempt history.
Task nodes in `tree.json` may link to infra trace ids when available, but this
folder does not keep a parallel task event log.

## Rules

- Task `inputs`, `outputs`, and `workspaceRefs` should make path ownership
  explicit. App-control files are app-relative, such as `project.json`,
  `app.ts`, and `tasks/tree.json`. App runtime exchange/traces are
  app-relative under `.state/`, such as `.state/discussion.jsonl` and
  `.state/planner-runs.jsonl`. Domain files are domain-relative, such as
  `specs/index.json`, `replays/<name>.ts`, `runs/executions/`, and
  `evidence/archive/`.
- Only leaf tasks are executable.
- `ready` means the planner may assign it now. If a task is waiting for another task, keep
  it `proposed` and list the upstream ids in `depends_on`. If it is waiting on
  a real external/human/environment condition, keep it `blocked` and describe
  the condition in `blocker`.
- Do not use `gates` or `gate_status` in `tasks/tree.json`. They were a legacy
  catch-all for dependencies, safety constraints, external blockers, and live
  execution approval. Use `depends_on`, `forbidden`, `blocker`, structured
  `context`, and `conflict_scope` instead.
- A task without `owner` is owned by the convention-inferred project owner
  (`agents/<single-local-agent>/`, or `agents/owner/` /
  `agents/project-owner/` when multiple app-local agents exist). Set `owner`
  only for real exceptions such as `human` or another agent boundary.
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
- The root project node should point to a visible standing reconciliation task
  when the project has measurable domain state. For `aks-rp-e2e`, the domain
  progress signal is the knowledge model status from `bun run status`; an empty
  task frontier is not completion while model paths remain fail, blocked, or
  unknown without visible follow-up tasks under that standing task.
- Metrics are project motion signals, not the project brain. The standing
  `project-progress-metric-watch` task owns what AKS metrics mean and how a
  breach should feed back into the task tree. Metric breaches wake the project
  owner; only confirmed human/ownership blockers become escalations.
- A single active task is not enough to call the project healthy while model
  gaps remain. The planner should keep a small ready backlog up to the app's
  parallelism target, unless the task tree visibly records why capacity cannot
  be filled. `ready-starvation-with-gaps` and
  `capacity-underfilled-with-gaps` are planner refill signals; only
  `no-work-with-gaps` is the high-urgency human unblock signal.
- If a planner wake times out or leaves no assignable backlog while worker
  capacity is underfilled and model gaps remain, the app may seed a bounded
  number of concrete backlog leaves from the knowledge model plus existing
  `specs/` and `replays/`. This is a liveness fallback, not domain judgment:
  it must avoid duplicate open work, attach path/feature context, use existing
  durable lanes, and let normal assignment/worker/review flow handle the task.
- If live execution is saturated and slow, do not wait for verification before
  learning more. Keep a bounded execution lane running, but seed backlog under
  `go-e2ev3-source-discovery` for source exploration, feature packets,
  source-grounded spec authoring, replay generation, and model-gap preparation.
  Those backlog leaves are not dispatched until capacity opens.
- The active root lanes are durable responsibilities:
  `feature-knowledge-and-specs`, `spec-runner-and-replays`,
  `evidence-feedback-and-model-update`, and `user-review-workspace`.
- Learning is not terminal by itself. A feature is useful only when source
  knowledge, spec shape, replay execution, evidence diagnosis, and model
  feedback close the loop or expose an exact external blocker.
- Test-spec design has a standard contract. A spec-ready task is not accepted
  unless the spec has scenario/scope, ordered `testLifecycle`, concrete
  operations, meaningful product assertions, execution variants,
  execution strategy, dependencies, deduped run artifacts/evidence, and explicit
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
  fields such as `specId`, `target`, `surface`, `active_run_id`, and
  `active_request_id` when known. Execution host is not a project-task field;
  the app runs the domain runner in the current credentialed environment. The
  task-owned worker session should run the domain runner through explicit
  project commands such as `bun runner/spec-runner.ts`; it must record terminal
  artifacts before reporting completion.
- A native spec-runner task is accepted only from terminal live artifacts:
  `result.json`, `diagnosis.json`, `summary.md`, and `steps.jsonl`. A canceled
  dry-run, local check, queued run, or running status keeps the task unverified.
- Replay `--check` is an idempotent local validation command. Workers may use it
  to verify syntax, wiring, and static preflight, but it must not write durable
  `evidence/archive/` artifacts unless the task explicitly requests
  `--write-evidence`.
- When a native spec-runner task finishes, model/spec feedback should be a
  separate leaf under `evidence-feedback-and-model-update`; the runner task
  proves what happened, and the feedback task decides how that evidence changes
  the knowledge model, spec, replay, or next work.
- The feature-learning queue is a conveyor. After one selected feature is
  accepted or externally blocked, return to `evidence/archive/feature-learning-queue.md`
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
  results. Convert them into a concrete ready task, an exact blocked resume
  condition, a human-question task, or a superseded task with its replacement.
- Human-question tasks are explicit input boundaries. Keep them visible in the
  tree, but do not auto-review them as ordinary stale blockers.
- Worker progress is not completion or final blockage. Worker `done`,
  `partial`, and `blocked` results arrive as `project.task.completed` events.
  The planner then updates the task tree and decides whether the task becomes
  accepted, review, repaired, replaced, retried, split, or truly blocked.
  `blocked` means "the worker believes it found a blocker"; the planner must
  verify the evidence and concrete resume condition before leaving a task
  blocked.
- The task is the context container. Store compact working context on the task
  itself, and use `tasks/context/<task-id>.md` only as a task-owned spillover
  file when the context becomes too large for `tree.json`.
- Reuse the task's primary session when continuing the same task or handling
  feedback on that task. The session preserves useful working memory that may
  not yet be obvious enough to structure, but important conclusions must be
  promoted into task context, outputs, evidence, or child tasks.
- Ordinary worker tasks store that primary session as `session_id`, with prior
  ids in `session_history`. The planner assignment tool assigns a stable
  task-derived `s_task_<task-id>` session id before the task becomes active, so
  the tree can show what session owns the work while it is running and later
  wakes can resume the same transcript.
- Child tasks inherit a seed from parent task context. Small recursive child
  work may continue in the parent session; parallel child work should fork a
  new session seeded from the parent and write a completion packet back to the
  parent.
- The planner agent is the brain. Workflows wake agent sessions and expose safe
  task-tree primitives; workflows do not encode project strategy, branch repair
  policy, or domain judgment.
- The task tree is the planner's workspace and context container. It serves the
  planner; it is not the controller. Task-tree processing code should be tools
  for the LLM. Use app-local commands such as `bun run task-tree summary`,
  `bun run task-tree frontier`, `bun run task-tree promote-clear`,
  `bun run task-tree add`, `bun run task-tree assign`, and
  `bun run task-tree complete` for reviewed task-tree operations.
- Planner work runs through the project owner. Each wake has two owner steps:
  event review first, then task-tree update. The event-review step receives a
  compact planning packet and should classify what changed without editing
  `tree.json`; it should stay bounded and prefer the packet over rediscovery.
  The update step uses that review and the latest packet to repair
  decomposition, review worker progress, create new leaves, assign ready
  leaves, and unblock the project.
- Planner session memory is non-authoritative. Each planner wake should reason
  from the latest compact planning packet, `tasks/tree.json`, trigger context,
  and domain workspace commands. The packet includes frontier task details so
  the owner can start from current state, then dive deeper with `task-tree show`
  or domain commands when needed. Reusing stale planner conclusions is a bug;
  if the tree says review work or domain gaps remain, the planner must judge
  that current state and move it forward.
- If `ready + active` is empty while review, blocked, or proposed work exists,
  treat the wake as a reconciliation incident. Make a durable tree decision
  before broad investigation: accept verified reviews, create retry/follow-up
  leaves for resolved blockers, link unresolved blockers to one visible problem
  task, and assign clear leaves. Do not spend the whole planning wake
  rediscovering context without recording the next action.
- Problem-solver output is evidence for the planner. If the event type says
  escalated but the summary clearly says a local runner/replay issue was fixed
  and verified, record it as a misclassified resolved problem and create retry
  work. If external input is still required, record the exact resume condition
  and move to unrelated work.
- Worker work runs in the task's primary session. The worker workflow receives
  one `project.task.assigned` event, verifies the attempt id, wakes that task
  session, and emits `project.task.completed`. Workers must not reshape sibling
  branches, roll up parents, create planner/control nodes, or mutate completion
  state in the task tree.
- Repeated stale active attempts are not progress. The watchdog observes
  missing/dead runtime attempts and wakes planning with stale-attempt evidence.
  The planner should create a concrete runner/session/replay diagnosis,
  replacement leaf, retry assignment, or exact blocker before the task moves.
- Parent tasks roll up from verified child state, then get a parent-review leaf
  when the parent needs audit or replanning before acceptance/blocking.
- New or materially changed cloud/staging execution patterns require structured
  live-run context, not a prose gate. Established spec-runner reruns use
  `context.live_run_policy: "repeatable-approved"` plus a task-specific
  `context.mutation_allow` value so the project can rerun them without repeated
  human approval. If a spec-runner task has a replay input such as
  `replays/<name>.ts` but is missing this context, the planner/engine should
  repair the task metadata and keep it assignable. The runner must still set
  the exact `AKS_RP_E2E_ALLOW_CLOUD_MUTATION=<context.mutation_allow>` value,
  run in the current credentialed execution context, serialize the relevant
  `cloud:*` conflict scope, and record terminal result/diagnosis/cleanup
  evidence. Blocked-review tasks must not bypass live execution preconditions
  or run mutation.
- Recurring responsibilities should not become top-level project work unless
  they directly express the AKS value loop. Planning, task-tree hygiene, and
  blocked-frontier review are engine/workflow behavior; when their output is
  real project work, create or update concrete leaves under one of the durable
  value-loop lanes.
- Recurring metric review is a standing evidence-feedback responsibility. Keep
  metric interpretation compact and explicit in the task context: activity
  counters show whether work is moving, impact counters show whether model/spec
  coverage is improving, and health counters wake owner/human unblock paths
  when reality contradicts the task tree.
- Planning is control-loop behavior, not worker task work. The
  `project-planner` workflow may run one bounded planner wake with event-review
  and update steps, record the attempt in `.state/planner-runs.jsonl`, and let
  the project-owner agent update `tree.json` with concrete domain leaves and
  explicit assignments.
  Bounded does not mean one edit: when model gaps remain and active work is
  below the app parallelism target, the planner should review worker progress
  and keep creating/promoting/assigning concrete leaves until capacity is filled
  or exact blockers are recorded. Do not represent each planner wake, retry, or
  recovery as a normal leaf task.
- Legacy planning/control nodes such as `project-control`,
  `project-planning-loop*`, and `project-frontier-replan-*` are history only.
  They must not be assigned as worker tasks, must not consume active capacity,
  and should be superseded when they appear in the executable frontier.
- The robust execution loop is: event or timer wakes the planner; the planner
  reviews progress, repairs, rolls up, refills the task tree, and explicitly
  assigns ready leaves with `task-tree assign`; the workflow emits
  `project.task.assigned`; each worker executes exactly one assigned task and
  emits `project.task.completed`; completion wakes the planner again. The timer
  is only a safety net for missed events or stale sessions.
- Task lifecycle events have explicit ownership. `project.planning.requested`
  is handled by the planner workflow. `project.task.assigned` is handled by the
  worker workflow. `project.task.completed` is handled by the app event layer
  and wakes planning with the latest task snapshot, result, summary, evidence,
  blocker, verification, attempt id, and session context. Legacy
  `project.task.execution.requested` events wake planning instead of bypassing
  assignment.
- A task event should carry enough compact context for the next handler and UI
  to understand what changed without blindly rediscovering the task: task id,
  parent id, status, owner/workflow, session id, goal, inputs, outputs,
  acceptance, conflict scope, compact `context`, blocker, verification, and
  worker evidence fields when available. The task tree remains the mutation
  source of truth; event payloads are the handoff packet.
- Planner and worker are intentionally decoupled. The planner is sequential and
  owns task-tree meaning: decomposition, repair, verification, parent rollup,
  ready promotion, and assignment. Workers may run in parallel, but each worker
  owns only one assigned task execution and emits `project.task.completed`;
  workers must not create tree branches, roll up parents, or emit planner wake
  events directly.
- Domain repo commits are planner-owned checkpoints. A worker may modify
  `../aks-rp-e2e`, but it must not commit. After the planner accepts worker
  output, it may checkpoint a coherent accepted slice in the domain repo when no
  active/review task still owns the same files, `bun run check` passes, and the
  commit message references the accepted task ids. The planner should use
  `bun run domain:checkpoint` from the app directory to inspect dirty files and
  hold mixed or still-reviewable work. No separate commit event is needed; a
  commit is one planner action during normal review/rollup.
- Do not create top-level `project-control`, `execution-engine-audit`, or
  `project-frontier-replan-*` branches. Keep planner/engine history in runtime
  traces or archive material, and put current work under the feature/spec,
  runner, evidence-feedback, or user-review lane.
- When the project needs to speed up, create a small number of parallel,
  purpose-shaped leaves under durable lanes. Prefer an audit/design leaf first
  when the next implementation or staging step depends on knowing what is
  already true. Put the implementation/execution follow-up beside it as a
  dependent child, not as a new root.
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
      -> design atomic test spec with lifecycle, operations, assertions, and execution metadata
    -> next-feature-frontier review

  -> spec-runner-and-replays
    -> generate REST replay script
    -> dry-run/check replay
    -> run staging replay through structured live-run context
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
- live verification through the native spec runner
- model/evidence feedback from completed runs

## Failure Recovery

Failed work should be resolved, not cycled around. A recovery action must
reduce uncertainty or reduce remaining work.

When a task fails, classify the recovery as exactly one of:

- `retry_same_task`: the task is still correct and the failure was transient.
- `repair_task`: the task is correct but metadata/routing/dependencies are wrong.
- `replace_task`: the task is polluted or misleading; supersede it with one
  clean canonical task.
- `split_task`: the task is truly too broad and children have distinct outputs,
  decision boundaries, or verification boundaries.
- `block_task`: a real external/human condition prevents progress.

Do not create a child task merely to retry the same purpose with a synonym
name. If parent and child have the same output paths, same conflict scope, and
same root-cause failure, repair or replace the task instead of deepening the
tree.

Good split:

```text
jwt-incluster-idp-replay
  -> script-authoring
  -> live-staging-verification
  -> model-feedback-rollup
```

Bad split:

```text
replay-author
  -> code-write
    -> replay-file-author
      -> direct-write
```
