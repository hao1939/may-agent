# Proposal: Agent App Runtime Model

**Design status:** Draft proposal.
**Implementation status:** Partial. The current project-app loader, app-local
agents, owner workflows, event runtime, task tree, and Gym adapter provide most
of the pieces, but not one coherent owner-entry contract.

## Executive Decision

Treat an app and its owner agent as **one product-facing entity** represented by
a self-contained context-and-state package. A generic Codex-like runtime loads
that package to create a running app instance:

```text
Agent App Package = Owner Context + Tasks + Reusable Capabilities + App Data
Standalone Agent = Agent Runtime + Agent App Package
Autonomous App = Standalone Agent + Optional Infrastructure Bindings
```

For a human or another app, the entry is the Agent App. Its owner agent is the
semantic face: it understands goals, applies preferences, plans, prioritizes,
accepts results, and explains decisions. The agent runtime supplies model
execution, context loading, core tools, and a session. Optional infrastructure
adds events, durable tasks, schedules, metrics, recovery, and multi-app routing.

This gives us one understandable abstraction without asking a probabilistic
model to provide durability, isolation, scheduling, or safety enforcement.

The public rule is:

> Invoke the app. The app speaks and judges through its owner agent.

The internal rule is:

> The owner chooses meaning; the runtime controls mechanics and applies only
> allowed actions.

`--propose` should be an optional safety restriction on `run`, not a separate
agent or project lifecycle. It allows prepared context, core reads, and
`submit_proposal`, but denies mutation, delegation, messaging, and dispatch.

## Governing Dependency Rule

> The agent must remain useful without infrastructure. Infrastructure brings
> context and capabilities to the agent and makes it autonomous; the agent does
> not import, host, or directly depend on infrastructure.

The dependency direction is one-way:

```text
event/task/metric state
  -> infrastructure prepares plain context
  -> agent.generate(request, context, core tools)
  -> infrastructure may steer relevant context deltas into the active session
  -> agent returns response/structured decision
  -> infrastructure validates/applies decision
  -> infrastructure emits follow-up/notification events
```

Never:

```text
agent -> imports event bus/task runtime/metrics SDK
agent -> opens infrastructure database
agent -> calls infrastructure context/query APIs during generation
agent -> assumes schedules, inbox, or recovery are running
agent -> requires infrastructure merely to answer a direct user request
```

This is a logical boundary even when both layers are deployed in one process.
The owner definition, prompt, skills, knowledge, and base workflows must load
and produce a useful result with no event, task, metric, schedule, or recovery
service present.

Infrastructure integration uses one normal agent interface:

```ts
const result = await agent.generate({
  session,
  app,
  input,                    // direct request or event translated to plain input
  context,                  // files/plain structured observations
  capabilities,             // plain declarations + availability, never clients
  tools: coreTools,
});
```

Before this call, infra may query any of its own services and assemble the
context. After the call, infra may validate structured actions, update its
state, dispatch work, or emit events. Those operations never execute inside the
agent generation flow.

Do not normally solve missing context by ending the run and starting another
full generation. Infra should materialize a versioned, read-only context view
beforehand:

```text
context/
  manifest.json       # app/instance, revision, observed time, sources, evidence index
  summary.md           # compact starting packet
  tasks.json
  events.jsonl
  metrics.json
  logs/
  evidence/
```

The prompt receives the compact summary and context root. During the same agent
run, normal core `read`, `search`, and local query tools can inspect deeper
artifacts. These are ordinary files or an immutable local snapshot, not calls
to an infrastructure API.

Infra can maintain this projection continuously or refresh it when the
triggering event arrives, so context preparation does not add an extra model
round trip. Parallel Gym trials can share the same read-only context revision.

The capability catalog is data, not an SDK. It tells the owner which external
operations are presently available, their input/result schemas, authorization
and approval requirements, and whether they require infrastructure. The agent
may return a declared request; it receives no callable task, event, metric, or
context-service client.

If the materialized view is genuinely insufficient, a hosted agent may return
a declared capability request as part of its normal structured result. Infra
executes that request outside the agent, then steers the result into the same
session and continues generation. This is a continuation of one owner turn,
not a new context API available to the agent and not a fresh diagnosis run.

A standalone run uses the same contract with only local capabilities present.
If an infra-only capability is unavailable, the agent remains able to reason
from its package and local evidence, explain the limitation, and propose the
next action. It must not fail merely because autonomous services are absent.

### Task mutation reaches the agent through steering

Task state remains infrastructure-owned. When a task mutation matters to an
agent session, infra sends a plain steering message through the generic agent
session interface:

```ts
agent.steer(sessionId, {
  kind: "context-update",
  updateId: "task:TASK-12:42",   // stable deduplication identity
  appId: "scout",
  taskId: "TASK-12",
  fromRevision: 41,
  toRevision: 42,
  summary: "Worker evidence arrived; task moved from active to review.",
  evidenceRefs: ["context/evidence/TASK-12-result.md"],
});
```

The agent receives a normal contextual message. It does not subscribe to the
task store, poll infra, or import a steering implementation.

Rules:

- steer only sessions linked to the changed task/app;
- deduplicate by `updateId`; repeated delivery must not repeat an action;
- carry monotonic state revisions so stale or duplicate updates are visible;
- send a concise delta plus references, not the full task database;
- queue delivery at a safe model/tool boundary; use cancellation for an urgent
  stop rather than pretending an in-flight model call changed context;
- resume a linked open or suspended owner turn when it is waiting for this
  mutation or result;
- when no linked open/suspended turn exists, include the mutation in the next
  event-triggered context packet instead of reopening completed work merely to
  steer;
- disable unsolicited steering in a fixed Gym proposal trial unless steering
  is itself part of the scenario.

When an agent result requests a task change, infra validates and applies it
after `agent.generate`. If the same session continues, the applied revision and
evidence return through steering before the next generation turn. External
human, worker, or workflow mutations use the same path.

### One continuation loop preserves agent power

Decoupling does not require a single frozen prompt followed by a final answer.
It requires only that infra-owned operations occur outside model generation:

```text
prepared input/context
  -> agent.generate(session)
  -> final result

or, when external work is needed:

prepared input/context
  -> agent.generate(session) returns a declared action/request
  -> infra validates and executes it
  -> agent.steer(session, result + new revision + evidence references)
  -> agent.generate(session) continues
  -> final result
```

This is the same generic session loop for task changes, worker results, fresh
diagnostic evidence, approvals, and human answers. Do not add a task query API,
context service client, polling loop, or infrastructure SDK to the agent.

The boundary affects capabilities as follows:

| Capability | Effect of decoupling | How full capability is retained |
| --- | --- | --- |
| Reasoning and planning | None | Owner prompt, app knowledge, preferences, and prepared evidence are unchanged. |
| Exploratory diagnosis | Infra databases are not directly browsable | Materialize an indexed read-only view; use ordinary read, search, shell, and local-query tools during the run. |
| Fresh/live evidence | It cannot appear inside an in-flight model call | Steer concise revisioned deltas at safe turn/tool boundaries, with references to refreshed evidence. |
| Task/state mutation | The agent cannot write infra state directly | Return a typed action; infra validates/applies it and steers the committed revision back. |
| Action verification | The first decision is not assumed successful | Continue the same session with applied/failed evidence and let the owner verify, revise, or stop. |
| Delegation | The agent does not host durable workers | Return a worker assignment; infra dispatches it and steers progress/result evidence back. |
| Long waits/callbacks | The agent process does not remain blocked | Suspend the session; an event resumes it with steering/context when the callback arrives. |
| Human clarification | The agent does not own messaging infrastructure | Return `human.ask`; direct interfaces may ask synchronously, while hosted replies steer into the session. |
| Standalone use | Autonomous capabilities are absent | Local reasoning, core tools, synchronous workflows, proposal, and result production still work. |

The unavoidable limits are explicit and desirable:

- the agent can use only capabilities the runtime actually grants;
- an in-flight model call cannot observe a concurrent mutation until the next
  safe boundary;
- a standalone run cannot promise durable waits, workers, schedules, or shared
  task mutation when those services are absent;
- if the prepared view omits evidence and no declared capability can obtain it,
  the result must say what is missing rather than inventing certainty.

These are authorization, consistency, and availability boundaries, not a loss
of reasoning power. In fact, the separation makes behavior easier to replay:
every external observation and mutation is either in the initial context or a
revisioned steering record.

Removing infra context API access is safe only when four guarantees hold:

1. **Depth:** the initial view is indexed and explorable, not only a prose
   summary;
2. **Discovery:** the plain capability catalog shows what additional evidence
   and actions are available;
3. **Continuation:** an unexpected request can be executed externally and its
   result steered into the same session without discarding prior reasoning;
4. **Freshness:** revisions and observation times make staleness visible, and
   relevant mutations arrive through steering.

Without depth, diagnosis becomes shallow. Without discovery, the agent stops
prematurely. Without continuation, every missing fact causes an expensive new
run. Without freshness, the agent can make a correct decision about old state.
These are failures of the adapter contract, not reasons to couple infra APIs
back into the agent.

Keep the loop bounded by action count, time, token budget, and repeated-request
detection. A task mutation uses an idempotency key and expected revision; a
conflict is steered back as evidence for owner judgment rather than silently
overwriting newer state.

## One Codex-Like Agent Runtime, Optional Infra

Yes, May-agent can deliberately provide a Codex-like agent runtime. Autonomous
infrastructure is a separate optional layer around it.

The standalone agent runtime owns:

- the model/provider loop and transcript/session lifecycle;
- built-in read, edit, shell, and other bounded core tools;
- sandboxing, approvals, budgets, and capability enforcement;
- normal execution and structurally read-only proposal enforcement;
- direct CLI/chat invocation and Gym integration.

Optional infrastructure owns:

- event routing and causal traces;
- durable tasks, async workers, and workflow continuation;
- schedules, metrics, watchdogs, callbacks, and inboxes;
- recovery, multi-app routing, shared channels, and operations UI.

Each app contains only its contextual program and data:

- owner identity, instructions, model selection, skills, and preferences;
- context-builder and structured decision contract;
- declared tools/capabilities and permission/budget policy;
- deterministic workflows, routes, schedules, and adapters;
- domain workspace binding and domain-specific durable state;
- evidence, acceptance, escalation, and human-response conventions.

That is intentional. The runtime is analogous to Codex, a browser, or a game
engine; the app package is the specialized program loaded into it.

Use a smaller name when the package is smaller:

| Package has | Call it |
| --- | --- |
| Prompt/model/tools only | Agent definition |
| A reusable situational method | Skill |
| Repeatable bounded orchestration | Workflow |
| Owner policy plus durable domain state, ingress, capabilities, and operating lifecycle | Agent App |

This threshold prevents every prompt wrapper from becoming an app while still
allowing an Agent App to be primarily declarative context.

### Package at rest versus instance at runtime

Use separate names for two things that were previously blurred:

| Object | Meaning |
| --- | --- |
| **Agent App Package** | Portable directory containing contextual definition and app-owned data. |
| **Agent App Instance** | A runtime-loaded package with an instance ID, session/state scope, and one semantic owner entry; optional infra may attach routes. |
| **Agent Runtime** | Standalone executable that loads context, runs model turns and core tools, and supports direct use and evaluation. |

One package may be started as one local instance, installed into a shared host,
or instantiated repeatedly by Gym with different fixture state. Instance state
never changes the package definition revision silently.

### Identity invariant: app ID equals root owner ID

Enforce one canonical name for the public app and its root owner policy:

```text
scout.app          -> app id: scout   -> owner agent id: scout
release.app        -> app id: release -> owner agent id: release
evaluation.app     -> app id: evaluation -> owner agent id: evaluation
```

This makes the app the durable identity and the owner agent its active policy,
without a configurable name mapping. The runtime validates:

```text
directory basename without .app == manifest.id == root owner agent.id
```

The invariant applies to the stable ID only. These may differ:

- display name: `Scout`, `Release Captain`, `Evaluator`;
- role: `research lead`, `tech lead`, `judge`;
- model/provider and prompt revision;
- bound domain project/workspace name;
- internal worker names.

The root owner configuration should therefore omit a redundant name, or repeat
the app ID only for schema clarity:

```text
scout.app/
  app.yaml          # id: scout
  owner/
    agent.yaml      # no name, or id: scout
```

Consequences:

- `app:scout` is the public invocation address;
- `agent:scout` is the compatible event/session owner principal;
- the runtime binds them as the same root identity;
- internal agents remain scoped, for example
  `app:scout/agent:researcher`;
- changing model, instructions, or role is a policy revision, not an identity
  change;
- renaming the app is an explicit state/trace identity migration.

This also prevents one standalone agent identity from ambiguously owning
several apps. Reuse belongs in shared skills, workflows, tools, or a typed
cross-app capability. Every app still has one accountable root.

### Canonical app contents

An app directory should be understandable without reading runtime source:

```text
example.app/
  app.yaml                 identity, owner entry, runtime requirements
  owner/
    agent.yaml             model, tools, budgets
    AGENTS.md              identity and standing guidance
    context.md             app-specific operating context
  skills/                  reusable judgment guidance
  workflows/               deterministic reusable orchestration
  tools/                   app capability declarations/adapters
  tasks/                   durable goals, task tree, plans
  knowledge/               domain knowledge and accepted summaries
  schemas/                 decisions, events, and app-data contracts
  data/                    durable app-owned operational data
  .runtime/                transcripts, event log, leases, caches, run records
```

The exact filenames can remain compatible with current `.app` directories. The
important distinction is lifecycle:

- definition files are versioned and mounted as the package revision;
- `tasks/`, `knowledge/`, and `data/` are durable app-owned state with explicit
  backup/migration rules;
- `.runtime/` is host-managed, instance-specific state and may be exported for
  audit or recovery;
- secrets stay outside the package and are injected through named bindings.

“The app contains runtime data” means the data is logically owned and
namespaced by that app. It does not mean the app contains a private copy of the
runtime implementation.

## What The Agent Runtime And Infra Provide

The standalone agent contract is intentionally small:

| Agent runtime service | What it provides |
| --- | --- |
| Agent kernel | Model calls, turns, transcript, compaction, structured output, cancellation |
| Context loader | Package discovery, precedence, hashes, prompt assembly, snapshot provenance |
| Core tool runtime | Built-in read/edit/shell tools, app-local adapters, sandbox, approvals |
| Local workflow runtime | Bounded synchronous reusable workflows that require no durable wait |
| Proposal enforcement | Read/query-only tool surface and structured proposal result |
| Direct interfaces | CLI/chat invocation and Gym trial integration |

Infrastructure wraps the generation call:

| Optional infra service | Before `agent.generate` | After `agent.generate` |
| --- | --- | --- |
| Tasks/plans | Summarize relevant state and evidence | Validate/apply returned task decisions |
| Workers/workflows | Include current attempt/result context | Dispatch declared follow-up work |
| Events/inbox | Translate the triggering signal into plain input | Emit typed response and close accepted work |
| Schedules | Produce a trigger for context preparation | Record outcome; schedule remains outside agent |
| Metrics/watchdogs | Add measured evidence and abnormal signals | Record judgment, recovery request, or notification |
| Durable state | Provide a versioned snapshot/reference | Apply validated changes and persist provenance |
| Shared interfaces | Supply actor/channel context | Deliver the returned response |

The agent sees plain input, prepared evidence, core tools, and its own app
context. It does not know which infra APIs, databases, or processes produced the
packet or consumed the result.

## How One Runtime Works For Multiple Apps

The runtime maintains an app registry and creates an isolated scope for every
active instance:

```text
Generic Agent Runtime
  shared: model providers, tool implementations, scheduler engine,
          event/session/workflow engines, UI and transports

  app:release
    package revision: sha256:...
    owner entry: release
    workspace + state namespace + budgets + capability grants

  app:scout
    package revision: sha256:...
    owner entry: scout
    workspace + state namespace + budgets + capability grants

  app:gym
    package revision: sha256:...
    owner entry: gym
    workspace + state namespace + budgets + capability grants
```

Shared engine does not mean shared app context. The runtime must isolate:

- owner prompt, memory, skills, knowledge, and task state;
- workspace roots and write permissions;
- tools and external credential bindings;
- sessions, workflows, event inboxes, schedules, and budgets;
- app data, runtime data, traces, and revision provenance.

Model connections, low-level tool code, the event database implementation, and
the worker process pool may be shared internally. Every record still carries
`appId` and `instanceId`, and every access is checked against that scope.

Root owner IDs are globally unique because they equal globally unique app IDs.
Internal names are app-local, so two packages may both define `reviewer` or
`worker`; the runtime key is qualified:

```text
app:scout    <-> agent:scout
app:release  <-> agent:release
app:scout/agent:worker
app:release/agent:worker
```

Humans normally see the local display name. Routing, persistence, permissions,
and traces use the qualified identity. This is a required change from the
current global agent-name registry, which treats identical internal agent names
in two project apps as a duplicate configuration error.

### Dedicated and shared hosting

Both deployment shapes use the same runtime implementation:

```bash
# Dedicated local instance: start the generic runtime with one app package.
may app start ./apps/scout.app

# Shared host: activate several packages as isolated instances.
may host start --apps-root ./apps
may app activate ./apps/scout.app --host local

# Ephemeral instance for one task or Gym trial.
may app run ./apps/scout.app --propose --task "..."
```

A dedicated process gives stronger OS isolation and simple portability. A
shared host reduces cost and supports common UI, channels, and routing. This is
a deployment decision, not a different app contract.

### Multi-app routing

Every explicit invocation names an app:

```text
CLI/UI/API: app:scout + input
  -> runtime registry resolves package and live instance
  -> app:scout owner entry
  -> app-scoped decision and actions
```

If a human enters through a global May conversation without naming an app, May
is itself a system/deputy app. May interprets the intent and emits one typed
handoff to the selected app. The generic runtime must not use hidden heuristics
to guess a domain owner.

Apps communicate through typed events or capability calls, never by importing
another app's internal workflow or reading its private state:

```text
app:scout owner
  -> typed handoff targeted to app:release
  -> runtime authorization and trace link
  -> app:release owner inbox/entry
  -> typed response linked to the original trace
```

Cross-app access requires an explicit grant and preserves both ownership
boundaries. Internal worker agents remain subordinate to their app and are not
alternate public entry points.

### Parallel agent runs over shared app state

Use the app instance as the state boundary and the agent session as the normal
parallel evaluation boundary:

```text
one app instance
  shared: failure state, task tree, metrics, logs, knowledge, workspace reads

  -> trial-001: private agent session, transcript, result, trace
  -> trial-002: private agent session, transcript, result, trace
  -> trial-003: private agent session, transcript, result, trace
```

This lets several trials diagnose the same real failure without constructing an
artificial empty app instance. Gym sends one explicitly targeted scenario event
to each trial session. No other event producers are connected.

For proposal/diagnostic evaluation, infra prepares a plain diagnostic packet
from the shared failure state before each generation call. Sessions receive the
same state revision plus read-only workspace evidence; they do not query infra
during generation and cannot edit state, resolve the failure, emit production
events, or see another trial's transcript and result.

The report records the app-state revision or observation time used by each
trial. If the live state changes during the batch, that drift is visible; a
point-in-time snapshot can be used when exact reproducibility matters.

An illustrative command is:

```bash
may gym run ./apps/scout.app --trials 20 --concurrency 5
```

This is the preferred way to speed up stochastic evaluation.

Separate app instances remain useful when trials need independent mutable state.
Do not run several executing trials against shared writable state: run them
sequentially or give them snapshots/copy-on-write state. The common diagnostic
case needs neither—it uses one app instance with parallel read-only sessions.

## Why Distinguish App From Agent?

### Can they be the same?

Yes at the level where users form a mental model. No at the level where the
system must enforce behavior.

An agent is a bounded policy execution: identity instructions, model, skills,
context, and tools produce a judgment or action. An app is a durable operating
boundary: it owns ingress, state, events, budgets, permissions, workflows,
capabilities, versioning, and recovery. Their lifetimes and failure modes are
different.

| Question | Owner agent / policy | App / task runtime |
| --- | --- | --- |
| What does this goal mean? | Decides | Does not decide |
| Which preference or guidance applies? | Decides | Supplies recorded context |
| Is worker evidence acceptable? | Decides | Preserves evidence and applies the disposition |
| What survives when no model is running? | Nothing implicit | Events, task tree, traces, workflow/session records |
| Who enforces write scope and approval? | Requests an action | Enforces it |
| Who delivers timers and callbacks? | Reacts when woken | Delivers and records them |
| Who can be evaluated in `propose` mode? | Policy behavior | Isolation and enforcement behavior |
| What can be deterministic and replayable? | Only its input/output contract | Routing, validation, transitions, and capability execution |

If the two are collapsed in implementation, the model must become its own
queue, scheduler, state machine, permission checker, and auditor. That fails
when the process restarts, the model makes a mistake, or the same input produces
a different output. It also makes Gym unable to tell whether a failure came
from the policy, context builder, runtime, or capability.

If the two are exposed as unrelated products, users must choose between “call
the app” and “call the agent,” and routing can bypass the project brain. That is
the confusion visible in the current implementation.

The recommended middle is **one identity with two layers**:

- stable public identity: `app:<id>`;
- semantic implementation: the app's owner policy;
- mechanical implementation: the host-provided app-scoped task runtime;
- optional internal agents: workers or specialist policies, not alternate app
  entry points.

The owner agent may be replaced or versioned without changing the app's public
identity. Traces still record the exact agent/model/prompt/skill revision that
made each judgment.

`app:<id>` is the canonical address for direct and cross-app Agent App ingress.
Domain events may continue to target `project:<id>` and resolve the bound app;
the event envelope keeps both routes explicit instead of guessing from agent
names.

## Terms

| Term | Meaning |
| --- | --- |
| **Agent App** | The public, deployable domain package. It has one accountable owner policy and receives an isolated runtime scope from the host. |
| **Owner policy** | The agent identity and configuration that makes semantic decisions for the app. |
| **Agent host** | The shared May-agent process/library that supplies model execution, sessions, events, workflows, tools, enforcement, persistence, and transports. |
| **Task runtime** | The app-scoped facade the shared host provides over existing events, traces, project state, task tree, sessions, workflows, guards, and evidence. It is not app-owned infrastructure or a new persisted lifecycle. |
| **Capability port** | A typed operation the runtime can validate and invoke: task-tree command, workflow, worker dispatch, event emission, query, human ask, or domain command. |
| **Owner entry** | The first-class context-builder and owner-turn route for input requiring judgment. |
| **Deterministic fast path** | A predeclared runtime/workflow route whose semantics were already decided and whose current execution requires no new judgment. |
| **Proposal** | A structured, read-only owner decision describing intended actions, evidence, risks, verification, and stop conditions. |

“Task runtime” must not introduce a `TaskRun` or generic request record. The
opening event and trace remain the commitment; the task tree remains project
understanding; session and workflow records remain execution attempts.

## Governing Invariants

This proposal preserves the accepted system contracts:

1. No generic request lifecycle beside events, traces, and domain state.
2. Every actionable event has a target or accountable owner route.
3. Delivery acceptance, owner review, typed response, and domain completion are
   distinct.
4. The owner decides project meaning; runtime and workflows remain mechanical.
5. Workflows are bounded synchronous runs. Durable waits persist domain state
   and resume through a later event.
6. Worker completion is evidence; only the owner accepts task meaning.
7. Human input remains `human.input.received` followed by exactly one semantic
   child intent.
8. Proposal quality is evidence about policy judgment, not proof of execution.

## Current Design And Implementation

### Accepted design

The accepted design already says that a project app is a control plane around
a portable domain project, the owner is the project brain, and runtime/app code
must not decide decomposition, acceptance, retry, or project truth. It also
defines `project.owner.requested` as the sole owner wake and permits routine
dispatch from owner-created backlog as mechanical scheduling.

That is compatible with the Agent App model. The missing part is a first-class
contract that makes the owner route the semantic entry and makes deterministic
exceptions explicit.

### SDK surface

`ProjectApp` currently exposes four independent behavior surfaces:

1. schedules that emit events;
2. `workflowHandlers` that bind events directly to a workflow and optional
   agent;
3. named actions;
4. an imperative `onEvent` adapter.

The manifest has `owner?: string`, but it does not declare an owner-entry
workflow, owner context builder, proposal restriction, owner decision schema, or
runtime action ports. `workflowHandlers[].handler.agent` can independently name
an agent, so agent choice and app ownership are only loosely related.

### Loader behavior

The loader already moves toward app-owned agents:

- it discovers agents under the app;
- it infers an owner from explicit configuration, one local agent, or an
  `agents/owner` convention;
- it registers app-local owner and handler agents;
- it installs schedules and workflow handlers on the owner's cron surface.

Ingress, however, has three competing paths:

```text
matching workflowHandlers -> workflow, possibly with a non-owner agent
otherwise onEvent         -> deterministic adapter or no-op
otherwise project event   -> raw fallback owner session
```

The raw fallback calls `runAgent(owner, ownerFallbackTask(...))`; it bypasses an
owner workflow and therefore bypasses the app's normal context builder,
structured output, capability policy, and completion handling. The fallback
also emits an inbox-reviewed signal immediately after starting the session,
before owner judgment has succeeded.

The platform owner workflow has the same lifecycle hazard in another form: it
marks inbox messages, escalations, and signals reviewed before invoking the
owner agent. A failed owner turn can therefore consume the durable input without
producing the promised semantic review. Acceptance or leasing may occur before
the turn; closure must occur only after a valid owner decision is applied.

### Representative apps

The current apps show why both layers are needed:

- `aks-rp-e2e.app` has a strong owner planner but also many direct reviewer,
  worker, loop-controller, and watchdog workflows. Its planner mixes context
  construction, owner judgment, task mutation, capacity refill, dispatch, and
  durable-loop routing in one large workflow.
- `may-agent.app` routes owner wakes through `platform-owner-review`, but its
  `app.ts` contains extensive metric-specific suppression policy. Some of that
  is stable mechanical noise control; some is project strategy that should be
  visible to and testable as owner policy.
- `scout-knowledge-lib.app` combines owner planning with scheduled exploration
  and digest workflows. Exploration of a previously authorized source is a
  good fast path; deciding what knowledge matters remains owner work.

The hybrid is functional, but it makes “what will this app do?” hard to answer.
Behavior is distributed across event selectors, adapters, workflows, fallback
prompts, agent instructions, and broad tool access.

### Current-state scorecard

| Property | Assessment | Evidence |
| --- | --- | --- |
| Portable project plus sibling control plane | Strong | The accepted layout and active apps consistently separate domain workspace from `.app` state and automation. |
| Owner as project brain | Strong in design, partial in code | Owner workflows exist, but direct workflow routes and policy-heavy adapters can bypass or pre-empt owner judgment. |
| One semantic entry | Gap | Explicit handlers, `onEvent`, and raw fallback sessions form three ingress behaviors. |
| Multi-app identity isolation | Gap | App-local agents are loaded into a global name registry, so two apps cannot safely use the same local role names. |
| Deterministic runtime boundary | Partial | Events, workflows, guards, sessions, and task tools are present; typed owner decisions and action ports are not. |
| Durable owner-input handling | Correctness risk | Some paths mark inbox work reviewed before successful owner judgment and follow-up. |
| Session steering | Useful primitive, missing domain bridge | Active, idle, and cold sessions can receive/resume from generic steering, but task revisions and applied action results are not yet mapped into a canonical app/task/session envelope. |
| App-specific start/invoke surface | Gap | The current May process discovers all apps at startup; one-shot and chat modes still select an interface agent rather than an Agent App. |
| Auditable proposal mode | Designed, not implemented end to end | Gym has non-executing v1 cases; runtime-enforced `--propose` behavior and `submit_proposal` remain target work. |
| Human-reviewable benchmark | Good design, transitional implementation | The 12-case suite passes its structural review, while Markdown case authoring and Vitest/HTML reporting remain the intended destination. |
| Independent evaluation | Good boundary, partial operation | `evaluation.app` exists; release governance and preference-label approval still require explicit separation from May. |

## Target Model

### Technical entry versus semantic entry

Every signal technically enters through runtime because runtime must validate,
persist, route, and enforce it. Not every signal needs a model turn.

Every signal that introduces or changes meaning enters semantically through the
owner policy:

- a human goal or correction;
- ambiguous intent;
- planning or reprioritization;
- acceptance or rejection of worker evidence;
- interpretation of failure, retry, blocker, or escalation;
- a preference-sensitive response;
- an unclassified project event.

Known mechanics may bypass an immediate owner turn:

- status/read-model queries;
- persistence and trace projection;
- cancellation already authorized by a human or owner;
- dispatch of an owner-created runnable leaf;
- execution of an accepted plan phase;
- a fixed observer or digest;
- a typed workflow continuation whose meaning was already established.

The result of a fast path wakes the owner if it changes project meaning or
requires judgment.

```text
human goal / ambiguous signal
  -> runtime ingress and durable event
  -> owner context builder
  -> owner policy turn (proposal or normal run)
  -> typed owner decision
  -> runtime validates and applies allowed actions
  -> capabilities / workers / workflows
  -> evidence event
  -> owner acceptance when meaning must change
  -> typed result or human response

known deterministic command
  -> runtime validates declared fast path
  -> capability / workflow
  -> evidence
  -> owner wake only when judgment is required
```

### The fast-path test

A route may bypass an immediate owner turn only when all are true:

1. its input is typed and unambiguous;
2. the owner or human already authorized the semantics;
3. execution is repeatable and bounded;
4. it does not create, accept, reject, reprioritize, retry, or reinterpret
   project work;
5. permissions, budget, idempotency, and terminal behavior are enforceable in
   code;
6. its output is evidence or a mechanical projection, with an explicit rule for
   when to wake the owner.

If any condition is false, route to owner entry. “It is cheaper” or “we already
have a handler” is not sufficient.

## Proposed App Contract

Make the owner entry explicit while retaining compatibility with the current
manifest:

```ts
type AgentApp = {
  id: string;
  version: 2;
  owner: {
    context: string;             // normally ./owner; canonical id derives from app.id
    entry: {
      workflow: string;          // context builder + bounded owner turn
      accepts: EventSelector[];  // normally project.owner.requested
      task: string;
      timeoutMs: number;
    };
  };
  workspace: ProjectWorkspace;
  budget: ProjectBudget;
  schedules: ProjectSchedule[];
  capabilities: Record<string, CapabilityDeclaration>;
  fastPaths?: DeterministicRoute[];
  actions: Record<string, ProjectAppAction>;
  onEvent?: ProjectAppIngressAdapter;
};
```

Recommended rules:

- `owner.entry` is required for a new Agent App.
- The public invocation target is `app:<id>`; its root owner principal is
  `agent:<id>`.
- The app directory name, manifest `id`, and root owner agent ID must match.
- `owner.context` resolves inside the app package and cannot select another
  app's or a global agent definition.
- `owner.entry.accepts` must include the canonical owner-wake selector.
- A handler cannot name an arbitrary semantic agent. Non-owner agents are
  invoked through declared capabilities as workers/specialists.
- `onEvent` remains a bounded normalizer/translator and cannot close semantic
  work.
- Unhandled owned input routes to `owner.entry`; raw owner-session fallback is
  removed after migration.
- Existing `owner: string` and `workflowHandlers` remain v1 compatibility
  inputs. Mismatched legacy owner names produce a migration diagnostic and
  normalize only during the compatibility window.

This is intentionally an app contract, not a new generic agent framework. A
system-level conversational agent such as May can use the same internal
policy/runtime split without pretending it owns a domain project.

## Starting And Invoking An Agent App

Starting/activating an app and invoking its owner are different operations:

- **start** launches the generic runtime with one dedicated app instance;
- **activate** installs an app instance into an existing shared host;
- **invoke** supplies semantic input. It may start an owner turn, select an
  already-authorized fast path, or answer from a deterministic read surface;
- starting or activating an idle app validates the package, recovers its state,
  installs its routes, and does not spend a model turn;
- event producers are attached separately by the deployment; merely loading the
  app emits nothing.

The current May process installs every discovered `projects/*.app` during
daemon bootstrap. A one-shot command selects `--agent`, so there is no direct
way to say “run this app” while preserving its owner workflow and context. The
target CLI should make the app, rather than its internal owner name, the unit of
selection and invocation. These commands are thin modes of the existing May
host; they are not a second agent runtime.

### Proposed command surface

```bash
# Start the generic runtime with one dedicated app. No owner turn is implied.
may app start ./projects/example.app

# Or install the app into an existing shared host.
may app activate ./projects/example.app

# Boot, invoke the semantic entry once, wait for its typed result, then stop.
may app run ./projects/example.app \
  --propose \
  --task "Review the current release plan"

# Invoke an app already hosted by a local or remote runtime.
may app invoke app:example \
  --task "Advance the release safely"
```

`activate --detach` may be an operator convenience for launching the common May
host with only this app selected. It must not create another model loop or app-
specific runtime implementation. UI, HTTP, socket, chat, and SDK clients all
call the same host operation used by `app invoke`.

Suggested behavior:

| Command | Runtime lifetime | Semantic turn | Result |
| --- | --- | --- | --- |
| `app start` | New dedicated host process | None unless later input arrives | Ready/health plus installed app revision |
| `app activate` | Existing shared host | None unless later input arrives | Ready/health plus installed app revision |
| `app run` | One invocation | Owner or declared fast path | Wait for typed result, print proposal/outcome, exit |
| `app invoke` | Existing host | Owner or declared fast path | Return/stream the existing trace and typed result |

The transport response may contain the opening event ID, trace ID, and current
session/workflow evidence. It must not invent an `AppRequest` lifecycle.

### Standalone and infra invocation

A direct run calls the standalone agent contract:

```ts
runAgent({
  app: "example",
  input: "Advance the release safely",
  propose: true,
});
```

It loads the same owner identity and base context but creates no production
event, project task, owner inbox item, or workflow run.

An infrastructure-backed transport calls the hosted boundary:

```ts
invokeApp({
  app: "example",
  actor: "human:hao",
  input: { kind: "text", text: "Advance the release safely" },
  propose: true, // optional; absent means normal execution
  responseMode: "wait" | "stream" | "accepted",
});
```

This object is a transport command, not persisted domain state. Infra normalizes
it into accepted system objects:

```text
human CLI / UI / HTTP / chat
  -> authenticate actor and resolve app:<id>
  -> human.input.received
  -> exactly one project.owner.requested semantic child
  -> configured owner.entry workflow
  -> observation packet + optional proposal restriction
  -> owner decision
  -> runtime validates/applies actions
  -> typed follow-up closes or continues the trace
  -> transport renders proposal, outcome, or accepted trace
```

A typed machine event enters through the same app host but does not need a
synthetic human event:

```text
typed event
  -> validate, persist, and resolve app ownership
  -> declared deterministic fast path, if the six fast-path conditions hold
  -> otherwise project.owner.requested with the opening event linked as cause
  -> the same owner.entry workflow
```

“Unified entry” means both paths load the same app ID, owner identity, base
context, prompt, skills, and core tools. It does not mean a standalone agent
must pass through the infrastructure event pipeline. Hosted execution adds
prepared infra context, authorization, causal trace data, and post-result action
handling.

### Addressing and responses

Callers address `app:<id>`. They do not need to know that the current owner
policy is `tech-lead`, `scout`, or another internal agent. The host resolves:

```text
app:<id>
  -> installed app revision
  -> domain workspace
  -> owner.entry
  -> owner policy revision
  -> allowed capabilities and runtime requirements
```

Human replies are rendered in the owner's voice but attributed to the app, for
example “Scout Knowledge App · owner: scout.” Traces retain both identities so
the app remains stable while the owner policy can change.

`--propose` waits for and returns the proposal because it is a bounded,
read-only judgment. A normal infrastructure-backed invocation may return an
accepted trace immediately for long-running work, with later typed results
delivered through the chosen channel.

## Can It Run Without Infra?

Yes. Running the agent requires the standalone agent runtime, not autonomous
infrastructure.

| Use | What runs | What it provides |
| --- | --- | --- | --- |
| Direct agent run | Agent runtime + app package | Prompt/context, core tools, synchronous work, transcript, result |
| Direct proposal | Agent runtime + app package | Same agent with structurally read-only tools and proposal output |
| Autonomous app | Direct agent plus optional infra bindings | Events, tasks, schedules, metrics, async workers, recovery, multi-app operation |

For a direct run, the runtime starts only:

- app and owner-policy loading with content hashes;
- model-provider access, or a configured local model;
- a local session/transcript and result record;
- the app's base context and core tools;
- capability-policy enforcement, including structural `propose` isolation;
- scoped workspace access;
- typed decision validation and result rendering.

It does not start or require events, tasks, schedules, metrics, async workers,
inbox processing, recovery, cross-app routing, or a shared dashboard.

An app may declare infrastructure bindings for autonomous operation, but those
bindings cannot be prerequisites for loading the owner and answering a direct
request. If an infra-only action is requested during a direct run, the agent
explains what capability is unavailable or proposes the action; it does not
fail to start.

### Offline behavior

Without network infrastructure, deterministic project commands and cached
reads may still work. Owner judgment requires either a reachable provider or a
local model. An unavailable model must produce a visible blocked result linked
to the opening trace; the runtime must not pretend that deterministic fallback
logic is equivalent to the owner policy.

### Packaging boundary

Portability requires two independently useful artifacts:

```text
project/       domain code, tests, data, and native commands
project.app/   owner policy, runtime declaration, workflows, task state,
               schemas, and capability adapters
```

Moving or packaging them together preserves the app definition. Keeping the
project usable alone preserves the existing domain-portability goal. A
distribution may include the common May host binary beside the app for
convenience, but the app does not own or fork that runtime. Runtime state,
credentials, and deployment-specific endpoints remain outside the committed
app definition.

### Owner entry workflow

The owner entry workflow should do only four things:

1. build a compact, provenance-bearing observation packet;
2. invoke the owner policy with its capability catalog and optional proposal
   restriction;
3. validate and apply the returned decision through runtime ports;
4. emit the typed follow-up and close consumed inbox work after successful
   application.

It must not embed project strategy in TypeScript. Context selection, truncation,
deduplication, leasing, dispatch draining, and event emission are mechanics.
Choosing goals, task decomposition, acceptance, retry meaning, and response
content are policy.

For reliability, owner input should move through:

```text
open -> accepted/leased -> owner decision submitted -> actions applied
     -> typed follow-up emitted -> reviewed/closed
```

Failure before the typed follow-up leaves the item retryable and visible.

## Owner Decisions And Runtime Ports

### Structured decision

The owner should return a typed decision rather than relying on transcript prose
or unrestricted mutation as the only observable behavior:

```ts
type OwnerDecision = {
  schemaVersion: 1;
  understoodIntent: string;
  evidence: Array<{ ref: string; claim: string }>;
  assumptions: string[];
  questions: string[];
  constraints: string[];
  actions: OwnerAction[];
  expectedOutcome: string;
  stopConditions: string[];
  responseToHuman?: string;
};
```

This records concise decision rationale and evidence. It must not request or
expose private chain-of-thought.

### Capability ports

`OwnerAction` should be a tagged union over app-declared ports, for example:

- `task.create`, `task.update`, `task.assign`, `task.accept`, `task.block`;
- `capability.invoke` for a declared workflow or domain command;
- `worker.assign` for one bounded owner-created leaf;
- `event.emit` for a declared typed event;
- `human.ask` or `owner.escalate` across an ownership boundary;
- `project.respond` or `decision.noop`;
- `plan.create`, `plan.adjust`, or `plan.cancel` when the existing project
  design uses an owner-written execution plan.

The runtime validates scope, preconditions, budget, approval, idempotency key,
and expected evidence before application. Each applied action records the
decision ID and action ID in its trace. Direct file/code mutation may remain an
explicit bounded capability, but should not be an invisible side effect of the
owner turn.

Typed decisions need not force every low-level tool read into the schema.
Queries and evidence gathering remain transcript-visible observations. The
schema captures consequential intent and actions.

## Proposal Runs

`propose` is not a second “plan model.” It is the same owner policy, prompt,
skills, context builder, and app knowledge under a different runtime-enforced
capability policy.

| Concern | `--propose` | Normal run |
| --- | --- | --- |
| Reads and bounded queries | Allowed | Allowed |
| `submit_proposal` / decision output | Required exactly once | Required or recorded by action tools |
| Task/file/state mutation | Denied | Allowed only through declared ports |
| Worker/agent dispatch | Denied | Allowed by policy and budget |
| External messages/deployments | Denied | Approval and port dependent |
| Disallowed attempt | Safety-gate failure | Runtime denial and audit finding |

The human-facing name may be “proposal” or “preview.” Do not infer safety from
a sentence in the prompt; tool and port availability must make proposal runs
structurally read-only.

An accepted proposal can later accompany a normal run as evidence, but it
does not become a parallel work lifecycle. Significant execution actions should
reference proposal step IDs. A deviation is allowed when new evidence justifies
it, but the runtime records the changed action and reason.

## Event Sources Define Autonomy

An Agent App is reactive. Loading it registers its owner, context, tools,
workflows, and event consumers, but does not invoke the owner. No event means no
work: the agent simply waits.

Autonomy comes from the event sources connected to the instance:

```text
production instance
  <- human/API input
  <- schedules
  <- metrics/watchdogs
  <- callbacks/webhooks
  <- inbox/recovery events

Gym instance
  <- one scenario input
```

This does not require an activity mode or runtime profile. The deployment or
test harness controls which event producers are attached.

For Gym:

1. bind the trial to either a fixture state or a read-only view of an existing
   app state containing the condition under diagnosis;
2. register no production schedules, metrics, webhooks, inbox replay, or
   recovery producers;
3. emit exactly one scenario input, normally through the canonical human-input
   to owner-entry route;
4. observe the owner result, transcript, proposal, and attempted actions;
5. deliver no further autonomous input and dispose of the instance.

Before and after the scenario event, the owner is idle. Pending production
events are not delivered into the trial, even when the trial reads live app
state.

`--propose` remains an optional restriction on the scenario turn when Gym wants
read-only judgment. It prevents the agent from creating side effects or
starting additional work. Without `--propose`, one input may legitimately
produce follow-up events and synchronous actions, so the benchmark must state
what trajectory it is evaluating.

`may app run` is only a convenience that creates an isolated instance, sends
one explicit input, waits for its result, and disposes it. `may app start` or a
shared host keeps an instance available and connects whatever event sources the
deployment declares. The agent semantics do not change.

## Gym And Evaluation Model

The policy/runtime split gives Gym a clean experimental model:

```text
scenario initial state + semantic input
  -> owner observations
  -> owner decision/proposal
  -> runtime-applied actions
  -> capability outcomes/evidence
  -> final owner judgment
  = trajectory
```

Evaluate layers separately before claiming the Agent App works:

| Level | Subject | Test shape | Main question |
| --- | --- | --- | --- |
| 0 | App contract | Static/lint tests | Is there one owner entry and are fast paths declared safely? |
| 1 | Owner policy | `propose` scenario with fixed snapshot | Did it understand intent, guidance, ownership, risk, and verification? |
| 2 | Runtime enforcement | Synthetic decision into test runtime | Are denied actions blocked and allowed actions applied exactly as declared? |
| 3 | App integration | Real context builder and event graph with fake capabilities | Does semantic input reach owner; do known mechanics avoid unnecessary owner turns? |
| 4 | Execution fidelity | Accepted proposal followed by bounded execution | Did actions follow the proposal, adapt visibly, produce evidence, and stop? |
| 5 | Longitudinal behavior | Multi-turn/multi-session replay | Is guidance learned, retrieved, superseded, and applied later? |
| 6 | End-to-end outcome | Sandboxed real capability run | Did the app actually reach the intended domain outcome? |

Level 1 is the right first benchmark for May preference alignment. It is cheap,
auditable, and isolates policy judgment. It is not sufficient evidence for
Levels 2–6.

### Infrastructure-decoupling conformance suite

Keep these cases separate from May preference scoring. They test the adapter
and runtime boundary, not whether May understood Hao:

| Case | Required observation |
| --- | --- |
| Standalone direct request | Useful owner judgment with no task/event/metric services present |
| Materialized drill-down | Agent finds detailed evidence beyond `summary.md` using only core local tools |
| Unexpected evidence | Declared request executes externally; result returns to the same session through steering |
| External task mutation | Only the linked open/suspended turn receives the revisioned delta |
| Agent-requested mutation | Commit or conflict is steered back before owner verification |
| Missing capability | Agent reports the limitation and useful next step without startup failure or fabrication |
| Fixed proposal trial | No production producer or unsolicited steering enters the trial |

The report must show the initial context manifest, capability-catalog hash,
attached producers, ordered generation/action/steering timeline, state
revisions, and final result. A failure here is classified as runtime, adapter,
or infrastructure—not as an alignment regression.

### Scenario and report organization

Use the human-review design in
`/app/projects/gym/benchmarks/may-alignment/HUMAN-REVIEW-DESIGN.md`:

- one Markdown case per stable case ID and version;
- suites grouped by capability like unit-test `describe` blocks;
- base case, paraphrases, and opposite controls adjacent;
- Request and Context visible to the owner; labels and reviewer rationale
  hidden;
- Vitest-style console output for triage;
- HTML detail for blind review, expected-label reveal, evidence, transcript,
  and append-only adjudication.

The current twelve `may-align-*` directory scenarios and
`alignment-decision.json` schema are a useful executable v1. They should be
treated as a migration source, not the final authoring model, because the
proposed human-review design uses Markdown cases and the richer shared proposal
schema. Do not maintain two permanent scenario formats or two proposal schemas.

### Dataset splits

- **Practice:** visible synthetic cases used while developing prompts and
  runtime behavior.
- **Regression:** approved cases run on every candidate revision.
- **Replay:** redacted real Hao interactions, labeled after the fact.
- **Hidden holdout:** cases and labels unavailable to prompt authors and to the
  agent-visible workspace.

Run multiple trials for policy tests because model behavior is stochastic.
Safety/control gates require perfect performance; preference and quality
dimensions report macro rate plus per-case flakiness. Never hide a hard safety
failure inside an aggregate score.

### Provenance

Every result must record a version tuple sufficient to reproduce or explain it:

```text
app manifest/runtime revision
owner agent instructions + model/provider + skills revision
context-builder revision
scenario ID + version + fixture hash
proposal/decision schema version
scorer version
capability/workflow revision for execution tests
```

Without this separation, a prompt regression, stale packet, router bug, runtime
denial, and scorer error all look like “the app failed.”

### Start with the Gym project

Gym begins as a normal portable project, not an Agent App:

```text
projects/gym/
  runner and adapters
  cases and fixtures
  schemas and scorers
  reports and append-only human reviews

Hao/CI             invokes runs and approves preference-sensitive ground truth
optional evaluator interprets results under separate governance
```

This is sufficient for authoring, CLI/CI execution, comparison, reporting, and
human review. It also ensures that any conforming Agent App can be evaluated
without first loading an autonomous Gym owner or the May infrastructure.

Do not create `gym.app` initially. Add it later only if Gym needs recurring
autonomous operation such as scheduled regressions, review-queue preparation,
benchmark-health monitoring, or proposing cases from real failures. If added,
it is an optional operator over `projects/gym/`: it invokes the project through
declared capabilities and never becomes a dependency of the runner, scorer,
case format, or report reader.

Whether operated by a human, CI, or a future app, the evaluated agent must not
own its labels, scorer, adjudication, or release decision. May can consume
findings and improve; May must not certify herself. A separately governed
evaluator may assist review, but it is not required to start the Gym project.

## Migration Plan

### Phase 0 — Accept terminology and boundaries

- Approve “one product identity, two internal layers.”
- Define semantic-entry and fast-path tests in accepted design.
- State explicitly that task runtime is a facade, not a new lifecycle.

### Phase 1 — First-class owner entry

- Add a backward-compatible owner-entry declaration to the SDK.
- Normalize v1 `owner: string` plus its canonical owner workflow into the new
  internal registration.
- Derive the root owner principal from `app.id`; validate directory/app/owner
  equality and migrate current mismatches while preserving display names and
  roles.
- Key agents, sessions, workflows, events, state, and budgets by `appId` plus
  `instanceId`; allow the same local agent role name in different apps.
- Add `target.app` for direct and cross-app ingress; preserve `target.project`
  for domain events and resolve it to the bound app explicitly.
- Add one `invokeApp` host operation and app-specific `activate`, `run`, and
  `invoke` CLI commands as thin modes of the existing host.
- Add one-app `run` behavior to the existing runtime; do not build another
  agent loop, tool engine, or deployment framework.
- Route unhandled owned events through the configured owner entry.
- Remove raw fallback sessions only after every active app has an owner entry.
- Attribute public invocation to `app:<id>` while preserving exact policy
  provenance.

### Phase 2 — Correct owner-input lifecycle

- Separate inbox acceptance/lease from reviewed/closed.
- Close only after a valid owner decision is applied and a typed follow-up is
  emitted.
- Make failure retryable without duplicate application.
- Add tests for owner timeout, invalid decision, runtime denial, duplicate
  delivery, and restart between decision and follow-up.

### Phase 3 — Structured decisions and `propose`

- Reuse one proposal schema for production preview and Gym.
- Add the runtime-enforced `--propose` restriction to bounded owner invocation.
- Add runtime-enforced proposal capability policy and `submit_proposal`.
- Record decision/action IDs in traces.
- Migrate the twelve alignment cases into the approved Markdown format and
  Vitest/HTML reporter path.

### Phase 4 — Capability ports and fast paths

- Define the versioned context manifest and read-only projection adapter.
- Pass capability declarations and availability as plain input data; do not
  pass infrastructure clients into the agent.
- Connect committed task mutations and capability results to linked sessions
  through revisioned steering.
- Continue the same owner session after externally executed requests, with
  action-count, time, token, conflict, and duplicate-request bounds.
- Inventory each app handler as `owner-entry`, `deterministic-fast-path`, or
  obsolete/duplicate.
- Move strategy out of large adapters and owner workflows into owner policy or
  explicit owner-authored plan data.
- Keep packet building, validation, dispatch draining, and evidence collection
  deterministic.
- Split oversized owner workflows so policy invocation is easy to test in
  isolation.

### Phase 5 — Execution fidelity

- Apply accepted owner actions through typed ports.
- Link execution traces to proposal/decision action IDs.
- Evaluate policy, runtime enforcement, integration, and outcome separately.
- Add longitudinal preference replay and, when useful, independently governed
  evaluator review.

## Acceptance Tests

The model is ready to promote into accepted design when these tests pass:

1. A human goal addressed to `app:<id>` reaches exactly one owner entry.
2. An unhandled project event uses the same context builder and decision
   contract as a normal owner wake; no raw fallback prompt exists.
3. A deterministic observer runs without an owner turn and cannot mutate task
   meaning.
4. Worker completion cannot mark a task `done` without owner acceptance.
5. An owner-session failure leaves its inbox input visible and retryable.
6. Duplicate event delivery does not duplicate applied owner actions.
7. A `propose` run cannot mutate files/state, dispatch agents, or send messages,
   even if the policy attempts it.
8. The same scenario can run against two owner-policy revisions with the
   runtime and fixture held constant.
9. An accepted proposal's execution trace identifies followed steps and visible
   deviations.
10. The report identifies case, trial, failed dimension, evidence, policy
    revision, runtime revision, and infrastructure errors without transcript
    archaeology.
11. A durable wait ends its current workflow and resumes from a later event; no
    Agent App introduces a generic request/task-run state machine.
12. Gym labels and release judgment remain outside the evaluated app's control.
13. Activating an app without input installs and recovers it without invoking
    the owner model.
14. CLI, UI, HTTP, socket, and chat invocations resolve the same app revision,
    owner entry, proposal restriction, and trace behavior.
15. A local `app run --propose` result matches the managed host when
    policy, model, context, fixture, and runtime contract versions are fixed.
16. A host missing a required runtime capability rejects the app at preflight;
    it never silently disables an enforcement guarantee.
17. Two active apps can both declare internal `agent:reviewer` and
    `agent:worker` roles without prompt, state, session, event, permission, or
    budget collisions.
18. App directory basename, manifest ID, and root owner agent ID are equal; a
    mismatch prevents activation outside the explicit legacy migration path.
19. A Gym run boots no production task, event, metric, schedule, or worker
    service while preserving the production owner context contract.
20. Reports never treat a Gym run pass as evidence of background app
    operation or final execution success.
21. Loading an app with no connected event producers invokes no agent turn and
    consumes no model or session budget.
22. Gym connects only its scenario source; schedules, metrics, webhooks, inbox
    replay, and recovery cannot inject additional turns into the trial.
23. Parallel diagnostic trials can share one app's read-only failure state while
    keeping sessions, transcripts, results, and traces isolated.
24. Every shared-state trial records its observation revision/time, and no
    executing trial can mutate shared state concurrently.
25. A direct owner request still produces a useful judgment when tasks, events,
    metrics, schedules, workers, recovery, and shared context services are
    absent.
26. A hosted diagnosis can drill from the compact summary into indexed evidence
    using only core read/search/local-query tools.
27. A relevant task mutation resumes exactly the linked open or suspended owner
    turn through steering, with old/new revisions and evidence references.
28. An owner-requested task mutation is applied outside generation and its
    committed result or revision conflict is steered into the same session
    before owner verification.
29. An unavailable infra-only capability produces a useful limitation or
    proposal, not startup failure or fabricated evidence.
30. A concurrent mutation is observed only at a safe turn/tool boundary; an
    urgent stop uses cancellation and leaves an auditable steering record.

## Risks And Controls

| Risk | Control |
| --- | --- |
| Owner becomes a costly bottleneck | Use the explicit fast-path test; batch compact owner packets; execute owner-authored plans mechanically. |
| “Agent is the entry” causes every event to invoke a model | Distinguish technical ingress from semantic entry; status, projection, and authorized mechanics remain runtime-only. |
| Runtime code quietly accumulates strategy | Require every fast path to state prior authorization and owner-wake conditions; review adapters as policy leakage. |
| Structured decisions become rigid or verbose | Keep the schema focused on consequential judgment and actions; allow evidence reads and low-level mechanics outside it. |
| Model proposes safe work but executes differently | Evaluate execution fidelity separately and link actions/deviations to proposal steps. |
| Gym overfits visible cases | Use paraphrases, opposite controls, real replays, multiple trials, and hidden holdouts. |
| Agent grades itself | Keep cases, scorers, reviews, and release gates outside the evaluated app; require human approval for preference-sensitive ground truth. |
| App and owner versions become impossible to diagnose | Record the complete version tuple and score policy/runtime/capability layers separately. |
| New “task runtime” duplicates task/session/workflow state | Define it only as a facade over existing sources of truth; prohibit a generic TaskRun lifecycle. |
| Local and managed hosts behave differently | Use the same runtime implementation, share conformance tests, record host versions, and fail closed on missing required capabilities. |
| “Runs without infra” is interpreted as “runs without enforcement” | State that only the domain project is runtime-free; local Agent App execution still uses the common agent runtime and preserves authorization, trace, and proposal-isolation contracts. |
| A diagnostic evaluation wakes or changes production work | Connect only targeted scenario events, enforce read-only proposal tools, and fail on undeclared events or state mutation. |

## Rejected Alternatives

### Fully collapse app into an agent process

This is simple only while the process is alive. It loses deterministic safety,
durable waits, replayable routing, independent enforcement, and useful failure
attribution.

### Keep app and agent as separate public entry points

This preserves implementation boundaries but gives callers two ways to express
the same intent. It encourages bypassing owner context and recreates today's
hybrid routing ambiguity.

### Route every event through the owner model

This maximizes conceptual purity but wastes budget, increases latency and
nondeterminism, and turns the owner into a scheduler. Owner-authorized mechanics
should remain mechanical.

### Treat a proposal as a new durable work object

This would create another lifecycle beside events, traces, domain plans, tasks,
sessions, and workflows. Store the proposal as decision evidence linked to the
existing trace; use a domain-specific owner-authored execution plan only when
the project needs durable goal-directed state.

## Recommended Next Decision

Approve the conceptual boundary before changing loaders:

> An Agent App is the public unit. Its owner agent is the semantic entry and its
> durable task runtime is the enforcement/execution boundary. They share one
> app identity but retain separate, versioned policy and runtime components.

If accepted, the smallest implementation slice is Phase 1 plus the owner-input
lifecycle tests from Phase 2. That removes the raw fallback inconsistency and
gives every later Gym and `propose` improvement one stable entry to evaluate.
