# Agent Responsibilities and Cooperation

**Supports:** [System Model](system-model.md#enable-useful-action-within-authority). Keeps one agent accountable for useful outcomes across executions, with optional App scope and bounded cooperation.

**Choice basis:** [One authority for each resource](../1-principles/core-principles.md#one-authority-for-each-resource) and [context discovery](../1-principles/core-principles.md#context-is-discovered-not-dumped). Separating the durable owner from its executions prevents lost responsibility; an App adds useful scope without becoming a second Task owner.

**Design status:** Accepted.
**Implementation status:** Bounded calls/forks and durable cross-App Task
dependencies are implemented. Helpers retain their live caller's scope and
cancellation. Ended Host sessions cannot resume; unfinished work starts a fresh
Task attempt. Supported native CLI thread continuation remains separate. The
[execution review](../archive/reviews/execution-consolidation-poc-20260914.md)
retains the trials and their limits. The accepted cooperation design below
removes invocation permissions, unifies input/result/discovery, and retires
public `fork`. Draft Host #589 implements the model list/call and canonical
registration boundaries; SDK/App migration and paired verification remain open.
The installed runtime still exposes the earlier interface. The
[source review](../archive/reviews/agent-workflow-interface-source-review-20261117.md)
records exact published checkpoints and verification limits.

Agent registration has two scopes:

1. **Global agents** — `agents/<name>/agent.json`, for genuinely standalone
   capability.
2. **App-local agents** — `projects/<name>.app/agents/<agent>/agent.json`,
   registered with the owning App.

App-local registration groups agents with their team's policy and knowledge.
The packages, not a duplicated design-time roster, are the current inventory.
Registration scope does not select a different agent lifecycle or implicit tool
grants. [Shared Agent Runtime](agent-runtime.md) owns standalone/Host parity:
the same agent receives ordinary context, supplied tools and execution controls.

## Task ownership and App scope

**An agent owns a Task. An App is an organized extension of its owner agent.**
The agent is a durable role with capabilities, knowledge and obligations; a
session or attempt is one execution of that role. Replacing an execution does
not replace the Task or its responsible agent.

| Concept | Responsibility |
| --- | --- |
| Task owner agent | Carry the assigned outcome through useful work, verification, reporting and unresolved blockers |
| Creator/caller | Define the requested scope and acceptance; revise the assignment through the authorized path |
| App | Extend its owner agent with a scoped address, policy, shared context and knowledge, capabilities and collaborating agents |
| Helper, workflow or executor | Perform the supplied contribution or procedure within the Task's authority |
| Host | Retain Tasks and decisions, execute admitted actions, deliver feedback and recover execution |

For example, the May App extends May. Work addressed to it normally goes to May.
A review explicitly assigned to Bob is Bob's Task, within the May App's scope. If May
instead calls Bob for a bounded review inside her own attempt, May keeps her
Task and Bob returns his contribution. A workflow or native executor can carry
out either Task without requiring the owner to make a model call at every step.

The App address remains a useful interface: callers can choose domain scope
without choosing a specialist. App input policy maps the request to its
owner agent or an explicitly selected specialist. The owner agent coordinates
that App's responsibility and unresolved blockers. Delegating a contribution
does not settle any broader commitment it made to the caller. Shared knowledge is
discoverable context, not a requirement to copy the whole App into every prompt.
An App address, membership or owner label never grants additional authority.

The owning agent decides how to make progress under the assignment and domain
rules. The creator's authority over requirements remains distinct. A helper
does not take ownership just by running; a help request creates or addresses a
separate Task for the requested contribution. The original owner keeps the
original obligation and applies the returned evidence.

### Current implementation and next change

`TaskIntent.agent` names the responsible agent. Current resolution uses an
explicit Task assignment, then the nearest parent assignment, then
`AppDefinition.agent`. The latter is the App's owner agent. `workflow` and
`executor` select how an attempt runs, independently of who owns the outcome.
New authoring uses only `agent`; the old `owner` spelling remains in stored
Task records and is rejected as new input. See the
[cleanup record](../archive/reviews/task-api-cleanup-20261112.md) for availability. An omitted assignment still inherits current
configuration; pin `agent` when a fixed assignment is required. This clarification
does not change assignment, creator authority or closure permissions.

Task detail reads expose the resolved agent; execution briefs distinguish it from the
creator. App contract/catalog discovery exposes the owner agent alongside
the input schema. These facts make responsibility discoverable; they do not
automatically supervise a specialist or contact someone when a result is blocked.

**Source availability:** the added owner metadata and execution guidance merged in
[Host PR #314](https://github.com/hao1939/may-agent/pull/314), merge commit
`169396a4040f7b9b43cbbafb87d5d24e8e773f4c`. The reviewed candidate was
`21570ff54f144be6a598d511734fc09457d1e745`. Activate a Host containing this change
before activating instructions that rely on the added fields. Merge and source
checks do not establish installed availability or improved agent behavior. Existing input
routing, workspace/knowledge discovery and assignment controls are retained.

**Accepted direction, not yet implemented:** an agent can own durable Tasks
without an App. Global agents already support bounded calls, but durable
admission, identity and recovery still require an App scope. The
[standalone Task follow-up](../archive/decisions/standalone-agent-tasks.md) owns that
remaining change. Do not invent an App wrapper or a callable standalone API
in agent instructions. Use current declared App routes until that path exists.

### Intended workload behavior

**Accepted direction; shared accounting, scoped feedback and protected
coordination are implemented in source. Operational adoption remains separate.**
Business need establishes the assignment. Workload guides priorities, timing,
scope and whether discretionary expansion justifies delaying existing work.
Required work can remain pending while execution capacity is full; Task count
alone does not decide acceptance. Pressure can bring creator review forward,
while completion evidence and closure authority retain their existing meaning.
Resource limits continue to constrain execution and spending. Empty execution
places do not imply usable capacity when workspace, disk or access prerequisites
are blocked. The intended feedback distinguishes runnable demand, blocked
obligations and results awaiting creator review within the agent's read scope.
The [workload proposal](../archive/decisions/agent-task-workload-model.md) owns the detailed
decision guidance, shared-accounting choices and behavioral verification cases.
Its [bounded decision pass](../archive/decisions/agent-task-workload-model.md#one-bounded-decision-pass)
connects feedback to useful next actions and makes consequential deferral visible
through existing Task and caller paths. Workload situations guide judgment;
they introduce no new Task states or automatic admission and closure thresholds.
The [lifecycle integration](../archive/decisions/agent-task-workload-model.md#integrate-with-the-existing-lifecycle)
places accounting and feedback at shared admission, execution start,
settlement/cleanup and agent decision context, preserving the existing engine.
Protected coordination lets explicitly eligible agents make bounded decisions
under resource stress. Host #443 integrated that support; the
[completion audit](../archive/reviews/workload-completion-audit-20261109.md)
records its supported paths and remaining acceptance. Source integration does
not establish installed funding, activation or improved judgment.
The [implementation approach](../archive/implementation/agent-task-workload-implementation.md)
maps these changes to current Host owners and staged verification; current App
admission can support that work without waiting for standalone Task addressing.

## Definition sources

A snapshot means one consistent selected definition, not another work record.
The [shared rule](agent-runtime.md#working-directory-and-definition-consistency)
requires resolved instructions/tools/skills to remain stable for an invocation
while work context may refresh. Current Host release capture implements this;
standalone still rereads some mutable source after catalog selection.

Host captures agent and App definitions with `shared/common-sense.md`,
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
result. Retain `ctx.call` and the model-facing `agents.call` as thin scoped
wrappers, preserving useful agent cooperation without independent session recovery.
The caller's execution context supplies exact Task identity, available tools,
cancellation and remaining allowance. Invocation adds no target permission
profiles, allow/deny lists or App-based call denials.

## Agent tool actions

The refined cooperation surface treats prompt agents and code workflows alike;
see [common invocation](execution-contributions.md#invocation-and-ownership).

| Action | Behavior | When to use |
| --- | --- | --- |
| `list` | List one catalog of registered callables and their contracts | Discover an exact canonical name |
| `call` | Await a bounded contribution with `{ prompt, data? }` input and the common result | Current invocation needs the result |

The accepted direction is to retire `fork` and the session-management actions from
this cooperation tool. A fork's distinct value is letting a model start a helper,
continue its own work and later collect the result. It also requires session
handles, inspection, live steering, result collection and cleanup semantics.
No active explicit fork callers were found in the checked Alex, May and Scout
source/guidance; existing workflows use awaited `ctx.call`.

Use parallel joined calls in a workflow when concurrent bounded work is useful.
Use a Task when an independent outcome must survive the caller. Removing public
forking gives up ad hoc model-controlled background helper execution; it does
not remove workflow concurrency, Host observation or cancellation.

Required children settle or stop before their caller completes. Caller timeout
or Stop propagates cancellation through the entire child tree. The installed
Host still exposes `fork`, `peek`, `follow-up`, `cancel`, `context` and `sessions`.
Their removal from the model cooperation tool is published in draft #589;
complete SDK/App adoption and activation remain open. Execution records, Task
feedback, diagnostic reads and operator/Host controls retain supervision,
feedback and cancellation.

## Workflow capability

The refined interface calls either implementation through the same envelope
and canonical [name](execution-contributions.md#discovery-and-callable-names):

```ts
const result = await ctx.call("alex/dev", { prompt: task });

const [implementation, review] = await Promise.all([
  ctx.call("alex/dev", { prompt: implementationTask }),
  ctx.call("alex/reviewer", { prompt: reviewTask }),
]);
```

Both return the shared [bounded result](execution-contributions.md#result-admission).
Backend kind and session/workflow aliases remain execution diagnostics, rather
than fields a caller must inspect to consume a contribution. The current SDK
requires migration before these examples are deployed call syntax.

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

If a message asks another owner to act and report back durably, use a Task
request. Current admission requires a declared App route. A missing route is
a capability gap to report; standalone Task support is the follow-up above.
Do not use a generic notification as a durable owner inbox.

## Context passing

Context supplies the assignment, relevant facts and discoverable evidence. The
agent does not construct or interpret Host claims, leases or queue state. The
[generic preparation/refresh contract](agent-runtime.md#context-is-information-not-host-machinery)
applies in either environment; the following describes current Host delivery,
not information every standalone caller must represent as a Task.

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

The [integration record](../archive/reviews/task-decision-context-integration-20260926.md)
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
The portable preparation boundary is `prepareAgentExecution`; Host currently
wraps it with Task/conversation context. The shared model/tool loop transforms
messages before each provider request. Host-specific preparation and completion
remain [convergence work](agent-runtime.md#source-convergence), not a required
second agent interface.

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

The Task and Conversation adapters supply data, while shared runtime orientation
is bundled in `packages/sdk/src/runtime/lib/execution-instructions.md`. Contract
details live with SDK
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
[implementation record](../archive/reviews/agent-prompt-assembly-review-20260927.md#implementation-and-verification)
records source and test status separately from deployment and behavioral quality.

## Choosing the mechanism

| Situation                                                      | Mechanism                               |
| -------------------------------------------------------------- | --------------------------------------- |
| Need another capability before this bounded attempt can finish | `agents.call` / `ctx.call`              |
| Several independent bounded checks                             | parallel awaited calls                  |
| Short exploration still owned by this live caller              | Awaited call; parallel joined calls inside a workflow |
| Another domain owes an eventual result                         | Cross-App task dependency               |
| Durable desired outcome needs repeated attempts                | App task                                |
| Optional FYI with no result obligation                         | `message` notification                  |
| Repeatable multi-step bounded process                          | `ctx.call`                              |

Provider-specific helpers and direct CLI calls follow the same
[execution rules](system-boundary.md#execution) without needing their own Tasks.

## Integrity checklist

- Every agent call belongs to one bounded caller attempt.
- A caller does not finish while an unjoined child still carries required work.
- Durable cross-owner obligations use task dependencies, not messages or events.
- Child execution results remain evidence until admitted by the owning
  workflow/App/task.
- App-local agents and workflows retain their App's scope and policy; the assigned agent owns the Task.
- No agent notification becomes a hidden retry queue or owner inbox.
