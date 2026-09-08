# System Model

**Design status:** Accepted.
**Implementation status:** Durable App outcomes use the shared Task path.
May's bounded conversational frontend is the deliberate non-Task path: it may
answer, clarify, perform authorized self-contained tool work, or publish typed
durable intent. It does not duplicate an existing Task's owned work. New
direct-admission turns reuse the bounded App execution tool profile; retained
child waits keep their compatibility profile. Direct Topic-to-responsible-Task
admission, event-driven
non-proxy May supervision, and the live `up to date` maintain-Task view are
implemented. Pure selectors and input-to-Task mappings run during admission
coordination. Scoped Task list/get reads are implemented in the SDK,
agent tool, control socket, and HTTP adapter. Remaining implementation gaps are
tracked in
[design-implementation-convergence.md](../proposals/design-implementation-convergence.md).

The May system has one App work object, one durable source of change, and three
responsibility areas:

```text
Task    = the durable desired and observed App work
Event   = durable new information that may create or wake that work
Infra   = ingress, persistence, scheduling, capacity, and presentation output
Runtime = task lifecycle, execution, scoped capabilities, and recovery
App     = resolve inputs to tasks and reconcile those tasks
```

Infra and Runtime are responsibility boundaries inside the Host, not separately
discovered services or additional domain owners. The SDK is the typed boundary
through which a task attempt receives Runtime capabilities.

The practical test is deliberately plain:

| Part    | One question it answers                                                       |
| ------- | ----------------------------------------------------------------------------- |
| Event   | What meaningful new information arrived?                                      |
| Infra   | How does input, state, time, capacity, and output move?                       |
| Runtime | Which tasks does the event wake, which attempt runs, and what did it observe? |
| App     | Given this task and its unobserved events, what should happen next?           |

The side-effecting App/Runtime boundary is one conceptual function:

```text
reconcile(task context + bounded capabilities) -> task result
```

Everything before that call is validation, pure mapping, admission, or
preparation. Everything after it is result validation, persistence, wake
scheduling, recovery, or projection. May's bounded frontend work does not need
a Task reconciliation merely to use tools. Both paths use the same executor;
only the Task path owns ongoing work across attempts.

The semantic-decision boundary is equally small:

> Code collects bounded trustworthy context and executes a validated decision;
> the LLM makes the semantic decision.

Code owns exact reads, schemas, deterministic controls, identity, authority,
fencing, and effects. It may apply a pure deterministic rule when meaning is
already explicit. It must not grow a parallel keyword router, intent
classifier, or conversational state machine.

## Public mental model

The ordinary interaction model has four nouns:

- an **App** owns a responsibility;
- an **event** is durable new information that can create or wake work;
- a **request** is the Host's short-lived correlation for one admitted input;
- a **task** is the work an App reconciles toward an accepted outcome.

```text
human or caller
  -> Host event and bounded request
  -> Task when durable work is required
  -> event-driven execution until completion or an exact wait
  -> accepted result
  -> Host projection to the caller
```

The request proves that one input was accepted and answered or handed off. A
Task is the durable work identity and may outlive any one caller request. The
selected executor keeps working while it can make safe progress;
internal model turns do not end the attempt. Crashes and restarts resume the
same Task. A request may attach to an
existing stable task, and a task may outlive any one caller request.

Two common words are deliberately not resources:

- an **action** is a named, schema-validated request entrypoint; invoking it
  creates an App request and the action has no status or lifecycle of its own;
- a **Task hierarchy** is a read-only presentation using parent and dependency
  relationships; it does not own, schedule, or mutate work.

Humans normally talk to May or invoke a named App command and then track the
Task. They inspect its details when they need progress or diagnostic detail.

There is one kind of Task. A conversation coordinator, deployment, evaluation,
and project review all use the same Task resource and lifecycle. Their owning
App, goal, relationships, and selected attempt handler differ; their Task kind
does not.

### May in one flow

```text
human talks to May (`app:may`)
  -> May frontend understands one turn
  -> it answers, does bounded work, or publishes typed durable intent/feedback
  -> Runtime links the Topic to the actual Task owned by the responsible App
  -> meaningful Task events wake May's supervision Task
  -> one bounded reconciliation steers that same Task or updates Conversation
```

May is the App; “May App” is only the precise name used when contrasting May
with another App or with the Host. That is the complete ordinary mental model.
The Host may run a bounded executor such as `agent:may` to decide one turn, but
the executor is not another service or owner. A Topic only links related turns
and Tasks.

May is the human's deputy rather than a forwarding layer. Its frontend uses
Conversation, preferences, and focused resources to understand the intention.
It can answer, investigate, edit, and verify within the human's authorized scope
without creating or changing a Task. Conversation remembers that discussion;
Tasks own commitments needing background continuation, later steering, or
restart-safe coordination. Creating a Task is not delegation: May can own and
execute an ordinary Task. Involve another App for existing ownership, required
authority, or useful expertise, not merely a matching name. For durable work,
May publishes a clear outcome or exact feedback. Runtime records
the actual responsible Task on the Topic. Code filters later Task events against
those exact links; only a meaningful linked change wakes May's normal maintain
Task for one bounded reconciliation. May may then explain progress, protect the
human's intent by steering the same Task, or do nothing. The maintain Task does
not parent, wait on, or copy the responsible Task. A mixed request may receive a
useful immediate answer and continue exact work. Focus is context, not automatic
mutation authority.

The names describe different responsibilities:

| Name                                      | Meaning                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **May** (`app:may`)                       | The deputy: conversation, authorized direct work, ordinary owned Tasks, and linked-work follow-through. |
| **Agent** (for example `agent:may`)       | A named reasoning profile for one bounded attempt. It owns no durable work.                      |
| **Host**                                  | The generic machinery that persists, schedules, runs, recovers, and delivers work for every App. |
| **Host Operations App** (`app:may-agent`) | The ordinary App that owns desired changes to the Host itself.                                   |

### App or agent?

Use one test:

```text
must the responsibility survive this execution? -> App
is this only how one bounded attempt is performed? -> agent
```

An **App** is the durable unit of responsibility. It has an address, accepts
typed input, maps that input to Tasks, decides which events matter, and defines
what completion means. Create or use an App when work needs durable identity,
later wakes, retries, dependencies, or acceptance across attempts.

An **agent** is a named reasoning profile used inside one attempt. It supplies
instructions, tools, and model behavior. It receives bounded Task context and
returns a proposed Task result. It has no inbox, Task namespace, scheduler,
retry loop, or independent completion authority. Add an agent when an existing
App needs different expertise or tool access; do not create an agent to own a
new durable responsibility.

A workflow is a bounded procedure and an executor adapter is another way to
run one attempt. **Attempt handler** is the umbrella term for an agent,
workflow, or executor adapter. None owns the Task.

For example:

- ordinary conversation belongs to `app:may`; `agent:may` may make one bounded
  decision for the current turn;
- AKS review belongs to `app:aks-rp-e2e`; an AKS reviewer agent or workflow may
  perform the next attempt; and
- changing the Host belongs to `app:may-agent`; May may route the request but
  neither May nor the selected agent owns that Host Operations Task.

The Conversation preserves what the human said, the Topic preserves exact Task
links, the Task preserves the goal, and the event log preserves relevant
changes. Together they provide durable follow-through without copying the goal
into a May wrapper. The May executor can change, fail, or be replaced without
creating per-turn or conversation wrapper Tasks. Durable Task identity remains
namespaced by its owning App. May can own an ordinary goal Task like any other
App without first proving that every specialist App is unsuitable. An explicit
durable request to monitor or coordinate work may therefore be a normal May-owned Task; routine
supervision of work May just delegated is not.

The public SDK calls the execution selection `agent`. The Host accepts the old
`owner` spelling at one migration boundary and still stores it in retained Task
state. That compatibility alias is not a second ownership model and must not
leak into new App code, prompts, or UI. It can disappear after retained state
has a safe migration.

Use the shortest name that fits the audience:

- say **May** in product behavior, conversation, and ordinary operations;
- say **May App** only when contrasting the App boundary; and
- say **agent**, **workflow**, or the exact executor adapter when inspecting
  one attempt.

Do not make a human or App author reason about all three at once. In
particular, a Task is never transferred to an executor merely because the Host
is currently running it.

Current design prose uses **App** as the architectural term. Retained names such
as `agent-app` filenames and project type values are compatibility vocabulary;
they mean an App that can use agents, not a second kind of App and not an agent
that owns durable work.

There is no architectural component called **May agent**. New explanatory
prose should say May, executor, Host, or Host Operations App. The
technical identifier `may-agent` remains on compatibility surfaces: the Host
repository, binary, container, package scope, and Host Operations App ID. It
does not mean that the Host is May's worker.

The repository `projects/may-agent` contains the Host implementation. The App
at `projects/may-agent.app` owns desired operational outcomes for that Host.
The separate `projects/may.app` owns human conversation.

May may coordinate a cross-App request, but the responsible App owns the
resulting Task. For example, May can understand a deployment request and route
it, while the Host Operations App owns and reconciles the deployment Task.
Runtime supplies the bounded May attempt with a compact catalog generated from
the current installed App registry: App identity, declared responsibility, and
accepted input contracts. Each contract is derived from the existing schema as
its kind, required data paths, named field shapes, and fixed literal values;
Runtime does not keep a second routing registry or copy the full schema. The
catalog includes only Apps with both an
input-to-Task resolver and active Task policy, so every advertised target can
actually admit and reconcile the dependency. May judges semantic ownership;
Runtime only rejects a missing App or input that does not satisfy that App's
declared schema.

## Records and responsibility

The public records are few:

| Record       | Meaning                                                   |
| ------------ | --------------------------------------------------------- |
| Event        | Durable new information that may create or wake work      |
| App request  | Short-lived correlation for a caller still owed a result  |
| Task         | One durable desired outcome owned by one App               |
| Attempt      | One bounded execution of that Task                          |
| Conversation | Ordered shared human, May, command, and tool messages      |
| Topic        | Human context linked to exact Tasks                         |

Request and fact describe what an Event means; they are not extra transport
types. Result is accepted Task state, not another work object. Session, trace,
queue, lease, metric, and projection are supporting implementation records and
never own work.

The responsibility split is equally small:

| Boundary | Owns                                                                 |
| -------- | -------------------------------------------------------------------- |
| Host     | event admission, persistence, capacity, execution, fencing, and recovery |
| App      | input meaning, Task identity, acceptance, domain actions, and waits       |
| Attempt  | bounded progress using Runtime-supplied capabilities                      |
| Adapter  | interface-appropriate rendering and input                                 |

The Host never invents domain work. An App does not implement its own daemon,
database, queue, scheduler, recovery loop, or delivery service. Adding an App
capability makes one attempt more capable; it does not add another lifecycle.

## Whole flow

```text
event is persisted
  -> explicit App policy admits or wakes one Task
  -> Runtime starts one fenced attempt with bounded current context
  -> App accepts progress, an exact wait, another safe attempt, or completion
  -> accepted state and emitted Events wake interested work and presentation
  -> recovery resumes the same Task identity after interruption
```

A cross-App dependency is typed input to the destination App and an exact
Condition on the parent Task. It is not a callback, a second loop, or polling.
Only the destination App decides its Task; the parent decides what that result
means for its own Task.

Pausing stops new attempts while retaining admitted work. Restart repairs
temporary execution state and continues the same Tasks. A rejected or crashed
attempt cannot replace accepted Task state.

## Detailed authorities

This document intentionally stops at the mental model. Subsystem contracts own
the details:

- [Agent App](agent-app.md): declaration, admission, ownership, and Task policy;
- [Task Resource Engine](task-resource-engine.md): fencing, Conditions,
  dependencies, waiting, cancellation, and recovery;
- [Events](events.md): persistence-first publication and explicit routing;
- [Runtime](runtime.md), [Sessions](sessions.md), and
  [Native Coding Workers](native-coding-workers.md): attempt execution;
- [Message Lifecycle](message-lifecycle.md) and
  [Human Control Surfaces](human-control-surfaces.md): May, Conversation,
  Topics, commands, and adapters;
- [Cron](cron.md) and [Metrics](metrics.md): time and observation; and
- [Architecture](architecture.md) and [SDK](sdk.md): code composition and the
  supplied capability boundary.

## Rules

1. Every durable desired outcome belongs to one Task.
2. Every Task belongs to one App; executors own no work.
3. Admission is durable before execution starts.
4. Facts wake only explicit routes or exact Tasks.
5. Attempts are bounded, fenced, and replaceable.
6. Waits name the fact or decision that can resume the Task.
7. Pause retains work and restart preserves identity.
8. Code collects facts and applies validated effects; the LLM decides meaning.
9. Adapters observe shared resources without becoming delivery authorities.
10. Public capabilities expose meaning, not Host persistence internals.
