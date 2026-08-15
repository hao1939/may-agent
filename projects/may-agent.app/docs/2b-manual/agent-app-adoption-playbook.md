# Agent App quickstart

Use an Agent App when one accountable owner should make sure addressed work is
eventually handled. An App is a domain capability, not another daemon.

The routing rule is deliberately small:

```text
independent addressed obligation -> Inbox
deterministic desired outcome     -> TaskIntent
exact task target or Condition    -> exact task wake
otherwise                         -> observation
```

An App has one declaration, `app.ts`, and uses one public SDK entry point,
`@may-agent/sdk`. Do not create `inbox.ts`, an App-local event router, a second
queue, or direct task-state writes.

## 1. Create the package

```text
projects/example.app/
  app.ts
  project.json
  agents/
    example-owner/
      agent.json
      AGENTS.md
      workflows/
        inspect-source.ts
  tasks/seed.json                 # optional structural seed
  .state/                         # runtime-owned, never authored
```

The configured owner must match an App-local or globally registered agent.
Reusable workflows live below the agent that owns their judgment.

## 2. Declare the smallest App

```ts
import { Type, defineApp } from "@may-agent/sdk";

export default defineApp({
  id: "example",
  version: 1,
  owner: "example-owner",
  description: "Maintain the example domain.",
  inputSchema: Type.Object({
    kind: Type.String(),
    data: Type.Unknown(),
  }),
  workspace: { kind: "local", localPath: "../example" },
});
```

This owner-only App is valid. Requests are durable Inbox items. The runtime
claims them, calls the owner, and records the returned disposition.

## 3. Add deterministic routing sparingly

`route` is pure policy for an App request. Return `null` whenever owner judgment
is needed.

```ts
route(request) {
  if (request.input.kind !== "refresh-known-cache") return null;
  return {
    type: "complete",
    summary: "The requested cache is already current.",
  };
}
```

The other dispositions delegate to another App or attach the request to an
existing/desired durable task. They do not execute work inside the router.

## 4. Add task reconciliation only for durable desired outcomes

```ts
tasks: {
  attach: true,
  subscriptions: [
    { type: "example.source.changed", target: { project: "example" } },
  ],
  maxConcurrent: 2,
  resolve(event) {
    const revision = String(event.data.revision ?? "");
    if (!revision) return null;
    return {
      id: "inspect-source",
      parentId: "project",
      outcome: "Inspect the current source and retain useful evidence.",
      acceptance: ["Current source evidence justifies the disposition."],
      mode: "maintain",
      workflow: "inspect-source",
      input: { revision },
    };
  },
},
```

The resolver is deterministic and cheap. It may identify desired work; it may
not inspect external state, invoke an agent, or mutate storage. Returning
`null` means the event remains an observation, not an implicit owner request.

Exact task targets and matching Conditions wake only that task. They are
additive to an independently addressed Inbox obligation, but a single App may
not claim the same event as both a new Inbox item and a new TaskIntent.

## 5. Add ingress without creating another authority

- `subscriptions` translate selected facts into App inputs.
- `observations` classify reviewed facts that intentionally create no work.
- `schedules` admit an App input or publish a fact.
- `observers` read scoped state and publish facts.
- `actions` validate user parameters and translate them to App input.

All five enter the same canonical host. They do not invoke App code directly.

```ts
actions: {
  inspect: {
    description: "Inspect the current source",
    inputSchema: Type.Object({ scope: Type.String() }),
    toInput: ({ scope }) => ({ kind: "inspect", data: { scope } }),
  },
},
```

## 6. Write a bounded workflow

```ts
import type { WorkflowContext, ExecutionResult } from "@may-agent/sdk";

export async function execute(ctx: WorkflowContext): Promise<ExecutionResult> {
  const result = await ctx.agents.call(
    "example-owner",
    "Inspect the declared source revision and summarize the evidence.",
  );
  if (result.status !== "done") return ctx.blocked(result.summary);
  return ctx.done("Source inspection completed.", {
    state: "converged",
    summary: result.summary,
    evidence: [`agent-execution:${result.id}`],
    actions: [],
  });
}
```

Use scoped `ctx.read`, `ctx.workspace`, agent/workflow calls, events, and
metrics. Return task actions and exact Conditions; never open task storage or
implement retries in App code.

## 7. Verify

Run the App package's normal gates and the runtime contract suites:

```bash
bun run syntax
bun run typecheck
bun run test
bun run bundle:verify
```

Before rollout, prove direct completion, owner handling, delegation, task
attachment, restart recovery, registry reload, and final delivery for the App's
actual routes.
