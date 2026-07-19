# Proposal: Agent App and Optional Autonomy Boundary

**Design status:** Accepted.
**Implementation status:** Implemented, deployed, and restart-validated with
the convention-first task reconciler active in production.
**Identity migration status:** Deferred. This proposal does not rename any app
or agent and does not require app IDs to equal owner-agent IDs.

## Review at a Glance

| Decision | Proposal |
|---|---|
| What is an agent? | An independently runnable identity with instructions, capabilities, skills, and workflows. |
| What is an Agent App? | A package containing one current root owner, optional supporting agents, domain context, and app-owned data. |
| What is a workflow? | Reusable experience: a learned, repeatable process owned by one agent. |
| Where do workflows live? | Under the agent that owns the experience, never at the app root. |
| Are tasks required? | No. Kubernetes-style task reconciliation is an optional autonomous-runtime attachment. |
| What does infrastructure add? | Durable sessions, events, schedules, tasks, metrics, recovery, projections, and interfaces. |
| What does Gym run? | The same prepared agent execution used by production, without attaching autonomous infrastructure. |
| Are identities renamed now? | No. Existing `app.id -> owner` mappings remain valid during this work. |

**Requested review decision:** approve, revise, or reject the boundary between
independent agent execution, the Agent App package, and optional autonomous
infrastructure. Identity naming is deliberately outside this decision.

## Context

May-agent previously had two useful designs that were too tightly combined:

1. an agent runtime that can reason and act with a model, prompt, and tools;
2. a durable event-driven task reconciler with queues, attempts, Conditions,
   recovery, and stale-result protection.

The reconciler is valuable for autonomous apps, but its types and lifecycle
were mandatory parts of `ProjectApp`. One-shot and Gym execution also assembled
much of the daemon before starting an agent. App-root workflows made process
ownership ambiguous and permitted app execution to bypass the accountable
agent.

This proposal makes the task reconciler optional and places workflows under
agents while preserving the current production identities and reconciliation
semantics.

## Governing Model

```text
Agent
  = identity + instructions + capability selection + skills
    + reusable learned workflows
  = independently runnable

Agent App
  = current root owner agent + optional supporting agents
    + domain context + app-owned data + optional host declarations

Autonomous infrastructure
  = optional durable sessions + events + schedules + task reconciliation
    + domain watchers + metrics + recovery + projections + interfaces

Domain project
  = portable source, artifacts, and domain state operated on by the app
```

The same agent execution sits under every use case:

```text
human input ---------------------------> prepared agent run -> result
Gym scenario --------------------------> prepared agent run -> evidence
event -> optional task runtime --------> prepared agent run -> state update
event -> agent-owned workflow ---------> prepared agent run(s) -> state update
```

An Agent App does not become capable because infrastructure is running.
Infrastructure makes it autonomous, durable, observable, recoverable, and
connected.

## Invariants

1. One model/tool execution implementation serves direct, Gym, session,
   workflow, and autonomous use.
2. Loading an app package does not by itself start model work.
3. Direct execution does not require EventBus, SQLite, task state, schedules,
   metrics, or a daemon.
4. Autonomous work happens only after an explicitly attached producer such as
   a human input, event source, schedule, recovery source, or task resync.
5. Tasks and task reconciliation are optional.
6. Every workflow belongs to one agent and executes with that agent's identity,
   context, and capability policy.
7. Infrastructure may observe and persist agent execution but is not imported
   by the execution core.
8. Session files remain authoritative when durable sessions are enabled;
   SQLite remains a bounded projection.
9. Task reconciliation remains level-based and idempotent when attached.
10. Current app and agent names remain unchanged until a separate identity
    proposal is approved.

## Identity Is Explicitly Deferred

The current mappings remain valid:

```text
may-agent           -> tech-lead
evaluation          -> evaluator
aks-rp-e2e          -> app-ops
scout-knowledge-lib -> scout
gym                 -> gym
```

This proposal keeps `app.owner` and all existing runtime addresses. It does
not:

- rename apps;
- create same-named root agents;
- add permanent aliases;
- change globally unique agent-name requirements; or
- introduce app-qualified supporting-agent identities.

Those questions matter, but combining them with the execution/autonomy
boundary would enlarge the migration and make review harder. A later identity
proposal may evaluate same-name ownership and app-local namespacing after this
boundary is working.

## Agent Ownership

An agent owns behavior that changes how it reasons or performs work:

- identity and stable instructions;
- private context and knowledge routing;
- tool/capability selection;
- skills;
- reusable learned workflows; and
- agent-specific evaluation expectations.

Tools may be implemented by local code, infrastructure adapters, or remote
services. The agent execution core sees only the supplied capability contract.

### Workflow ownership

A workflow is reusable experience: an explicit process an agent has learned
well enough to repeat. It is a capability of its owning agent, not app
orchestration. The app may bind a task to that capability; it does not own or
execute the workflow itself.

The canonical workflow location is:

```text
projects/<app>.app/agents/<agent>/workflows/<name>.ts
```

Standalone agents retain:

```text
agents/<agent>/workflows/<name>.ts
```

Rules:

1. A workflow has exactly one owning agent.
2. It uses that agent's prompt, tools, skills, guards, and context paths.
3. It may call supporting agents, but orchestration ownership remains with the
   workflow owner.
4. Workflow names need only be unique inside the owning agent.
5. Shared deterministic functions may live in normal libraries; they are not
   independently discoverable workflows.
6. New code does not discover `projects/<app>.app/workflows/`.

For a reconciled task, execution resolves as:

```text
resolved agent = task.owner ?? nearest parent owner ?? app.owner

task.workflow exists
  -> <resolved-agent>/workflows/<task.workflow>.ts

task.workflow absent
  -> run resolved agent directly
```

In both paths there is one handler: the resolved agent. A workflow only tells
that agent which reusable process to apply. The task does not need a separate
workflow registry or app-root workflow map.

## Agent App Package

The existing `app.ts` remains the package manifest for this proposal. It is not
removed or renamed. The manifest becomes capable of describing a non-autonomous
app by making host features optional.

Illustrative contract:

```ts
type AgentApp = {
  id: string;
  version: 1;
  owner: string; // retained until identity migration is separately decided
  description: string;
  workspace?: WorkspaceBinding;

  budget?: RuntimeBudget;
  schedules?: ScheduleDeclaration[];
  tasks?: TaskAttachment;
  events?: EventSelector[];
  actions?: Record<string, AppAction>;
  onEvent?: AppObservationHandler;
};
```

Only `id`, `version`, `owner`, and the information required to locate the
owner's execution context are fundamental. Runtime budgets, schedules, tasks,
event observations, and actions describe optional hosting behavior.

Supporting agents remain app-local where they are today. This proposal does not
change their naming or registration behavior.

## Context Contract

Direct and hosted execution must prepare the same agent-visible context.

The agent owns its identity and private context. The app owns domain data and a
workspace binding. Infrastructure may prepare a task/event packet, but it does
not inject a private context API into generation.

At the start of a run, shared preparation resolves:

- the agent definition and instructions;
- its tool and skill catalog;
- agent and app paths;
- the bound domain workspace;
- explicit caller input; and
- optional task/event context supplied by the caller.

Additional evidence is discovered through normal supplied tools or delivered
to an active run through steering. The initial prompt should not dump the
entire app state.

No new mandatory context file is introduced by this proposal. Existing agent
instructions and explicit context-file conventions remain authoritative until
a separate context-layout decision is required.

## Execution Layers

### 1. Agent execution core

```text
model + prepared prompt/context + supplied tools
  -> model/tool loop
  -> result + neutral runtime observations
```

The core must not import:

- EventBus;
- SQLite or database helpers;
- session persistence;
- projects or task resources;
- schedules or metrics; or
- recovery services.

`agent-runner.ts` is the infrastructure-neutral model/tool loop.
`agent-execution.ts` owns shared prompt, tool, skill, guard, completion, and
compaction preparation. Direct, Gym, and durable callers now reuse those same
functions; `SubagentManager` only adds durable-session infrastructure around
them.

### 2. Optional durable session runtime

The session wrapper may add:

- session identity and lineage;
- incremental transcript persistence;
- `meta.json` and result artifacts;
- steering and cancellation handles;
- compaction snapshots;
- resume and crash recovery; and
- neutral lifecycle callbacks.

It does not write SQLite or import EventBus. The app adapter translates
lifecycle callbacks into system events, and the existing event projection path
updates SQLite.

### 3. Optional autonomous host

The host may attach:

- event consumers and producers;
- domain watchers;
- schedules;
- task reconciliation;
- recovery and bounded resync;
- metrics and alerts;
- HTTP, socket, terminal, and Telegram adapters; and
- database projections.

An attachment is explicit. A direct or Gym run does not first install every
app, controller, watcher, recovery source, and schedule.

### Watchers are observers, not workflows

A watcher reconciles an external or infrastructure-owned resource and emits a
semantic observation:

```text
pipeline/service/provider state
  -> app or infrastructure watcher
  -> semantic event
  -> Condition tracker
  -> task key
```

Watchers own provider APIs, polling, retries, and replay of current external
state. They do not invoke an agent, encode a learned process, know task IDs, or
mutate task storage. A workflow may start external work and then return an
exact Condition; the watcher independently reports the observed result.

Task resync recovers task delivery and satisfied-Condition wakeups. It never
treats Condition age as truth or substitutes a task handler for the watcher.

## Direct, Gym, and Hosted Use

### Direct execution

```text
load one app manifest
  -> resolve its existing owner mapping
  -> load that agent and shared execution preparation
  -> run
```

The final CLI spelling is not decided here. A future command may resemble
`may app run <id>`, but this proposal specifies behavior rather than syntax.

Direct execution creates no task controller, EventBus, database, scheduler, or
app watcher. Durable session output may be an explicit caller choice, not an
implicit requirement of agent capability.

### Gym execution

Gym uses the same app/agent resolution and execution preparation as direct and
hosted runs. It supplies sandbox tools and records neutral observations for
evaluation. It does not launch the complete daemon merely to obtain an agent
response.

Separate integration scenarios may deliberately attach durable sessions or the
task runtime when those mechanisms are the subject under test.

### Hosted autonomous execution

```text
load app package
  -> attach selected producers/consumers
  -> optional event creates or wakes task
  -> task runtime invokes resolved owner or owner-owned workflow
  -> validate result
  -> atomically update task state
  -> emit lifecycle evidence and projections
```

Recovery and resync are event producers in this model. They run only when the
autonomous task attachment is enabled.

## Optional Kubernetes-Style Task Runtime

The existing reconciliation model remains appropriate for durable autonomous
work:

- desired `spec` and observed `status`;
- `generation`, `observedGeneration`, and `resourceVersion`;
- one deduplicating key queue per attached app;
- bounded concurrent attempts;
- idempotent level-based reconciliation;
- typed Conditions for exact external waits;
- stale-result rejection;
- recovery and bounded resync; and
- completion receipts for finite work.

These mechanics move out of the fundamental Agent App contract into an
optional task-runtime contract. Conceptually:

```text
agent-app.ts
  identity, workspace, optional host declarations

task-reconciliation.ts
  task resources, Conditions, attempts, actions, queue/controller contract
```

An app without `tasks`:

- does not create `.state/tasks`;
- does not install a task controller;
- does not run recovery or resync;
- does not need task resource types; and
- can still run its owner and agent-owned workflows directly.

Events remain wake-up hints. Persisted task and Condition state remains the
level-based source used by the reconciler.

## Migration Plan

Each phase is separately reviewable. Identity renaming is absent from every
phase.

### Phase 1: Characterize shared execution

- Add parity tests for prompt, tools, skills, guards, completion, steering,
  cancellation, and compaction.
- Keep production behavior unchanged.

### Phase 2: Complete the reusable agent boundary

- Keep the neutral Pi runner.
- Extract infrastructure-independent agent preparation from the manager.
- Export a direct execution API.
- Make the durable manager/session path call that API.

### Phase 3: Add direct app loading

- Load one requested app and its current owner without installing all apps.
- Do not create EventBus, SQLite, watchers, schedules, recovery, or task
  controllers.
- Preserve current app and owner names.

### Phase 4: Make autonomy attachments optional

- Make tasks, schedules, budgets, events, and actions optional in the app type.
- Install the controller only when a hosted app declares tasks.
- Start recovery/resync only as part of that attachment.
- Validate an app containing only its owner and workspace.
- Discover and install app watchers only in the autonomous host.

### Phase 5: Move workflows to agents

- Move app-root workflows to their accountable agents.
- Resolve task workflow names relative to the resolved agent.
- Remove `projectWorkflowDir` and app-root workflow discovery.
- Delete app-root workflow discovery after migration; do not keep a
  compatibility resolver.

### Phase 6: Move Gym to direct execution

- Reuse the production preparation path.
- Stop launching the full daemon for ordinary behavior trials.
- Retain explicit integration suites for session and task infrastructure.

### Phase 7: Separate public contracts and documentation

- Split Agent App and task-reconciliation SDK types.
- Promote the accepted portions of the task model into Tier 2 design.
- Update system model, architecture, workflows, runtime, storage, projects,
  manuals, and README.
- Remove duplicate design locations and stale app-root workflow guidance.

## Acceptance Criteria

1. An existing app owner runs directly with no EventBus or SQLite database.
2. Direct execution creates no task tree unless explicitly requested.
3. A minimal app with no tasks or schedules validates and runs.
4. Loading a package alone starts no model work or autonomous producer.
5. Direct, Gym, and durable execution use the same prompt/tool preparation and
   neutral runner.
6. The execution core has an enforced import boundary from infrastructure.
7. Durable sessions still persist incrementally and recover after interruption.
8. Every discoverable workflow lives under one agent.
9. A task workflow resolves under the task's resolved owner agent.
10. Apps without task attachment do not construct queue/controller/recovery or
    resync machinery.
11. Apps with task attachment preserve current generation, Condition, attempt,
    stale-result, concurrency, and receipt behavior.
12. Existing app IDs, owner names, event targets, and session attribution remain
    unchanged throughout this migration.
13. An unknown external Condition remains waiting until its watcher emits an
    observation; task resync does not poll the external source.
14. A watcher emits semantic events without importing or addressing task-tree
    resources.

## Non-Goals

- Renaming apps or agents.
- Enforcing app ID equals owner-agent ID.
- Introducing app-qualified agent names.
- Replacing EventBus in the autonomous host.
- Removing durable sessions or task reconciliation.
- Rewriting the task reconciler.
- Changing task-state semantics during boundary extraction.
- Creating a second model loop for direct or Gym execution.
- Adding profiles or a `standalone: true` branch inside the manager.
- Changing the domain workspace layout.
- Redesigning HTTP, Web UI, terminal, metrics, or Telegram.

## Relationship to Existing Documents

If accepted, this proposal changes the interpretation of several documents:

- `2a-design/system-model.md` should lead with independent agent capability and
  optional autonomy.
- `2a-design/project-app-v3.md` should become the Agent App package contract,
  with task fields optional.
- `3-proposals/app-task-reconciliation-model.md` remains the detailed task
  runtime basis but no longer defines every Agent App.
- `2a-design/task-tree-engine.md` remains the internal task-runtime contract.
- `2a-design/workflows.md` must make workflows exclusively agent-owned.
- `2a-design/runtime.md` and `2a-design/storage.md` must distinguish direct
  execution from optional durable wrapping.
- `README.md` must stop presenting `SubagentManager` as the agent capability
  boundary.

This proposal does not become authoritative merely by being written. After
human approval, accepted decisions must be promoted into Tier 1/2 documents;
this file then remains migration rationale.

## Review Questions

1. Is an independently runnable agent the correct smallest capability unit?
2. Is `app.ts` an acceptable retained manifest while its infrastructure fields
   become optional?
3. Is workflow ownership unambiguous when resolution is relative to the task's
   resolved owner?
4. Which production paths, if any, truly require task reconciliation for every
   loaded app?
5. Does direct execution need optional durable sessions initially, or should
   that follow after the no-infrastructure path works?
6. Which app-root workflows cannot be cleanly assigned to one existing agent,
   and why?
7. Are current task reconciliation guarantees fully covered by tests before
   making attachment optional?
8. What evidence should be required before a separate identity-renaming
   proposal is considered?
