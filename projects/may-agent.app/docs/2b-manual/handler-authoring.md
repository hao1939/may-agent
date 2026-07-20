# Authoring Agent App task handlers

An Agent App has one event-to-task resolver and one accountable owner. The
runtime supplies one deduplicating work queue and reconciler for the app.

## App manifest

```ts
export default defineProjectApp({
  id: "example",
  version: 1,
  owner: "example-owner",
  workspace: { kind: "local", localPath: "../example" },
  budget: { sessionsPerDay: 20, tokensPerDay: 500_000, maxConcurrent: 2 },
  schedules: [],
  tasks: {
    accepts: [{ type: "example.requested", project: "example" }],
    resolve(event) {
      return {
        id: `request/${String(event.eventId)}`,
        parentId: "project",
        outcome: "Handle the request.",
        acceptance: ["The requested outcome is evidenced."],
        mode: "achieve",
        workflow: "handle-request",
        input: { eventId: event.eventId },
      };
    },
  },
  actions: {},
});
```

Targeted task events, Condition observations, and periodic resync already enter
the same controller. Do not add a second route or scheduler for them.

## Workflow convention

`workflow: "handle-request"` resolves
`agents/<resolved-owner>/workflows/handle-request.ts`. No workflow registry is
needed. A task without a workflow runs its explicit or inherited owner. If a
workflow returns `needs-owner`, the same task is handed to that owner once. An
unavailable or failed explicitly bound workflow moves the task to `attention`;
the runtime does not substitute direct owner handling. After the binding is
repaired, a successful app reload re-enqueues it.

Every handler returns one envelope:

```ts
{
  state: "converged" | "waiting" | "needs-owner";
  summary: string;
  evidence: string[];
  actions?: ProjectAppTaskAction[];
  conditions?: ProjectAppConditionSpec[];
}
```

- `converged` means the current generation satisfies its acceptance criteria.
- `waiting` must carry exact typed Conditions.
- `needs-owner` deliberately hands the task to its accountable owner.

Handlers may use normal tools and skills, including database-backed tools.
They must not edit task storage, create worker sessions, acknowledge inbox
delivery, or implement retries/recovery. Those are infrastructure duties.

## Actions and safety

Actions create, update, close, or unblock resources. Updates use
`expectedGeneration`; the reconciler checks generation and resource version,
then commits task state, receipts, Conditions, and dependent wakeups atomically.

App UI actions declare a semantic event factory in `app.actions`. Infrastructure
translates `project.action.invoked` exactly once. Do not add an app-local action
adapter.

Validate with the app's `bun run check` and runtime reconciliation tests.

## Handler boundary checklist

A handler is a small infrastructure adapter. It may translate, observe,
persist, or dispatch bounded work. It must not become a second task scheduler,
task-state writer, domain owner, or learned process.

- Does project work enter the app's single resolver/queue/controller?
- Is reusable judgment implemented under its owning agent?
- Does any watcher know task IDs or mutate task resources?
- Can recovery start from durable state without replaying a synthetic scheduler
  event?
- Is every compatibility read isolated, with no compatibility writer or second
  authority?
