# Project Observability

Status: design proposal

## Purpose

`aks-rp-e2e.app` needs observability that can answer two different questions in
the right order:

1. Is the project process connected and moving correctly?
2. Are the AKS work results correct?

Do not start by judging AKS results. First prove that events, workflow routes,
task state transitions, reviews, loop controllers, and planner decisions are
connected. If the process has a black hole, the right fix is routing,
scheduling, task-state, or workflow-contract repair. Only after the process is
sound should we judge whether specs, compact plans, live tests, or reference
collection are correct.

## Mental Model

The app is an event-reactive system with closed-loop observability:

```text
event
  -> handler
  -> workflow
  -> durable outcome
  -> closure check
```

An event is not closed merely because a handler ran. It is closed only when the
expected durable outcome exists in task-tree state, loop state, process trace,
metric recovery, or a declared terminal output.

If closure is missing, observability creates a signal:

```text
closure signal
  -> signal consumer
  -> durable outcome
  -> closure check
```

If the signal consumer cannot close the signal within its authority, the
consumer creates an escalation and records an exact wait:

```text
signal consumer cannot close
  -> escalation.created
  -> blocked/wait task records escalation id and resume condition
  -> escalation.resolved | escalation.dismissed
  -> project-planner reconciles
```

Nothing is allowed to disappear. Every abnormal condition must clear, become
owned work, become an exact wait, create an escalation, or reach an accepted
terminal disposition.

The normal work loop is one instance of that model:

```text
project.planning.requested
  -> project-planner
  -> project.task.assigned
  -> task-worker
  -> task.workflow from tasks/tree.json
  -> project.task.completed
  -> task-reviewer
  -> project.task.reviewed
  -> project-planner
  -> done, redo, follow-up, blocked, escalation-created, or another assignment
```

Durable loops are another instance:

```text
project.task.tick + action=<loop>
  -> loop controller
  -> loop state reconciliation
  -> child task assignment, blocked wait, repair task, escalation-created, or terminal disposition
```

The process is correct only when every event, signal, and task transition can
be explained by this closure model.

### Shared Blocked Model

`blocked` means work cannot continue now, but it is still tracked. It must not
mean "failed", "done", "unknown", or "check again later with no owner".

Say this loudly: `blocked` is only valid when the project can answer four
questions:

```text
What are we waiting for?
Who will check it?
How will they check it?
When do we stop waiting and do something else?
```

The task is not waiting for the watcher. The task is waiting for the real
condition. The watcher is only how the app notices that the condition changed.

Example: if a compact feature is blocked on GitHub, it is not waiting for the
next loop pulse. It is waiting for GitHub run `123` to complete and upload a
passing live result artifact. The loop pulse is only the check mechanism.

The same mental model applies to task-tree leaves and durable loop records:

```text
blockedAt
  + reason
  + waitingFor
  + owner
  + observedBy
  + observationMethod
  + nextCheckAt
  + fallbackAt/fallbackAction
  + scope
  + evidence
  + resumeAction
  + fingerprint
  + lastCheckedAt
```

Required fields:

- `blockedAt`: when the wait started.
- `reason`: why execution or planning stopped.
- `waitingFor`: the exact condition that must become true.
- `owner`: who or what can make that condition true.
- `observedBy`: the workflow, event handler, metric, or human that checks the
  condition.
- `observationMethod`: how the observer checks the condition.
- `nextCheckAt`: when the observer should check again.
- `fallbackAt`: when the project should recheck or escalate if the signal has
  not arrived.
- `fallbackAction`: what to do at fallback time.

Recommended fields:

- `scope`: task/spec/feature/package/family ids covered by this wait.
- `evidence`: run ids, artifacts, evidence files, API errors, or review notes
  proving the wait is real.
- `resumeAction`: the first action after the wait clears.
- `fingerprint`: source ref, target env, plan/spec list, and other input state.
- `lastCheckedAt`: last time the wait was reviewed without becoming runnable.

If the fingerprint changes, the blocked record may be stale and should be
rechecked. If `fallbackAt` passes, the project should run the fallback action:
recheck, escalate, reclassify, or create repair work. If `waitingFor`, owner,
observer, or fallback is missing, the item is not truly blocked; it is unowned
work.

For GitHub workflow-result waits, `waitingFor` must name the exact run:

```json
{
  "waitingFor": {
    "type": "github.workflow_run.completed",
    "runId": "123",
    "runUrl": "https://github.com/.../actions/runs/123",
    "workflow": "aks-rp-e2e-plan-execute.yaml",
    "branch": "dev",
    "successCriteria": "Run completed and uploaded a passing live-azure-run artifact."
  },
  "observedBy": {
    "workflow": "feature-compact-loop-controller",
    "trigger": "project.task.tick",
    "schedule": "durable-loop-pulse every 10 minutes"
  },
  "observationMethod": "Poll GitHub Actions run API and inspect artifacts.",
  "nextCheckAt": "2026-07-05T12:10:00.000Z",
  "fallbackAt": "2026-07-05T18:00:00.000Z",
  "fallbackAction": "If the run is still missing, still running, or lacks artifacts, create GitHub workflow diagnosis or escalation work."
}
```

If the run id is not known, do not call it a workflow-result wait. Use the real
wait instead:

- before dispatch: waiting for GitHub auth, workflow input/schema repair, or
  dispatch capacity;
- after dispatch but before run lookup: waiting for a discoverable workflow run,
  with dispatch metadata and loop key;
- before dispatch because Azure is full: waiting for Azure capacity, not
  GitHub workflow completion.

Blocked lifecycle:

1. Enter `blocked` only after the code can write the required fields above.
2. Keep one durable representation for the same wait: a blocked task, a blocked
   loop record, or both linked by scope/fingerprint.
3. Do not create repeat diagnosis work while the same fingerprint is still
   blocked and `fallbackAt` has not passed.
4. Recheck only when `waitingFor` becomes true, fallback time passes, or the
   fingerprint changes.
5. Exit `blocked` by moving to runnable work, `done` with proof, `error` with a
   new repair need, or escalation.

Blocked tasks do not watch their own signal. They are passive durable state.
The watchers are:

- domain event handlers, such as GitHub workflow completion, approval,
  escalation resolution, or test-run completion events;
- loop controllers, which re-evaluate blocked loop records when the loop is
  pulsed;
- project watchdog, which periodically samples blocked leaves and wakes the
  planner when a blocked frontier needs review;
- metrics, which raise breaches for malformed, stale, or unowned blocked
  records.

The planner consumes those watcher signals. If every blocked leaf is still a
structured future wait and the next `resumeAt`/`fallbackAt` window has not
opened, the planner may record an idempotent no-op. If `fallbackAt` has passed,
the planner should execute `fallbackAction`: recheck, repair, reroute,
escalate, or convert the item back to actionable work.

## Authority

Use this authority order:

1. `tasks/tree.json`: current task state, live frontier, task workflow routes.
2. App manifest in `app.ts`: schedules, actions, handlers, accepted events,
   emitted events, intentional cycles.
3. Workflow code and structured workflow results: actual emitted events,
   ignored-trigger guards, completion claims.
4. `.state/*.jsonl`: journal, planner runs, reviewer runs, assignment rows,
   stall-review runs, loop controller pulses.
5. Loop ledgers: `.state/spec-loop/state.json`,
   `.state/feature-reference-loop/state.json`,
   `.state/feature-compact-loop/state.json`.
6. `project.json.currentState/currentFocus`: compact readout only, never the
   source of truth.

If surfaces disagree, prefer current task tree plus structured runtime traces.

## Observability Layers

This design now focuses on layers 1-4. Layer 5 is intentionally separated so a
broken process is never hidden behind noisy AKS result failures.

### Layer 1: Static Process Graph

Build a generated graph from `app.ts` and workflow metadata:

- schedules -> emitted events;
- actions -> emitted canonical events;
- external events -> handlers;
- event accepts -> handler -> workflow;
- workflow declared emits -> next events;
- `project.task.assigned` -> `task-worker` -> task workflow route;
- terminal external outputs such as `message.created`;
- intentional cycles from `eventGraph.intentionalCycles`.

Static graph checks:

- Every internal emitted event has exactly one handler or is explicitly marked
  as terminal/external output.
- Every accepted event is part of the canonical event contract.
- Every handler's declared emitted events are either handled, terminal, or
  listed as external outputs.
- Every schedule and action emits a canonical event.
- Shared event types such as `project.task.tick` include a routing key
  (`action`) and every known action has exactly one handler.
- Every intentional cycle is named and has a guard, for example reviewer
  idempotency, planner stale-event validation, loop retry limits, or exact
  blocked waits.

This layer answers: "Can the app route the process?"

### Layer 2: Runtime Event Trace

Static wiring is not enough. Runtime observability must correlate:

```text
event emitted
  -> handler selected
  -> workflow started
  -> workflow completed
  -> next event emitted or terminal state recorded
```

Every project-emitted event should carry or be recorded with:

- `eventId`
- `correlationId`
- `causationId`
- `eventType`
- `target`
- `action`
- `emittedBy`
- `emittedAt`
- `expectedHandler`

Every handler run should record:

- `eventId` or best-effort event fingerprint;
- handler name;
- workflow name;
- start/end time;
- status: `completed`, `failed`, `timed-out`, `ignored`, or `stale-noop`;
- emitted events;
- durable state touched.

Until the runtime gives a platform event trace, app workflows should append a
small project-local trace row when emitting events. Code collects the facts;
the agent judges what they mean.

This layer answers: "Did the route actually run?"

### Layer 3: Task State Machine

Task state observability validates the project work loop:

- `project.task.assigned` must create or match an active task attempt.
- The assignment queue must be consumed by `task-worker`.
- The assigned task's workflow must exist and accept `project.task.assigned`.
- An `active` task whose current attempt has started must not be marked
  `done`, `replaced`, or `cancelled` by owner cleanup. That would leave the
  assignment without a real close event and make the worker's eventual
  completion look obsolete. The allowed exits are worker completion,
  stale-attempt requeue/recovery, or a separate successor task that does not
  close the active assignment.
- Worker completion must move the task to `review` and emit
  `project.task.completed`.
- `task-reviewer` must emit `project.task.reviewed`.
- `project-planner` must apply that review or record a structured stale/no-op
  reason.
- A task must not churn forever in `redo` without a changed task shape,
  follow-up, problem investigation, or exact wait.

This layer answers: "Is task work closing the loop?"

### Layer 4: Durable Loop Representation

Durable loop state is a ledger, not a task tree by itself. For each loop:

- non-terminal ledger records must be represented by current task-tree work;
- retry-exhausted records are not complete;
- blocked records need the shared blocked contract: start time, reason, owner,
  waiting target, observer, observation method, next check, fallback, scope,
  evidence, resume action, and fingerprint;
- pending records need runnable verifier/planner children unless intentionally
  held by capacity or dependency gates;
- `workflowProgress` must expose structured counters, not only prose.

This layer answers: "Does each loop have visible work for unfinished records?"

The user-facing metric should stay simple: count unfinished work that has no
active owner. In code this may include task-tree leaves with dead worker
sessions and loop-ledger records that have no open recovery/wait/escalation
task. The metric name should describe the problem humans need to act on, for
example `aks-rp-e2e.process.unowned-work-count`; narrower counters such as
retry-drained specs are debug components, not the primary mental model.

Unpublished project-repo changes are also a process break for GitHub-side
verification. GitHub workflows only see committed and pushed
`aks-rp-e2e` code, specs, plans, and artifacts. The app must expose dirty files
or local commits ahead of origin in that project repo through
`aks-rp-e2e.process.unpublished-change-count` so the owner can publish or
discard them before expecting GitHub-side recovery to work. Local
`aks-rp-e2e.app` UI and task-state changes are control-plane state; they take
effect locally and should not make this GitHub visibility metric fire.

### Layer 5: Result Correctness

Only after process layers are healthy do we judge result correctness:

- spec loop: every spec has a standalone live pass or reviewed terminal
  disposition;
- feature-reference loop: every feature has official Learn/API/design source
  claims or an accepted public-source gap;
- feature-compact loop: every feature has a compact plan that covers the
  feature specs and a real live GitHub proof, or an accepted terminal
  disposition;
- domain test results include real AKS proof when required;
- failed/error results are classified into product, test, model, environment,
  or workflow root cause.

This layer answers: "Are we doing the AKS work correctly?"

## Process Layer Detailed Design

### Process State Model

The process layer has four object types:

| Object          | Source of truth                   | Meaning                                           |
| --------------- | --------------------------------- | ------------------------------------------------- |
| Event route     | `app.ts`                          | Event type/action/target -> handler -> workflow.  |
| Runtime route   | event/workflow trace files        | One actual event moving through one actual route. |
| Task transition | `tasks/tree.json` + journal       | One task moved between states for a named reason. |
| Loop record     | `.state/<loop>/state.json` + task | One durable ledger item represented by live work. |

The system is process-healthy when all four object types are closed:

```text
static route is valid
  and runtime route was observed
  and task transition reached a known state
  and unfinished loop records are represented by live work
```

### Static Graph Model

The graph builder should output:

```json
{
  "nodes": [
    {
      "id": "event:project.task.completed",
      "kind": "event"
    },
    {
      "id": "handler:aks-rp-e2e-task-reviewer",
      "kind": "handler",
      "workflow": "task-reviewer"
    }
  ],
  "edges": [
    {
      "from": "event:project.task.completed",
      "to": "handler:aks-rp-e2e-task-reviewer",
      "kind": "accepts",
      "selector": {
        "type": "project.task.completed",
        "target": {
          "project": "aks-rp-e2e"
        }
      }
    }
  ],
  "terminalEvents": ["message.created"],
  "problems": []
}
```

Node kinds:

- `schedule`
- `action`
- `external-event`
- `event`
- `handler`
- `workflow`
- `task-workflow`
- `terminal-output`

Edge kinds:

- `emits`
- `accepts`
- `runs`
- `routes-task-workflow`
- `terminal`
- `cycle`

The graph must treat `project.task.assigned` specially. The app-level event
routes to `task-worker`; the domain-specific workflow route comes from the
assigned task's `workflow` field:

```text
project.task.assigned
  -> task-worker
  -> task.workflow
```

So the graph has two route layers:

1. app event routing;
2. task workflow routing.

### Route Closure Contracts

Each event type needs a closure contract. A route is closed when one of its
allowed outcomes is observed.

| Input event                                      | Expected handler                    | Closed when                                                                 |
| ------------------------------------------------ | ----------------------------------- | --------------------------------------------------------------------------- |
| `project.planning.requested`                     | `project-planner`                   | planner run row records assigned work, pulse, accepted no-op, or exact wait |
| `project.task.assigned`                          | `task-worker`                       | task starts worker and reaches `review`, `done`, `blocked`, or stale-noop   |
| `project.task.completed`                         | `task-reviewer`                     | reviewer emits `project.task.reviewed` or records structured escalation     |
| `project.task.reviewed`                          | `project-planner`                   | planner applies decision or records structured stale-noop                   |
| `project.task.tick` + `action=spec-loop`         | `spec-loop-controller`              | pulse row updates loop progress and assigns/represents records              |
| `project.task.tick` + `action=feature-reference` | `feature-reference-loop-controller` | pulse row updates loop progress and assigns/represents records              |
| `project.task.tick` + `action=feature-compact`   | `feature-compact-loop-controller`   | pulse row updates loop progress and assigns/represents records              |
| `project.watchdog.check.requested`               | `project-execution-watchdog`        | emits planner wake, stall review, loop tick, or records healthy no-op       |
| `project.stall.review.requested`                 | `project-stall-review`              | emits `project.stall.reviewed` or loop tick with structured review result   |
| `project.stall.reviewed`                         | `project-planner`                   | planner applies next move or records accepted no-op                         |
| `project.problem.investigation.requested`        | `problem-solver`                    | emits resolved, escalated, or inconclusive                                  |
| `project.problem.*`                              | `project-planner`                   | planner reconciles problem result into task-tree work or exact wait         |
| `project.focus.review.requested`                 | `focus-plan`                        | emits planner wake or `message.created` terminal output                     |
| `project.approval.requested`                     | `approval-dispatch`                 | emits `message.created` terminal output                                     |

The exact action names in the graph are:

- `spec-loop`
- `feature-reference-loop`
- `feature-compact-loop`

If an event has no closure row after the SLA, it is a process problem even if
the task tree later happens to move.

### Runtime Trace Schema

Runtime trace should be append-only JSONL:

```text
.state/process-events.jsonl
.state/process-routes.jsonl
```

`process-events.jsonl` row:

```json
{
  "ts": "2026-07-03T14:00:00.000Z",
  "eventId": "evt_...",
  "correlationId": "corr_...",
  "causationId": "evt_parent",
  "type": "project.task.completed",
  "target": {
    "project": "aks-rp-e2e",
    "taskId": "task-a"
  },
  "action": null,
  "emittedBy": {
    "workflow": "task-worker",
    "handler": "aks-rp-e2e-task-execution-worker",
    "taskId": "task-a",
    "attemptId": "a_task_a_..."
  },
  "expectedHandlers": ["aks-rp-e2e-task-reviewer"],
  "terminal": false
}
```

`process-routes.jsonl` row:

```json
{
  "ts": "2026-07-03T14:00:03.000Z",
  "eventId": "evt_...",
  "correlationId": "corr_...",
  "handler": "aks-rp-e2e-task-reviewer",
  "workflow": "task-reviewer",
  "status": "completed",
  "durationMs": 12000,
  "outcome": "emitted",
  "emittedEventIds": ["evt_reviewed"],
  "stateWrites": [],
  "ignoredReason": null
}
```

The first implementation can infer some rows from existing files, but new
workflow code should use one helper:

```text
emitProjectEvent(ctx, type, payload, metadata)
```

The helper appends trace rows and then calls `ctx.dispatchEvent`.

### Task State Invariants

These invariants are process checks:

- `tasks/tree.json` has exactly one root.
- Every task's `parent_id` agrees with its parent's `children`.
- Every non-root task is reachable from the root.
- Every `active` leaf has a current attempt id, assignment timestamp, and
  recent worker/session/heartbeat activity unless it is inside start grace.
- Every `review` leaf has a worker completion claim and either a pending
  reviewer route or a reviewer result.
- Every `blocked` leaf has structured `blocker.blocked_at`,
  `blocker.condition`, `blocker.owner`, `blocker.resume_condition`,
  `blocker.fallback_at`, and `blocker.fallback_action`.
- Every `backlog` leaf is either runnable or has structured dependency/capacity
  reasons.
- A `done` leaf is either accepted by planner/reviewer or archived by a
  task-tree operation.
- Repeated redo on the same attempt class must change work shape: split,
  follow-up, problem investigation, or exact wait.

### Loop Controller Invariants

Each durable loop root must satisfy:

- loop root task exists;
- loop state file exists;
- loop root has `context.workflowProgress`;
- `completionReady=false` when any ledger record is non-terminal;
- every non-terminal ledger record is represented by:
  - active/runnable child work;
  - review child work;
  - blocked/escalated wait that satisfies the shared blocked contract;
  - accepted terminal disposition;
  - externally running workflow with run id and heartbeat;
- `unrepresentedNonTerminalCount=0` before a loop can be considered exact-wait
  stewardship;
- retry budget exhaustion is represented as repair/follow-up work or exact
  wait, never as completion.
- loop ledger status must distinguish `error` from `blocked`:
  - `error` means diagnosis or repair is still needed;
  - `blocked` means the wait is understood, owned, and has fallback behavior.
- loop loaders must preserve valid `blocked` records. They must not normalize
  `blocked` back to `error`.

### Process Health Status

The process layer has its own status:

| Status      | Meaning                                                                   |
| ----------- | ------------------------------------------------------------------------- |
| `healthy`   | graph closed, no black holes, task/loop invariants pass, movement ok.     |
| `attention` | process is moving but has warnings, backlog, waits, or pending review.    |
| `broken`    | black hole, invalid graph, stale active, unrepresented loop, or bad tree. |

Overall project status should prefer process status over result status:

```text
process=broken => project health is broken/attention even if results improved
process=healthy + result=failing => system is working and finding real issues
```

### Health Check And Metrics

Health checks and metrics are peers over shared observation data. Do not make
metrics dependent on health check output.

```text
task tree + app graph + event trace + workflow runs + loop ledgers + sessions
  -> health check explains current closure state
  -> metrics sample facts, trends, and anomalies
  -> UI joins both for humans
```

Health check is the current-state examiner. It answers:

- what is wrong;
- where it is;
- who owns it;
- what response is expected;
- what clears it.

Metrics are continuous sensors. They answer:

- how often this happens;
- how long it has been happening;
- whether the value crossed a threshold;
- whether the trend is abnormal;
- whether a new anomaly exists that health check has not modeled yet.

Metrics may read health check fields when the metric is a thin view over a
known signal, but metrics may also read raw data directly when the point is
trend, anomaly detection, or monitor coverage. Data is the authority; health
check is not the only gateway to data.

When a metric discovers a new abnormal pattern, it should create a process
signal with a stable `signalKey`. The health check should then include that
signal in its next readout, even if the first version only classifies it as
`metric-discovered`.

Core process metrics:

| Metric id                                              | Type   | Breach meaning                                   |
| ------------------------------------------------------ | ------ | ------------------------------------------------ |
| `aks-rp-e2e.process.closed`                            | health | 0 means at least one process black hole exists   |
| `aks-rp-e2e.process.graph.problem-count`               | gauge  | static graph has route or cycle problems         |
| `aks-rp-e2e.process.graph.unhandled-event-count`       | gauge  | emitted internal events have no handler          |
| `aks-rp-e2e.process.graph.multi-handler-count`         | gauge  | event routes to too many handlers                |
| `aks-rp-e2e.process.graph.missing-routing-key-count`   | gauge  | shared event lacks action/target key             |
| `aks-rp-e2e.process.route.unobserved-count`            | gauge  | emitted event has no handler run after SLA       |
| `aks-rp-e2e.process.workflow.no-next-step-count`       | gauge  | workflow ended without expected next step        |
| `aks-rp-e2e.process.assignment.not-consumed-count`     | gauge  | assignment queue rows are stale                  |
| `aks-rp-e2e.process.task.stale-active-count`           | gauge  | active leaves lack live worker activity          |
| `aks-rp-e2e.process.task.review-not-applied-count`     | gauge  | review facts not applied/stale-nooped            |
| `aks-rp-e2e.process.unowned-work-count`                | gauge  | unfinished work has no active owner              |
| `aks-rp-e2e.process.unpublished-change-count`          | gauge  | project repo changes are not visible to GitHub   |
| `aks-rp-e2e.process.assignment-state-mismatch-count`   | gauge  | assignment stayed open after task left active    |
| `aks-rp-e2e.process.loop.unrepresented-record-count`   | gauge  | non-terminal loop records lack live work         |
| `aks-rp-e2e.process.integrity.task-tree-problem-count` | gauge  | root/orphan/parent-child integrity problems      |
| `aks-rp-e2e.process.blocked.missing-waiting-for-count` | gauge  | blocked leaves/records lack the real wait target |
| `aks-rp-e2e.process.blocked.missing-observer-count`    | gauge  | blocked leaves/records lack who checks the wait  |
| `aks-rp-e2e.process.blocked.missing-owner-count`       | gauge  | blocked leaves/records lack owner fields         |
| `aks-rp-e2e.process.blocked.missing-fallback-count`    | gauge  | blocked leaves/records lack fallback behavior    |
| `aks-rp-e2e.process.blocked.stale-fingerprint-count`   | gauge  | blocked records no longer match current inputs   |

Alert policy:

- static graph problem: alert immediately;
- task-tree integrity problem: alert immediately;
- stale assignment: warn after 10 minutes, alert after 30 minutes;
- review not applied: warn after 10 minutes, alert after 30 minutes;
- stale active: honor start grace, then alert immediately;
- loop unrepresented records: alert immediately unless a controller pulse is
  currently running.

Metric breach does not mutate the task tree. It emits `metric.breach`, which
routes to planner or stall review. Code reports facts; owner/planner decides
the repair. The consumer should read both the metric sample history and the
latest health check/context packet before deciding.

Evaluator feedback follows the same closure rule. `learning.feedback` is not
durable task state by itself. When its payload names project `aks-rp-e2e`, it
routes to `project-planner`; the owner must either create/link repair work,
record an exact wait, escalate, or record an accepted no-op. Feedback for other
projects is a no-op for this app.

### Signal Lifecycle

Every process signal must have an owner and a terminal outcome. A signal that
only appears in a dashboard is not enough.

Signal flow:

```text
observation data
  -> health check signal and/or metric-discovered signal
  -> metric.breach when threshold/SLA/anomaly rule is crossed
     or learning.feedback when evaluator finds actionable project feedback
  -> consumer workflow
  -> task-tree decision, exact wait, repair task, escalation, or accepted no-op
  -> signal clears or remains with a newer owning task
```

Consumers:

| Signal family            | Primary consumer              | Why                                                    |
| ------------------------ | ----------------------------- | ------------------------------------------------------ |
| static graph             | planner                       | Graph/config change is repo-local repair work.         |
| runtime route            | stall review, then planner    | Needs packet collection before choosing repair.        |
| task assignment/active   | planner                       | Usually a task-state/session repair or requeue.        |
| task review/application  | planner                       | Planner owns review application and stale-noop logic.  |
| loop representation      | loop controller, then planner | Controller can refill; planner owns grouped repair.    |
| blocked resume integrity | planner                       | Planner owns exact waits and blocker shape.            |
| evaluator feedback       | planner                       | Owner converts actionable findings to work/wait/no-op. |
| process monitor failure  | stall review                  | Monitor itself failing is a liveness fallback problem. |

Terminal outcomes:

- `cleared`: next health sample no longer reports the signal.
- `accepted-noop`: consumer proves current state is already correct and records
  the idempotent no-op.
- `repair-task-created`: a concrete task-tree leaf owns the repair.
- `exact-wait-recorded`: blocker has owner and resume condition.
- `loop-refilled`: controller assigned or represented non-terminal records.
- `escalation-created`: `escalation.created` was emitted and a blocked/wait
  task records the escalation id plus resume condition.
- `terminal-disposition`: owner accepts the condition as final.

Signals must not end in free-form prose only. The terminal outcome has to be
visible in task tree state, workflow progress, event trace, or health snapshot.
`escalation.created` alone is not closure; the task tree must carry the exact
wait that ties project state back to the escalation.

### Signal Consumer Matrix

| Signal                                        | Breach consumer                   | Expected first action                                                                                                                                                    | Allowed final state                                                      |
| --------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `process.closed=0`                            | `project-stall-review`            | Collect graph/runtime/task packet and classify process break.                                                                                                            | repair task, exact wait, accepted-noop, or escalation-created.           |
| `process.graph.problem-count>0`               | `project-planner`                 | Create/assign repo-local graph repair task.                                                                                                                              | graph health clears or repair task remains active/review.                |
| `process.graph.unhandled-event-count>0`       | `project-planner`                 | Add handler, mark terminal output, or remove invalid emission.                                                                                                           | no unhandled internal event remains.                                     |
| `process.graph.multi-handler-count>0`         | `project-planner`                 | Tighten selector/action/target routing.                                                                                                                                  | event has one owner or documented fan-out.                               |
| `process.graph.missing-routing-key-count>0`   | `project-planner`                 | Add `action`/target to producer or selector.                                                                                                                             | shared event routes deterministically.                                   |
| `process.route.unobserved-count>0`            | `project-stall-review` -> planner | Correlate emitted event to handler sessions and find missing hop.                                                                                                        | route observed, stale event accepted-noop, or repair task created.       |
| `process.workflow.no-next-step-count>0`       | `project-stall-review` -> planner | Inspect workflow completion and expected closure contract.                                                                                                               | workflow emits next event, writes terminal state, or repair task exists. |
| `process.assignment.not-consumed-count>0`     | `project-planner`                 | Re-emit assignment, clear stale row, or repair worker dispatch.                                                                                                          | assignment queue consumed or stale assignment repaired.                  |
| `process.assignment-state-mismatch-count>0`   | `project-planner`                 | Inspect the task and pair, then close by replaying/recording the missing completion, requeueing stale work, or repairing the task-state transition that skipped closure. | no open assignment pair exists for non-active/missing tasks.             |
| `process.task.stale-active-count>0`           | `project-planner`                 | Requeue active task with fresh session or create focused repair.                                                                                                         | task active with live worker, backlog with reason, done/review/blocked.  |
| `process.task.review-not-applied-count>0`     | `project-planner`                 | Apply review, stale-noop it, or create manual review task.                                                                                                               | reviewed task exits review or has owned manual review work.              |
| `process.unowned-work-count>0`                | `project-planner`                 | Create or repair ownership: active worker, recovery task, exact wait, escalation, or terminal disposition.                                                               | all unfinished work has an active owner.                                 |
| `process.unpublished-change-count>0`          | `project-planner`                 | Commit and push intended `aks-rp-e2e` repo changes, or discard/generated-ignore unintended churn.                                                                        | GitHub-visible project repo state matches intended local state.          |
| `process.loop.unrepresented-record-count>0`   | loop controller -> planner        | Pulse controller; if still unrepresented, create grouped repair.                                                                                                         | every non-terminal record represented or terminal disposition accepted.  |
| `process.integrity.task-tree-problem-count>0` | `project-planner`                 | Repair tree root/reachability/parent-child links through tools.                                                                                                          | integrity check clears.                                                  |
| project-scoped `learning.feedback`            | `project-planner`                 | Classify evaluator finding against current task tree and create/link repair, wait, escalation, or no-op.                                                                 | feedback is represented by owned work, exact wait, escalation, or no-op. |
| `process.blocked.missing-waiting-for-count>0` | `project-planner`                 | Name the exact condition being waited for, or reopen as actionable work.                                                                                                 | blocked item has `waitingFor` or is no longer blocked.                   |
| `process.blocked.missing-observer-count>0`    | `project-planner`                 | Name who checks the wait and how, or reopen as actionable work.                                                                                                          | blocked item has observer/check method or is no longer blocked.          |
| `process.blocked.missing-owner-count>0`       | `project-planner`                 | Add exact owner or reopen as actionable diagnosis/repair work.                                                                                                           | blocked item has an owner or is no longer blocked.                       |
| `process.blocked.missing-fallback-count>0`    | `project-planner`                 | Add fallback time/action or convert to active work/escalation.                                                                                                           | blocked item has fallback behavior or is no longer blocked.              |
| `process.blocked.stale-fingerprint-count>0`   | loop controller -> planner        | Recheck changed input state and either unblock, refresh blocker, or create repair/retry work.                                                                            | blocked item matches current inputs or has moved to work/done.           |

### Escalation Rules

Consumers should use the lightest workflow that can close the signal:

1. **Planner directly** for deterministic task-tree or app-graph repairs.
2. **Loop controller first** for refillable durable loop representation gaps.
3. **Stall review** for runtime black holes, unclear route gaps, or monitor
   contradictions that require packet collection.
4. **Problem solver** only when the planner identifies a bounded local/tooling
   root cause that needs focused investigation.
5. **Escalation** only when the responsible consumer cannot close the signal
   within its authority.

Use the existing escalation vocabulary and events:

```text
escalation.created
escalation.resolved
escalation.dismissed
```

When creating an escalation, also create or update the owning blocked/wait task:

```json
{
  "blocker": {
    "owner": "platform-runtime",
    "escalationId": "esc_...",
    "resume_condition": "Resume when escalation is resolved or dismissed."
  }
}
```

The planner already consumes `escalation.resolved` and
`escalation.dismissed`. On either event, it should reconcile the owning wait:
unblock, reopen, mark terminal, or create the next bounded task.

Repeated signals should not create duplicate work. Before creating a new task,
the consumer must look for an open task with the same `signalKey` or
`rootCauseClass`.

Suggested task context for signal-owned work:

```json
{
  "signal": {
    "metricId": "aks-rp-e2e.process.graph.unhandled-event-count",
    "signalKey": "event.no-handler:project.some.event",
    "severity": "P0",
    "firstSeenAt": "2026-07-03T14:00:00.000Z",
    "lastSeenAt": "2026-07-03T14:10:00.000Z",
    "consumer": "project-planner",
    "expectedClearCondition": "static graph reports zero unhandled internal events"
  }
}
```

Signal-owned tasks should close only when their expected clear condition is
true, or when the owner records an accepted terminal disposition.

### Consumer Failure

A consumer saying "unable" is not terminal. Failed signal consumption becomes a
higher-level process signal:

```text
signal
  -> primary consumer failed, timed out, ignored trigger, or made no durable decision
  -> process.signal.consumer-failed
  -> fallback consumer
  -> repair task, exact wait, escalation-created, or accepted no-op
```

Consumer failure examples:

- signal event was emitted but no consumer workflow ran;
- consumer workflow timed out or crashed;
- consumer ignored the trigger;
- consumer completed without a durable outcome;
- consumer created duplicate work while the original signal still lacks an
  owner;
- consumer cannot decide because required evidence is unavailable.

Consumer failure metrics:

| Metric id                                         | Type  | Breach meaning                                      |
| ------------------------------------------------- | ----- | --------------------------------------------------- |
| `aks-rp-e2e.process.signal.unconsumed-count`      | gauge | signal has no owning consumer attempt               |
| `aks-rp-e2e.process.signal.consumer-failed-count` | gauge | consumer attempt failed or produced no closure      |
| `aks-rp-e2e.process.monitor.failed-count`         | gauge | health/metric/trace monitor path is not trustworthy |

If the fallback consumer also cannot close the condition, it must create
`escalation.created` and record the escalation id on an exact blocked/wait task.

### Monitor Of The Monitor

The observability path also needs closure:

```text
health command works
metrics sample raw and derived fields
metric breach emits event
planner/stall-review consumes breach
```

Add a process-monitor signal for the monitor itself:

- health command failed;
- health JSON missing required `process` fields;
- metric sampler failed to read a registered process metric;
- metric sampler cannot access its raw data source;
- metric breach has no matching structured signal/context packet after grace;
- `metric.breach` was emitted but not handled.

These should route to `project-stall-review` because they mean the monitoring
system may not be trustworthy.

### Process Readout Shape

`bun run health --json` should include:

```json
{
  "process": {
    "status": "healthy|attention|broken",
    "closed": true,
    "graph": {
      "nodeCount": 0,
      "edgeCount": 0,
      "terminalEvents": ["message.created"],
      "problems": []
    },
    "runtime": {
      "lookbackMinutes": 30,
      "events": {
        "emitted": 0,
        "handled": 0,
        "unobserved": []
      },
      "routes": []
    },
    "tasks": {
      "integrityProblems": [],
      "assignmentsQueued": [],
      "staleActive": [],
      "reviewNotApplied": [],
      "blockedMissingResume": []
    },
    "loops": [
      {
        "taskId": "aks-feature-compact-loop",
        "completionReady": false,
        "unrepresentedNonTerminalCount": 0,
        "representedBy": {
          "active": 0,
          "review": 0,
          "blocked": 0,
          "externalRun": 0
        }
      }
    ]
  }
}
```

Human output should show process failures before ordinary frontier movement.

## Black Hole Classes

Process observability should name black holes explicitly:

- `event.no-handler`: an internal emitted event has no handler.
- `event.multi-handler`: an event may be consumed by more than one handler when
  the graph expects one.
- `event.routing-key-missing`: shared event type is missing `action` or target
  data needed for routing.
- `event.emitted-not-observed`: event was emitted but no handler run was seen
  within the SLA.
- `workflow.ignored-trigger`: workflow started but ignored the trigger type or
  action.
- `workflow.no-next-step`: workflow completed without an emitted event,
  terminal output, or durable state transition.
- `assignment.not-consumed`: assignment row remains queued.
- `task.active-stale`: active task has no running workflow or heartbeat.
- `task.review-not-applied`: review event exists but planner did not apply or
  explicitly stale-noop it.
- `loop.unrepresented-records`: loop ledger has non-terminal records not
  represented by task-tree work.
- `cycle.unguarded`: a cycle exists without retry limits, stale-event checks,
  or exact wait gates.

These classes are process findings. They should be fixed before interpreting
AKS result quality.

## Readout Contract

`bun run health` remains the operator entry point, but its JSON should grow into
two sections:

```json
{
  "status": "attention",
  "process": {
    "status": "healthy|attention|broken",
    "graph": {
      "nodes": [],
      "edges": [],
      "deadEnds": [],
      "cycles": []
    },
    "runtime": {
      "eventsEmitted": 0,
      "handlerRuns": 0,
      "blackHoles": []
    },
    "taskStateMachine": {
      "assignmentsQueued": 0,
      "staleActive": [],
      "reviewNotApplied": []
    },
    "loops": []
  },
  "results": {
    "status": "unknown|healthy|attention|failing",
    "specLoop": {},
    "featureReferenceLoop": {},
    "featureCompactLoop": {}
  },
  "signals": [],
  "nextActions": []
}
```

Human output should show:

1. process graph summary;
2. black holes and dead ends first;
3. task/loop movement second;
4. result correctness last.

## Process Graph For Current App

The intended graph is:

```text
regular-learning schedule
  -> project.planning.requested
  -> project-planner

project-execution-watchdog schedule
  -> project.watchdog.check.requested
  -> project-execution-watchdog
  -> project.planning.requested | project.stall.review.requested | project.task.tick

durable-loop-pulse schedule
  -> project.task.tick + action=spec-loop
  -> spec-loop-controller
  -> project.task.assigned

durable-loop-pulse schedule
  -> project.task.tick + action=feature-reference-loop
  -> feature-reference-loop-controller
  -> project.task.assigned

durable-loop-pulse schedule
  -> project.task.tick + action=feature-compact-loop
  -> feature-compact-loop-controller
  -> project.task.assigned

project.task.assigned
  -> task-worker
  -> task.workflow
  -> project.task.completed | project.task.tick

project.task.completed
  -> task-reviewer
  -> project.task.reviewed
  -> project-planner

project.stall.review.requested
  -> project-stall-review
  -> project.stall.reviewed | project.task.tick
  -> project-planner or loop controller

project.problem.investigation.requested
  -> problem-solver
  -> project.problem.resolved | project.problem.escalated | project.problem.inconclusive
  -> project-planner

project.focus.review.requested
  -> focus-plan
  -> project.planning.requested | message.created

project.approval.requested
  -> approval-dispatch
  -> message.created
```

`message.created` is an external output. It is not a black hole if it is
classified as terminal output.

## Web UI Readout

The first Web UI screen should show process state before result state. The
human should not need to inspect raw logs or guess what to do.

The UI purpose is to show raw project facts with useful hints layered on top.
It should help the human quickly identify potentially abnormal project
behavior, see who already owns it, inspect the evidence, challenge the system's
classification, and decide whether human judgment or external input is actually
needed.

The first screen must answer:

```text
Is the system closed?
If not, what broke?
Who owns it?
What response is needed?
What condition will make it disappear?
```

The main read pattern is:

```text
Expected -> Actual -> Age -> Owner -> Current attempt -> Why not closed
```

This is the shortest path from raw observations to useful human judgment:

- `Expected`: what should have happened according to the process contract.
- `Actual`: what the task tree, metrics, loop state, or trace currently shows.
- `Age`: last movement, first seen, and whether this is still inside grace.
- `Owner`: planner, loop controller, stall review, problem solver, human, or
  external owner.
- `Current attempt`: task id, workflow run id, GitHub run id, escalation id, or
  exact wait.
- `Why not closed`: missing route, stale work, missing review, exact wait,
  retry exhaustion, unrepresented loop record, or terminal disposition pending.

The UI should prefer mismatch-plus-age over large raw counts. A fresh failure
with an owner may be normal. The same failure with no owner, no current attempt,
or no movement is a process issue.

Do not hide facts just because the system has a suggested classification. Each
readout should separate:

- raw fact: the direct value from task tree, metric, loop ledger, trace, or run
  artifact;
- system hint: why the app thinks the fact may matter;
- confidence: known, inferred, stale, conflicting, or unknown;
- uncertainty: what the app cannot prove yet;
- evidence: source file, task id, run id, metric sample, or trace row;
- action: only when human judgment or external authority can change the
  outcome.

The page should make it easy to challenge a classification. A human should be
able to open the raw source behind any issue row.

The UI must never imply "no alert means no issue" unless observation coverage
is complete for the area being summarized. The readout should distinguish:

```text
No issue observed, coverage complete
No issue observed, but coverage has gaps
Issue observed with evidence
Issue suspected from incomplete or conflicting evidence
```

This gives humans a way to recognize potential issues that the app has not
classified yet. The UI should show negative space: what the app did not check,
what data is stale, what expected item has no observation, and where sources
disagree.

### Top Status

Show the two-layer status clearly:

```text
Process: Healthy | Attention | Broken
Results: Healthy | Attention | Failing | Unknown
```

Also show compact counters:

- last health check time;
- open process signals;
- consumer failures;
- open escalations;
- active work;
- pending review;
- blocked/exact waits.

Process status should visually dominate result status. If process is `Broken`,
result widgets are secondary because result interpretation may be unreliable.

Also show observation coverage beside status:

- task tree freshness;
- metric freshness;
- loop ledger freshness;
- runtime trace availability;
- static graph check availability;
- GitHub/run artifact freshness when result health depends on it.

Coverage should be visible even when there are no open alerts.

### Coverage And Blind Spots

Add a compact trust readout near the top of the page:

```text
Can we trust this readout?
```

This is not a separate health system. It is a coverage view over the same raw
facts.

Columns:

- surface: task tree, app graph, runtime trace, workflow runs, loop ledgers,
  metrics, GitHub runs, test results;
- expected: what should be observable;
- observed: what the app actually read;
- freshness: current, stale, missing, or unknown;
- coverage: complete, partial, inferred, or not implemented;
- blind spot: what issue could exist without being detected;
- evidence: source file, timestamp, sample id, or artifact link;
- action: only when the gap needs repair or human challenge.

Examples:

```text
Runtime trace
expected: emitted events can be matched to handler runs
observed: no process-routes.jsonl yet
coverage: not implemented
blind spot: event black holes may exist even when task tree is moving
action: Review Observability Gap
```

```text
Compact loop representation
expected: every non-terminal feature has open work, exact wait, or terminal disposition
observed: unrepresentedNonTerminalCount=0 from workflowProgress
coverage: inferred
blind spot: UI has not independently checked each representedFeatureKey
action: Challenge Classification
```

Humans can detect app-missed issues by comparing expected inventory to observed
inventory and by inspecting stale, missing, inferred, or conflicting coverage
rows.

### Process Closure Panel

Show the closure pipeline:

```text
Events -> Handlers -> Workflows -> Durable Outcomes -> Closure
```

Each stage has one state:

- `OK`
- `Attention`
- `Broken`

Clicking a stage shows its process signals. Example:

```text
Events        OK
Handlers      OK
Workflows     Attention
Outcomes      Broken
Closure       Broken
```

### Open Signals Queue

This is the main human action surface.

Columns:

- signal key;
- severity;
- raw fact;
- system hint;
- confidence;
- first seen;
- last seen;
- consumer;
- state;
- uncertainty;
- owning task/escalation;
- evidence;
- required response;
- clear condition.

Signal states:

- `new`
- `acknowledged`
- `owned`
- `processing`
- `repair-task-created`
- `exact-wait-recorded`
- `escalation-created`
- `accepted-noop`
- `cleared`
- `consumer-failed`

Example row:

```text
process.integrity.task-tree-problem-count
P0
consumer: project-planner
state: repair-task-created
required response: review/approve repair task
clear condition: task-tree integrity reports zero problems
```

The UI must not show a signal as closed unless the clear condition is true or
there is an accepted terminal disposition.

When a metric is attached to the signal, show metric context beside the
closure fields:

- current value;
- threshold;
- consecutive breaching samples;
- first breach time;
- trend direction;
- raw data source.

If a metric is breaching but no matching health-check signal exists, show it as
`metric-discovered` and route it through the same signal ownership model. That
keeps new data findings visible instead of hiding them until health check code
knows about the pattern.

Signals should be grouped by the issue they help the human identify:

| Group            | Purpose                                                                |
| ---------------- | ---------------------------------------------------------------------- |
| Process mismatch | Expected route/state differs from actual route/state.                  |
| Stuck work       | Work has an owner but age/movement shows it may not be progressing.    |
| Failure cluster  | Many result failures share a likely root cause or feature family.      |
| Human needed     | Escalation, exact wait, approval, missing external proof, or response. |
| Monitor problem  | Health, metrics, trace, or breach routing may not be trustworthy.      |
| Coverage gap     | Expected observation is missing, stale, partial, or only inferred.     |

Each visible signal row should include enough context to explain why it is
potentially abnormal:

- expected state;
- actual state;
- raw fact and source;
- system hint;
- confidence and uncertainty;
- first seen and last movement;
- current owner;
- current attempt or exact wait;
- required response;
- clear condition;
- evidence link when available.

Rows should include a challenge path even when no immediate action is needed:

- open evidence;
- open raw source;
- challenge classification;
- ask owner to re-evaluate this area;
- create observability-gap repair when the issue is missing data rather than
  domain failure.

### Escalations Panel

Show only escalation-created conditions that require external or human response.

Columns:

- escalation id;
- owner;
- related signal;
- related task;
- ask;
- created time;
- resume condition;
- status;
- latest response/evidence.

Actions:

- mark resolved;
- dismiss;
- add response note;
- link evidence;
- open owning blocked/wait task.

An escalation should always link back to a task-tree wait with `escalationId`
and `resume_condition`.

### Current Work Loop

Show the normal project loop as a compact process panel:

```text
Planner -> Worker -> Reviewer -> Planner
```

Surface stuck points:

- assignments not consumed;
- active tasks stale;
- completions without review;
- reviews not applied;
- redo churn;
- blocked leaves missing resume condition.

The human should see where work is stuck without reading individual workflow
logs first.

### Durable Loops

Show one row per durable loop:

```text
Spec loop       incomplete  pending=284  error=5   unrepresented=159
Reference loop  complete    done=305     error=0   unrepresented=0
Compact loop    incomplete  done=22      error=62  unrepresented=0
```

Columns:

- `completionReady`;
- pending/running/error/done counts;
- unrepresented records;
- current owner task or wait;
- last pulse;
- next pulse/hold reason;
- latest signal.

The UI should distinguish:

- incomplete but represented;
- incomplete and unrepresented;
- exact wait stewardship;
- controller running;
- consumer failed.

### Result Health Below Process Health

Only after the process panels, show AKS result health:

- spec verification;
- feature references;
- feature compact tests.

This section should be clearly labeled as result correctness. Poor result
health with healthy process means the app is working and producing useful
failure information.

### Human Actions

Actions should map directly to the process model:

- acknowledge signal;
- request planner review;
- request stall review;
- retry consumer;
- create escalation;
- resolve escalation;
- dismiss escalation;
- add evidence or response note;
- open owning task;
- record accepted no-op with reason.

Every action must produce an event or durable state change with a clear closure
condition. The UI should avoid generic "retry" or "dismiss" buttons that do not
state what signal they affect.

The UI should not ask the human to monitor everything. It should expose an
action only when the system needs judgment, approval, external evidence, or a
bounded diagnostic route.

| Situation                 | User decision or response                                    | Preferred action label                      |
| ------------------------- | ------------------------------------------------------------ | ------------------------------------------- |
| Escalation                | Provide outside info, approve, dismiss, or confirm unblock.  | Resolve Escalation / Add Response / Dismiss |
| Consumer failed           | Ask the system to investigate the broken process route.      | Request Stall Review                        |
| Unknown abnormal signal   | Ask the owner to classify into repair/wait/escalation/no-op. | Request Planner Review                      |
| Task/process integrity    | Review or approve a repair when the repair is risky.         | Review Repair Task                          |
| Durable loop not moving   | Ask controller/planner to refill or explain the exact wait.  | Review Loop                                 |
| Live test failure cluster | Classify as product, test, environment, model, or workflow.  | Triage Failure Cluster                      |
| Exact wait                | Attach proof when the wait condition has landed.             | Add Evidence And Resume                     |
| Metric-discovered signal  | Convert the new sensor finding into owned work or no-op.     | Review Signal                               |
| Coverage gap              | Decide whether missing/stale visibility is acceptable.       | Review Observability Gap                    |
| Wrong classification      | Human sees raw facts contradict the system hint.             | Challenge Classification                    |

Do not show system-owned normal work as a human action. Show it as status with
owner and current attempt. Human action rows should be reserved for cases where
the human can change the outcome.

If the next step is deterministic and safe, the system should do it. The UI
should show the auto action as a fact and expose the evidence, not ask the
human to perform routine routing work.

Buttons on process cards should not be mystery controls. A card action such as
`Prepare Review` should fill a complete planner request in the project action
box and explain that the user may send it as-is or add context. The button does
not mean "chat with the agent here"; it means "post a
`project.planning.requested` event with this raw fact and requested
classification." Follow-up appears through the normal project surfaces after
refresh: updated task-tree state, review rows, exact waits, escalations, or
human-facing messages. If the planner needs human input, it must create a
visible human-needed task, escalation, or message with a clear resume condition.

Human challenge actions should not mutate project state directly without a
recorded decision. They should create a planner/stall-review input that names
the challenged row, raw evidence, user's concern, and expected re-evaluation
condition.

### UI Rule

Do not show humans a giant log as the primary surface. Show:

```text
raw fact -> hint -> confidence -> owner -> required response -> clear condition
```

The user should always know:

- what is wrong;
- what raw fact supports that conclusion;
- what is inferred or uncertain;
- who owns it;
- what action is expected;
- what will make it disappear from the dashboard.

## Implementation Plan

### Phase 1: Static Graph Readout

Add a small graph builder used by `bun run health --json`:

- import the app definition from `app.ts`;
- extract schedules, actions, workflow handlers, accepts, emits, external
  events, and intentional cycles;
- classify emitted events as handled, terminal external output, or black hole;
- include task workflow routes from known task `workflow` values in
  `tasks/tree.json`;
- report `event.no-handler`, `event.multi-handler`,
  `event.routing-key-missing`, and `cycle.unguarded`.

This is read-only and can be tested with fixture app definitions.

### Phase 2: Runtime Trace Correlation

Introduce a tiny event emit helper for workflows:

```text
emitProjectEvent(ctx, eventType, payload, metadata)
```

The helper should:

- add `observability.eventId`, `correlationId`, and `causationId` when absent;
- append `.state/event-trace.jsonl`;
- call `ctx.dispatchEvent`.

Do not require every legacy call site to migrate at once. Health should support
best-effort inference from existing journal/planner/reviewer files during
migration.

### Phase 3: Route SLA Checks

Add process checks:

- emitted event without handler run after SLA;
- handler run without expected emitted event or terminal state;
- assignment not consumed after SLA;
- completion without reviewer event;
- review without planner apply/stale-noop;
- loop tick without loop progress update.

These are process signals and should be visible before result signals.

### Phase 4: Result Health

Keep result health separate:

- spec pass/error/fail counts and live proof;
- feature reference source coverage;
- compact plan coverage, cluster compaction count, and live proof;
- root-cause classification for non-pass results.

Result health may be poor while process health is good. That means the system
is working and producing useful failure information.

## Design Rules

- Observability is read-only.
- Code collects facts; the agent judges meaning and repair strategy.
- Do not parse prose for control decisions when structured fields exist.
- Prefer one readout over many commands: extend `bun run health --json`.
- Treat process black holes as higher priority than AKS result failures.
- A terminal output must be explicitly classified; otherwise it is a dead end.
- A cycle must have a named guard.
- `blocked` is not completion. It must have an exact owner and resume
  condition.

## Current Gap

The first health implementation reports frontier movement and several task/loop
signals, but it does not yet build the full process graph or correlate emitted
events to handler runs. That means it can say "the project is moving" but cannot
yet prove "every route is connected and no event fell into a black hole."

The next implementation step should be Phase 1: static graph readout and
dead-end classification.
