# Agent Cooperation

**Supports:** [System Model](system-model.md#enable-useful-action-within-authority). Gives workers usable context and ways to cooperate within the caller's scope.

**Choice basis:** [Core Principles](../1-principles/core-principles.md#context-is-discovered-not-dumped).

**Design status:** Accepted.
**Implementation status:** Bounded calls/forks and durable cross-App Task
dependencies are implemented. Helpers retain their live caller's scope and
cancellation; standalone sessions require an explicit caller to resume. The
[execution review](../archive/reviews/execution-consolidation-poc-20260914.md)
retains the trials and their limits.

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
| `context`  | Read caller/session lineage context        | Agent context management                                             |
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
concurrent bounded work. The agents tool retains `fork` as a scoped model-tool
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
records source integration, trials and rollout evidence. This does not add mid-command
steering to native executors or change workflow result/Task settlement rules.

- Agent calls receive the supplied task, explicitly selected context, tool
  policy, and execution lineage.
- A cross-App dependency receives typed input and a stable parent relationship; it does
  not inherit an arbitrary caller transcript or mutable session context.
- Durable domain context belongs in App/project artifacts and exact bounded
  projections, not in a hidden global agent prompt.

## Model context assembly

The model receives system instructions, tool definitions and messages. An
agent's `AGENTS.md` and the initial request are only parts of that input.
The managed preparation boundary is `prepareAgentExecution`; the model/tool
loop then transforms messages before each provider request.

Keep responsibility and lifetime explicit:

- The Host documents and enforces its execution and tool contracts. Result
  validation, authority and persistence are code guarantees.
- Shared and agent instructions define working principles and responsibilities
  from the selected definition release. Situational methods belong in skills
  or linked knowledge.
- The invocation defines the worker's contribution and expected result. Shared
  Task context does not expand a helper's assignment.
- Owned resource readers supply current facts, outstanding obligations, input
  and exact evidence references. History records earlier observations and
  execution; it is not a competing current-state authority.

These sources coexist. Placement later in a prompt does not make an event,
document or tool output authoritative over the accepted assignment. A schema
can enforce an allowed result shape without proving the work is sufficient.

### Extending capabilities without changing the execution mechanism

| Concern | Infrastructure owns | App extends |
| --- | --- | --- |
| Standing instructions | Assembly order and the bundled Host execution contract | Shared installation guidance and each agent's `AGENTS.md` |
| Situational methods | Scoped discovery and explicit skill loading | Skills, knowledge and domain judgment |
| Actions | Tool binding, execution scope, validation and result delivery | App tools with accurate descriptions, parameter schemas and implementation |
| Procedures | Bounded calls, workflow execution and caller/Task correlation | Workflows that compose capabilities and return their declared result |
| Results | Caller-supplied result validation, admission and persistence | Output schemas, domain acceptance and review of returned evidence |
| Context | Original managed-session assignment, current Task reader, compaction and exact evidence links | Input content, required references and optional `contextPreparation` |

A new capability normally changes the owning App's definition, tool, workflow,
skill or schema. It should not require an agent-name branch in the Host prompt
assembler. If the needed primitive is absent, add a generic Host/SDK capability
with its own tested contract, then let Apps compose it. A prompt cannot grant
an unavailable tool, change authority or prove that a returned outcome is good.

The App context preparer projects the request only. Shared Host instructions,
capability schemas and current Task observations are assembled independently.
The Host checks synchronous, nonempty returns; purity is the authoring contract.
Its imported code is trusted, not sandboxed. The App remains responsible for
preserving the meaning of the assignment and required evidence. Keep it optional until a measured
context problem justifies it; ordinary role files, skills and references suffice
for most extensions.

The Task and Conversation adapters supply data, while runtime orientation is
bundled in `src/lib/execution-instructions.md`. Contract details live with SDK
result schemas and tool descriptions. May's interpretation, intent echo and
human communication policy live in `may.app/agents/may/AGENTS.md`. These roles
cooperate through existing preparation and validation, without a prompt registry
or a second work lifecycle.

**Limits:** a required reference guarantees discoverability, not that the model
read or understood it. Bounded managed sessions retain an exact assignment link
and explicitly selected skill reference through compaction; direct callers
without session persistence must supply their own needed references. Persistent
chat skills are turn-scoped and remain in history/catalog discovery, not pinned
as a standing assignment. Native CLI executors keep their own prompt contracts.
Session transcripts do not capture every post-transform provider input.

The [assembly manual](../2b-manual/agent-convention.md#system-prompt-assembly)
explains ordering, extension choices and activation. The
[implementation record](../proposals/agent-prompt-assembly-review-20260927.md#implementation-and-verification)
records source and test status separately from deployment and behavioral quality.

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

The fork row follows the bounded caller contract above. Do not rely on
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
