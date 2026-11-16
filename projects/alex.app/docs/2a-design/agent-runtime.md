# Shared Agent Runtime

**Supports:** [System Model](system-model.md#enable-useful-action-within-authority). Lets the same agent perform useful work standalone or in Host without learning a second execution model.

**Choice basis:** [Simple first](../1-principles/core-principles.md#simple-first) and [Apps own meaning; the Host owns mechanics](../1-principles/core-principles.md#apps-own-meaning-the-host-owns-mechanics). Share execution once; supply context, tools and operational services at the boundary instead of recreating Host inside standalone.

**Design status:** Accepted.
**Implementation status:** Partial. Standalone preparation, explicit skills,
service absence and supplied workspace paths share runtime rules;
root worker authoring and bounded helper calls use the execution SDK. Host still
has a separate invocation lifecycle and Task-specific preparation. Shared
`run()` supervision, parent-only SQLite and companion App adoption remain gaps.
[Source convergence](#source-convergence) distinguishes completed foundations
from remaining integration. Source status does not establish deployed parity.

## One agent, different environments

An agent receives its instructions, assignment and relevant context, available
tools, and execution controls. It reasons, acts and returns a contribution.
Standalone and Host must use the same implementation of that execution.

```text
Standalone caller ─┐
                   ├─ prepare inputs and services ─ shared agent invocation
Host orchestration ┘                               ─ tools/model ─ result
```

Host adds durable work management, scheduling, persistence, supervision,
monitoring and recovery around the invocation. A Host Task is how Host retains
work across executions; it is not a different kind of agent. Portable runtime
code is not a third work owner, daemon or required service.

Equivalent definitions, assignments, context, tools and execution controls must
produce equivalent preparation, tool contracts, completion, cancellation and
cleanup semantics. Model output need not be deterministic. Actual data, explicit
permissions and caller-selected limits can differ; the execution mode alone must
not introduce hidden behavioral rules.

[Architecture](architecture.md) owns component placement. [Host Runtime](runtime.md)
owns long-running process orchestration. [Task attempts](task-attempts.md) own
Host's claim and settlement, not another implementation of agent execution.

## Capabilities are supplied tools

A tool powers the agent when a working implementation is supplied. The same tool
has the same description, parameter schema, effects, result and error contract
standalone and in Host. Composition can bind local or Host-backed services
without changing that observable promise.

Resolve the effective tool set before invocation. Definition presets are a
configuration convenience, not another capability authority. Do not silently
remove cooperation because execution is standalone, or automatically grant Task
mutation because it is hosted. Explicit installation/caller policy may restrict
tools; apply the same restriction and descendant-scope rules in either mode.

A tool requiring storage, helper dispatch or durable scheduling needs an actual
backend. Supply a local implementation that honors its contract, or leave it
unavailable with an explicit configuration/call error. A test fake is selected
by the test caller, never substituted by the production runtime. Do not promise
durable feedback from a snapshot or turn a missing backend into a successful
no-op. The default standalone invocation need not start a database or daemon.

Bounded helpers inherit their caller's authority, cancellation and remaining
allowance. A helper result does not transfer ownership of the caller's work.
[Cooperation](agents.md) and [contributions](execution-contributions.md) own these
observable relationships; the agent need not assemble their transport or leases.
Tool policy is not an OS sandbox for shell, native executors or trusted code.

## Context is information, not Host machinery

The caller supplies the assignment and result expectations. An environment may
prepare relevant facts and references, including goals, acceptance criteria,
constraints, previous work, outstanding questions and new information.

For example, an agent can receive:

```text
Goal: Fix the failing parser tests.
Acceptance: Relevant tests pass; the public API is unchanged.
Previous work: Patch and test output are available at the supplied paths.
New information: The caller also needs empty input handled.
```

The agent understands that work, not Task claim generations, leases, queue state
or reconciliation envelopes. Host retains those coordinates in its adapters and
checks authority at the operation boundary. A business resource ID can still be
useful context; hiding bookkeeping does not mean removing references needed to
act correctly. Context and prompt text cannot grant authority.

Use one generic preparation/refresh mechanism. Host can provide current work
facts before a model call; standalone can provide fixed local context or its own
refresh source. Refresh follows the same timing relative to compaction and model
requests. Preserve the original assignment separately from a shortened rendering.
A refresh failure must disclose stale or missing coverage; do not replace known
facts with an invented empty state. Detail references remain readable when needed.
Helpers receive their own contribution plus relevant background, not a silently
expanded assignment.

A domain-specific work-management tool or caller-owned result schema may expose
business decisions such as progress or waiting. It is explicitly supplied and
has the same contract in either environment; it is not knowledge required by the
generic agent runtime. Host's current Task-shaped prompt/schema is an adapter
contract pending simplification, not the universal agent interface.

## Skills are optional guidance

Expose available skill descriptions and readable locations so the agent can
choose a useful method. Do not classify every assignment into a mandatory skill
or enforce compliance merely because a skill is installed.

When a caller deliberately selects a skill, preparation uses that agent's
catalog, validates availability and supplies its full instructions consistently
in both modes. Supplying requested guidance is not proof or enforcement that the
agent followed it. Ordinary delegated text stays literal unless the caller
explicitly selects activation; apply that distinction consistently.

Discovery, full-body delivery, actual use and useful results are separate facts.
[Skills](skills.md) owns packaging, precedence, disclosure and activation rules.
No skill gets its own work lifecycle or completion gate.

## Missing data and unavailable services

| Observation | Meaning and response |
| --- | --- |
| Successful lookup, item absent | Return `null` when that is the lookup contract. |
| Successful collection read, no matches | Return an empty collection with its normal coverage/freshness fields. |
| Backend not configured or unavailable | Return an explicit error; do not claim a successful empty read. |
| Operation failed or access denied | Return the specific error and available evidence through the tool/call contract. |

An intentionally configured empty local store can legitimately return no data.
An absent implementation cannot. Use the existing result/error vocabulary; no
universal service registry or new error taxonomy is needed. Partial capability
bindings must not silently fill missing effects with no-ops.

## Working directory and definition consistency

For the agent, a workspace is simply its working directory and supplied source,
output and evidence paths. Host may allocate a Git worktree; a standalone caller
may supply an existing directory. Allocation, branch identity, retention and
cleanup belong to the environment, not a term the agent must learn to execute.
The environment owns required isolation. Host may enforce its checkout contract;
standalone runs in the supplied `cwd`/`workRoot` without inferring a Git-checkout
preflight from workflow workspace metadata. A procedure checks the concrete
prerequisites its work requires.
Current SDK `workspace` fields remain usable path bindings, not a new work owner.

Standalone resolves selected agent sources and reads configuration, instructions
and skill bodies from disk when needed. It does not pin arbitrary file reads to
a captured byte snapshot. A recorded definition revision identifies a selected
entry, not every future file read. Callers requiring immutable supporting files
supply an immutable source directory. Host generation/restart fences and fresh
file evidence are separate guarantees.

## One invocation lifecycle

There is one implementation of:

```text
prepare → execute model/tools → finish or interrupt → cleanup → return result
```

It owns preparation, tool/result validation, compaction, corrective completion,
execution limits, cancellation, finish fencing, descendant joining, error
classification and cleanup reporting. Environment adapters supply services,
control signals and evidence sinks; they do not duplicate those decisions.
Required persistence failures stay visible; optional observation failure must
not replace the result. Cancellation does not undo committed external effects.

An accepted finish ends this invocation and fences remaining effects. Rejected
output remains correctable within its existing allowance. Preserve useful
partial output and failures. A successful invocation does not by itself mean
that a durable Task or human promise is fulfilled.

Host's surrounding sequence is:

```text
select retained work → prepare environment/context → shared invocation
  → validate/admit the proposed result → retain or schedule remaining work
```

Task identity, leases, result admission and later attempts remain Host mechanics.
App/caller policy owns domain acceptance and continuation. Use an explicit
result contract to connect them; do not infer Task closure from prose, a tool
name or a successful session. Recovery confirms old execution cleanup and starts
an ordinary fresh invocation with retained evidence. [Sessions](sessions.md) own
retained history and direct-chat continuity, not another model/tool lifecycle.

A workflow can organize an understood bounded procedure inside an invocation,
including iteration, parallel cooperation and synchronization. Host coordinates
continuation between invocations through retained work and relevant events;
the agent/App still chooses strategy and judges progress. Complexity alone does
not select Host orchestration or a different agent runtime. See
[bounded procedure versus durable coordination](workflows.md#bounded-procedure-versus-durable-coordination)
for the dividing line and contrasting examples.

## Source convergence

Standalone skills, explicit context/services, supplied workspace paths and the
execution/App SDK split are implemented foundations. Source files are read
directly; standalone does not require a Git checkout from workspace metadata. Explicitly declared
prompt/code helper calls use the common kernel and its admission, cancellation,
identity and cleanup lifecycle; supplied providers keep precedence. Retained
legacy finishes normalize at the read boundary without restoring old authoring.
The [source record](../archive/implementation/host-ingress-sdk-source-review-20261116.md)
pins that scope. These foundations do not establish hosted parity.

| Boundary | Current difference | Required correction |
| --- | --- | --- |
| Hosted invocation | Host still has Task-specific manager/worker execution rather than calling shared `run()` unchanged. | Keep one execution lifecycle; Host supplies persistence, controls and supervision through adapters. |
| Tools, input and finish | Host injects Task tools, reconciliation briefs and Task finish schemas. | Supply explicit worker input and declared tools; keep Task admission and blocked translation at the App/settlement boundary. |
| Host capability wiring | Standalone helper/provider semantics exist; the full Host caller has not adopted them. | Preserve explicit tools, CLI capabilities, deadlines, identities, cleanup uncertainty and captured definitions through the real Host path. |
| Storage and recovery | The attempt child still constructs `DbWriter`; shared-run settlement has no production callers. | Keep Host SQLite writes in the parent and preserve pinned generation, accepted checkpoints and restart fences. |
| Public worker types | Deferral and CLI evidence reachable from root still contain Task identities. | Remove implicit Host identity requirements while retaining explicit coordinator domain tools under `/app`. |
| Paired adoption | Local App imports/contexts pass the 24-workflow pairing check; domain-worker continuation is not connected. | Integrate the companion patch and verify fresh input, prior evidence and wait/resume behavior through the real Host path. |

Current source entry points are [portable agent execution](../../../may-agent/packages/sdk/src/runtime/lib/agent-execution.ts),
[standalone composition](../../../may-agent/packages/sdk/src/runtime/app/standalone.ts),
[Host preparation](../../../may-agent/src/lib/agent-execution.ts), and
[session management](../../../may-agent/src/lib/manager.ts). Public callable APIs
remain those in [SDK](sdk.md); this design does not invent a replacement signature.
The [convergence follow-up](../proposals/host-ingress-and-boundary-simplification-20261116.md)
owns the remaining integration sequence; the [earlier runtime follow-up](../proposals/unified-agent-instance-runtime.md)
retains the additional worker-supervision boundary.

## Acceptance

Use paired standalone/Host tests with equivalent definitions, context, tools and
limits. Check prepared system instructions, effective tool schemas, transformed
messages, result validation, corrective finish, cancellation and cleanup—not
just that both callers return success. Cover:

- provided cooperation tools, absent backends and explicit restrictions;
- assignment, helper scope, fresh context and failed/stale refresh;
- optional discovery and deliberately selected skill delivery;
- legitimate missing data versus failed/unavailable reads and effects;
- required working-directory setup and changes during an invocation;
- partial results, rejected/accepted finish, queued input and late tool calls;
- deadline/Stop races, child joining and unconfirmed cleanup; and
- Host restart with retained work, without duplicate execution or false closure.

Fixture tests establish semantics, not identical model prose, improved judgment
or installed adoption. Long-running worker supervision has its separate owner
in [Host Runtime](runtime.md#worker-supervision).
