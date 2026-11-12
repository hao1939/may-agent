# Message Lifecycle

**Supports:** [System Model](system-model.md#understand-intent-and-close-the-loop). Retains accepted human asks and closes the loop across discussion and delegated work.

**Choice basis:** [Core Principles](../1-principles/core-principles.md#one-authority-for-each-resource).

**Design status:** Accepted.
**Implementation status:** Human Turns, accepted Requests, correlated handoffs,
linked-result review and Turn Stop use the shared Task lifecycle. New input is
durable; immediate redirection of a running Turn remains limited. The
[implementation and gaps](#current-implementation-and-gaps) distinguish Host
mechanics from App judgment and installation evidence.


Read [Conversation execution](conversation-execution.md) for bounded turns, input routing, Stop and recovery. This chapter owns human-facing Request meaning, closure and response records.

## Mental model

> Discuss and work together in Conversation. A Request is an accepted ask
> that May must close the loop on. Delegate a Task for independent execution.

```text
Human message -----------------------------------+
                                                 |
Task change -> route by saved Conversation link --+--> durable input
                                                 |          |
Timer tick -> find missed follow-up --------------+          v
                                                   Conversation's Task
                                                   one bounded attempt
                                                     |- discuss / act / explain
                                                     |- update Request
                                                     `- delegate independent Task
                                                                  |
                                                      accepted outcome returns
                                                       through the same loop
```

The timer does a bounded database check first; a quiet Conversation needs no
model call. Human input, linked Task facts and due follow-up reviews share one
handling path while retaining their source and authority. An Event requests
reconsideration; current stored state determines the response.

The product model is: **discuss in Conversation, track accepted asks as
Requests, and delegate Tasks for independent execution.** Topics organize context.
The Conversation's logical execution identity is stable from the human's
perspective. Normally one Task serves it. If that execution Task was explicitly
cancelled, fresh human input may continue through a deterministic linked
successor while the cancelled predecessor and its receipts remain immutable.
This is recovery of the same Conversation, not a new Conversation, controller,
or hidden work queue. The execution Task is not a background handoff or an
extra object the human must manage. The vocabulary is:

| Term | Meaning |
| --- | --- |
| Message | Something a human, agent or tool said |
| Conversation | The shared append-only message stream and related context |
| Inbox item | A durably admitted input and its handling/caller correlation |
| Turn | One bounded attempt of the Conversation's Task handling human input or a routed system fact, including repeated model calls and tool use |
| Request | An accepted promise to the human; it can span Turns and link Tasks |
| Topic | Related discussion and exact Task links, with no execution lifecycle |
| Task | Agent-owned durable work that handles inputs, records outcomes and stays available until explicitly closed |
| Model step | One internal model/tool cycle inside a Turn or Task attempt |
| Event | Input or a fact; an explicit route determines what acts on it |

These definitions do not imply a separate controller for each concept.
Current Request storage and remaining validation are described below.

Conversation is the default human interaction. Discussion, brainstorming,
design review, and joint problem-solving stay here for as many turns as useful.
Each execution is bounded; the discussion does not have to finish in one turn.
Length, complexity, tool use, and an expected human reply do not by themselves
justify a background Task. Conversation and Topic already preserve the context
needed to continue a discussion later.

A discussion may commission a specific independent investigation, comparison,
or implementation as a Task. Its findings return to the Conversation; the
discussion remains available for the human to shape. A Task can later need a
human decision without becoming the owner of that discussion.

There is only one kind of Task. “Delegated,” “maintenance,” and “child” describe
a Task's goal or relationship, never a different resource or lifecycle. An App
owns and reconciles Tasks; an agent, workflow, Codex, or Claude is only a
replaceable way to perform one attempt.

Conversation provides discussion, context and Request tracking; its Task owns
execution through the common controller. A linked Task result can start a new
Turn after the original human Turn ended. The original execution does not stay
alive while the child works. Conversation and maintenance usually remain open;
ordinary work is usually closed by its caller/App after accepting its outcome.
These are conventions around the same lifecycle, with no core mode switch.

Follow-through belongs to the accepting Task's agent. It reads exact linked
evidence, explains a useful result or human decision, and updates the accepted
Request through common communication. There is no separate
supervisor or independently executing inbox owner. Requests and Topic links
preserve the obligation and context; input records preserve pending handling.
The owning App keeps responsibility for Task execution and mechanical recovery stays with the Host.

## Task, Request, input and human action

**Tasks own work. Conversation Requests retain what May owes the human. Inputs
carry asks and facts to work. Conditions retain facts that work needs.** Use
"ask" as a verb; it does not introduce another resource or lifecycle.

| Term in current contracts | Meaning and responsibility |
| --- | --- |
| Task | Scoped work owned by an agent. It retains requirements, context, accepted results and remaining work across attempts. |
| Conversation Request | An accepted conversational promise to the human. May judges its scope and fulfillment through the Conversation's Task; the Request has no executor. It can span inputs and reference several Tasks. |
| App input / App request | A submitted input plus admission and caller/result correlation. The receiving App selects or addresses a Task; pending admission can exist before that Task is known. It does not represent a new conversational promise by itself. |
| Caller/result link | Connects a submitted ask to the result owed to its caller. Asking for help can establish this link between Tasks. A Task's structural parent link alone does not establish it. |
| Condition | An exact fact the Task needs to observe. A caller declares a request Condition when it needs a submitted contribution's answer; submitting work and waiting for it are separate choices. |
| Human-owned Condition | An answer, decision or action needed from the human. The agent still owns the Task. This is the opposite direction from a Conversation Request: the agent needs help from the human. |
| Response | The actual answer or explanation. Sending progress does not by itself fulfill the accepted ask. |

"Human-facing commitment" explains Conversation Request more precisely than
"human-owned response": May owes the response; the human is its recipient.
Use **Conversation Request** when discussing it beside App requests. The word
"request" in a transport or tool field does not identify one universal object.

The SDK currently uses these names; this clarification does not rename them:

| API location | Refers to |
| --- | --- |
| `AppConversationRequest`, `communication.requestUpdates` | The accepted human promise and its scope, associations or closure. |
| `TaskAppRequest`, ordinary Task `requests`, `TaskChangeReceipt.requests[].requestId` | Work/input submitted to an App and its admission identity. |
| `conditions: [{ requestId }]` | Interest in the result of an App submission, using its local or admitted identity under the caller-generation rules. |
| `TaskInput.communication.requestIds` | Conversation Requests associated with that input, when communication context exists. |
| `inputKeys` | The exact admitted Task inputs covered by a result; these are not Conversation Request IDs. |

For example, "compare two approaches and explain the recommendation" becomes
one Conversation Request. May can ask a benchmark Task for measurements through
App input. If the benchmark needs the human to restore credentials, it retains
a human-owned Condition. The human reply returns to that Task; the measurements
return to May through the caller link; May explains the recommendation and
closes the Conversation Request. Each record describes a distinct responsibility
or fact, while Tasks perform all execution.

A discussion-only answer can fulfill a Conversation Request in the existing
Conversation Task. A correction can refine that same Request. Automated
agent-to-agent escalation need not create any Conversation Request. If the
human only asked to start work, confirmation of that narrower outcome can
fulfill the Request while the delegated Task continues.

The [Task attempt contract](task-attempts.md) owns submission/result fields;
[Events](events.md#addressed-input-and-caller-requests) owns admission and caller
correlation; [human control surfaces](human-control-surfaces.md) own rendering
and returning human action. The [terminology review](../archive/reviews/task-request-terms-20261017.md)
records naming recommendations and the limits of merging these records.

## Requests: acceptance and closure

May follows this conversational pattern:

```text
user input
  -> understand intention; recognize a new Request or refine an existing one
  -> acknowledge the ask and explain what May will do
  -> discuss/work together, or admit an independent Task
  -> keep the accepted ask and exact work links visible in Conversation
  -> return the outcome and close the Request, or explain what remains
```

A Request is an accepted conversational promise to the human, recognized by May
after message admission. New input can refine an existing Request; distinct
independent asks remain distinguishable without splitting every sentence.
A simple answer can acknowledge and fulfill its Request in one turn.
Routine automated reviews record handling in turn/Task evidence; independent
background work uses Tasks. An automated result may fulfill a human's existing
Request and require its normal closure explanation. Input source alone does not
decide meaning; the App judges it using existing records.

Acknowledge clear asks naturally: “I'll compare the approaches and explain the
tradeoffs.” This confirms understanding and intended action without demanding
another approval. Ask a question when an unresolved choice materially changes
the work, cost, risk, or authority. Preserve existing authorization and follow
the [background authorization policy](conversation-execution.md#authorization-for-background-work).

| Thing | When it finishes |
| --- | --- |
| Turn | May records an answer or quiet system outcome, or execution ends through Stop, failure or its bound. |
| Request | The accepted ask is addressed and its outcome communicated, or it is explicitly cancelled or otherwise resolved. |
| Task outcome | Accepted evidence addresses the exact work considered; its caller can proceed while the Task remains open. |
| Task lifetime | An authorized App, parent agent or human closes it; closure prevents future execution and does not imply success. |

“The benchmark is running” can finish a turn while leaving the Request to
compare implementations open. Even after the benchmark Task finishes, May
still owes the comparison and explanation. A discussion-only Request can close
with a useful answer and no delegated Task; the Conversation remains available.
If the ask was only to start a benchmark, confirmed admission may itself fulfill
it; closure follows the accepted ask.

One Request represents one human promise across inputs. Clarifications refine
the accepted scope; independent intentions remain
distinct even when one Turn addresses them together. May chooses those
associations and judges fulfillment. The Host preserves them and rejects
convergence that would consume input while its accepted Request remains open.
A waiting or incomplete result retains the obligation; an unrelated answer
cannot silently fulfill it.

An open Request carries the current accepted ask, relevant Conversation/Topic
references, exact Task references when present, and an eventual closure message
and reason. Start with open or closed; derive progress, blockers, and execution
results from Tasks. Keep one authority for the accepted ask and closure, using
stored identities rather than reconstructing promises from full chat history.
Do not copy Task state or add a Request executor, retry policy, or per-Request
supervision Task. [Storage](storage.md#conversation-state-api) owns persistence
and atomic operations; May owns the meaning of the accepted ask.

Request `taskRefs` record relevant Task identities, including work discovered
through a report or another Conversation. They are metadata: saving a reference
does not assign work, create a result subscription or grant control authority.
They require no prior Topic attachment. A retained reference may point to
unavailable work; its presence is not proof that the Task exists or succeeded.
Read current Task evidence when that matters to the answer. Omitted or empty
reference updates retain earlier references.

Ordinary Task `requests` submit independent work; `conditions: [{ requestId }]`
retain a needed return. `communication` publishes human messages, selects Topics
and saves accepted Request scope or closure through an input admitted to this
Task. These effects have different identities and responsibilities. A Request
`taskRefs` update records evidence; it does not submit work or create a wait.

The original accepting Task keeps the human promise while a contributing Task
returns evidence. A review needing no further work can finish quietly; unrelated
open asks do not require new delegation. Ordinary admitted inputs can coexist
with chat input in one Task batch, retaining their payload and return identities.
The executor name `conversation` is retired and reserved, including for custom
adapters. Saved Conversation input bindings identify lineage and ownership;
executor labels never grant human authority.

Closure must match the latest accepted scope and explain the outcome in
Conversation. Persist its message and closure decision consistently, so retry
cannot lose the explanation or produce duplicate closure. Adapter delivery
acknowledgement and another human approval are not required for ordinary
evidence-backed completion. A Task's completion supplies evidence; May judges
whether it addresses the ask and supplies the human-facing explanation.

A progress report, blocker, or clarification alone leaves the Request open.
An affordable retry, narrower scope, or an explicit decision to stop may be
appropriate; state the remaining gap and respect the user's authority. Close
as cancelled or not fulfilled when that is the accepted disposition, never as
achieved. Record scope changes against the same Request when its purpose still
fits, so an omitted part cannot disappear silently.

Stopping a turn does not fulfill or cancel its Request. Retain the unresolved
ask for later human input without automatically rerunning the stopped turn.
Linked background Tasks keep their separate controls. An explicit cancellation
of the ask must account for any related work still running; changing a
conversational record alone does not stop a Task.

## Results and human updates

Task events admit system inputs to the same conversation handler. May judges
whether current evidence deserves a response and proposes useful text with the
exact links and any Request updates. The Host checks the claim and revisions,
then commits the input outcome, response and closure consistently. A quiet
system review records handled evidence without an empty chat message.

Human-facing policy requires a useful answer or explanation when the ask calls
for one; quiet system observations need no empty message. This is agent judgment
carried through the common Task result, not a second Conversation result schema.
Use `communication: [{ id, inputId, message, requestUpdates, topic }]` for the
relevant effects; the optional fields are supplied only as needed. `inputId`
selects saved recipient context, never an arbitrary destination. Communication
operation IDs are stable within the Task generation and cannot change content
on replay.

Request changes use current revision fences and exact saved input associations.
Closure requires a message in that communication operation or a valid `replyId`
to an explanation already published by the same Task generation. Shared
Conversation membership or a Task reference does not transfer the promise.
Save accepted asks and corrections before work with `attempt.apply`; accepted
updates survive later failure or Stop. Use `attempt.read.communication` for more
history or current Request records through an input admitted to this Task.

A result's `inputKeys` names its covered work. Convergence cannot consume those
inputs while an associated accepted Request remains open. This check includes
live inputs incorporated into the result using the same snapshot as settlement.
Retain a real wait or unfinished work instead, or accept an independent input
scope without consuming an older promise. Unrelated open Requests do not block
useful answers. Communication, result acceptance and input coverage settle in
one fenced transaction; the agent still judges whether the explanation is true.

Task controls use ordinary scoped actions with current target identity, creator
or human authority and revision checks. Independent work uses normal typed App
admission. There is no `decision.followUp`, Conversation-only control field or
separately supplied attachment that can redirect a handoff.

Duplicate inputs reuse stable admission/result identities. A human Turn may
already have explained a result before its queued system input runs; reread
current closure and handled evidence and complete quietly. This guarantees
consistent durable outcomes, not exactly-once external effects or model calls.

Stored input correlation owns the target Conversation and Topic; an LLM-written
label cannot redirect the answer. Message identity, not text comparison,
establishes one canonical presentation. An earlier acknowledgment cannot hide
a later failed execution. The current projection implementation is recorded
[below](#current-response-projection).

Progress is deduplicated by stable event or result identity and appears at most
once in durable Conversation. Adapters may render faster transient progress
while watching a Task, but transient output is not later used as conversational
memory.

An active Task exposes observations from its current attempt. Starting a newer
attempt does not relabel the previous attempt's summary, response, or evidence
as current progress; those facts remain in Task history until the new attempt
reports its own observation.

No component tracks “delivery to web-ui.” Conversation persistence completes
publication of the response; Request closure additionally requires the accepted
ask to be resolved. Console and Telegram independently observe
`conversation.updated` and render unseen message identities. A missed notification
can trigger a bounded Conversation reread; adapters do not promise that every message is
shown exactly once across process loss or offline time.

## Presentation adapters

Console and Telegram are adapters over the same Conversation and resources:

- both append human Turns and observe Conversation updates;
- both can select an App, Topic, or exact Task;
- each uses presentation suited to its interface;
- Console may expose slash commands and a live watch;
- Telegram may use native commands, buttons, and compact cards; and
- adapter-local cursors, selection, and transient progress are not semantic
  state.

Provider chat, terminal, thread, and message IDs are delivery coordinates, not
Conversation or Topic identity.

## Ownership boundary

Inbox admission/ownership, bounded execution and the consistency of retained
Conversation/Request/Topic records belong to the existing core responsibilities.
The conversation handler, May's judgment and follow-up policy, and concrete
interfaces are replaceable capabilities. An installation without conversation
can still run Tasks; replacing the frontend must preserve retained obligations.
[Architecture](architecture.md#conversation-core-and-capability-boundary) owns
this split and absence behavior. It does not create a fifth core component.

| Component | Owns | Does not own |
| --- | --- | --- |
| Conversation handler / May policy | Discussion, recognition/refinement/closure, linked-result review, useful replies and authorized feedback | Independent execution lifecycle, SQL, queues or mechanical recovery |
| Target App | Domain interpretation, Task outcome, execution choices and decomposition | Conversation transport or follow-up bookkeeping |
| Core runtime and state | Durable inputs, claims, ordering, bounded execution, consistent decisions and recovery | Semantic intent or automatic fulfillment |
| Composition routing | Saved-link lookup and declared Task/timer-to-input wiring | Model judgment, new work ownership or a second queue |
| Interface | Human input, response rendering and local selection | Work state or delivery-gated completion |

## Invariants

1. Human messages and explicitly routed Task/timer facts share one conversation
   handler while retaining distinct source and authority.
2. Ordinary agent/tool messages and `conversation.updated` never recursively
   start handling.
3. One Turn runs per Conversation; pending human input takes priority and Stop
   bypasses the ordinary queue.
4. An inbox item tracks handling, a Request tracks the accepted ask, and a Task
   owns independent execution. None copies the other's lifecycle.
5. A bounded Turn can answer, clarify, act, admit work or quietly handle a fact.
   Completing it does not by itself fulfill a Request.
6. Discussion stays in Conversation; exact Topic/Task links return independent
   work's evidence to that discussion without a waiting parent or supervisor.
7. Task resources own progress/results. Existing unfinished work is addressed
   by exact identity; owner-closed Tasks stay immutable while accepted results
   remain available on open Tasks.
8. Closure uses the latest accepted Request scope and commits its explanation
   consistently. Adapter acknowledgements do not gate closure.
9. Event and timer reviews use the same admission, decision and commit path.
   Duplicate or stopped input cannot become fresh work; failed input retains
   its paced retry under the continuing-Task baseline.
10. Code enforces identity, authority and consistency; the App/LLM judges
    usefulness, fulfillment and any authorized next step.

## Current implementation and gaps

### Shared execution

Conversation uses [the common Task execution path](conversation-execution.md)
for human input, linked results and timer-discovered follow-up. Human and system
origin retain their own capacity and control authority; a system review cannot
acquire human permissions or close its own execution Task. The
[unification record](../archive/reviews/conversation-input-unification.md) retains
cutover evidence. App judgment and installed adoption require their own evidence.

### Accepted Request storage

The Host stores one `conversation_requests` row per
accepted ask, keyed by App, Conversation and App-chosen ID. It holds current
scope/revision, optional Topic, exact Task links, and open/closed with a closure
reason and message identity. It owns no execution state.

A Request reference requires no prior Conversation Topic link. The
[reference contract](#requests-acceptance-and-closure) applies independently
of optional Topic organization.

May saves accepted asks and corrections through common Task `communication`,
either in `attempt.apply` or the final Task result. `expectedRevision: 0` accepts
a new ask; later updates retain its ID and use the observed revision. Input
associations and exact Task references preserve its scope across turns. A direct
answer can accept and close an ask in one Turn without creating another Task.
Stopping or failing execution does not itself close an accepted Request.

The common `attempt.events.communication` projection supplies bounded history
and Requests. `attempt.read.communication` discovers further context through
an input already admitted to the Task. Full accepted scopes remain in storage;
omitted records are discoverable rather than treated as absent.

Closure carries its explanation through the same communication or a `replyId`
to a previously published explanation in this Task generation. Request changes
are claim- and revision-fenced. A correction accepted during execution remains
saved if final settlement fails. Convergence rejects an open Request associated
with a covered input; waiting/incomplete results preserve outstanding work.
The [storage contract](storage.md#request-input-associations) owns exact linkage.

These checks preserve accepted promises; they cannot prove that the agent
recognized every ask or judged fulfillment correctly. Historical messages are
not automatically converted into accepted Requests.

### Input handling remains separate

The Host uses `AppInputContext` and `app_inbox_items` for admitted input. These
records exist before the agent understands the ask. Accepted Task results settle
only their exact covered inputs; waiting/incomplete results keep independent
obligations and return links available. An input's `done` status is not proof
that the human promise was fulfilled. The separate accepted Request stores that
judgment and explanation without an execution controller or queue.

### Current response projection

Accepted replies and exact caller feedback enter the shared Conversation read
projection. Input correlation and Topic/Task links preserve their origin; missing
required identity is a failed projection, not successful communication. The input
result can be projected again without accepting another Task outcome.

Common communication operations have stable message identities derived from
the Task generation and operation ID. Historical `result:<inputId>` and failure
projections remain readable. A transport receipt or rendered message alone never
establishes Request fulfillment.

### Naming and organization

Use `AppInputContext` for admission, `TaskInput` for exact assigned input,
`TaskCommunication` for scoped messages/Request changes, and the common
`TaskReconcileResult` for execution outcomes. Retired `ConversationTurnResult`
and its schemas decode historical data only; `conversation_context` and
`conversation_request` are not current tools.

Use `inboxId` for input correlation, the exact observed attempt/generation for
Stop, and the accepted human Request ID for scope and closure. Task request IDs
and human Request IDs remain distinct. The [source reading guide](../2b-manual/source-reading-guide.md)
locates current context, state, communication and transport modules.

### Live validation and remaining checks

The [common communication tests](https://github.com/hao1939/may-agent/blob/7d32fa337890e2ec04e0d7de8a026637952c0b2b/src/app/core/tasks/task-communication.test.ts) and
[state tests](../../../may-agent/src/app/core/state/conversation-task-turns.test.ts) exercise admission,
handoff, scoped Stop, accepted Requests and recovery across storage reopen. The
[test guide](../../../may-agent/test/README.md) separates these checks from process-loss and browser coverage.
Earlier model trials remain in the [Request follow-through review](../archive/reviews/task-runtime-organization.md#request-follow-through-review)
and [workflow review](../archive/reviews/workflow-practices-review.md).

Remaining proof is behavioral: multi-turn discussion should not create unnecessary
work; clear authorization should not prompt repeated approval; corrections should
retain their ask and revise the responsible assignment; a child's result should
produce the owed explanation; a blocker should not silently close the ask.
Measure these in real use. Source checks alone cannot certify them, and immediate
current-turn steering remains a distinct interface gap.

## Retained-state compatibility

Old execution identities and receipts remain history. Migration must preserve
accepted Requests, messages, Task links and outcomes while fencing retired
writers. An unfinished ask does not become fulfilled because an old execution
path was retired. The [simplification record](../archive/implementation/task-owned-host-simplification-20261111.md)
retains the merged-source evidence; [Operations and Recovery](../2b-manual/app-operations-recovery.md)
owns operating procedures.
