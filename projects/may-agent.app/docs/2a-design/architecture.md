# May-Agent Architecture

**Design status:** Accepted.
**Implementation status:** Implemented; subsystem documents record narrower
gaps.

May-agent is an event-driven agent system. Apps organize durable domain work,
agents provide capability and judgment, workflows preserve learned repeatable
processes, and infrastructure supplies delivery, persistence, reconciliation,
recovery, and observability.

Read [system-model.md](system-model.md) first for the compact mental model. This
document maps that model to components without repeating each subsystem's full
contract.

## Core flow

The primary mental model for durable app work is deliberately small:

```text
event -> task -> workflow or owner -> result or Condition
```

The expanded runtime path is:

```text
signal
  -> typed event or explicit control action
  -> target consumer or accountable owner route
  -> optional app task correlation
  -> one app queue receives a stable task ID
  -> generic controller claims current canonical state
  -> explicitly bound workflow or resolved owner runs
  -> structured result, evidence, and pending event intents are admitted atomically
  -> infrastructure dispatches those events idempotently
  -> completion, exact Condition wait, or attention
```

Tasks are optional. A direct, Gym, chat, or standalone workflow run uses the
same prepared agent capability without attaching task infrastructure.

Persistence, queues, deduplication, attempts, retry/backoff, restart recovery,
Conditions, watchdogs, metrics, stale-state repair, escalation delivery, and
traces support this path. They are essential runtime mechanics, but they do not
add another app-level loop or decide domain strategy. See
[agent-app.md](agent-app.md#supporting-reliability-infrastructure) for the
boundary and recovery order.

## Boundaries

```text
Agent core
  model + prompt + context + supplied tools
  -> result + neutral runtime notifications

Autonomous host
  events + schedules + task queues + attempts
  + persistence + recovery + metrics + interfaces

Agent App
  accountable owner + supporting agents + domain organization
  + optional host attachments
```

The agent core does not import EventBus, SQLite, metrics, tasks, scheduling, or
recovery. Infrastructure may wrap the same agent run and supplied tools may use
databases or remote services behind explicit capability boundaries.

Apps do not implement another agent runtime or scheduler. They declare domain
identity, ownership, event correlation, schedules, actions, and optional task
intent. The generic host owns execution mechanics.

## Components

| Component       | Responsibility                                                                | Does not own                              |
| --------------- | ----------------------------------------------------------------------------- | ----------------------------------------- |
| Agent           | Capability, instructions, tools, context, and judgment                        | Event delivery or task persistence        |
| Workflow        | One agent-owned repeatable process and optional verifier                      | Durable business waits or task scheduling |
| Agent App       | Owner, supporting agents, domain organization, and optional host declarations | A second controller/runtime               |
| Event bus/store | Signal persistence, delivery bookkeeping, traces, and owner inbox             | Domain completion truth                   |
| Schedule        | Emit semantic events at declared times                                        | Work meaning or acceptance                |
| Watcher         | Observe an external provider level and emit semantic facts                    | Agent execution or task mutation          |
| Task controller | Claims, concurrency, Conditions, admission, atomic state, and recovery        | Domain strategy or prose interpretation   |
| Session runtime | Execute and persist bounded agent or chat turns                               | Project/task acceptance                   |
| Metrics/guards  | Observe measurable health and mechanical risk                                 | Domain judgment                           |
| UI/CLI/Telegram | Translate human intent and project current read models                        | Mutation authority                        |

## Agent Apps and projects

```text
projects/<id>/                 # optional portable domain workspace
projects/<id>.app/
  app.ts                       # organization and optional host declarations
  project.json                 # durable project goal and posture
  tasks/seed.json              # boot-only initialization
  agents/<agent>/
    agent.json
    AGENTS.md
    workflows/<name>.ts
  .state/tasks/state.json      # sole mutable task authority
  .state/tasks/tree.json       # disposable current-state projection
```

The public unit is the app. The execution unit remains an agent. Workflows live
under the agent that owns the experience. New work uses the `.app` layout;
legacy project-agent discovery remains a bounded migration reader, not a model
for new apps. Historical Markdown project content and app-root workflow
registries are not task-runtime authorities.

Each task-enabled app has one resolver, one controller, and one deduplicating
key queue. Loops, focus plans, and one-off work are task resources, not
controller types.

An executable parent may declare child tasks and wait without holding a worker.
The children run as ordinary keys in that queue. Child convergence or attention
durably wakes the parent, which rereads current child state and receipts before
refilling, repairing, or accepting the aggregate result. Structural groups stay
passive, and dependencies continue to express ordering rather than containment.

Handler resolution is convention-based:

```text
owner = task.owner ?? nearest explicit ancestor owner ?? app.owner

workflow absent       -> run owner directly
workflow present      -> run that owner-owned workflow
workflow needs-owner  -> run owner once, sequentially
workflow unavailable  -> attention; no owner substitution
```

See [agent-app.md](agent-app.md), [projects.md](projects.md), and
[task-resource-engine.md](task-resource-engine.md).

## Events and durable continuation

Events carry durable signals and causal trace. They are not a second domain
state machine. Targeted delivery is attempted first; unclaimed owned work
remains visible in the owner inbox. Crossing an ownership boundary requires an
explicit escalation.

Workflows are synchronous ordered runs. A durable wait ends the current run,
persists domain state or an exact Condition, and continues from a later event.
No suspended workflow, generic request object, or hidden polling loop is
needed.

See [events.md](events.md), [event-graph.md](event-graph.md),
[workflows.md](workflows.md), and [escalation.md](escalation.md).

## Human interaction

```text
conversation directed to an agent
  -> human.input.received
  -> chat.start.requested or session.steer.requested
  -> bounded agent turn and delivery

outcome directed to an app
  -> project.comment.created receipt or typed app event
  -> app owner result
  -> optional durable task

human judgment requested by an owner
  -> escalation.created with exact question and evidence
  -> resolved approval, rejection, advice, or action
  -> waiting Condition updates and same task key wakes
  -> dismissal instead returns the task to attention
```

Both use the same event-native ingress, receipts, traces, and agent runtime. An
app request lets the app choose its handler; an agent message fixes the agent or
conversation. Persistent chat is a conversation container; each human turn has
its own trace. Chat and bounded jobs use different lifecycle policies but share
agent preparation, session persistence, event tracing, and interface
boundaries.

Infrastructure provides escalation persistence, human-channel delivery,
deduplication, reply correlation, overdue detection, and task wakeup. The agent
decides when human judgment is needed and applies the response; infrastructure
does not make the decision.

See [human-control-surfaces.md](human-control-surfaces.md),
[sessions.md](sessions.md), [webui.md](webui.md), and
[telegram-notifications.md](telegram-notifications.md).

## State and storage

| State                                       | Authority                                         |
| ------------------------------------------- | ------------------------------------------------- |
| Authored app/project intent                 | `app.ts`, `project.json`, agent/workflow source   |
| Live task resources                         | `.state/tasks/state.json`                         |
| Human task view                             | generated `.state/tasks/tree.json`                |
| Session/workflow detail                     | runtime artifacts plus bounded SQLite projections |
| Events, delivery, alerts, and query indexes | SQLite plus referenced artifacts                  |

SQLite is a coordination/query store, not a replacement for owned domain
artifacts. Read projections may be regenerated and never become mutation
authority. See [storage.md](storage.md).

## Runtime code map

| Area                        | Current implementation                                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Daemon assembly             | `projects/may-agent/src/app/app-runtime.ts`, `projects/may-agent/src/app/daemon.ts`                                                 |
| Agent preparation/execution | `projects/may-agent/src/app/loader/`, `projects/may-agent/src/lib/agent-execution.ts`, `projects/may-agent/src/lib/agent-runner.ts` |
| Agent App hosting           | `projects/may-agent/src/app/loader/project-app-loader.ts`                                                                           |
| Task mechanics              | `projects/may-agent/src/app/project-app-task-controller.ts`, `projects/may-agent/src/app/project-app-task-reconciler.ts`            |
| Events and persistence      | `projects/may-agent/src/app/event-bus.ts`, `projects/may-agent/src/lib/db/`                                                         |
| Workflow runtime            | `projects/may-agent/src/lib/workflow-tool.ts`                                                                                       |
| HTTP/UI                     | `projects/may-agent/src/app/http/`, `projects/may-agent/packages/webui/`                                                            |
| Public SDK                  | `projects/may-agent/packages/sdk/`                                                                                                  |

## Invariants

1. Apps organize; agents judge; workflows repeat learned processes.
2. Infrastructure owns mechanics, never project strategy or domain truth.
3. Each task-enabled app has one controller and a queue of stable IDs.
4. `state.json` is authoritative; `tree.json` is disposable.
5. Explicit workflow bindings are honored; only `needs-owner` changes the
   selected method.
6. Cron owns time, watchers own external observation, and Conditions represent
   exact external facts.
7. Direct and Gym execution remain usable without autonomous infrastructure.
8. Human and system interfaces translate intent; they do not bypass canonical
   admission.
9. Evidence precedes closure.
10. Recovery and metrics preserve the same domain identity; they do not create
    a second planner.
11. Durable work is acknowledged only after its continuation is recoverable.
12. Task results and their follow-up event intents survive as one admitted
    state transition.

## Contract ownership

When this overview conflicts with a subsystem document, fix this overview and
follow the subsystem contract:

- agent/app/task boundaries: [agent-app.md](agent-app.md) and
  [task-resource-engine.md](task-resource-engine.md)
- agents, workflows, and skills: [agents.md](agents.md),
  [workflows.md](workflows.md), and [skills.md](skills.md)
- runtime and SDK: [runtime.md](runtime.md), [system-boundary.md](system-boundary.md),
  and [sdk.md](sdk.md)
- events and reliability: [events.md](events.md), [event-graph.md](event-graph.md),
  [cron.md](cron.md), [metrics.md](metrics.md), and [guards.md](guards.md)
- interfaces: [human-control-surfaces.md](human-control-surfaces.md),
  [http-boundary.md](http-boundary.md), and [webui.md](webui.md)
