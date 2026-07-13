# Project App Event Contract

Status: implemented contract

## Purpose

`aks-rp-e2e.app` uses events as the app control plane. Events wake workflows,
carry compact handoff context, and let the app keep the task tree moving without
turning every timer, retry, or UI click into a task node.

The contract is intentionally small:

- `type` says what kind of command or fact this is.
- `target` says who should handle it.
- optional top-level `action` disambiguates routing when several event routes
  share the same event type.
- `data` explains why the event was fired and carries workflow context.

The target-first rule is the most important part: fire the target. If no direct
event route catches the event, runtime ownership fallback may route it to the
owning task or project.

## Event Routes

`handler` is runtime plumbing, not a project-level mental model. In app design,
talk about event routes and route targets:

```text
event -> event route -> target
```

An event route lives in `app.ts` through `onEvent`. Most routes are generated
with `workflowHandlers([...])`; that helper name is implementation history, not
the conceptual model. A route matches an event selector and delivers the event
to the right target. The target is inferred by convention: a route with a
workflow runs that workflow; a route or event with an owner and no workflow is
an owner handoff; an unmatched event follows the runtime ownership fallback.
The responsible actor is the agent, project, or task owner named by the
task/event context, not the route object.

Owner-routed events must still close with structured output. The owner should
record one of: dispatch a workflow, create/assign a task, accept a no-op, block
with an exact waiting condition, escalate, or emit another canonical event.

Example owner route:

```text
metric.breach
  -> project owner/app-ops
  -> structured decision
  -> project.planning.requested, project.stall.review.requested,
     accepted no-op, exact wait, or escalation
```

For task-backed work, the route normally starts a task adapter:

```text
project.task.assigned -> task-worker -> task.workflow
```

The task adapter may read the task tree to build workflow input and normalize
workflow output. Business workflows should not need task-tree mechanics unless
their business purpose is project orchestration.

## Naming Rules

- Use `*.requested` for commands that ask a workflow or controller to run.
- Use past-tense facts for results: `assigned`, `completed`, `submitted`,
  `resolved`, and `escalated`.
- Keep event names generic. Put variants in `data.reason`, `data.mode`,
  `data.approvalKind`, `target.taskId`, and `data.params`.
- Use top-level `action` only as routing metadata for shared event types.
- Avoid ambiguous event names:
  - `owner` is accountability, not the planner event name.
  - do not create new `dispatch` event names; `project.task.assigned` is the
    existing task-dispatch fact.
  - `unknown` is not a result; use `inconclusive`.
- Platform events such as `metric.*`, `escalation.*`, and `message.created`
  remain platform events. The project app may subscribe to them when they affect
  project state.

## Vocabulary Guardrail

Prefer the existing event vocabulary before adding a new event:

- Use `project.planning.requested` when the planner should decide what happens
  next.
- Use `project.task.tick` plus top-level `action` for durable loop pulses.
- Use `project.task.assigned`, `project.task.completed`, and
  `project.task.reviewed` for normal task execution.
- Use `project.stall.review.requested` only when the process itself needs a
  liveness diagnosis.
- Use `project.problem.investigation.requested` for one bounded root-cause
  investigation.

New event types are justified only when the existing events cannot express the
command/fact without hiding ownership or closure. Put variants in `data.reason`,
`data.mode`, `data.params`, or `action` rather than creating
feature-specific event names.

This makes app extension incremental:

```text
new workflow -> task.workflow usage -> app route when direct triggering is needed
new event    -> only when there is a new durable command or fact
```

One-off work does not need a new event. Repeated one-off work should first
become a task pattern or workflow. Add an app route only when an event,
schedule, metric, external input, or UI action must start it directly.

## Canonical Events

### Planning

`project.planning.requested`

Wakes the planner workflow. The planner reviews current state, reconciles
results, repairs task-tree meaning, and creates, blocks, or dispatches the next
concrete work.

Planning is invoked by event. Emit `project.planning.requested`; do not call an
agent directly as the planner. The `project-planner` workflow is the executable
adapter that packages state, calls `app-ops` when judgment is needed, validates
structured decisions, and applies task-tree changes. `app-ops` supplies
judgment; the workflow owns the IO contract and state mutation boundary. When
the next move is AKS domain work, the planner should create or dispatch a
`domain/*` task for `aks-explorer` rather than doing that work itself.

In this app, "assign" means event-driven dispatch:

```text
task tree stores runnable work
project.task.assigned starts the worker attempt
task-worker consumes the event and runs the scoped agent
```

It is not a manual management step. If the planner creates a runnable task, it
must dispatch it with `project.task.assigned` or record why the task is blocked.

Do not confuse `project.task.assigned` with `blocker.owner`. `blocker.owner`
names the party accountable for a blocked wait; it does not start a worker and
does not prove work is happening. When a blocked wait reaches fallback time, the
planner must either create/dispatch an active recovery task, refresh the exact
wait with evidence, create/verify a handoff or escalation, or mark the wait
terminal with proof.

Use this for manual planning, scheduled learning, watchdog refill requests,
task-completion reconciliation, metric/escalation follow-up, comments that need
project interpretation, and generic project advancement.

```json
{
  "type": "project.planning.requested",
  "target": { "project": "aks-rp-e2e" },
  "data": {
    "reason": "watchdog-capacity-underfilled",
    "params": { "maxConcurrent": 80 }
  }
}
```

### Task Lifecycle

`project.task.assigned`

A planner or controller dispatched one concrete executable leaf. The name is
kept for compatibility, but the meaning is "start this runnable task now".

`project.task.completed`

A worker completed one dispatched task and reported structured completion fields,
summary, test result fields, evidence refs, attempt, and review context.
Completion is progress, not automatic acceptance; it wakes independent task
review.

`project.task.reviewed`

The read-only task reviewer judged one completed task. This is a structured
review fact, not a task-tree mutation. The planner consumes it and is still the
only workflow that decides whether to accept, reject, block, or create follow-up
work in the live task tree.

The reviewer should normally run as app-local agent `aks-reviewer`, configured
with the project-available `gpt-5.5` model alias. The separate model/agent gives
completion review a second perspective while preserving a single task-tree
writer.

```json
{
  "type": "project.task.reviewed",
  "target": {
    "project": "aks-rp-e2e",
    "taskId": "repair-spec-x"
  },
  "data": {
    "taskId": "repair-spec-x",
    "attemptId": "a_repair_spec_x_20260630102000",
    "decision": "accept",
    "confidence": "high",
    "summary": "Evidence satisfies the task acceptance criteria.",
    "findings": [],
    "feedback": [],
    "suggestedFollowups": [],
    "reviewAction": {
      "actionKind": "app-state-repair",
      "goal": "Optional exact planner/app-ops successor goal"
    }
  }
}
```

Supported `data.decision` values:

- `accept` - evidence satisfies the task acceptance criteria.
- `redo` - the same task should be rejected back to backlog with feedback.
- `followup` - current work is useful but needs a concrete successor task.
- `blocked` - the task reached a real external/environment/product wait.
- `escalate` - owner/human judgment is required before the tree should move.

Required review rules:

- The reviewer must not mutate the live task tree, loop state, or project
  files.
- The reviewer must judge only the completed task, its acceptance criteria,
  worker result, evidence refs, and relevant dirty files/artifacts.
- The reviewer must emit structured fields; prose is explanation, not control
  flow.
- When the review needs planner-owned follow-up routing, it must use
  `reviewAction.actionKind`; summaries/findings/feedback are not routing
  protocol.
- The planner must validate the review event against live task state before
  applying it because event delivery is at least once.
- If the reviewer cannot emit valid structured output, it must emit
  `decision=escalate`, `confidence=low`, and feedback that lets the planner
  inspect the completion manually.

### Task Tick

`project.task.tick`

Wakes a targeted durable task/controller. This is the canonical loop pulse. We
do not use a separate `project.loop.*` event family because a loop is just one
kind of durable task.

```json
{
  "type": "project.task.tick",
  "target": {
    "project": "aks-rp-e2e",
    "taskId": "aks-spec-verification-loop"
  },
  "action": "spec-loop",
  "data": {
    "reason": "child-task-completed"
  }
}
```

Known loop actions:

- `spec-loop`
- `feature-reference-loop`
- `feature-compact-loop`

The `action` belongs at the top level because the runtime selector uses it for
routing. The same value may also appear in `data.action` for audit readability,
but event routes must not depend on payload-only routing metadata.

### Watchdog

`project.watchdog.check.requested`

Asks the watchdog workflow to inspect liveness, stale active work, blocked
frontier, review backlog, and capacity underfill. The watchdog emits
`project.planning.requested` when planner review is needed. When it sees a
project-level liveness contradiction, such as durable loop state with unfinished
work but no useful runnable/review/active frontier, it emits
`project.stall.review.requested` instead of another generic planner wake.

The watchdog is a normal workflow with scheduled, metric, or manual triggers.
It has no special runtime authority. Its role is to observe closure/liveness
gaps and emit follow-up events; planner, reviewer, loop controller, or
stall-review workflows own the resulting decisions.

Review backlog by itself is not proof that `task-reviewer` is idle. The
reviewer is completion-event driven: it judges fresh `project.task.completed`
events and emits `project.task.reviewed`. Durable loop controllers must still
compact mechanically settled child attempts from structured loop state and keep
their own `workflowProgress.completionReady` false while any feature/spec
records remain in `error`, pending, running, or another non-terminal state.
They must also report whether those non-terminal records are represented by
live task-tree leaves. A blocked-only frontier is not a valid steady state when
`unrepresentedNonTerminalCount` is greater than zero.

### Stall Review

`project.stall.review.requested`

Asks the deep-dive fallback workflow to collect the project liveness packet and
ask `app-ops` to judge why the project is not moving. Code
collects structured state and applies only safe mechanical repairs, such as
task-tree rollup repair, only in fallback mode. The agent judges the stall
class and recommends the next project move.

The packet is a starting point, not a verdict. The agent must verify current
facts from live state before deciding: task tree, loop ledger, latest
pipeline/result artifacts, backend/environment config, and relevant source or
official/API/design documentation. Long-stalled work should become renewed
judgment: try a different workable path, create repair work, reset/retry only
with a reason, keep an exact wait with current proof, escalate with an exact
ask, or close with proof.

Supported `data.mode` values:

- `fallback` - automatic watchdog path for a true global stall. The workflow may
  apply safe mechanical repair and pulse durable loop controllers if the normal
  frontier is empty.
- `risk-review` - manual or metric-triggered diagnostic path. The workflow is
  collect-only; it asks the agent to judge suspicious stale tasks, noisy waits,
  retry-drained loops, or review pileups while normal project work may still be
  moving.

`project.stall.reviewed`

The stall-review workflow finished its diagnostic pass. The planner consumes
this fact and owns the resulting task-tree decision: dispatch loop/controller
work, create grouped repair tasks, convert a noisy wait into one exact wait, or
record a real escalation/resume condition.

When the stall packet shows durable loop state with pending/error records and no
runnable, active, or review leaves, the default structured judgment is
`needs-work` unless every non-terminal record is represented by an exact
blocked/escalated leaf or an accepted terminal disposition. Agent prose may
explain a different judgment, but code must not downgrade that packet to a
no-op merely because the model failed to return structured JSON.

```json
{
  "type": "project.stall.reviewed",
  "target": { "project": "aks-rp-e2e" },
  "data": {
    "reason": "watchdog-durable-loop-stall",
    "mode": "fallback",
    "judgment": "needs-work",
    "repaired": true,
    "dispatchedTicks": [
      {
        "taskId": "aks-spec-verification-loop",
        "action": "spec-loop"
      }
    ],
    "stallReview": {
      "judgment": "needs-work",
      "rootCause": "retry-drained loop family",
      "nextProjectMove": "create grouped repair work",
      "whyNotMoving": "loop state has nonterminal records",
      "evidence": ["spec-loop state reports non-pass records"]
    },
    "summary": "Human-readable explanation."
  }
}
```

### Problem Solving

`project.problem.investigation.requested`

Asks the focused problem-solver workflow to investigate one shared/local root
cause. The planner may emit this when review finds a bounded blocker that needs
focused diagnosis, and the `investigate-problem` action may emit it for manual
operator-directed investigation.

`project.problem.resolved`

The solver found and verified a resolution.

`project.problem.escalated`

The solver found a real ownership boundary or human/external wait.

`project.problem.inconclusive`

The solver could not produce a reliable resolution or escalation. The planner
must review the result and decide the next bounded step.

### Focus

`project.focus.review.requested`

Asks the focus workflow to propose or review the current focus branch. Use
`data.mode` to distinguish proposal from progress review.

```json
{
  "type": "project.focus.review.requested",
  "target": { "project": "aks-rp-e2e" },
  "data": {
    "mode": "plan",
    "reason": "scheduled-focus-plan"
  }
}
```

Supported `data.mode` values:

- `plan`
- `progress`

### Human Approval

`project.approval.requested`

Asks the app to create a human-facing approval request.

`project.approval.submitted`

Records a human approval decision. The approval kind belongs in payload.

```json
{
  "type": "project.approval.submitted",
  "target": { "project": "aks-rp-e2e" },
  "data": {
    "approvalKind": "focus-plan",
    "approvalId": "focus-20260629",
    "decision": "approve",
    "comment": "Proceed"
  }
}
```

### Test Run Results

Most test execution is task-owned. In that normal path, the dispatched worker
emits `project.task.completed` and includes test fields such as `runId`,
`specId`, `status`, `durationMs`, and `artifactRef` in the task completion
payload.

`project.test_run.completed`

This event is only for out-of-band test backends that finish independently of
the worker session that started them. It bridges into planner reconciliation; it
does not replace `project.task.completed` when a task owns the run.

## Target Event Map

| Event                                                 | Destination                                   | Purpose                                                 |
| ----------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------- |
| `project.planning.requested`                          | workflow: `project-planner`                   | App-ops planner wake/reconciliation.                    |
| `project.task.assigned`                               | workflow: `task-worker`                       | Execute one dispatched leaf.                            |
| `project.task.completed`                              | workflow: `task-reviewer`                     | Independently judge completed worker output.            |
| `project.task.reviewed`                               | workflow: `project-planner`                   | Apply reviewer judgment to the task tree.               |
| `project.task.tick` + `action=spec-loop`              | workflow: `spec-loop-controller`              | Refill spec verification loop.                          |
| `project.task.tick` + `action=feature-reference-loop` | workflow: `feature-reference-loop-controller` | Refill feature reference loop.                          |
| `project.task.tick` + `action=feature-compact-loop`   | workflow: `feature-compact-loop-controller`   | Refill compact planning loop.                           |
| `project.watchdog.check.requested`                    | workflow: `project-execution-watchdog`        | Inspect liveness and wake planner if needed.            |
| `project.stall.review.requested`                      | workflow: `project-stall-review`              | Collect stall packet and ask agent to judge.            |
| `project.stall.reviewed`                              | workflow: `project-planner`                   | Apply stall-review judgment to the task tree.           |
| `project.problem.investigation.requested`             | workflow: `problem-solver`                    | Investigate a bounded blocker/root cause.               |
| `project.problem.resolved`                            | workflow: `project-planner`                   | Reconcile resolved problem evidence.                    |
| `project.problem.escalated`                           | workflow: `project-planner`                   | Reconcile external/human wait.                          |
| `project.problem.inconclusive`                        | workflow: `project-planner`                   | Decide next step after unresolved investigation.        |
| `project.focus.review.requested`                      | workflow: `focus-plan`                        | Propose or review focus, selected by `data.mode`.       |
| `project.approval.requested`                          | workflow: `approval-dispatch`                 | Create a human-facing approval message.                 |
| `project.approval.submitted`                          | workflow: `project-planner`                   | Reconcile a human approval decision.                    |
| `project.test_run.completed`                          | workflow: `project-planner`                   | Reconcile an out-of-band test backend result.           |
| `metric.breach` affecting project closure             | owner: `app-ops`                              | Judge whether to plan, stall-review, wait, or escalate. |
| `learning.feedback` for project agents                | workflow: `project-planner`                   | Reconcile evaluator findings about project work.        |

Fresh worker completions route to read-only review first. The planner consumes
only the structured `project.task.reviewed` result in the normal path. Watchdog
or manual planning may still inspect stale review leaves as recovery behavior
when a review event was lost, malformed, or never emitted.

## External Inputs And Outputs

The app may receive these platform events and route them into planning when
they affect project state:

- `project.comment.created`
- `project.approval.submitted`
- `project.test_run.completed`
- `metric.breach`
- `metric.recovered`
- `learning.feedback`
- `escalation.resolved`
- `escalation.dismissed`
- `coverage.gap.detected`

The app may emit:

- `message.created`

## Delivery Semantics

Project events are coordination hints, not the durable state store.

- Delivery is at least once. Duplicate delivery is allowed.
- Do not assume global ordering across schedules, workflow outputs, UI actions,
  metrics, and external events.
- Event routes and workflows must be idempotent. Before mutating the task tree
  or loop state, read the durable source of truth and check whether the
  requested transition already happened.
- Commands such as `project.planning.requested`, `project.task.tick`,
  `project.watchdog.check.requested`, and
  `project.problem.investigation.requested` must be safe to retry.
  `project.stall.review.requested` must also be safe to retry; `risk-review`
  retries are collect-only, and `fallback` retries may repeat only idempotent
  mechanical repair/pulse requests.
- Fact events such as `project.task.completed`,
  `project.task.reviewed`, `project.test_run.completed`, and
  `project.approval.submitted` should carry a stable idempotency key:
  `taskId + attemptId`, `runId`, `approvalId`, or `artifactRef`.
- Event payloads should be compact handoff packets. The task tree, loop state,
  test result files, and workflow/session logs remain the durable truth.

## Task State And Test Results

`blocked` remains a task-tree state and a task-review decision for real
external, environment, product, or human waits with exact resume conditions. It
is not a normal test result class. Spec/test execution records should use
`pass`, `fail`, or `error` plus exact root cause and resume/retry condition in
structured fields.

`blocked` has the same meaning in task-tree leaves and durable loop ledgers:
work cannot continue now, but the work is still owned and has a known resume
path. A blocked item is not done, and it is not an unclassified error.

Every new blocked item must carry structured fields:

```json
{
  "blockedAt": "2026-07-05T00:00:00.000Z",
  "reason": "Why work stopped now.",
  "waitingFor": {
    "type": "ado.pipeline_run.completed",
    "runId": "123",
    "runUrl": "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
    "pipeline": "467665",
    "branch": "dev",
    "successCriteria": "Run completed and uploaded a passing live-azure-run artifact."
  },
  "owner": "human | azure | product | ado | project | external",
  "observedBy": {
    "workflow": "feature-compact-loop-controller",
    "trigger": "project.task.tick"
  },
  "observationMethod": "Poll Azure DevOps pipeline run API and inspect artifacts.",
  "nextCheckAt": "2026-07-05T00:10:00.000Z",
  "fallbackAt": "2026-07-06T00:00:00.000Z",
  "fallbackAction": "Recheck, escalate, reclassify, or create repair work.",
  "scope": {
    "kind": "task | spec | feature | compact-package | family",
    "ids": ["spec.example"]
  },
  "evidence": ["runs/test-results/example", "evidence/archive/example.md"],
  "resumeAction": "Rerun, regenerate, review artifact, or reclassify.",
  "fingerprint": {
    "sourceRef": "dev@...",
    "target": "staging",
    "planPath": "features/example/compact/staging.plan.json"
  },
  "lastCheckedAt": "2026-07-05T00:00:00.000Z"
}
```

Task-tree blockers should store the same contract under `blocker` using the
existing snake_case aliases where needed:

```json
{
  "blocker": {
    "condition": "Why work stopped now.",
    "category": "external-wait",
    "owner": "ado",
    "blocked_at": "2026-07-05T00:00:00.000Z",
    "waiting_for": {
      "type": "ado.pipeline_run.completed",
      "runId": "123",
      "runUrl": "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
      "pipeline": "467665",
      "branch": "dev",
      "successCriteria": "Run completed and uploaded a passing live-azure-run artifact."
    },
    "observed_by": {
      "workflow": "feature-compact-loop-controller",
      "trigger": "project.task.tick"
    },
    "observation_method": "Poll Azure DevOps pipeline run API and inspect artifacts.",
    "next_check_at": "2026-07-05T00:10:00.000Z",
    "resume_condition": "Resume when Azure DevOps pipeline run 123 has completed and the artifact verdict is known.",
    "resume_action": "Review returned artifact and rerun the exact plan.",
    "fallback_at": "2026-07-06T00:00:00.000Z",
    "fallback_action": "Escalate if no artifact has returned.",
    "evidence": ["evidence/archive/example.md"]
  }
}
```

Loop ledgers should preserve `status=blocked` for records that satisfy this
contract. They must not normalize a valid blocked record back to `error`.
`error` means repair or diagnosis is still needed; `blocked` means the wait is
understood and represented until `waitingFor` becomes true, fallback time, or
fingerprint change.

For Azure DevOps pipeline-result waits, `waitingFor.runId` is required. Without the
run id, the item is not waiting for pipeline completion; it is waiting for an
earlier condition such as dispatch permission, pipeline input/schema repair,
run lookup/discovery, or Azure capacity.

## Compatibility Notes

Historical event names may exist in old logs, but new producers should use the
canonical names above.

| Old Event                             | Canonical Event                                                  |
| ------------------------------------- | ---------------------------------------------------------------- |
| `project.owner.requested`             | `project.planning.requested`                                     |
| `project.tick`                        | `project.planning.requested`                                     |
| `project.watchdog.tick`               | `project.watchdog.check.requested`                               |
| `project.problem.requested`           | `project.problem.investigation.requested`                        |
| `project.problem.unknown`             | `project.problem.inconclusive`                                   |
| `project.focus.plan.requested`        | `project.focus.review.requested` with `data.mode=plan`           |
| `project.focus.approval.submitted`    | `project.approval.submitted` with `data.approvalKind=focus-plan` |
| `project.approval.dispatch.requested` | `project.approval.requested`                                     |
| `project.approval.dispatch.submitted` | `project.approval.submitted`                                     |
| `task.requeued`                       | `project.planning.requested` with `data.reason=task-requeued`    |

`project.task.tick` is not a compatibility alias. It is the canonical targeted
task wake event.

## Action Bridge

`project.action.invoked` is a UI/runtime bridge event, not a domain workflow
event.

When the runtime receives:

```json
{
  "type": "project.action.invoked",
  "data": {
    "project": "aks-rp-e2e",
    "action": "pulse-spec-loop",
    "params": { "taskId": "aks-spec-verification-loop" }
  }
}
```

it should:

1. load `app.actions[action]`;
2. call `event(params)`;
3. emit the returned canonical event;
4. route that canonical event normally.

If the action is unknown or invalid, the bridge should emit a planning request
only when the payload is still meaningful project context. It should not
silently pretend that an action-specific event function ran.
