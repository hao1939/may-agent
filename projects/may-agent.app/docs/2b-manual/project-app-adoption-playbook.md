# Project App Adoption Playbook

Use a Project App when one accountable owner needs durable domain context and
optional autonomous hosting. An app organizes capability; it does not create a
second agent runtime, controller type, or scheduler.

Read [Agent App Contract](../2a-design/agent-app.md) and
[Task Resource Engine](../2a-design/task-resource-engine.md) for the exact
contracts. This guide covers the normal adoption path.

## 1. Create the package

```text
projects/example/                   # optional portable domain workspace
projects/example.app/
  app.ts
  project.json
  agents/
    example-owner/
      agent.json
      AGENTS.md
      workflows/                    # optional learned processes
        inspect-source.ts
  tasks/seed.json                   # optional boot-only task initialization
  .state/                           # runtime-owned, not authored
```

`owner` is explicit in `app.ts`. Agent directory names and configured agent
names may differ, but `agent.json.name` must match the owner or supporting agent
identity used by the app.

Workflows always live under the agent that owns the experience. Do not create an
app-root workflow registry.

## 2. Declare the smallest app

```ts
import { defineProjectApp } from "@may-agent/sdk";

export default defineProjectApp({
  id: "example",
  version: 1,
  owner: "example-owner",
  description: "Maintain the example domain.",
  workspace: {
    kind: "local",
    localPath: "../example",
  },
});
```

This owner-only app is valid. It installs no task controller, schedules,
recovery, or resync until those attachments are declared.

## 3. Add task autonomy only when durable work state is useful

```ts
export default defineProjectApp({
  id: "example",
  version: 1,
  owner: "example-owner",
  description: "Maintain the example domain.",
  workspace: { kind: "local", localPath: "../example" },
  budget: {
    sessionsPerDay: 20,
    tokensPerDay: 500_000,
    maxConcurrent: 2,
  },
  tasks: {
    accepts: [{ type: "example.source.changed", project: "example" }],
    resolve(event) {
      if (event.type !== "example.source.changed") return null;
      return {
        id: "inspect-source",
        parentId: "project",
        outcome: "Inspect the current source and record useful evidence.",
        acceptance: ["Current source evidence justifies the disposition."],
        mode: "maintain",
        workflow: "inspect-source",
        input: { sourceRevision: event.sourceRevision },
        outputs: [],
      };
    },
  },
});
```

`tasks.resolve` is pure and cheap. It identifies desired work; it does not run
an agent, inspect the external source, or mutate task storage.

The runtime supplies one controller and one deduplicating queue for the app.
The queue carries task IDs only. Targeted wakes for an existing task,
Condition observations, recovery, and passive resync enter that same
controller without another app route.

`maxConcurrent` is enforced by the task controller. The daily session and
token values are planning envelopes today; they do not stop schedules from
requesting more work. Keep routine demand below them and review actual usage.

## 4. Choose owner or workflow execution

```text
task.workflow absent
  -> task.owner ?? nearest ancestor owner ?? app.owner

task.workflow present
  -> resolve that workflow under the resolved owner
```

Use direct owner handling for novel, ambiguous, or one-off work. Bind a
workflow after a repeatable process is worth preserving and testing.

An explicit binding is authoritative:

- `converged` applies the accepted current result;
- `waiting` requires exact typed Conditions;
- `needs-owner` deliberately hands the task to its owner once;
- missing, blocked, invalid, thrown, or timed-out workflows move to
  `attention` without owner substitution.

## 5. Emit time and external facts, not work commands

Schedules emit semantic events:

```ts
schedules: [
  {
    id: "daily-source-review",
    enabled: true,
    intervalMs: 24 * 60 * 60 * 1000,
    emits: [
      {
        type: "example.source.review.requested",
        target: { project: "example" },
      },
    ],
  },
];
```

Cron owns time. A watcher owns polling or replay of an external provider level:

```text
provider state -> watcher -> semantic event -> task/Condition correlation
```

Neither schedule nor watcher invokes an agent or writes task state.

## 6. Keep app observations deterministic

Use `events` and `onEvent` for small deterministic observations or translations
that do not execute project work:

```ts
events: [{ type: "example.metadata.observed", project: "example" }],
onEvent(ctx, event) {
  if (event.type !== "example.metadata.observed") return undefined;
  return ctx.noop("metadata observation accepted");
},
```

Use `app.actions` for optional, discoverable typed shortcuts. Declare an input
schema and translate valid input into one semantic event. The runtime persists
that event directly and returns its ID; there is no action wrapper envelope.

## 7. Seed once; observe live state elsewhere

`tasks/seed.json` initializes an empty task runtime. After initialization:

- `.state/tasks/state.json` is the sole mutable task authority;
- `.state/tasks/tree.json` is a disposable current-state projection; and
- authored seed changes do not overwrite live desired state.

Achieve tasks leave the live graph with a compact completion receipt. Maintain
tasks stay live after convergence and sleep until a real wake arrives.

## 8. Respect pause and paths

When project lifecycle is `paused`, the host installs no schedules, task
controller, event routing, recovery, or resync for that app.

Handlers receive resolved app, project, and workspace paths. Use those paths;
do not derive one root from another or depend on process working directory.

## Adoption checklist

- App identity, owner, `project.json`, and workspace binding agree.
- Every declared owner is a runnable global or app-local agent.
- Every workflow is under its resolved owner and passes focused tests.
- `tasks.resolve` only correlates events to stable intent.
- Schedules and watchers emit facts; they do not perform project work.
- Task handlers return the shared result contract and never edit task files.
- Waiting results use exact observable Conditions.
- Declared outputs remain inside admitted app/domain roots.
- Direct owner and Gym execution work without autonomous attachments.
- App checks and focused May reconciliation tests pass.

See [handler-authoring.md](handler-authoring.md) for result/action examples and
[workflow-authoring.md](workflow-authoring.md) for workflow implementation.
