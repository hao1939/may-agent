# Runtime Internals

**Design status:** Accepted runtime reference.
**Implementation status:** Implemented. The shared execution kernel and one App
host own App Inbox, optional task reconciliation, adapters, and recovery.

## Process modes and authority

One binary exposes several modes, but only the long-running host may own
autonomous work.

| Mode                         | May prepare agents/workflows?                      | May attach App inbox/schedules/tasks? |
| ---------------------------- | -------------------------------------------------- | ------------------------------------- |
| Long-running `--cron` daemon | Yes                                                | Yes; sole autonomous host             |
| Web/read process             | Only as required for bounded control/read adapters | No competing controllers              |
| Direct agent/workflow        | Yes                                                | No                                    |
| Gym/benchmark                | Yes, through production preparation                | No                                    |
| Status/read-only CLI         | No execution required                              | No                                    |

The long-running host loads one atomic App registry generation, then attaches
inbox dispatch, subscriptions, schedules, observers, optional task controllers,
delivery, and recovery. Other modes cannot claim or repair App work.

## Input routing

Ingress normalizes into one of four operations:

```text
ordinary human input -> admit May App request
addressed App input  -> admit destination App request
changed fact         -> publish canonical event
explicit control     -> deterministic session/task/runtime controller
```

Compatibility socket frames (`input`, `steer`, `cancel_all`, and similar)
normalize immediately into one canonical operation. They do not define another
lifecycle. A generic event cannot fall back to an owner or launch a workflow.

Socket-local observation remains narrow: status and live subscription. External
adapters use the control protocol and never call the session manager or task
store directly.

## Host startup

Startup order preserves complete generations and durable ownership:

```text
open stores / recover schema
  -> discover and validate App + agent definitions
  -> prepare one complete App registry generation
  -> publish registry and route generation atomically
  -> attach inbox, schedules, observers, task controllers, and delivery
  -> reclaim stale claims/attempts and schedule existing obligations
  -> accept new ingress
```

Failure before publication leaves the prior generation active on reload.
Failure during initial startup prevents partial hosting. Schedule and
subscription registration is generation-owned so reload cannot duplicate them.

Runtime implementation modules may be split behind host-private typed ports and
wired by explicit constructors or factories in the host composition root. This
is internal code structure, not an App plugin system: there is no
`services/*.ts` discovery, string-keyed service locator, cross-App live-object
injection, or independently reloaded dependency subgraph. Generation-owned
attachments provide deterministic teardown for every long-lived registration.

Shutdown stops new admission/dispatch, drains or interrupts bounded execution
under policy, persists terminal evidence, releases leases, and stops adapters.
It does not mark unfinished requests/tasks complete.

## Shared agent execution

Agent capability is smaller than the autonomous runtime:

```text
agent definition + prompt + typed context + supplied tools
  -> model/tool loop
  -> ExecutionResult and neutral observations
```

One execution kernel serves direct, Gym, durable session, workflow, and App
owner runs. Do not add a second “lightweight” runner.

The source boundary is deliberate:

- `src/lib/agent-runner.ts` constructs and controls the Pi Agent and exposes
  observations, steering, and cancellation;
- `src/lib/agent-execution.ts` prepares shared prompt, completion, guard, and
  tool-call behavior;
- `src/lib/manager.ts` adds hosted session persistence, transcript, lineage,
  resume, and parent/child coordination; and
- `src/app/direct-agent.ts` prepares the same definition/tools without event,
  database, scheduler, task, inbox, or recovery infrastructure.

The low-level runner cannot query May state to discover new direction. The
owning App/workflow supplies initial typed context; explicitly granted steering
or tools may provide later input.

## LLM call structure

The model receives three conceptual blocks.

### System prompt

```text
behavioral fundamentals
+ owning AGENTS.md identity/contract
+ bounded skill catalog
+ permitted runtime/workspace/tool context
```

The catalog contains metadata only. A complete skill body is loaded for a turn
only through the skill contract. Domain documents and prior-session summaries
are not globally injected unless the caller explicitly includes them.

### Invocation input

The first task message carries:

- session/execution identity and time;
- the exact typed App/workflow/task context rendered for the agent boundary;
- optional explicitly prepared continuity/evidence; and
- the bounded task request.

Workflow logic consumes typed `ctx.input` and `ctx.reconciliation`; it must not
recover those structures by parsing this rendered model task.

### Conversation/tool history

Model messages, tool calls, and results accumulate only for that bounded
session. Append-only transcript evidence remains intact. An active compact
snapshot may summarize an older prefix while preserving the original task,
important file/tool/agent facts, and recent reasoning.

May owns its deterministic compaction decision and persisted evidence. Pi's
full harness compactor is not mixed into May's independent session persistence
unless the whole harness session model is adopted deliberately.

Context overflow follows ordinary bounded failure/recovery. It does not
silently continue a durable App/task in a hidden new session; the owning
boundary decides the next attempt with explicit handoff context.

## Pi runtime boundary

May passes an explicit Pi stream function and provider session identity. Pi
owns provider request construction, streaming, tool-argument validation, tool
execution, steering/follow-up queues, cancellation, and model lifecycle events.
May does not recreate those mechanics in guards or adapters.

May supplies canonical model IDs, endpoint/credential configuration, and
verified context-window overrides. The external endpoint is deployment
configuration, not an architectural dependency on its implementation.

Pi validates TypeBox tool arguments before May guards run. Guards see valid
calls and cover semantic/safety policy, not missing schema fields.

Read-only tools may execute concurrently. Tools that mutate files, processes,
sessions, messages, or runtime state use sequential execution policy. May owns
bounded shell process behavior, including timeout, process-tree control,
rolling output cap, full-output artifact, and error guidance.

## Hosted session boundary

Sessions persist bounded execution identity, transcript, lineage, status, and
result. They do not own App requests or task outcomes.

The manager may resume a session interrupted mid-attempt when compatible source
and tool state exist. It must not replay a completed idle human turn or use
session resume as a durable business wait. App inbox/task recovery may instead
start a new session from the same authoritative obligation.

Active executions retain their prepared agent, prompt, tools, App generation,
and workflow source. Reload affects subsequent executions only.

## Workflow runtime

Canonical workflows receive scoped `WorkflowContext`:

```text
typed input + optional reconciliation facts
+ exact reads + agent/workflow calls + fact/metric ports
+ allocated workspace + log + done/blocked
```

The workflow runner imports and validates the resolved owner's module, records
source provenance, enforces one bounded deadline, persists child executions,
and returns `ExecutionResult` to the owning App/task boundary.

No workflow context contains global agent roots, task files, SQL, event bus,
scheduler, or session manager. Portable paths come only from
`ctx.workspace.root` and `ctx.workspace.output`.

## Agent discovery

The runtime discovers:

- standalone agents at `AGENTS_ROOT/<agent>/agent.json`; and
- canonical App-local agents at
  `projects/<id>.app/agents/<agent>/agent.json`, registered through the same
  prospective App generation.

Legacy flat or embedded project-agent paths are migration readers only and must
not be used by new Apps. Directories without a valid `agent.json` are not
agents.

Names are process-wide identities and must be unambiguous. App-local agents are
scoped to their App/domain workspace by prepared tools; they do not infer scope
from current working directory or copied global roots.

## Agent configuration

`agent.json` affects preparation:

| Field                | Effect                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `model`              | Configured model identity                                                                    |
| `compaction`         | Active-context compaction policy                                                             |
| `tools`              | Explicit tool presets/capabilities                                                           |
| `context_files`      | Files resolved relative to the agent and explicitly added to invocation context              |
| compatibility fields | Parsed only at documented migration boundaries; never silently change the canonical contract |

Agent configuration does not attach schedules, App subscriptions, task
controllers, or project ownership. Those belong to `defineApp`.

## Scheduling compatibility

The internal scheduler retains the historical `Cron` name. Canonical Apps
declare input/event schedules and observers. `cron.json`, named handlers,
detached jobs, and agent self-scheduling are restricted to standalone global
agents or explicit host-internal system duties; they are not an Agent App
workflow or compatibility path.

A host-internal duty may be implemented beside the App-local operations agent
when it needs Runtime-private SQL, global paths, recovery mechanics, or direct
operational delivery. Source placement does not change authority: the handler
uses a host-private structural contract, cannot own an App inbox item or task,
and must publish a fact through a declared route when domain judgment is
needed. Canonical workflow compatibility checking covers these enabled handler
entrypoints separately so host integration does not leak into the public SDK.

No canonical App work may depend on a legacy handler, and no handler may run in
parallel with a canonical subscription/schedule/task route for the same
obligation.

## What model execution cannot see implicitly

- other Apps' inbox items or task storage;
- other agents' sessions/transcripts;
- raw SQLite, event bus, queues, leases, scheduler, or recovery state;
- manager active-session internals;
- other agents' prompts;
- global filesystem/repository paths outside granted workspace/tools; and
- project/domain facts not supplied through typed context or permitted reads.

## Runtime code map

All paths are relative to `projects/may-agent/`:

- binary and long-running assembly: `src/app/may.ts`, `src/app/app-runtime.ts`;
- daemon lifecycle/adapters: `src/app/daemon*.ts`, `src/app/transport/`,
  `src/app/http/`;
- App registry/validation/inbox: `src/app/app-registry.ts`,
  `src/app/app-definition-validation.ts`, `src/app/app-inbox-*.ts`;
- App/agent preparation: `src/app/loader/`, `src/app/agent-loader.ts`;
- canonical task capability/runtime: `src/app/app-task-capability.ts`,
  `src/app/app-task-runtime.ts`;
- session/execution: `src/lib/manager.ts`, `src/lib/agent-execution.ts`,
  `src/lib/agent-runner.ts`;
- direct/Gym adapter: `src/app/direct-agent.ts`;
- task mechanics: `src/app/app-task-*.ts`;
- stable public SDK: `packages/sdk/`; and
- control protocol/client: `packages/control/`.

Task persistence, controllers, recovery, and workspaces are host-private. They
consume canonical App definitions and cannot publish another App generation or
route.

## Integrity checklist

- Only the long-running host attaches autonomous App work.
- One execution kernel serves hosted, direct, and Gym runs.
- Agent/workflow execution has typed bounded context and no durable runtime
  authority.
- App definitions and routes publish atomically by generation.
- Recovery reconciles App/task ownership rather than replaying old prompts.
- Reload never mutates active execution or duplicates controllers/schedules.
- App-local agents are discovered through the canonical App generation.
- Compatibility socket/cron/chat/project paths normalize or remain read-only;
  they never form a parallel lifecycle.
- Host-private scheduled maintenance is explicit, mechanically scoped, and
  hands domain work back through canonical App routes.
