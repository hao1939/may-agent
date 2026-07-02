# Project App Event Contract

Status: implemented contract

## Purpose

`aks-rp-e2e.app` uses events as the app control plane. Events wake workflows,
carry compact handoff context, and let the app keep the task tree moving without
turning every timer, retry, or UI click into a task node.

The contract is intentionally small:

- `type` says what kind of command or fact this is.
- `target` says who should handle it.
- optional top-level `action` disambiguates routing when several handlers share
  the same event type.
- `data` explains why the event was fired and carries workflow context.

The target-first rule is the most important part: fire the target. If no direct
handler catches the event, runtime ownership fallback may route it to the owning
task or project.

## Naming Rules

- Use `*.requested` for commands that ask a workflow or controller to run.
- Use past-tense facts for results: `assigned`, `completed`, `submitted`,
  `resolved`, and `escalated`.
- Keep event names generic. Put variants in `data.reason`, `data.mode`,
  `data.approvalKind`, `target.taskId`, and `data.params`.
- Use top-level `action` only as routing metadata for shared event types.
- Avoid ambiguous event names:
  - `owner` is accountability, not the planner event name.
  - `dispatch` is implementation detail.
  - `unknown` is not a result; use `inconclusive`.
- Platform events such as `metric.*`, `escalation.*`, and `message.created`
  remain platform events. The project app may subscribe to them when they affect
  project state.

## Canonical Events

### Planning

`project.planning.requested`

Wakes the planner workflow. The planner reviews current state, reconciles
results, repairs task-tree meaning, and assigns or creates the next concrete
work.

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

A planner or controller assigned one concrete executable leaf.

`project.task.completed`

A worker completed one assigned task and reported structured completion fields,
summary, test result fields, evidence refs, attempt, and review context.
Completion is progress, not automatic acceptance; it wakes independent task
review.

`project.task.reviewed`

The read-only task reviewer judged one completed task. This is a structured
review fact, not a task-tree mutation. The project owner/planner consumes it and
is still the only workflow that decides whether to accept, reject, block, or
create follow-up work in `tasks/tree.json`.

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
    "suggestedFollowups": []
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

- The reviewer must not mutate `tasks/tree.json`, loop state, or project files.
- The reviewer must judge only the completed task, its acceptance criteria,
  worker result, evidence refs, and relevant dirty files/artifacts.
- The reviewer must emit structured fields; prose is explanation, not control
  flow.
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
but handlers must not depend on payload-only routing metadata.

### Watchdog

`project.watchdog.check.requested`

Asks the watchdog workflow to inspect liveness, stale active work, blocked
frontier, review backlog, and capacity underfill. The watchdog emits
`project.planning.requested` when planner review is needed. When it sees a
project-level liveness contradiction, such as durable loop state with unfinished
work but no useful runnable/review/active frontier, it emits
`project.stall.review.requested` instead of another generic planner wake.

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

Asks the owner deep-dive fallback workflow to collect the project liveness
packet and ask the owner agent to judge why the project is not moving. Code
collects structured state and applies only safe mechanical repairs, such as
task-tree rollup repair, only in fallback mode. The agent judges the stall
class and recommends the next project move.

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
this fact and owns the resulting task-tree decision: assign loop/controller
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

Most test execution is task-owned. In that normal path, the assigned worker
emits `project.task.completed` and includes test fields such as `runId`,
`specId`, `status`, `durationMs`, and `artifactRef` in the task completion
payload.

`project.test_run.completed`

This event is only for out-of-band test backends that finish independently of
the worker session that started them. It bridges into planner reconciliation; it
does not replace `project.task.completed` when a task owns the run.

## Target Event Map

| Event                                                 | Owner Handler                       | Purpose                                           |
| ----------------------------------------------------- | ----------------------------------- | ------------------------------------------------- |
| `project.planning.requested`                          | `project-planner`                   | Planner wake/reconciliation.                      |
| `project.task.assigned`                               | `task-worker`                       | Execute one assigned leaf.                        |
| `project.task.completed`                              | `task-reviewer`                     | Independently judge completed worker output.      |
| `project.task.reviewed`                               | `project-planner`                   | Apply reviewer judgment to the task tree.         |
| `project.task.tick` + `action=spec-loop`              | `spec-loop-controller`              | Refill spec verification loop.                    |
| `project.task.tick` + `action=feature-reference-loop` | `feature-reference-loop-controller` | Refill feature reference loop.                    |
| `project.task.tick` + `action=feature-compact-loop`   | `feature-compact-loop-controller`   | Refill compact planning loop.                     |
| `project.watchdog.check.requested`                    | `project-execution-watchdog`        | Inspect liveness and wake planner if needed.      |
| `project.stall.review.requested`                      | `project-stall-review`              | Collect stall packet and ask agent to judge.      |
| `project.stall.reviewed`                              | `project-planner`                   | Apply stall-review judgment to the task tree.     |
| `project.problem.investigation.requested`             | `problem-solver`                    | Investigate a bounded blocker/root cause.         |
| `project.problem.resolved`                            | `project-planner`                   | Reconcile resolved problem evidence.              |
| `project.problem.escalated`                           | `project-planner`                   | Reconcile external/human wait.                    |
| `project.problem.inconclusive`                        | `project-planner`                   | Decide next step after unresolved investigation.  |
| `project.focus.review.requested`                      | `focus-plan`                        | Propose or review focus, selected by `data.mode`. |
| `project.approval.requested`                          | `approval-dispatch`                 | Create a human-facing approval message.           |
| `project.approval.submitted`                          | `project-planner`                   | Reconcile a human approval decision.              |
| `project.test_run.completed`                          | `project-planner`                   | Reconcile an out-of-band test backend result.     |

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
- Handlers must be idempotent. Before mutating the task tree or loop state, read
  the durable source of truth and check whether the requested transition already
  happened.
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
