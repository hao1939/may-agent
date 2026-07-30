# May-Agent System Model

**Design status:** Accepted.
**Implementation status:** Implemented as the governing mental model; subsystem
documents define the detailed contracts.

## One-Sentence Model

May-agent is an event-driven deputy system in which a durable signal reaches a
target or accountable owner, bounded execution produces evidence, the owning
domain updates its state, and a typed follow-up event closes or continues the
loop.

```text
event -> target -> owner fallback -> judgment/execution -> evidence/state -> follow-up event
```

There is no generic request object beside this loop. The opening event and its
trace represent the commitment. Domain entities such as projects, tasks,
alerts, sessions, and escalations retain their own state only when they answer
a domain-specific question.

## Core Objects

| Object         | One question it answers                                                     | Owner of truth                                  |
| -------------- | --------------------------------------------------------------------------- | ----------------------------------------------- |
| Event          | What durable signal crossed a boundary?                                     | Event store during its retention window         |
| Event delivery | Did a responsible consumer accept the signal?                               | `delivery_*` fields on the event                |
| Event pair     | Did the expected typed response arrive in time?                             | `event_pair_runs`                               |
| Trace          | What caused this work, and which event fulfilled it?                        | Event trace and closure links                   |
| Project        | What durable goal and operating posture does an owner maintain?             | `project.json` and project-owned state          |
| Task resources | What desired and observed work state does the app currently own?            | `.state/tasks/state.json`                       |
| Metric alert   | Which measured signal still needs judgment or recovery evidence?            | Metric and alert tables                         |
| Session        | Which agent execution or conversation container ran?                        | Session registry and transcript                 |
| Workflow run   | Which ordered executable process ran, and how did it end?                   | Workflow-run record                             |
| Escalation     | Which blocker crossed an ownership boundary, and what action was requested? | Escalation events plus trace                    |
| Skill          | Which situational method was loaded for one model turn?                     | Canonical `SKILL.md`; no independent work state |

These records are complementary, not alternate lifecycle systems. Do not copy
domain state into an event, infer delivery from task completion, or treat a
workflow result as project completion.

## Ownership And Routing

Every actionable event has one accountable owner. Routing is target-first:

```text
matching target consumer -> accept and act/queue
no target consumer        -> queryable owner inbox
owner cannot resolve      -> explicit escalation across the ownership boundary
```

`target` identifies the intended consumer or domain object. `owner` identifies
who is accountable if targeted delivery fails. Event-specific facts stay in
`data`. Authoring helpers may derive a default owner from an app or agent, but
the persisted canonical event contains the resolved owner.

Owner-inbox acceptance means the signal is visible in the owner's durable pull
queue. It does not mean the owner acted or the work completed. Owner review
emits a typed follow-up event.

## Execution Boundaries

Choose the smallest controller that matches the work:

| Need                                                              | Mechanism                                                            |
| ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| Variable judgment or one bounded action                           | Agent session, optionally guided by a skill                          |
| Repeatable ordered branching/retry/verification                   | Synchronous TypeScript workflow                                      |
| Wait for a human, timer, callback, restart, or external condition | Persist domain state and continue from a later event-linked workflow |
| Mechanically detectable risk around tool/workflow execution       | Guard                                                                |
| Capability an agent calls against an external system              | Tool                                                                 |
| Repeated typed automation entering an existing app                | Discoverable app action that emits one semantic event                |
| Timer/event-to-workflow bridge or mechanical projection           | Handler/app schedule                                                 |

Workflows are ordered synchronous blocks even though their TypeScript uses
`await`. They finish with `done` or local `blocked`. A durable wait never keeps
one workflow run open; it ends the current phase and a later event starts a new
run.

Skills and workflows share discovery, scope, provenance, and evaluation
conventions, but not execution semantics. A skill guides model judgment. A
workflow controls execution.

## Project Loop

A project app is a small May-agent control plane around a portable domain
workspace.

```text
project signal
  -> app task resolver declares desired task state
  -> one deduplicating queue receives the task key
  -> controller reconciles the latest persisted resource
  -> resolved owner runs directly or applies an owner-owned workflow
  -> one structured result is atomically applied
  -> Condition wait, attention, or completion receipt records the outcome
  -> changed dependents re-enter the same queue
```

The owner is the project brain. Runtime and app code deliver, schedule,
observe, and persist. They do not decide domain decomposition, acceptance,
retry policy, or project truth.

Task resources persist desired `spec` and observed `status`. Their phases are
`pending`, `running`, `waiting`, `attention`, and `converged`. Attempts are
separate durable runtime records; completion receipts preserve finite results
after completed tasks leave the live graph.

Project posture is separate from task state. Project status answers whether the
owner loop should push, wait, request judgment, pause, or stop. Session and
workflow statuses describe execution attempts only.

## Human Loop

Human interaction shares event-native ingress but has two explicit semantic
addresses:

```text
conversation directed to an agent
  -> human.input.received
  -> chat.start.requested or session.steer.requested
  -> bounded agent turn
  -> session.idle/session.end and channel delivery

outcome directed to an app
  -> project.comment.created receipt or typed app event
  -> app owner judgment
  -> project.owner.reviewed
  -> optional durable task and Conditions
```

An app request lets the app choose the handler. An agent message fixes the
agent or conversation. They share envelopes, receipts, traces, and execution
infrastructure without sharing one ambiguous public `send(target, message)`
contract.

A human conversation is a logical channel/thread relationship, not a session
or permanent trace. One conversation may use many bounded sessions, and each
human turn receives its own trace. Replies to a notification continue the
referenced trace; unrelated follow-ups start a new trace. If conversation
judgment creates durable project work, it emits a linked app-intent event rather
than treating the chat session as task state. The app task continues after the
turn session ends; a later owner result starts a fresh May review session when
needed and final channel delivery links back to the originating human trace.

Session reuse may cache conversational context, but no durable work, caller
identity, completion route, or promised human follow-up may depend on one
mutable current session. When an old session is unavailable, runtime prepares
a new bounded session from the linked human trace, app task, relevant recent
conversation, and durable preferences.

One human conversation can contain several concurrent request threads. A
request thread is a read view assembled from a human trace, linked channel
messages, domain events, and the owning app task; it is not another durable
request object. A channel reply id is an anchor used to find that trace, not the
request identity itself. When no explicit anchor exists, routing uses a clearly
named subject, then the only plausible open request, and otherwise one focused
clarification. A conversation context reader exposes the focused request and
compact neighboring context without copying work state out of the owning app.

## Event Durability And Reliability

“Durable event” means the signal and its trace are persisted for audit,
reconciliation, and owner-inbox review. The in-process event bus is not a
general durable queue and does not promise automatic exactly-once replay.

Runtime guarantees are intentionally narrower:

- persist before or with routing where the boundary requires durability;
- record whether a responsible consumer accepted delivery;
- route unclaimed owned work into the queryable owner inbox;
- detect overdue delivery and missing typed responses;
- make continuation handlers idempotent because reconciliation can retry them;
- preserve domain state outside the event log when work must survive retention.

Persistence is therefore not proof of execution, and delivery acceptance is
not proof of completion.

## Terminal Vocabulary

Use terminal words only inside their owning layer:

| Layer          | Terminal vocabulary                                | Meaning                                               |
| -------------- | -------------------------------------------------- | ----------------------------------------------------- |
| Workflow       | `done`, `blocked`                                  | This ordered run finished or cannot continue locally  |
| Session finish | `success`, `partial`, `blocked`, `failure`         | This agent attempt's claim                            |
| Maintain task  | `converged`                                        | Current desired generation is satisfied               |
| Achieve task   | completion receipt and removal from the live graph | Owner accepted finite work                            |
| Project        | `done`, `closed`                                   | Goal completed, or ownership loop intentionally ended |
| Escalation     | `resolved`, `dismissed`                            | Cross-owner request received a disposition            |
| Metric alert   | resolved/recovered evidence                        | Signal no longer needs active judgment                |

Never translate one terminal word into another without owner judgment. A
successful session can produce a task claim that the project owner rejects. A
completed workflow phase can establish a durable wait without completing the
project task.

## Non-Negotiable Invariants

1. No generic request lifecycle beside events, traces, and domain state.
2. Every actionable event has a target or accountable owner route.
3. Delivery, typed response, trace closure, and domain completion remain
   distinct.
4. Project owners decide project meaning; infra remains mechanical.
5. Workflows are bounded synchronous runs; durable waits cross event boundaries.
6. Skills provide guidance and never own work state.
7. New code writes canonical names and fields; compatibility is read-only and
   isolated at explicit boundaries.
8. Evidence precedes closure claims.

## Detailed Contracts

- Principles and work posture: `1-principles/core-principles.md` and
  `1-principles/work-model.md`
- Events, delivery, and inbox: `2a-design/events.md`
- Trace and closure: `2a-design/event-graph.md`
- Agent App contract: `2a-design/agent-app.md`
- Task runtime: `2a-design/task-resource-engine.md`
- Sessions and human turns: `2a-design/sessions.md` and
  `2a-design/human-control-surfaces.md`
- Skills and workflows: `2a-design/skills.md` and `2a-design/workflows.md`
- External ownership handoff: `2a-design/escalation.md`
