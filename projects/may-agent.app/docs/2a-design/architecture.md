# May-Agent Architecture

**Design status:** Accepted.
**Implementation status:** Canonical App ownership and authoring core are
implemented; legacy Project App hosting and work authorities are being deleted.

May-agent is an Agent App host. Apps own durable requests and desired outcomes;
agents provide judgment; workflows preserve repeatable bounded processes; and
infrastructure supplies admission, delivery, scheduling, reconciliation,
execution, recovery, and observation.

Read [system-model.md](system-model.md) first for the compact mental model and
[system-boundary.md](system-boundary.md) for responsibility boundaries.

## Core flows

```text
addressed request
  -> App inbox
  -> pure route or one bounded owner pass
  -> complete, delegate, or attach task
  -> dependency result wakes parent
  -> correlated result and delivery

changed fact
  -> event store
  -> App subscription -> correlated App request
     or task subscription -> persisted TaskIntent/trigger
     or exact task target -> exact wake
     or observation only

durable desired outcome
  -> App task
  -> fenced bounded owner/workflow attempt
  -> validated result, actions, evidence, and Conditions
  -> repeat from current state until converged
```

Tasks are optional. A simple App request completes directly. Direct, Gym, and
explicit workflow/agent execution reuse the same prepared execution kernel
without attaching autonomous App ownership.

## Boundaries

```text
Agent execution kernel
  prepared model + prompt + typed context + supplied tools
  -> bounded ExecutionResult

Canonical App host
  registry + inbox + subscriptions + schedules + observers
  + optional task reconciliation + delivery

Agent App
  address + owner + schemas + pure policy + domain workflows/observers
  + workspace and optional desired task model
```

The execution kernel has no event bus, database, task store, scheduler, App
inbox, or recovery responsibility. The App host knows mechanics but not domain
strategy. Apps know domain meaning but cannot implement another runtime.

## Components

| Component | Responsibility | Does not own |
| --- | --- | --- |
| App registry | Validate and atomically publish one App generation | Model execution or domain judgment |
| App inbox host/store | Addressed request lifecycle, fencing, dependencies, result/delivery correlation | Durable desired task state |
| App definition | Owner, schemas, pure route/correlation policy, capabilities, domain meaning | Claims, retries, queues, or persistence mechanics |
| Event runtime | Fact persistence, declared delivery, trace and retention evidence | Requests, task state, or owner fallback |
| Scheduler | Input/event cadence and observer cadence | Work meaning or model dispatch |
| Observer | Bounded external-state read returning facts | Agent execution or durable state mutation |
| Task runtime | Intent/generation storage, Conditions, attempts, queues, result admission, recovery | Domain strategy or prompt interpretation |
| Agent | Capability, instructions, tools, context, and judgment | Durable ownership or runtime mechanics |
| Workflow | One agent-owned repeatable bounded process | Scheduling, durable waits, or task mutation |
| Session runtime | Prepare and persist bounded agent attempts | App/task acceptance |
| Metrics/guards | Observe measured health and mechanical risk | Desired state or domain judgment |
| UI/CLI/Telegram | Typed ingress and bounded read presentation | Direct model/task/storage control |

## App and project layout

```text
projects/<id>/                 # optional portable domain workspace
projects/<id>.app/
  app.ts                       # one defineApp declaration
  project.json                 # optional durable goal and posture
  tasks/seed.json              # optional boot-only desired state
  agents/<agent>/
    agent.json
    AGENTS.md
    workflows/<name>.ts
  observers/                   # optional external-state adapters
  scripts/                     # explicit offline maintenance
  .state/                      # host-managed runtime state/projections
```

The public organizational unit is the App. The execution unit is an agent or
workflow. Workflows live under the agent owning the experience. There is no
parallel `inbox.ts`, `defineProjectApp` manifest, App-root workflow registry,
or App-specific scheduler/recovery daemon.

The task capability has one resolver and one controller per App. Loops, plans,
groups, and one-off work are task resources or domain policy—not new controller
types.

Task handler resolution is conventional:

```text
owner = task.owner ?? nearest explicit ancestor owner ?? App.owner

workflow absent       -> one bounded owner run
workflow present      -> that owner's workflow
workflow needs-owner  -> one same-owner handoff for the same task
workflow unavailable  -> attention; no silent owner substitution
```

## Requests and delegation

Every addressed request has one durable App inbox item. A pure route or owner
returns:

- `complete` with the result;
- `delegate` to create a child App request; or
- `task` to attach an existing or desired task.

The host records the dependency before waking child work. Parent completion
waits for the exact child/task result and any required human delivery evidence.
Events and traces may explain causality but cannot replace this linkage.

The `may` App owns ordinary human conversation and final channel closeout. It
may answer directly or delegate to a domain App. It has no schedules, observers,
or task attachment, so conversation cannot become a background project loop.

## Facts and durable continuation

Events are facts and wakes, not work queues. Top-level App subscriptions create
inbox requests only through a pure `toInput` translation. Task subscriptions
resolve desired intent. Exact task targets wake only that task. Unhandled facts
remain observable and never fall back to a generic owner inbox.

Workflows are bounded. A durable wait ends the run:

- an App request waits on an explicit child App/task/session/delivery
  dependency; or
- a task waits on exact Conditions and is later woken by a fact/resync.

The later pass starts from current durable input/reconciliation context, not
workflow-local variables, a mutable session, prompt parsing, or event-pair
reconstruction.

## Scheduling and observation

An App schedule has one destination:

- input schedule -> correlated inbox obligation, with bounded catch-up; or
- event schedule -> published fact, with no missed-fact replay.

An observer polls/reads external state through bounded capabilities and returns
facts for the host to publish. Neither schedules nor observers launch model
work directly.

Legacy cron handlers/watchers migrate to an input schedule, event schedule,
observer, task workflow input, shared runtime maintenance, explicit offline
maintenance CLI, or deletion.

## Human interaction

```text
human input -> May App request
  -> direct response
     or child domain-App request -> optional task reconciliation
  -> May reviews result
  -> channel delivery operation/receipt
  -> May request done
```

Explicit approvals, cancellation, and runtime controls may use deterministic
typed ingress. Their result remains linked to the originating May/task
obligation. Human escalation is an explicit child request to May/human
attention, not an event owner fallback.

Persistent chat and event traces are context/read models. The App inbox request
is the durable identity for each human turn requiring a result.

## State and storage

| State | Authority |
| --- | --- |
| Authored App/project intent | `app.ts`, `project.json`, agent/workflow/observer source |
| Addressed work | App inbox store |
| Durable desired work | App task resource store |
| Bounded execution | Session/workflow records and artifacts |
| Facts and delivery evidence | Event/delivery store and referenced artifacts |
| Domain truth | App-owned typed state/artifacts and admitted task results |
| UI/query views | Disposable bounded projections |

Physical storage is host-private. SQLite, files, queues, and read models are
implementation choices and never SDK authoring contracts. Projections may be
regenerated and cannot become mutation authority.

## Runtime code map

| Area | Current implementation |
| --- | --- |
| Daemon assembly/lifecycle | `projects/may-agent/src/app/app-runtime.ts`, `daemon*.ts` |
| Canonical App definition/validation | `projects/may-agent/packages/sdk/src/app.ts`, `src/app/app-definition-validation.ts` |
| App registry/loader | `projects/may-agent/src/app/app-registry.ts`, `src/app/loader/` |
| App inbox | `projects/may-agent/src/app/app-inbox-*.ts` |
| Temporary canonical-to-task adapter | `projects/may-agent/src/app/loader/project-app-loader.ts` |
| Task mechanics | `projects/may-agent/src/app/project-app-task-controller.ts`, `project-app-task-reconciler.ts` |
| Events and persistence | `projects/may-agent/src/app/event-bus.ts`, `src/lib/db/` |
| Bounded execution | `projects/may-agent/src/lib/agent-execution.ts`, workflow/runner modules |
| HTTP/UI | `projects/may-agent/src/app/http/`, `packages/webui/` |
| Stable public SDK | `projects/may-agent/packages/sdk/` |

The temporary adapter and Project App-named task files are implementation debt;
their useful task mechanics move behind the canonical host, and their public
legacy contracts are deleted.

## Invariants

1. One App has one `defineApp` declaration, registry identity, and host.
2. App inbox items exclusively own addressed results.
3. App tasks exclusively own durable desired outcomes.
4. Events, queues, traces, metrics, sessions, workflows, and projections never
   become alternate work authorities.
5. Every fact-to-work route is explicit, pure, and uniquely owned.
6. Intent/trigger and request/dependency state are durable before wake
   coalescing.
7. Apps own meaning; infrastructure owns mechanics; execution remains bounded.
8. Schedules own time, observers own external reads, and Conditions name exact
   waits; none launches judgment directly.
9. Direct/Gym/read-only execution cannot attach autonomous controllers.
10. Human and external interfaces cannot bypass canonical admission.
11. Recovery preserves identity and does not invent desired state.
12. Evidence and owner admission precede closure.
13. Legacy and canonical actionable routes never run together.

## Contract ownership

When this overview conflicts with a subsystem document, fix both and follow the
narrow contract:

- App/task boundaries: [agent-app.md](agent-app.md) and
  [task-resource-engine.md](task-resource-engine.md)
- Agents/workflows: [agents.md](agents.md), [workflows.md](workflows.md), and
  [skills.md](skills.md)
- Runtime/SDK: [runtime.md](runtime.md), [system-boundary.md](system-boundary.md),
  and [sdk.md](sdk.md)
- Facts/schedules: [events.md](events.md), [event-graph.md](event-graph.md),
  [cron.md](cron.md), [metrics.md](metrics.md), and [guards.md](guards.md)
- Interfaces: [human-control-surfaces.md](human-control-surfaces.md),
  [http-boundary.md](http-boundary.md), and [webui.md](webui.md)
