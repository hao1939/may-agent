# Authoring Agent App task handlers

An Agent App has one `app.ts` declaration and one accountable owner. Ordinary
addressed requests enter its Inbox. Only deterministic desired outcomes enter
its optional task reconciler.

## App manifest

```ts
import { Type, defineApp } from "@may-agent/sdk";

export default defineApp({
  id: "example",
  version: 1,
  owner: "example-owner",
  inputSchema: Type.Object({
    kind: Type.String(),
    data: Type.Unknown(),
  }),
  workspace: { kind: "local", localPath: "../example" },
  tasks: {
    attach: true,
    subscriptions: [
      { type: "example.requested", target: { project: "example" } },
    ],
    maxConcurrent: 2,
    resolve(event) {
      const requestId = String(event.data.requestId ?? "");
      if (!requestId) return null;
      return {
        id: `request/${requestId}`,
        parentId: "project",
        outcome: "Handle the request.",
        acceptance: ["The requested outcome is evidenced."],
        mode: "achieve",
        workflow: "handle-request",
        input: { requestId },
      };
    },
  },
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
  actions?: TaskAction[];
  conditions?: Condition[];
}
```

- `converged` means the current generation satisfies its acceptance criteria.
- `waiting` must carry exact typed Conditions or leave at least one live direct
  child after its actions are admitted.
- `needs-owner` deliberately hands the task to its accountable owner.

For an unresolved human request, give its external Condition a bounded review
checkpoint:

```ts
{
  id: "report-run-finished",
  type: "pipeline-run.state",
  subject: "pipeline-run:123",
  expected: { field: "state", equals: "completed" },
  reviewAfterMs: 300_000,
}
```

The minimum is 60 seconds. When the checkpoint is missed, existing passive
resync wakes this same task and owner. Returning the same Condition resets the
checkpoint. Do not add a cron job, duplicate task, or routine Telegram update.
Change execution or prove a real blocker after an evidence-free recheck; May
handles any human-facing follow-through separately.

The selected handler may be a direct owner agent or an owner-owned workflow.
It may use supplied tools and skills; a workflow may also run bounded agent
steps. Those capabilities may access a database behind an explicit tool or SDK
boundary. The handler must not edit task storage, acknowledge inbox delivery,
or implement controller retries/recovery. Those are infrastructure duties.

## Actions and safety

Actions create, update, close, or unblock resources. Updates use
`expectedGeneration`; the reconciler checks generation and resource version,
then commits task state, receipts, Conditions, and dependent wakeups atomically.

An executable parent owns decomposition and aggregate acceptance. It may return
`waiting` while creating direct child tasks. Those children run as independent
keys in the same app controller and do not hold the parent's worker slot. Child
convergence or attention durably wakes the parent, which rereads bounded live
child state and completion receipts before refilling, repairing, or accepting
the aggregate result. Do not author task-lifecycle Conditions or an app-local
refill event for this path.

Count only direct children as the parent's in-flight work. A related task under
another parent is evidence, not a child representation.

Parent status does not automatically follow child status. The parent still
decides whether its own acceptance is satisfied. Use `dependsOn` for ordering,
exact Conditions for facts outside the task graph, and a structural group when
a node has no independently reconcilable outcome. An achieve task cannot close
while it still contains live child tasks.

A running handler must not close or unblock its own task. It may return one
`update-task` action for that task only when current evidence proves the
desired execution intent itself must change; that action must be the sole
action, advance the generation, finish the current attempt, and queue the same
task again. A no-op or mixed self-update is rejected. Broad reprioritization,
duplicate cleanup, and unrelated-branch changes belong to a bounded
owner-review pass.

Resolver observations and admitted task actions use the same fenced mutation
path. Task ID prefixes carry no authority semantics; add a pure App
`validateAction` rule only when the domain requires a stricter mutation
boundary.

App UI actions declare an input schema and a pure `toInput` translation in
`app.actions`. Infrastructure validates the action and durably admits the
resulting App input. Do not add another action lifecycle or event router.

Validate with the app's `bun run check` and runtime reconciliation tests.

## Handler boundary checklist

A handler is a small infrastructure adapter. It may translate, observe,
persist, or dispatch bounded work. It must not become a second task scheduler,
task-state writer, domain owner, or learned process.

- Does every addressed request enter the App Inbox, or exactly one task when it
  is a deterministic desired outcome?
- Is reusable judgment implemented under its owning agent?
- Does any watcher know task IDs or mutate task resources?
- Can recovery start from durable state without replaying a synthetic scheduler
  event?
- Is every compatibility read isolated, with no compatibility writer or second
  authority?
