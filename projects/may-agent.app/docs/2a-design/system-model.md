# May-Agent System Model

**Design status:** Accepted.
**Implementation status:** Canonical App ownership is implemented; legacy
Project App and event-pair authorities are being removed.

## One-Sentence Model

May-agent makes sure every addressed request is handled eventually: an Agent
App owns the request in a durable inbox, completes simple work in one bounded
pass, and attaches hard work to a task that reconciles repeatedly until the
desired outcome is proved.

```text
addressed request -> App inbox -> direct result or task -> verified result
changed fact      -> event     -> request, TaskIntent, exact wake, or observation
bounded action    -> session/workflow -> evidence
```

The inbox item is the authority for one addressed result. The task is the
authority for a durable desired outcome. An event is a persisted fact and wake,
never an alternate work queue. A session or workflow is a bounded execution
attempt, never durable ownership.

## Core objects

| Object | One question it answers | Owner of truth |
| --- | --- | --- |
| Agent App | Which durable address and owner owe this domain result? | Process-wide App registry |
| App inbox item | Which addressed request still requires its own correlated result? | App inbox store |
| Task | Which desired outcome and observed conditions must reconcile? | App task resource |
| Event | What fact crossed a boundary? | Event store during its retention window |
| Event delivery | Which declared consumer accepted this fact? | Event delivery metadata |
| Trace | What caused this request, fact, execution, or result? | Trace and closure links |
| Project | What durable goal and operating posture does an App maintain? | `project.json` and App-owned domain state |
| Session | Which bounded agent execution ran and what did it claim? | Session registry and transcript |
| Workflow run | Which bounded reusable process ran and how did it end? | Workflow-run record |
| Metric | What measured runtime or domain signal changed? | Metric samples and projections |
| Escalation | Which blocker crossed an ownership boundary? | Originating inbox/task plus correlated escalation result |
| Skill | Which situational method guided one model turn? | Canonical `SKILL.md` |

These records are complementary. An event cannot stand in for an inbox item or
task; a queue cannot stand in for desired state; a session result cannot stand
in for owner acceptance; and a projection cannot become mutation authority.

## Ownership and routing

Classification is based on durable obligation:

```text
addressed input requiring a distinct result -> App inbox
changed fact with deterministic desired work -> task resolver
fact with no actionable obligation          -> event only
```

Top-level App subscriptions explicitly translate a fact into a typed,
independently correlated App request. Task subscriptions explicitly translate a
fact into desired task intent. An exact task target wakes only that task. The
runtime never guesses that an unhandled event should become owner work.

Unknown addressed Apps are rejected with a visible admission failure. Unknown
unaddressed facts remain observable and unhandled; they do not silently fall
back to May, a generic owner inbox, or an arbitrary agent.

### Responsibility boundaries

| Role | Owns | Does not normally own |
| --- | --- | --- |
| May App | Human request, conversation, delegation, final review, and channel closeout | Project task state, polling, background schedules, or another App's implementation |
| Domain App | Typed domain requests, domain meaning, task intent, workflows, waits, and terminal proof | Human-channel policy or another App's internal work |
| Shared runtime | Admission, persistence, delivery, schedules, observers, queues, claims, bounded execution, recovery mechanics, and projections | Domain judgment, desired project strategy, or human preference |
| Human | Authority, private input, strategic direction, approvals, and consequential preferences | Routine execution or mechanical recovery |

May states the desired outcome and delegates to an App address. The receiving
App chooses whether to answer, delegate, or attach a durable task. May remains
responsible for reviewing the child result and delivering the final response;
it does not become the project's fallback controller.

A bounded, audited break-glass attempt may cross this boundary when canonical
delegation cannot fulfill the human outcome. It is an exceptional execution
linked to the same May request, not a parallel ownership model.

## Request loop

```text
human input
  -> May App inbox
  -> direct answer
     or delegate -> child App inbox
                    -> direct result
                       or task attachment -> repeated reconciliation
  -> May reviews dependency result
  -> channel delivery
  -> May request completes after delivery evidence
```

Every request keeps one stable identity, source, typed input, and optional
parent/dependency link. A child App result wakes its parent. A task result wakes
the request attached to it. Delivery uncertainty remains a host concern and
does not cause blind duplicate replies.

One human conversation may contain several concurrent request threads. The
request identity is the May inbox item, not a mutable chat session, event trace,
reply ID, or inferred current topic. Conversation and trace views may group
related evidence without copying work authority.

Direct controls such as cancel, reload, restart, shutdown, and an explicit
approval may use deterministic runtime ingress. When they originate from a
human request, their result remains correlated to that May inbox item.

## Task reconciliation loop

```text
fact or attached request
  -> pure resolver returns latest TaskIntent
  -> host persists desired intent and exact trigger
  -> deduplicating queue schedules the stable task ID
  -> reconciler observes current state
  -> owner or workflow performs one bounded attempt
  -> structured result updates state, waits on a Condition, or completes
  -> later fact/resync re-enters the same task ID
```

The owner is the domain brain. The host owns task storage, generations,
attempts, claims, leases, queues, workspace allocation, result admission,
recovery, and projections. Queue coalescing happens only after the latest
desired intent and trigger are durable.

A Condition records the exact external fact required before reconciliation can
continue. Durable waits end the current session/workflow attempt; they never
keep model execution open.

Project posture is separate from task and execution state. A project says
whether the owning loop should push, wait, request judgment, pause, or stop. A
task records convergence toward one desired outcome. A session or workflow
records only one bounded attempt.

## Facts, schedules, and observation

Events cross boundaries as facts. Their `target` narrows intended delivery;
their source and data preserve attribution and meaning. An event owner field,
when retained for compatibility or attribution, is not permission to create
generic owner work.

Event delivery acceptance means a declared consumer durably accepted the fact
or resulting obligation. It is not proof of execution, semantic completion, or
human delivery.

A schedule has exactly one destination:

- an input schedule creates one correlated App request per admitted slot; or
- an event schedule publishes a fact that may wake deterministic task work.

An observer reads external state through bounded capabilities and returns
semantic facts. It cannot launch agents or mutate inbox/task state. Metrics are
projections over runtime or domain observations; a breach may wake an existing
obligation but is not itself desired state.

The in-process event bus does not provide durable work ownership or implicit
exactly-once replay. Work that must survive restart is persisted before routing
as an inbox request or task trigger. Continuation handlers remain idempotent.

## Execution boundaries

Choose the smallest mechanism matching the responsibility:

| Need | Mechanism |
| --- | --- |
| Variable judgment or one bounded action | Agent session, optionally guided by a skill |
| Repeatable ordered branching and verification | Bounded TypeScript workflow |
| One addressed result that may depend on other work | App inbox item with child/dependency link |
| Durable desired outcome across attempts | App task and Conditions |
| Typed external ingress | App action translated to App input |
| Timer creates an independent obligation | Input schedule |
| Timer wakes deterministic desired work | Event schedule and task subscription |
| Poll external state | Observer producing facts |
| Mechanically detectable tool risk | Guard |
| Agent-callable external capability | Tool |

Skills guide judgment. Workflows control bounded execution. Neither owns
durable work state.

## Runtime boundary

The process-wide App registry validates and atomically publishes one generation
of `defineApp` declarations. One host attaches inbox dispatch, schedules,
observers, optional task controllers, and delivery. A failed reload keeps the
previous complete generation active.

The public App/workflow SDK exposes typed semantic contracts and scoped
capabilities. It does not expose raw SQL, task files and locks, scheduler
handles, global runtime paths, recovery APIs, or unrestricted event-driven
execution.

Direct, Gym, and read-only processes reuse the same prepared agents and
workflows without attaching autonomous controllers. Loading an App definition
cannot itself start model work.

## Reliability convention

```text
known transient failure
  -> bounded retry of delivery or execution
  -> repair stale mechanical state
  -> requeue the same persisted obligation
  -> attention when judgment is required
  -> explicit escalation only across a real ownership boundary
```

Infrastructure preserves identity and evidence. It never invents desired state
or project strategy. Repeated equivalent wakes may coalesce execution pressure
but cannot erase a correlated request or newer persisted intent.

## Terminal vocabulary

Use terminal words only inside their owning layer:

| Layer | Terminal vocabulary | Meaning |
| --- | --- | --- |
| App inbox item | `done` | This addressed request has its correlated result and required delivery evidence |
| Workflow | `done`, `blocked` | This bounded process ended or cannot continue locally |
| Session | `success`, `partial`, `blocked`, `failure` | This bounded agent attempt's claim |
| Maintain task | `converged` | The current desired generation is satisfied |
| Achieve task | completion receipt | Finite desired work was accepted and retired |
| Project | `done`, `closed` | The durable goal completed or ownership intentionally ended |
| Escalation | `resolved`, `dismissed` | The other owner returned a disposition |
| Metric alert | recovered/resolved evidence | The measured condition no longer needs attention |

Never translate one layer's terminal claim into another without the owning
admission check. A successful session can produce evidence that a task or App
owner rejects.

## Non-negotiable invariants

1. An App inbox item is the sole authority for an addressed request.
2. An App task is the sole authority for a durable desired outcome.
3. Events, traces, queues, metrics, projections, sessions, and workflows never
   become alternate work authorities.
4. Every fact-to-work route is explicitly declared as an App subscription,
   task subscription, or exact task target.
5. Every request, task intent, result, and delivery remains correlated before
   any wake is acknowledged.
6. Domain Apps decide domain meaning; shared infrastructure remains mechanical.
7. Workflows and sessions are bounded; durable waits cross persisted
   inbox/task boundaries.
8. Recovery preserves identity and never invents desired state.
9. May owns conversation and final human closeout, not background project work.
10. New code has one `defineApp` model and no `defineProjectApp`, legacy SDK,
    owner-inbox/event-pair work lifecycle, or imperative event execution path.
11. Evidence precedes closure claims.

## Detailed contracts

- Principles and work posture: `1-principles/core-principles.md` and
  `1-principles/work-model.md`
- App ownership and authoring: `2a-design/agent-app.md`
- Events and delivery: `2a-design/events.md`
- Task reconciliation: `2a-design/task-resource-engine.md`
- Sessions and human turns: `2a-design/sessions.md` and
  `2a-design/human-control-surfaces.md`
- Skills and workflows: `2a-design/skills.md` and `2a-design/workflows.md`
- Cross-owner escalation: `2a-design/escalation.md`
