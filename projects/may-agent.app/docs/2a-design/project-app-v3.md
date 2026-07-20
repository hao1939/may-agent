# Agent App Contract

**Design status:** Accepted.
**Implementation status:** Implemented by the current Agent App manifest and loader.

The canonical behavioral model is
[App Task Reconciliation Model](../3-proposals/app-task-reconciliation-model.md).
This document describes the production manifest surface.

## Purpose

An Agent App organizes durable work around a goal. It does not implement a
second scheduler or agent runtime.

```text
App = organization
Task = desired + observed state
Workflow = reusable process
Agent = adaptive capability and accountable fallback
Runtime = events, attempts, queueing, persistence, and recovery
```

## Manifest

```ts
type ProjectApp = {
  id: string;
  version: 1;
  owner: string;
  description: string;
  workspace: {
    kind: "git" | "local";
    repo?: string;
    localPath: string;
    branch?: string;
  };
  budget: {
    sessionsPerDay: number;
    tokensPerDay: number;
    maxConcurrent: number;
  };
  schedules: Array<{
    id: string;
    enabled: boolean;
    intervalMs: number;
    emits: ProjectAppEvent[];
  }>;
  tasks: {
    accepts: EventSelector[];
    resolve(event: Record<string, unknown>): ProjectAppTaskIntent | null;
    resyncIntervalMs?: number;
  };
  events?: EventSelector[];
  actions: Record<string, {
    type: "async";
    description: string;
    event(params: unknown): ProjectAppEvent;
  }>;
  onEvent?: ProjectAppOnEvent;
};
```

There is no owner-entry wrapper, workflow map, task-route list, manual event
graph, or synchronous action variant.

## Task correlation

`tasks.accepts` states which semantic events may create or update desired task
state. `tasks.resolve` returns a stable task intent or `null`.

Targeted task wakes, Condition observations, recovery, and periodic resync do
not need app-specific routes. They enter the same controller queue directly.

The resolver should be pure and cheap. It identifies work; it does not execute
it or mutate storage.

```ts
tasks: {
  accepts: [{ type: "project.review.requested", project: projectId }],
  resolve(event) {
    if (event.type !== "project.review.requested") return null;
    return {
      id: "project-review",
      parentId: "project",
      outcome: "Keep the project aligned with current evidence.",
      acceptance: ["One bounded decision is recorded."],
      mode: "maintain",
      owner: "app-owner",
      workflow: "project-review",
      input: event,
      outputs: [".state/reviews.jsonl"],
    };
  },
}
```

## Handler convention

For each reconciliation:

1. Resolve task ownership from the task, nearest ancestor, then app owner.
2. If the intent names `workflow: "x"`, load `workflows/x.ts`.
3. Otherwise invoke the resolved owner through the standard agent runner.
4. If a workflow returns `needs-owner`, invoke that same owner once.

A missing named workflow is observable and falls back to the owner; it is not
silently treated as an unbound task.

## Result contract

Workflow and owner handlers return the same envelope:

```ts
type ProjectAppTaskHandlerResult = {
  state: "converged" | "waiting" | "needs-owner";
  summary: string;
  evidence: string[];
  actions?: ProjectAppTaskAction[];
  conditions?: ProjectAppConditionSpec[];
};
```

- `converged` satisfies the current generation.
- `waiting` must carry at least one exact Condition.
- `needs-owner` requests the standard ownership fallback.

The runtime validates the whole result and atomically applies it with the
attempt transition. A stale generation or resource version cannot mutate newer
intent.

## Actions and Conditions

Handlers do not edit task storage. They may propose a bounded batch of:

- `create-task`
- `update-task`
- `close-task`
- `unblock-task`

Creation may include domain `input` and `dependsOn`; newly created tasks are
immediately enqueued through the same controller.

Conditions identify an exact external fact by event type, subject, and
expected observation. The event bus updates Conditions and wakes affected task
keys. A bounded resync handles missed edges and stale observations.

## Events and actions

`events` selects deterministic app-level observations for `onEvent`. It is not
an alternate execution path for project work.

The host handles `project.action.invoked` by looking up the named manifest
action, calling its event factory, and emitting the returned semantic event.
Apps do not reimplement this translation in `onEvent`.

Schedules likewise emit semantic events. Cron owns time; it does not own task
reconciliation.

## Lifecycle

`.state/tasks/state.json` is the sole mutable task resource authority;
`.state/tasks/tree.json` is a generated read projection. When
`project_lifecycle` is `paused`, the loader installs no schedules, controller,
event routing, recovery, or resync for that app.

An `achieve` task is removed from the live graph only after its outcome is
absorbed into a completion receipt and dependents are identified in the same
transaction. A `maintain` task stays live for later observations.

## Required invariants

1. One controller and deduplicating queue per app.
2. One writable authority for task and Condition state.
3. At most one current attempt per task generation.
4. Every actionable task resolves one workflow or one owner.
5. Every durable wait names exact observable state.
6. Task relationships are observed; they do not schedule execution.
7. Workflows preserve domain process; generic reconciliation contains no app
   strategy.
8. Finished work leaves the live graph through receipts, not archive trees.
