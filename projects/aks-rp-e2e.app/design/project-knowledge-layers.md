# Project Knowledge Layers

Status: accepted design direction

## Purpose

`aks-rp-e2e.app` runs a long AKS E2E improvement project. The project has two
different kinds of knowledge, and mixing them makes the system harder to reason
about:

```text
AKS knowledge model      -> what AKS features mean and how to test them
Project operating knowledge -> how May-agent keeps the work moving
```

The app should keep this boundary visible in docs, tasks, workflows, and code.

Use convention over configuration for this boundary. Do not add a task field
such as `workKind` just to say whether work is domain or ops. The task tree
scope, task id, workflow name, and UI grouping should make the answer visible.

The convention is:

```text
domain/spec/...       -> AKS spec/test/model work
domain/feature/...    -> AKS feature reference/model work
domain/compact/...    -> AKS compact planning and live proof work
domain/focus/...      -> AKS outcome-focused mission work

ops/watchdog/...      -> project liveness observation
ops/stall-review/...  -> process diagnosis
ops/recovery/...      -> repair/retry/escalation plumbing
ops/observability/... -> metrics, UI, event closure, integrity checks
```

Existing durable loop names such as `aks-spec-verification-loop`,
`aks-feature-reference-loop`, and `aks-feature-compact-loop` remain valid. They
are domain loops because their visible scope is AKS specs, features, and compact
tests. New work should use readable scope/id prefixes rather than hidden
classification fields.

The simple rule is:

```text
If it changes AKS knowledge, specs, tests, plans, or live result understanding,
it is domain work.

If it keeps the app moving, observes process health, repairs routing, or
escalates stuck work, it is ops work.
```

System ops must not decide AKS correctness. Domain work must not own whole-app
health. The planner may connect them by creating a domain repair task for an AKS
failure, or an ops repair task when the project machinery is the problem.

## One Tree, Two Roots

Keep one project task tree. Split it by visible roots:

```text
root
  domain/
    spec/
    feature/
    compact/
    focus/

  ops/
    observability/
    watchdog/
    stall-review/
    recovery/
    escalation/
```

Do not create a second task tree just for ops. One tree keeps one project truth:
the human can see when domain work is stuck because ops is broken, and when ops
work exists only to unblock domain progress.

Ownership can still be split:

```text
aks-explorer -> works under domain/*
app-ops      -> works under ops/* and runs planner judgment
aks-reviewer -> reviews completed task output, read-only
planner workflow -> applies app-ops decisions to the shared task tree
```

`app-ops` is allowed to inspect metrics, event traces, workflow runs, loop
ledgers, task state, and UI/readout gaps. It may fix project machinery, create
ops repair tasks, run planner judgment, or escalate process failures. It must
not declare an AKS spec correct or incorrect.

`aks-explorer` is allowed to update AKS knowledge, specs, generated tests,
compact plans, and live result understanding. It should not own whole-app
liveness, event closure, watchdog recovery, or observability repair.

`aks-reviewer` stays read-only. It checks whether completed work satisfies the
task acceptance criteria and emits structured review facts for the planner. It
does not mutate the task tree and does not own either root.

If ops becomes a shared platform project used by many apps, a separate ops task
tree may be justified later. For `aks-rp-e2e.app`, two roots in one tree is the
default because it is simpler and easier to audit.

## Layer 1: AKS Knowledge Model

AKS knowledge model is business/domain knowledge. It answers:

- What is the feature?
- What do official product docs, design docs, and API specs say?
- Which behavior should a spec assert?
- How should a runnable test create, mutate, verify, and clean up AKS
  resources?
- Which specs can share setup without changing expectations?
- What does a live pass, fail, or error teach us about the model,
  implementation, test, or environment?

The ground truth is not the `aks-rp-e2e` repo. Ground truth comes from
authorized AKS sources:

- official Microsoft Learn documentation;
- Azure REST API specs;
- AKS design documents and approved feature contracts;
- other explicitly authorized product/API sources.

The `aks-rp-e2e` repo, existing Go tests, generated specs, scenario tests, and
live results are evidence and executable workspace. They are useful sources,
but they may be incomplete, stale, or incorrectly implemented. The knowledge
model must be able to record gaps and contradictions instead of treating current
test code as authority.

The durable AKS knowledge model belongs in `aks-rp-e2e.app` because the app
needs it to operate the project: generate specs, create tests, classify
failures, compact compatible specs, and decide what to investigate next.

Durable model artifacts should record claims with source and confidence, for
example:

```text
aks-rp-e2e.app/
  knowledge/
    features/<capability>.yaml
    features/<capability>/claims/*.yaml
    features/<capability>/sources/*.md
    features/<capability>/gaps/*.md
    features/<capability>/test-intent/*.yaml
```

Executable outputs can still live in the portable domain workspace:

```text
aks-rp-e2e/
  features/<capability>/specs/*.json
  features/<capability>/tests/*.ts
  features/<capability>/compact/staging.plan.json
  features/<capability>/compact/staging.summary.md
  features/<capability>/compact/staging.diagnostics.json
  runner/
  runs/test-results/
```

Tests are how the project learns and verifies the model:

```text
authorized source -> model claim -> generated spec/test -> live result
  -> pass confirms current understanding
  -> fail/error exposes product, model, test, environment, or source gap
  -> update model/spec/test or create investigation work
```

Examples of app-side AKS knowledge:

- spec queue records keyed by spec id;
- feature queue records keyed by capability id;
- source-backed feature claims;
- expected behavior and unsupported behavior;
- generated test intent;
- known contradictions between docs, API specs, implementation, and tests;
- compact diagnostics summarized into loop state;
- live run summaries and latest artifact refs;
- planner packets that combine task state with feature/spec status;
- UI read models for feature/spec progress.

## Layer 2: Project Operating Knowledge

Project operating knowledge is how the May-agent app drives the project to
closure. It answers:

- What work exists right now?
- Which task is runnable, active, waiting for review, done, or waiting on an
  exact external condition?
- Which loop should run next?
- When should a failed attempt be retried, split, converted into a repair task,
  or escalated?
- Why is the project not moving even though unfinished work exists?
- Which workflow is reusable for this kind of task?

This knowledge belongs in the app control plane:

```text
aks-rp-e2e.app/
  app.ts
  tasks/seed.json
  workflows/
  design/
  scripts/
  ui/
  .state/tasks/tree.json
  .state/<loop>/state.json
```

`.state/` is operating memory, not accepted product truth. Deleting `.state/`
may lose queue cursors, attempts, and cached run details, but it must not lose
the AKS knowledge model, accepted source claims, generated executable artifacts,
or durable test results. After `.state/` is deleted, the app should be able to
rebuild loop projections from the checked-in knowledge model, domain workspace,
and external run artifacts.

## Workflow Bridge

Workflows are reusable project experience. A workflow can encode domain steps,
tool usage, artifact conventions, and result structure. A task is only the app
tracking wrapper when work needs ownership, retry, blocked-state handling, UI
visibility, review, or later recovery.

Direct human/agent use can call the same workflow with structured input:

```text
human instruction
  -> workflow under workflows/
  -> domain command, Azure DevOps pipeline run, or artifact update
  -> structured workflowResult
  -> agent reports the result
```

App-managed use wraps the same workflow in task state:

```text
task context
  -> workflow under workflows/
  -> domain command, Azure DevOps pipeline run, or artifact update
  -> structured workflowResult
  -> project.task.completed
  -> task-reviewer judgment
  -> project-planner task-tree decision
```

Examples:

| Workflow                      | Domain work it performs                         | Operating role                                                            |
| ----------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------- |
| `feature-reference-collector` | Collect Learn and REST API feature references.  | Advance one feature-reference loop item.                                  |
| `single-spec-verifier`        | Run one spec live and classify the result.      | Advance one spec-loop child task, or process one directly requested spec. |
| `feature-compact-planner`     | Generate and live-prove a compact feature plan. | Advance one feature-compact loop item.                                    |
| `project-stall-review`        | None directly.                                  | Collect state and ask the agent why work stuck.                           |

Workflow code collects facts, runs commands, writes scoped artifacts, and emits
structured results. The agent judges whether the facts satisfy the goal. The
planner owns task-tree mutation.

## Domain Flows

### Feature Reference

```text
feature area
  -> official Learn + Azure REST API + design sources
  -> source-backed claims, constraints, usage, and gaps
  -> reviewed AKS knowledge model update
```

The collector should use authorized sources as authority and local repo tests as
evidence/context. Missing or contradictory references are model findings, not
loop completion.

### Spec Verification

```text
knowledge claim / test intent
  -> generated spec
  -> standalone live Azure DevOps pipeline run
  -> result.json and workflow URL
  -> pass/fail/error classification
  -> model/spec/test/investigation update until understood and live-proven
```

Every spec must be able to run by itself. It should not depend on a caller-owned
cluster, Azure CLI login state, private AKS RP source code, or an implicit local
environment. The target environment is supplied by the workflow or by a plan.

### Feature Compact

```text
feature claims and specs
  -> resource/state DAG
  -> compact plan
  -> generated Vitest tests
  -> live pipeline proof
```

The compact planner should be brave about sharing setup only when the
resource/state DAG preserves expectations. Resource group names, cluster names,
DNS prefixes, and run suffixes are allocation details; they should not prevent
compaction. Conflicting global requirements, destructive terminal steps, network
isolation, and missing shared-fixture carrier support are real split or repair
reasons.

## Operating Flows

### Normal Task Loop

```text
project.planning.requested
  -> project-planner
  -> project.task.assigned
  -> task-worker routes to task.workflow
  -> project.task.completed
  -> task-reviewer
  -> project.task.reviewed
  -> project-planner accepts, redoes, follows up, blocks, or escalates
```

Completion is not acceptance. A worker says what happened; the reviewer judges
it; the planner changes the tree.

`project.task.assigned` is the dispatch event. The planner or loop controller
does not "assign" in a manual management sense; it emits the event that tells
`task-worker` to start a runnable task. If a task is created but not dispatched,
it must either remain intentional backlog or carry an exact blocked wait.

### Durable Value Loops

The three durable loops are normal tasks with controller workflows:

- `aks-spec-verification-loop`
- `aks-feature-reference-loop`
- `aks-feature-compact-loop`

Each controller owns a bounded frontier. It should keep
`context.workflowProgress` current and should not let the parent task finish
while ledger records remain non-terminal. A drained direct retry budget is not
completion; it should become grouped repair work, exact wait, or escalation.

Durable loop roots are woken with `project.task.tick`, not consumed as normal
worker leaves. `project.task.assigned` is for executable children created by a
controller, such as `single-spec-verifier`, `feature-reference-collector`, or
`feature-compact-planner`. The planner may bridge an accidental loop-root
dispatch into a tick, but the design source of truth is:

```text
project.task.tick + action=<loop-action>
  -> loop controller
  -> create/fill bounded child frontier
  -> project.task.assigned for runnable child leaves
```

### Stall Review

When metrics or watchdog checks show that unfinished work exists but the project
is not moving, `project-stall-review` collects:

- task-tree counts and frontier;
- durable loop state;
- represented versus unrepresented non-terminal records;
- recent planner and journal context;
- safe mechanical repair results.

Code collects this packet. The agent judges the stall class and next move. The
planner applies that judgment to the task tree.

### Redo Path

Redo is useful once or twice when the same task can succeed with clearer
feedback. Repeated same-reason redo is a signal that the current task shape is
wrong.

The operating policy is:

```text
first redo        -> retry same task with feedback
repeated redo     -> create a targeted repair/follow-up or split the task
external wait     -> record exact blocked task with resume condition
unclear root cause -> create project.problem.investigation.requested
```

The project should not churn by immediately reassigning the same leaf forever
with overwritten rejection history.

## Ownership Rules

- Ground truth comes from authorized AKS docs, design docs, API specs, and
  approved product contracts.
- The AKS knowledge model lives in `aks-rp-e2e.app` so the app can operate,
  generate, verify, compact, and investigate.
- `aks-rp-e2e` is the executable workspace and evidence source, not ground
  truth by itself.
- Knowledge claims must name their sources, evidence, confidence, and known
  gaps.
- Workflows are reusable work experience, not a second task system.
- Tasks are for breaking up, tracking, retrying, blocking, and reviewing work;
  direct human/agent work can use the same workflow without first creating a
  task.
- The live task tree is the visible work frontier.
- Loop state is operating memory and must be represented by task-tree work when
  non-terminal records exist.
- `workflowResult` carries machine-readable facts; summaries are review
  material.
- The reviewer judges completions but does not mutate project state.
- The planner is the single task-tree decision writer.

## Success Criteria

The design is working when:

- every feature has source-backed claims from official docs/API/design sources
  or exact gap/escalation work;
- specs and tests are generated from the knowledge model, not copied blindly
  from existing implementation tests;
- every live result updates understanding: confirm, repair model/spec/test,
  expose implementation gap, or record environment/source uncertainty;
- every compact package covers compatible feature-owned specs and has live
  proof, or exact repair work explains why not;
- no durable loop is hidden behind stale `done`, retry-drained, or blocked-only
  state while unrepresented non-terminal records remain;
- project stalls create bounded diagnosis or repair work instead of passive
  waiting.
