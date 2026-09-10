# How To Write An App Workflow

This manual describes the canonical App workflow surface. See
[Workflows](../2a-design/workflows.md), [SDK](../2a-design/sdk.md), and
[App](../2a-design/agent-app.md) for the governing contracts.

## Choose A Skill, Module, Or Workflow

- Use a skill when an agent should interpret reusable judgment for one turn.
- Use a normal TypeScript module for pure calculations and shared mechanics.
- Use a workflow for bounded, repeatable sequencing that must return one typed
  terminal result to its caller.
- Use an App request or task when work must survive beyond the current run.

A workflow is not a queue, daemon, owner inbox, or durable wait. Its TypeScript
module controls the bounded run; its description is discovery metadata.

## Location And Shape

Put a workflow under the agent that owns and operates it:

```text
projects/<id>.app/agents/<name>/workflows/<workflow>.ts
agents/<name>/workflows/<workflow>.ts  # standalone/system agent only
```

Use a flat `.ts` module exporting `name`, a nonempty `description`, and
`execute(ctx)`:

```ts
import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";

type Input = { changeId: string };

export const name = "review-change";
export const description = "Review one exact change and record evidence";

export async function execute(
  ctx: WorkflowContext<Input>,
): Promise<ExecutionResult> {
  const review = await ctx.agents.call(
    "reviewer",
    `Review change ${ctx.input.changeId}`,
  );

  if (review.status !== "done") {
    return ctx.blocked("Reviewer did not complete", { review });
  }

  return ctx.done("Review completed", {
    changeId: ctx.input.changeId,
    reviewExecutionId: review.id,
  });
}
```

Workflows are bounded and ordered. They may use `await`, but every awaited
agent, nested workflow, read, metric write, or fact publication must finish in
the current run.

## Workflow Context

The stable capabilities are:

| Capability                               | Purpose                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| `ctx.input`                              | App-owned typed workflow input                                                 |
| `ctx.reconciliation`                     | Exact task generation, events, and bounded child/frontier facts when a task owns the run |
| `ctx.read.appResult(id)`                 | Read one completed App result                                                  |
| `ctx.read.tasks.get(id)`                 | Read one bounded current-App task resource                                     |
| `ctx.read.tasks.list(options)`           | List one bounded page of current-App task summaries                            |
| `ctx.read.execution(id)`                 | Read one bounded execution projection                                          |
| `ctx.read.metric(id)`                    | Read one metric projection                                                     |
| `ctx.agents.call(agent, task, options?)` | Run and await one bounded agent execution                                      |
| `ctx.workflows.run(name, input)`         | Run and await one nested workflow                                              |
| `ctx.events.emit(event)`                 | Publish an immediate durable fact from the current bounded attempt             |
| `ctx.metrics.record(...)`                | Record a domain metric definition/sample                                       |
| `ctx.workspace`                          | App/task-scoped source and output paths when granted                           |
| `ctx.log`                                | Structured diagnostic logging                                                  |
| `ctx.done(summary, output?)`             | Return one successful bounded result                                           |
| `ctx.blocked(reason, evidence?)`         | Return one local terminal blocker                                              |

The context intentionally excludes raw SQL, global queries, task storage,
queues, leases, scheduler handles, session steering, human delivery, and
recovery APIs.

## Terminal Results

Every workflow returns exactly one `ExecutionResult` through `ctx.done(...)` or
`ctx.blocked(...)`.

`done` means this bounded workflow completed. It does not by itself complete an
App request or task. The calling App/task boundary validates and admits the
output.

An agent call can finish its bounded execution with `status: "done"` while
explicitly reporting partial progress in `evidence.status`. Inspect the
agent's finish evidence and the App's acceptance contract before accepting its
output. For work that requires a completed result, `evidence.status ===
"partial"` is incomplete, not a successful no-op. Retain that evidence when
returning a blocker. A real no-op needs a completed observation and a reason
that no useful change is warranted; exhausting the call allowance is not one.

`blocked` means this run cannot continue locally. It does not delegate,
escalate, start an agent session, notify a human, or keep the workflow open.
The owning App request or task decides the durable next state.

## Task-Bound Workflows

When a task owns the run, `ctx.reconciliation` supplies:

- App/task identity and fenced generation;
- outcome, acceptance, mode, selected agent, and typed input;
- ordered unobserved Task events; and
- bounded live/completed direct children.

It does not expose a global Task hierarchy or mutation handles. A Task workflow
returns the reconciliation output expected by its App task policy:

```ts
if (!ctx.reconciliation) {
  return ctx.blocked("This workflow requires task reconciliation");
}

if (ctx.reconciliation.children.live.length > 0) {
  return ctx.done("Waiting for child work", {
    state: "waiting",
    summary: "Direct children are still live",
    evidence: ctx.reconciliation.children.live.map(
      (child) => `live-child:${child.taskId}`,
    ),
    actions: [],
  });
}

return ctx.done("Desired state converged", {
  state: "converged",
  summary: "All acceptance evidence is present",
  evidence: ["report:verified"],
  actions: [],
});
```

Return task changes through the compatibility `actions` field and Conditions in the typed result. Do not edit task-state
files, write projections, acquire task locks, or emit assignment/completion
events.

For a resource-backed task, publish facts only with
`ctx.events.emit({ type, localKey, data })`. The older `ctx.emit` and
`ctx.dispatchEvent` forms are rejected because they bypass the attempt fence.
Return cross-App result work as a typed dependency; do not emit
`app.input.requested` directly.

Use `needs-agent` only when the same App needs exceptional judgment from its
selected agent. Do not clear an explicit workflow merely to let an agent perform
workflow-owned effects.

## Durable Wait Boundary

Never keep a workflow alive while waiting for a human, approval, timer,
provider callback, another App, process restart, or long-running external fact.

Use the owning durable authority:

```text
cross-App outcome -> task returns typed dependency -> exact child App task result
external fact     -> task returns waiting -> exact Condition/external fact
```

The parent request/task persists the dependency before the current bounded run
ends. A later result or fact wakes that exact authority. Do not reconstruct the
wait from an event pair, owner label, message, session, or prompt.

## Agent And Nested Workflow Calls

Use `ctx.agents.call(...)` when another agent can return a bounded result during
this run:

```ts
const implementation = await ctx.agents.call("dev", implementPrompt);
if (implementation.status !== "done") {
  return ctx.blocked("Implementation failed", { implementation });
}

const review = await ctx.agents.call("qa", reviewPrompt, {
  schema: ReviewResultSchema,
});
if (review.status !== "done" || review.output.verdict !== "pass") {
  return ctx.blocked("Review failed", { review });
}
```

Use `ctx.workflows.run(...)` for another bounded recipe:

```ts
const result = await ctx.workflows.run("verify-change", {
  changeId: ctx.input.changeId,
});
if (result.status !== "done") {
  return ctx.blocked("Verification did not complete", { result });
}
```

Background forks and direct agent messages cannot satisfy a workflow
dependency. If work must outlive this run or cross an App boundary, use the App
request/task model instead.

## Facts And Metrics

Publish only semantic facts whose route or observation status is declared:

```ts
await ctx.events.emit({
  type: "sample.change.verified",
  localKey: `change-verified:${ctx.input.changeId}`,
  data: { changeId: ctx.input.changeId },
  target: { appId: "sample" },
});
```

For task-owned workflows, `localKey` is required and must describe the stable
logical emission, not the current retry. Durable acceptance makes the event
visible immediately; a later workflow failure does not roll it back, and a
retry with the same key does not publish it twice.

Publishing a fact does not address an owner or guarantee a reply. An App
input subscription, exact task target, or Condition must own any
actionable continuation.

Metrics are observations, not desired state:

```ts
await ctx.metrics.record("sample.verification", 1, "verified");
```

Do not let metric code mutate tasks or dispatch sessions directly.

## Pure Functions And Retry

Call pure deterministic functions normally. Keep retries bounded inside the
current run and verify after every effect:

```ts
for (let iteration = 1; iteration <= 2; iteration += 1) {
  const result = await ctx.agents.call(
    "dev",
    iteration === 1 ? initialPrompt : repairPrompt,
  );
  const verification = await verifyResult(result);
  if (verification.ok) {
    return ctx.done("Implemented and verified", verification);
  }
}

return ctx.blocked("Verification failed after two repair iterations");
```

These iterations share one Task attempt and its deadline. Feed the failed check's
evidence into the repair, and stop when scope, prerequisites or remaining budget
no longer permit useful work. See the
[two-loop boundary](../2a-design/workflows.md#repair-within-an-attempt).
The Host's optional final verifier runs after the workflow returns and does not
automatically feed rejection back into `execute()`. Reuse check helpers inside
the workflow where local repair is useful. Task reconciliation owns durable
retry/backoff and continuation across runs.

A restart can rerun the whole workflow, including after an agent handoff; it
does not resume the lost TypeScript continuation. Before repeating an external
write, read the provider using the operation identity retained in Task input or
use the provider's existing idempotency key. Do not generate a new operation key
from the replacement attempt or session. If the effect cannot be confirmed,
return the exact uncertainty as a blocker rather than blindly repeating it.
Keep required verification valid for both workflow and agent-produced results.

## Cross-App And Human Escalation

A workflow cannot create a durable cross-App dependency by emitting
`escalation.created`, addressing an owner string, or sending a message. Return
compact evidence and one typed dependency request in the owning task result.
The Runtime resolves the accountable child App task and wakes the parent on its
exact result.

Human attention is a child `may` task dependency or an exact human Condition on
the source task. May owns channel policy and correlated delivery.

## Repository changes and integration

Review a workflow's actual effects before giving it a worktree. Read-only
research, observation, and declared runtime scratch need no Git branch.
Versioned source, instructions, library notes, and maintained documentation
do. Keep these write classes separate.

For a repository-changing workflow:

1. Identify the actual Git root, target branch, contribution rules, and exact
   owning Task. A project subdirectory is not necessarily a standalone repo.
2. Use the Host's existing task-worktree allocation when available. Work inside
   `ctx.workspace.root`; `projectRoot` and `appRoot` identify canonical resources,
   not permission to edit a shared checkout. Preserve the recorded worktree on
   retries. Do not add another worktree manager in the App.
3. Give every implementing and reviewing call the same explicit checkout and
   scope. Run verification there too. Output admission must inspect those exact
   files, not old files at the installed canonical paths.
4. Commit a small, tested diff on the owned branch. Follow the repository's PR
   policy and required CI/live verification. Fetch and compare the target before
   integration; resolve overlaps in the owned branch, not another worker's tree.
5. Treat prepared, verified, PR-ready, merged, and deployed as distinct outcomes.
   A workflow may prove one without proving the next. No code path or prompt
   may infer merge/deploy authority from a passing command.
6. Return exact branch/commit, checks, PR when applicable, and the next action.
   Wait through a Task Condition only when no independent authorized work can
   advance. External observation should free the worker from repetitive polling.
7. Confirm integration before cleanup; retain unfinished changes and evidence.
   Do not delete another worker's branch, worktree, or dirty files.

The shared agent guidance supplies these practices for direct work as well.
Workflow implementation must still make the paths and result contract agree;
adding a worktree sentence to a prompt is not end-to-end proof. The
[workflow review](../proposals/workflow-practices-review.md) tracks the installed
Apps that have not yet met this contract.

## Shared Mechanics

Shared workflow loading is not supported. If multiple Apps need a pure
mechanism, extract an ordinary shared module. If another App owns the judgment
or outcome, request a typed dependency on that App. Do not import another App's
workflow or expose it as a live service.

## Guards

Workflow guards are pure event-to-demand functions authored through the stable
`WorkflowGuard` contract. Add one only for a repeated, precise mechanical risk
or an immediate high-impact boundary. Guards observe, warn, run a bounded step,
or block under explicit policy; they do not own retries, App requests, or task
state.

Guard evidence should remain observable through canonical trace/metric facts.
Do not add App-specific domain routing to a shared guard.

## Testing

Use the SDK test context rather than starting the daemon:

```ts
import { expect, test } from "bun:test";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import { execute } from "./review-change";

test("returns one bounded result", async () => {
  const ctx = createTestAppWorkflowContext({
    input: { changeId: "v4" },
  });

  const result = await execute(ctx);
  expect(["done", "blocked"]).toContain(result.status);
});
```

Test task workflows with an exact `reconciliation` fixture. Assert emitted
facts, metric calls, child task changes, Conditions, evidence, and terminal state.

## Integrity Checklist

- The workflow has one owner and one typed input.
- Every call is bounded to the current run.
- Every path returns `ctx.done(...)` or `ctx.blocked(...)`.
- Durable waits use task dependencies or Conditions.
- Task mutation is returned as typed output, never performed directly.
- Cross-App outcomes use typed task dependencies; events remain facts.
- Tests use scoped fake capabilities and require no global runtime.
