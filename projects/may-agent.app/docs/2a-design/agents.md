# Agent Cooperation

**Design status:** Accepted.
**Implementation status:** Bounded agent execution implemented; App delegation
is the durable cross-owner request path.

Agent registration has two scopes:

1. **Global agents** — `agents/<name>/agent.json`, for genuinely standalone
   capability.
2. **App-local agents** — `projects/<name>.app/agents/<agent>/agent.json`,
   registered with the owning App.

App-local registration is the convention for App-owned work. The App packages,
not a duplicated design-time roster, are the current inventory.

## Two different relationships

```text
bounded execution dependency -> call an agent and await ExecutionResult
durable ownership dependency  -> delegate an App request and await AppResult
```

An agent call is part of one bounded session/workflow attempt. If the caller
ends, the call result does not become an independent durable promise.

App delegation creates a child inbox item with its own owner, restart recovery,
and correlated result. Use it when another domain remains responsible beyond
the current bounded attempt.

## Agent tool actions

The model-facing `agents` tool manages bounded execution:

| Action | Behavior | When to use |
| --- | --- | --- |
| `call` | Await one child session result | Current attempt needs the result |
| `fork` | Start a child session and return its ID | Bounded background exploration whose lifecycle the caller still owns |
| `list` | List registered agents and active sessions | Discovery |
| `peek` | Read recent output from a running child | Observe a fork |
| `cancel` | Cancel a running child | Stop obsolete bounded execution |
| `context` | Read/update permitted agent context | Agent context management |
| `sessions` | Query persisted execution summaries | Diagnostics/history |

`call` and `fork` create causal child sessions. Only `call` blocks.

```text
Root App/workflow attempt
  ├── call("dev", task)       # awaited bounded child
  ├── call("reviewer", task)  # awaited bounded child
  └── fork("scout", task)     # caller retains lifecycle responsibility
```

Forking does not create durable App ownership. A workflow must not fork work and
then return while still owing its result. Long-lived or independently
recoverable work belongs in an App request or task.

## Workflow capability

Canonical workflows call agents through their scoped context:

```ts
const result = await ctx.agents.call("dev", task);

const [implementation, review] = await Promise.all([
  ctx.agents.call("dev", implementationTask),
  ctx.agents.call("reviewer", reviewTask),
]);
```

Both return the shared bounded result:

```ts
type ExecutionResult<T = unknown> = {
  id: string;
  kind: "agent" | "workflow";
  status: "done" | "blocked" | "error" | "interrupted";
  summary: string;
  output?: T;
  evidence?: unknown;
};
```

The workflow decides how this evidence affects its own result. The App/task
boundary then validates and admits that result; a successful child session does
not directly complete durable work.

## App delegation

An App owner or pure route policy delegates by returning:

```ts
{
  type: "delegate",
  appId: "destination-app",
  input: { kind: "request-kind", data },
}
```

The host creates a child App inbox item, links the parent dependency before
waking work, and later wakes the parent with a bounded dependency observation.
The destination App may complete directly, delegate again, or attach a task.

Use App delegation when:

- another App owns the domain decision;
- the result must survive restart or caller-session loss;
- the parent must eventually receive one correlated result; or
- the child may require repeated task reconciliation.

Do not replace delegation with a fire-and-forget event or agent message.

## Notifications

The separate `message` tool is a notification surface, not a request identity.
Use it for optional FYI communication when no result, retry, or eventual
handling guarantee is required. A notification must not be the only record of
unfinished durable work.

If a message actually asks another owner to act and report back, address that
owner's App instead. If no App exists for that responsibility, create or extend
the appropriate App contract rather than relying on a generic owner inbox.

## Context passing

- Agent calls receive the supplied task, explicitly selected context, tool
  policy, and execution lineage.
- App delegation receives typed input and a stable parent relationship; it does
  not inherit an arbitrary caller transcript or mutable session context.
- Durable domain context belongs in App/project artifacts and exact bounded
  projections, not in a hidden global agent prompt.

## Choosing the mechanism

| Situation | Mechanism |
| --- | --- |
| Need another capability before this bounded attempt can finish | `agents.call` / `ctx.agents.call` |
| Several independent bounded checks | parallel awaited calls |
| Short exploration still owned by this live caller | `agents.fork`, then inspect/join/cancel |
| Another domain owes an eventual result | App delegation |
| Durable desired outcome needs repeated attempts | App task |
| Optional FYI with no result obligation | `message` notification |
| Repeatable multi-step bounded process | `ctx.workflows.run` |

## Integrity checklist

- Every agent call belongs to one bounded caller attempt.
- A caller does not finish while an unjoined fork still carries required work.
- Durable cross-owner obligations use App delegation, not messages or events.
- Child execution results remain evidence until admitted by the owning
  workflow/App/task.
- App-local agents and workflows remain inside their App's ownership boundary.
- No agent notification becomes a hidden retry queue or owner inbox.
