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

`workflow: "handle-request"` resolves `workflows/handle-request.ts`. No
workflow registry is needed. A task without a workflow runs its explicit or
inherited owner. If a workflow returns `needs-owner`, the same task falls back
to that owner; the app owner is always the final fallback.

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
- `needs-owner` asks the runtime to use the ownership fallback.

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
