# App quickstart

Use an App when one responsibility must make sure addressed work is
eventually handled. An App is a domain capability, not another daemon.

The routing rule is deliberately small:

```text
actionable App input           -> TaskIntent
exact task target or Condition -> exact task wake
otherwise                      -> observation
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
    example-agent/
      agent.json
      AGENTS.md
      workflows/
        inspect-source.ts
  tasks/seed.json                 # optional structural seed
  .state/                         # runtime-owned, never authored
```

The configured default agent must match an App-local or globally registered
agent. Reusable workflows live below the agent whose bounded context they use.

## 2. Declare the smallest App

```ts
import { Type, defineApp } from "@may-agent/sdk";

export default defineApp({
  id: "example",
  version: 1,
  agent: "example-agent",
  description: "Maintain the example domain.",
  inputSchema: Type.Object({
    kind: Type.String(),
    data: Type.Unknown(),
  }),
  task(input) {
    return {
      id: `input/${input.kind}`,
      parentId: "project",
      outcome: `Handle ${input.kind}`,
      acceptance: ["The requested outcome is evidenced."],
      mode: "achieve",
      input,
    };
  },
  workspace: { kind: "local", localPath: "../example" },
});
```

This agent-handled App is valid. Requests are caller correlation records; only
the linked task invokes its selected agent.

## 3. Refine task identity and intent

`task` is pure policy for validated App input. It selects the stable task the
App owns; agent judgment happens only during a bounded reconciliation attempt.

```ts
task(input) {
  return {
    id: `input/${input.kind}`,
    parentId: "project",
    outcome: `Handle ${input.kind}`,
    acceptance: ["The requested outcome is evidenced."],
    mode: "achieve",
    input,
  };
}
```

The resolver never executes work. Simple work still follows this path and can
converge during the task's first attempt.

## 4. Map repeated input to a standing task

```ts
task(input) {
  const revision = String(input.data.revision ?? "");
  if (!revision) return null;
  return {
    id: "inspect-source",
    parentId: "project",
    outcome: "Inspect the current source and retain useful evidence.",
    acceptance: ["Current source evidence justifies the disposition."],
    mode: "maintain",
    workflow: "inspect-source",
    input,
  };
},
```

The resolver is deterministic and cheap. It may identify desired work; it may
not inspect external state, invoke an agent, or mutate storage. Returning
`null` means the validated input is explicitly non-actionable.

Exact task targets and matching Conditions wake only that task. A single fact
must not both resolve a new task and wake an existing one in the same App.

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
    "example-agent",
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
metrics. Return task changes through the compatibility `actions` field and
exact Conditions; never open task storage or implement retries in App code.

## 7. Verify

Run the App package's normal gates and the runtime contract suites:

```bash
bun run syntax
bun run typecheck
bun run test
bun run bundle:verify
```

Before rollout, prove direct completion, agent handling, delegation, task
attachment, restart recovery, registry reload, and final delivery for the App's
actual routes.
