# Agent Cooperation

**Design status:** Accepted.
**Implementation status:** Bounded agent execution and Runtime-managed
cross-App Task dependencies are implemented. App delegation dispositions have
been removed. The [locally tested consolidation candidate](../archive/reviews/execution-consolidation-poc-20260914.md)
adds caller scope to generic calls/forks and removes automatic standalone
recovery. It has not been deployed.

Agent registration has two scopes:

1. **Global agents** — `agents/<name>/agent.json`, for genuinely standalone
   capability.
2. **App-local agents** — `projects/<name>.app/agents/<agent>/agent.json`,
   registered with the owning App.

App-local registration is the convention for App-owned work. The App packages,
not a duplicated design-time roster, are the current inventory.

## Definition sources

Runtime snapshots agent and App definitions with `shared/common-sense.md`,
`shared/skills/`, and optional `shared/tools/` helpers. An agent-local tool can
import a helper from that shared source directory; the helper stays pinned to
the same release as the importing agent. Commit helper changes before reload.
Reload prepares a new snapshot instead of changing a running attempt's imports.
This convention does not copy the whole shared corpus or add a plugin loader.

## Two different relationships

```text
bounded execution dependency -> call an agent and await ExecutionResult
durable ownership dependency  -> request a child App task and await its result
```

An agent call is part of one bounded session/workflow attempt. If the caller
ends, the call result does not become an independent durable promise.

A cross-App task dependency creates a destination task with its own owner,
restart recovery, and correlated result. Use it when another domain remains
responsible beyond the current bounded attempt.

These relationships guide capability implementation, not a second routing job
for the model. A helper remains an ordinary tool: supply input and receive a
result. Retain `ctx.agents.call` and the model-facing `agents.call` as thin scoped
wrappers, preserving useful agent cooperation without independent session recovery.
The caller's trusted execution context supplies permissions, exact ownership,
cancellation and remaining allowance; the agent does not construct that context.

## Agent tool actions

The model-facing `agents` tool manages bounded execution:

| Action     | Behavior                                   | When to use                                                          |
| ---------- | ------------------------------------------ | -------------------------------------------------------------------- |
| `call`     | Await one child session result             | Current attempt needs the result                                     |
| `fork`     | Start a child session and return its ID    | Bounded background exploration whose lifecycle the caller still owns |
| `list`     | List registered agents and active sessions | Discovery                                                            |
| `peek`     | Read recent output from a running child    | Observe a fork                                                       |
| `cancel`   | Cancel a running child                     | Stop obsolete bounded execution                                      |
| `context`  | Read/update permitted agent context        | Agent context management                                             |
| `sessions` | Query persisted execution summaries        | Diagnostics/history                                                  |

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

Required helpers must be joined or stopped before their caller completes, and
caller cancellation stops them. Parallel awaited workflow calls already support
concurrent bounded work. The candidate retains `fork` as a scoped model-tool
capability, tested through its public action. It no longer creates detached
responsibility or a second message notification. Existing durable dispatch
guidance is migrated to App Tasks. A returned session ID is not a durable result
promise; inspect the result or use an awaited call when it is required.

Trusted live caller context supplies Task binding, execution root, tool policy,
abort signal and deadline. A restricted caller's helper retains that policy;
conflicting profile overrides are rejected rather than guessing a privilege
hierarchy. Different profiles are not automatically ordered by name.

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
  facts?: unknown;
};
```

The workflow decides how this evidence affects its own result. The App/task
boundary then validates and admits that result; a successful child session does
not directly complete durable work.

## Cross-App task dependencies

During reconciliation, an App may use a typed Runtime capability to request an
outcome from another App. The Runtime creates the destination request and task,
links the parent task dependency before waking work, and later wakes the parent
with a bounded dependency observation. No App route or disposition owns this
lifecycle.

Use a cross-App task dependency when:

- another App owns the domain decision;
- the result must survive restart or caller-session loss;
- the parent must eventually receive one correlated result; or
- the child may require repeated task reconciliation.

Do not replace a dependency with a fire-and-forget event or agent message.

## Notifications

The separate `message` tool is a notification surface, not a request identity.
Use it for optional FYI communication when no result, retry, or eventual
handling guarantee is required. A notification must not be the only record of
unfinished durable work.

If a message actually asks another owner to act and report back, address that
owner's App instead. If no App exists for that responsibility, create or extend
the appropriate App contract rather than relying on a generic owner inbox.

## Context passing

Task-bound managed execution prepares a shared decision brief from the existing
Task reader before each model request, including helper calls and requests after
compaction. The caller's request still defines the contribution. The brief shows
assignment, accepted understanding/results, Condition observations, pending input
and exact detail links; reading it does not account for the input. It is a
disposable provider view, not another message queue or accepted Task record.

Automatic refresh failure retains the last successful snapshot, or the supplied
attempt-start snapshot when no refresh succeeded. Freshness and missing coverage
remain explicit. Agents diagnose through ordinary reads and obtain evidence for
the particular action that needs it. Detail-file failure preserves inline facts;
when the initial workspace entry cannot be saved, the root keeps its full input.
Explicit App context preparation still receives the original call request.

The [integration record](../proposals/task-decision-context-integration-20260926.md)
tracks candidate source, trials and rollout. This does not add mid-command
steering to native executors or change workflow result/Task settlement rules.

- Agent calls receive the supplied task, explicitly selected context, tool
  policy, and execution lineage.
- A cross-App dependency receives typed input and a stable parent relationship; it does
  not inherit an arbitrary caller transcript or mutable session context.
- Durable domain context belongs in App/project artifacts and exact bounded
  projections, not in a hidden global agent prompt.

## Choosing the mechanism

| Situation                                                      | Mechanism                               |
| -------------------------------------------------------------- | --------------------------------------- |
| Need another capability before this bounded attempt can finish | `agents.call` / `ctx.agents.call`       |
| Several independent bounded checks                             | parallel awaited calls                  |
| Short exploration still owned by this live caller              | `agents.fork`, then inspect/join/cancel |
| Another domain owes an eventual result                         | Cross-App task dependency               |
| Durable desired outcome needs repeated attempts                | App task                                |
| Optional FYI with no result obligation                         | `message` notification                  |
| Repeatable multi-step bounded process                          | `ctx.workflows.run`                     |

The fork row follows the tested candidate contract above. Do not rely on
detached auto-resume to fulfill an App obligation.
Provider-specific helpers and direct CLI calls follow the same
[execution rules](system-boundary.md#execution) without needing their own Tasks.

## Integrity checklist

- Every agent call belongs to one bounded caller attempt.
- A caller does not finish while an unjoined fork still carries required work.
- Durable cross-owner obligations use task dependencies, not messages or events.
- Child execution results remain evidence until admitted by the owning
  workflow/App/task.
- App-local agents and workflows remain inside their App's ownership boundary.
- No agent notification becomes a hidden retry queue or owner inbox.
