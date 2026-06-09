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
- The top-level task tree should follow the project goal: learn AKS input space
  and expectation space systematically. Do not let recent incidents or artifacts
  become the organizing structure.
- The project uses a repeated feature-learning loop: reference packet, input
  paths, expectation paths, evidence/test mapping, gap analysis, test-spec/probe
  design, execution gate or evidence, model update, and feature closeout.
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
- The feature-learning queue is a conveyor. After one selected feature is
  accepted or externally gated, return to `evidence/archive/feature-learning-queue.md`
  and schedule the next safe local feature before treating the project as
  blocked.
- A task can be decomposed into child tasks when it is too large or unclear.
- A blocked task is reviewable. If the ready frontier is empty, create or run a
  blocked-review leaf that classifies the blocker and looks for safe local
  unblock, split, correction, or evidence work.
- `no_work`, "no safe local work", and "waiting" are not accepted terminal
  claims. Convert them into a concrete ready task, an exact blocked resume
  condition, a human-question task, or a superseded task with its replacement.
- Human-question tasks are explicit input boundaries. Keep them visible in the
  tree, but do not auto-review them as ordinary stale blockers.
- A worker claim is not completion; the claim must be verified before a task is
  accepted.
- Workers do not edit `aks-rp-e2e.app/tasks/tree.json` directly. The engine owns task updates,
  parent rollup, review-task creation, and continuation events.
- Parent tasks roll up from verified child state, then get a parent-review leaf
  when the parent needs audit or replanning before acceptance/blocking.
- Cloud or staging execution requires an explicit task gate and a passing gate
  check. Blocked-review tasks must not bypass gates or run mutation.
- Recurring responsibilities are loop tasks. `project-planning-loop`,
  task-tree hygiene, model hygiene, and blocked-frontier review should be
  stable visible nodes mapped to workflows. Each execution is a run recorded in
  workflow history and, when useful, app-local compact JSONL files.
- Do not create a new top-level `project-frontier-replan-*` task for each
  planning execution. Keep planner runs linked through run records and parent
  generated domain work under meaningful project containers.
- When the project needs to speed up, create a small number of parallel,
  purpose-shaped leaves under durable lanes. Prefer an audit/design leaf first
  when the next implementation or staging step depends on knowing what is
  already true. Put the implementation/execution follow-up beside it as a gated
  child, not as a new root.
- Feature-page requested test execution is tracked as a stable runner-backed
  evidence flow, not as one task per run. Keep durable system work in the task
  tree, such as runner ledger, request handler, adapter, UI rendering,
  diagnosis, and model-update proposal. Store individual requests and runs in
  `runs/` and platform workflow history.

## Good Shape

Good task breakdowns are domain-shaped:

```text
aks-learning-system
  -> feature-learning-loop
    -> managedsystem-pool
      -> build reference packet
      -> extract input/expectation paths
      -> design test spec with full lifecycle, operations, assertions, and gates
      -> generate REST replay script
    -> run gated staging replay
    -> update model and feature page evidence

golden-e2e-replay-pipeline
  -> feature-test-runner-engine
    -> define durable request/run ledger
    -> route feature-page request event to runner
    -> run ManagedSystem REST adapter
    -> render active runs/history on feature page
    -> diagnose result before model update
```

Runtime-shaped branches should remain control/audit history, not the main
project plan:

```text
project-control
  -> project-planning-loop
  -> task-tree-hygiene
  -> blocked-frontier-review
```

Avoid growing the root with branches like `project-frontier-replan-17`,
`retry-ui-fix`, or `investigate-again`. If that work is real, attach it under
the domain feature, the reusable learning loop, or `project-control` with a
clear goal and acceptance criteria.

## Current View

Read `tree.json` for the current operational project state. `../project.md`
contains the human-readable summary and points to the active task.

As of June 8, 2026, the accelerated frontier is intentionally three lanes:

- Solid the ManagedSystem REST-first golden path.
- Polish the dedicated ManagedSystem feature page.
- Make combined-scenario tests possible through a compatibility contract.

The current P0 executable leaves are `managedsystem-golden-path-gap-audit`,
`feature-page-managedsystem-current-audit`, and
`combined-scenario-compatibility-contract`.
