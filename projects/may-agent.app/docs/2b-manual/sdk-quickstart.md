# SDK Quick Reference

`@may-agent/sdk` is the stable authoring boundary for Apps, bounded task
workflows, task policy, guards, and tests. It is not a runtime service object.
There is no `ctx.sdk`, database handle, queue, scheduler, service locator, or
legacy entry point.

See [SDK](../2a-design/sdk.md) and
[App Contract](../2a-design/agent-app.md) for the governing contracts.

## Choose The Right Primitive

| Need                                      | Use                                                          |
| ----------------------------------------- | ------------------------------------------------------------ |
| Address one App and require a result      | typed App input; Runtime links its request to one task       |
| Expose repeated typed ingress             | `defineApp({ actions: ... })` with `toInput`                 |
| React to a changed fact                   | App `subscription` -> typed input -> task resolver           |
| Declare/revise deterministic desired work | `task(input)` -> `TaskIntent`                                |
| Wake one existing task                    | exact event target or matching task Condition                |
| Run one bounded agent step                | `ctx.agents.call(...)`                                       |
| Run one bounded reusable workflow         | `ctx.workflows.run(...)`                                     |
| Publish a fact                            | `ctx.events.emit(...)`                                       |
| Record a domain metric sample             | `ctx.metrics.record(...)`                                    |
| Read an exact runtime projection          | `ctx.read.appResult/execution/metric(...)` or resource `get` |
| Inspect current App tasks                 | bounded `ctx.read.tasks.list/get` resource capability        |
| Wait durably                              | task dependency or Condition, never an open workflow         |

## Define One App

Every App exports one `defineApp(...)` declaration from `app.ts`:

```ts
import { Type, defineApp } from "@may-agent/sdk";

const inputSchema = Type.Object({
  kind: Type.Literal("review"),
  data: Type.Object({ subject: Type.String() }),
});

export default defineApp({
  id: "sample",
  version: 1,
  owner: "sample-owner",
  inputSchema,
  task(input) {
    return {
      id: `review/${input.data.subject}`,
      parentId: "root",
      outcome: `Review ${input.data.subject}`,
      acceptance: ["A supported answer is recorded"],
      mode: "achieve",
      input,
    };
  },
});
```

Importing an App definition is pure. It cannot start sessions, attach timers,
write state, or publish facts. The host validates and attaches the complete App
registry generation.

## Input Resolves To A Task

Every actionable App input resolves to one stable existing task or desired
`TaskIntent`:

```ts
{
  id: "review/v4",
  parentId: "root",
  outcome: "Review change v4",
  acceptance: ["A verdict and evidence are recorded"],
  mode: "achieve",
}
```

There is no direct-completion or delegation disposition beside this path. A
simple answer converges in its first bounded reconciliation attempt. A
cross-App outcome becomes a typed Runtime-managed task dependency. The Host
request remains only the caller's correlation and delivery record.

## Workflow Context

```ts
import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";

export const name = "review-change";

export async function execute(
  ctx: WorkflowContext<{ changeId: string }>,
): Promise<ExecutionResult> {
  const prior = await ctx.read.metric(`review.${ctx.input.changeId}`);
  const review = await ctx.agents.call(
    "reviewer",
    `Review ${ctx.input.changeId}; prior metric: ${prior?.value ?? "none"}`,
  );

  if (review.status !== "done") {
    return ctx.blocked("Reviewer did not complete", { review });
  }

  await ctx.metrics.record(`review.${ctx.input.changeId}`, 1, "reviewed");
  await ctx.events.emit({
    type: "sample.change.reviewed",
    data: { changeId: ctx.input.changeId, executionId: review.id },
  });
  return ctx.done("Change reviewed", { executionId: review.id });
}
```

Available capabilities are intentionally narrow:

- `ctx.input`
- required `ctx.reconciliation` for App-owned work
- exact `ctx.read` projections
- `ctx.agents.call(...)`
- `ctx.workflows.run(...)`
- `ctx.events.emit(...)`
- `ctx.metrics.record(...)`
- optional `ctx.workspace`
- `ctx.log`
- `ctx.done(...)` and `ctx.blocked(...)`

## Task-Bound Workflows

When `ctx.reconciliation` exists, it contains the exact task generation,
desired input, trigger, owner, and bounded live/completed child views. It does
not expose the global task tree or mutation handles.

A task workflow returns an `ExecutionResult` whose output is admitted as a
typed reconciliation result. Return task changes through the compatibility
`actions` field plus Conditions in that output; do not write task files or emit
parallel task-completion events.

```ts
return ctx.done("Waiting for rollout approval", {
  state: "waiting",
  summary: "Approval is still required",
  evidence: ["change:v4"],
  actions: [],
  conditions: [approvalCondition],
});
```

Use `needs-owner` only for exceptional judgment by the same App owner. When
another App owns the next decision, use the Runtime's typed cross-App dependency
capability. Human attention is a linked `may` task dependency or an exact human
Condition owned by the source task.

## Facts Are Not Requests

`ctx.events.emit(...)` publishes a fact. It does not directly launch an agent,
address an owner, attach a task, or guarantee a reply. An actionable destination
must declare an App subscription that produces input, an exact task target, or
a matching Condition.

Typed App actions translate validated parameters directly to App input. They do
not emit an actionable event as an admission shortcut.

## Reads And Writes

Use bounded reads only:

```ts
await ctx.read.appResult(itemId);
await ctx.read.tasks.get(taskId);
await ctx.read.tasks.list({ status: ["attention"] });
await ctx.read.execution(executionId);
await ctx.read.metric(metricId);
```

A task-bound workflow already receives its task and bounded direct-child views
in `ctx.reconciliation`; it should not list tasks merely to rediscover that
context. Agents, tools, observers, and owner workflows that genuinely need a
project overview use the shared bounded task list, scoped to the current App.

There is no raw SQL, `sdk.query`, `sdk.commands`, `getDb()`, global list/query,
or task-store escape hatch. A recurring legitimate need becomes the narrowest
typed projection or capability with scope and restart tests. Explicit offline
repair belongs in a maintenance CLI.

## Test A Workflow

```ts
import { expect, test } from "bun:test";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import { execute } from "./review-change";

test("reviews one change", async () => {
  const ctx = createTestAppWorkflowContext({
    input: { changeId: "v4" },
  });

  const result = await execute(ctx);
  expect(result.status).toBe("done");
});
```

Inject exact fake reads, agent/workflow results, emitted facts, and metric
records through the test context. Testing an App workflow does not require the
daemon or a database.

## Integrity Checklist

- Import authoring contracts from `@may-agent/sdk`; testing helpers come from
  `@may-agent/sdk/testing`.
- Keep App definitions pure and use one `app.ts` entry point.
- Keep workflows bounded; durable waits belong to task dependencies or
  Conditions.
- Use typed Runtime-managed dependencies for cross-App outcomes and events for
  facts.
- Keep task reconciliation as the only App work loop.
- Return structured results; never mutate inbox/task/runtime storage directly.
- Do not add a legacy SDK entry point, service locator, generic runtime context,
  or implementation export.
