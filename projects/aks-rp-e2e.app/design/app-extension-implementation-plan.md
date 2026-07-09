# App Extension Implementation Plan

Status: current implementation plan, updated 2026-07-09

## Purpose

Move the implementation toward the current app model without adding new route
kinds, task kinds, or configuration-heavy schema. This is the working checklist
for implementation order; the mental model stays in `README.md`,
`project-observability.md`, `project-planner-contract.md`, and the loop-specific
docs.

The target model is convention-based:

```text
event -> event route -> target
```

The target is inferred:

- a route with `handler.workflow` runs that workflow;
- a route or event with `owner` and no workflow is an owner handoff;
- an unmatched owned event follows runtime ownership fallback;
- external or terminal events close at the boundary.

The next work should not add new concepts. It should make the existing model
observable and convergent:

```text
event -> event route -> target -> durable outcome
durable loop -> reconcile ledger -> one representation per open item
failure -> classify -> diagnose/fix -> rerun/prove/wait/escalate
```

## Plan

### Current Baseline

These pieces are now part of the app model and should be preserved:

- one task tree with `domain/*` for AKS work and `ops/*` for app/process work;
- task states stay `backlog`, `active`, `review`, `blocked`, and `done`;
- ordinary task execution goes through `project.task.assigned -> task-worker`;
- workflows can declare `workflowContract` in the workflow file when
  structured input/output helps automation;
- `blocked` is valid only with a real wait condition, owner, observer, check
  method, next check, fallback time, and fallback action;
- Azure DevOps is the live proof platform; new wording should say pipeline or
  Azure DevOps, while old GitHub-named fields are compatibility aliases only;
- `project-health` and the kanban UI expose loop representation signals,
  including active compact pipeline waits;
- `project-health --json` exposes a static process graph from `app.ts`,
  including route count, emitted events, unhandled events, and multi-route
  conflicts;
- retry exhaustion is not completion; it must become repair work, exact wait,
  escalation, or accepted terminal disposition.

Remaining gaps should be handled as implementation work, not by adding another
architecture layer:

- finish runtime route-closure health so emitted events cannot disappear after
  dispatch;
- improve existing domain workflows from real good and bad runs, starting with
  `single-spec-verifier` and `feature-compact-planner` as separate workflows;
- harden compact-loop reconciliation so every feature has exactly one visible
  representation;
- rename or isolate GitHub-era implementation names where they still create
  operator confusion;
- keep adding fixture tests for stale ledger repair, duplicate pulse safety,
  malformed waits, retry exhaustion, terminal pipeline reconciliation, and
  crash recovery;
- verify the UI readout against the health JSON instead of letting the browser
  infer too much from partial state.

### Compact Loop Priority

For the compact loop, the highest-value fix is not language cleanup. The
highest-value fix is making the controller converge every feature record to one
clear state and one clear owner.

The compact loop should be considered solid only when these are true:

- every non-terminal feature has exactly one representation: child task, active
  Azure DevOps run, exact blocked wait, review task, repair task, or accepted
  terminal disposition;
- an Azure DevOps wait records the run id, run URL, watched condition, expected
  result artifact, owner, and fallback time;
- an active Azure DevOps run is reported as represented waiting, with enough
  detail for a human to see which feature, run, URL, condition, artifact, and
  fallback are involved;
- a finished Azure DevOps run is reconciled into live-pass, diagnosis, repair,
  or escalation instead of staying blocked;
- retry exhaustion creates repair/follow-up work or escalation, not a silent
  final state;
- a pass is accepted only when the compact package proves a real live run with
  expected artifacts and real Azure resource creation when the plan requires it;
- the same controller pulse can run repeatedly without creating duplicate child
  tasks or losing track of already-created work.

The immediate compact-loop bar is:

```text
for every feature:
  done live proof
  or active child task
  or active pipeline wait with exact run id/artifact expectation
  or review/repair task
  or exact blocked wait
  or accepted terminal disposition
```

Anything else is unrepresented work and should be reported as actionable.

### Workflow Improvement Pass

Before adding more control-plane machinery, improve the workflows by learning
from the work already done.

Use the same pass for spec and compact, but do not couple them:

```text
choose one workflow
  -> sample good and bad real runs
  -> identify what made the result efficient or wasteful
  -> update that workflow, its tests, or its domain artifacts
  -> verify with the smallest truthful local or Azure DevOps run
  -> record the reusable lesson where the next run will use it
```

For `single-spec-verifier`, the main questions are:

- did the spec run as a standalone live test?
- did failure classification point to the right next action?
- did the workflow avoid rerunning unchanged inputs?
- did live pass proof include the expected test result and resource proof?

For `feature-compact-planner`, the main questions are:

- did the compact plan really reduce cluster count?
- did diagnostics explain every split or conflict?
- did the live proof create real AKS resources when required?
- did a failure become feature repair, spec repair, exact wait, or escalation?

Only repeated lessons should become workflow changes. One-off findings can stay
as notes, but a repeated failure or repeated success pattern should become
automation, tests, prompt guidance, a metric, or a domain artifact update.

Run this through the existing task system first:

```text
domain/workflow-improvement/<workflow-name>/<case>
  -> project.task.assigned
  -> task-worker
  -> default-task-worker or declared workflow
  -> task-reviewer
  -> project-planner
```

No new event route is required for the first version. The app already knows how
to dispatch a normal task. The task should carry:

- `workflowUnderReview`: for example `single-spec-verifier`;
- `caseRefs`: run ids, result paths, state pointers, or task ids;
- acceptance criteria that require a real workflow/test/domain change when the
  lesson is repeated;
- verification proof from the smallest truthful local or Azure DevOps run.

Promote this to a dedicated `workflow-improvement-review` workflow only after
the same case-packet collection and result-checking steps repeat enough to be
worth automating.

### 1. Align Check Language

Update `scripts/check-integrity.ts` messages and helper names from
handler-centric language to route-centric language.

Keep compatibility with existing `workflowHandlers`, but report as:

```text
event route missing workflow
duplicate event route
route emits unknown event
route conflict on type+target+action/owner
```

This is a readability and model-alignment change. It should not change runtime
behavior.

### 2. Add Convention-Based Route Validation

Extend `bun run check` to infer route targets by convention.

Validate:

- every app route has `accepts`;
- every route workflow exists;
- every route emits only known internal, external, or terminal events;
- shared events with multiple routes are disambiguated by `action`,
  `target.taskId`, or `owner`;
- schedules and actions emit known routeable or external events.

Do not add `destinationKind` or another route type field.

### 3. Validate Task Workflow Extension

Make the seamless extension path checkable:

```text
add workflows/foo.ts
create/assign task with workflow=foo
task-worker loads and runs it
```

Checks:

- every live task `workflow` points to `workflows/<name>.ts` or an explicitly
  allowed built-in;
- allowed built-ins remain explicit, such as `default-task-worker`,
  `task-worker`, and `spec-runner`;
- loop-created task workflows exist;
- workflow files export `execute`;
- optional `workflowContract` is structurally valid when present.

### 4. Normalize Existing Runtime Observations

Do not introduce a new runtime trace schema first. Teach health/check code to
interpret current runtime events as route observations:

- `handler.workflow_dispatched` means a workflow route started or finished;
- `handler.started`, `handler.completed`, and `handler.failed` mean route
  lifecycle;
- `metric.feedback.routed` means owner fallback accepted a metric event;
- owner fallback session means owner target observed.

This follows convention over configuration and uses the data already emitted by
the runtime.

### 5. Add Route Closure Health

Add lightweight closure checks for high-value events:

```text
event emitted
  -> route observed
  -> follow-up event, terminal output, task state change, owner decision,
     or accepted no-op
```

Start with:

- `project.task.assigned`;
- `project.task.completed`;
- `project.task.reviewed`;
- `project.task.tick`;
- `project.planning.requested`;
- `metric.breach`.

Each closure check needs a time window. Use the most specific deadline already
available before falling back to a default:

1. task `blocker.fallback_at`, `fallbackAt`, or assignment/attempt timeout when
   the event is tied to task work;
2. workflow timeout when the event directly starts a workflow route;
3. route-specific SLA only when there is a proven exception;
4. default route closure SLA of 1 hour.

This prevents noisy false positives for long-running work while still catching
stale events. For example, a `project.task.assigned` that has been open for 10
minutes may be healthy for a live AKS run, but one still open after its
fallback/timeout window or after the default 1 hour needs a process signal.

Report process gaps as health findings or metrics before adding new runtime
concepts.

### 6. Clarify Specialized Workflow Completion

Make this convention explicit in checks and workflow docs:

```text
task-worker routes to specialized workflow
specialized workflow owns project.task.completed
if no completion appears, assignment remains unclosed and health flags it
```

Avoid wrapping specialized workflow results into another task completion unless
the workflow is the default worker path.

### 7. Add Durable Controller Contract

Stateful workflows such as `spec-loop-controller`,
`feature-reference-loop-controller`, and `feature-compact-loop-controller` are
durable controllers. They may own state, but only as a scheduling ledger.

Use this separation:

```text
workflow    -> stateless bounded work function
controller  -> durable progress ledger and scheduler
task tree   -> durable ownership, review, and relationship state
artifacts   -> durable AKS/domain output
```

Normal workflows receive scoped input, do one bounded job, write scoped
artifacts when needed, and return or emit structured output. They should not
own progress memory such as which specs remain pending, which feature packages
have exhausted retries, or which items still need representation. That memory
belongs to the controller ledger and task tree.

Controller state should answer:

```text
what items exist?
which items are pending, running, review, done, error, or blocked?
which task/run/wait represents each non-terminal item?
what was the latest attempt/result/evidence ref?
what should be scheduled next?
```

Controller state must not become the source of truth for feature definitions,
spec definitions, accepted AKS behavior, full test results, or planner
decisions. Those belong in domain artifacts, task completions, run artifacts,
or the task tree.

Controller pulse shape:

```text
trigger
  -> load ledger
  -> reconcile ledger from durable truth
  -> compute missing work
  -> create/assign bounded tasks
  -> save ledger atomically
  -> emit dispatch events
```

Normal workflow shape:

```text
scoped input + current external facts -> structured output + scoped artifacts
```

Controller shape:

```text
ledger + current durable facts -> updated ledger + next scheduled work
```

Every pulse must reconcile before scheduling. For every non-terminal ledger
item, exactly one of these should be true:

- represented by runnable/backlog task;
- represented by active task;
- represented by review task;
- represented by exact blocked wait;
- represented by external run with run id and watch condition;
- represented by accepted terminal disposition.

If none is true, the controller should create/assign bounded work, record a
structured `error`, or record a valid `blocked` wait. It should not silently
wait.

Controller robustness rules:

- singleflight per controller;
- file lock around ledger read/write;
- atomic write through temp file and rename;
- stable child task ids or conflict scopes;
- no duplicate child task for the same item and purpose;
- compact state with refs, not copied artifacts or long prose;
- `blocked` means known wait with owner/resume/fallback;
- `error` means diagnosis or repair is still needed.

### 8. Prove Controller And Route Health

Prove the design works with small, repeatable checks before relying on live
loops.

Required proof layers:

1. Static integrity.
   - `bun run check` validates workflow references, route conflicts, emitted
     events, controller ledger shape, and task workflow references.
2. Fixture reconciliation tests.
   - stale ledger item plus done task becomes terminal;
   - ledger item with no represented work creates one bounded child task;
   - active/review/backlog child prevents duplicate child creation;
   - valid blocked wait is preserved;
   - malformed blocked wait becomes `error` or repair work;
   - retry exhaustion creates repair/follow-up work, not completion.
3. Idempotency tests.
   - running the same pulse twice creates no duplicate task;
   - repeated completion event does not corrupt ledger state;
   - crash after task creation but before ledger save is repaired by next pulse;
   - crash after ledger save but before event emit is repaired by next pulse.
4. Runtime health checks.
   - every non-terminal ledger item has one representation;
   - every assigned task closes within `fallbackAt`, attempt timeout, workflow
     timeout, or the default 1 hour SLA;
   - owner fallback events are observed or flagged.
5. One live smoke proof per controller.
   - run one small spec-loop pulse, one feature-reference pulse, and one
     compact-loop pulse against a bounded fixture set;
   - verify task tree, ledger, emitted events, and resulting artifacts agree.

The strongest proof is not that a controller never fails. It is that a
controller can be pulsed repeatedly after stale state, duplicate events, partial
writes, or interrupted sessions and converge back to one represented item per
non-terminal ledger record.

### 9. Review Owner Fallback Usage

Review explicit routes such as:

```ts
{ type: "metric.breach", owner: "agent:app-ops" }
{ type: "metric.recovered", owner: "agent:app-ops" }
```

This is the implementation point that connects process metrics to the
fix-forward design. A metric breach is not itself the fix; it is a signal that
should either hand off to `app-ops` judgment or start a repeatable fix-forward
workflow when the response is mechanical.

Decision rule:

- if the event needs planner mechanics every time, keep the explicit planner
  workflow route;
- if it needs judgment first, remove the explicit route and let owner fallback
  handle it;
- if repeated handling becomes mechanical, introduce a workflow route later;
- if the breach identifies a concrete failed spec, compact plan, artifact gap,
  or app-process defect, create or dispatch the smallest fix-forward task that
  can diagnose, repair, rerun, or record an exact wait.

### 10. Add SDK Route Aliases Later

Do not do a breaking SDK rename now.

Later, add aliases while keeping old names compatible:

```text
eventRoutes([...])      -> workflowHandlers([...])
maxRoutesPerEvent       -> maxHandlersPerEvent
eventGraph.routes       -> eventGraph.handlers
```

The implementation can keep using current fields internally while docs,
checks, and generated diagnostics speak in route terms.

## Suggested Order

For compact-loop reliability, keep the order narrow:

1. Finish compact-loop convergence proof.
   - Start with `feature-compact-loop-controller`.
   - Prove stale ledger repair, duplicate pulse safety, malformed blocked waits,
     retry exhaustion, terminal Azure DevOps run reconciliation, and crash
     recovery around task creation/event emit.
   - Prove active Azure DevOps runs are represented waits, and expose exact run
     details to health/UI rather than only suppressing false stall signals.
   - Verify the real loop state: no non-terminal compact feature may exist
     without one representation from the immediate compact-loop bar above.
2. Make route closure visible.
   - Confirm `project.task.assigned`, `project.task.completed`,
     `project.task.reviewed`, `project.task.tick`, `project.planning.requested`,
     and `metric.breach` reach a route, owner decision, task state change,
     terminal output, or accepted no-op within the right window.
   - Prefer extending `bun run health --json` over adding another command.
3. Normalize runtime observations.
   - Use existing runtime events as route observations before adding any new
     trace schema.
   - Show unknown or unobserved closure as a health finding, not hidden debug
     text.
4. Validate task workflow extension.
   - Make sure every task-created workflow points to a loadable workflow file
     and exports `execute`.
   - Keep `workflowContract` optional and local to the workflow file.
5. Validate routes in `bun run check`.
   - Validate route conflicts, emitted events, schedule/action outputs, and
     workflow references.
   - Report route-centric language even while the SDK still exposes
     `workflowHandlers`.
6. Review metric/owner fallback routing.
   - Keep judgment-driven metric breaches going to owner fallback.
   - Turn repeated mechanical fixes into explicit workflow routes only after the
     repeated pattern is proven.
7. Clean naming debt.
   - New surfaces use pipeline/Azure DevOps wording.
   - Old GitHub-named implementation fields remain readable as compatibility
     aliases until the behavior is covered by tests. They should not appear in
     new operator-facing summaries unless the old name is the subject being
     repaired.
8. Add SDK route aliases later.
   - Add route aliases without a breaking SDK rename only after app-local
     checks and UI readouts already speak in route terms.

This order gives immediate value without a runtime migration. The first two
steps are the ones expected to make the compact loop and project observability
materially more reliable.
