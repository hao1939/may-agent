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

Follow-through belongs to the conversation handler. It reads the exact linked
Task, explains a useful result or human decision, and updates the accepted
Request. The conversation Task actually runs this handler; there is no separate
supervisor or independently executing inbox owner. Requests and Topic links
preserve the obligation and context; input records preserve pending handling.
The owning App keeps responsibility for Task execution and mechanical recovery stays with the Host.

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
associations and judges fulfillment. The Host preserves the associations and
requires a disposition for the Requests assigned to a Turn; completing a batch
must not silently discard an accepted obligation that its answer omitted.

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

`followUp` submits durable Task work; `requestUpdates` records human promises; `response` communicates with the human.
Reply requirements belong to `response`; delegation alone requires neither a new Request nor a reply.
The agent chooses the work. On accepted settlement, the Host saves the input, Task reference and return association together.
Existing Topic-to-Task links return results through [Routing and authority](conversation-execution.md#routing-and-authority).

A review that needs no further work finishes with its summary and facts in the
current Conversation result. Unrelated open Requests or waits do not require a
follow-up for that review. When work remains, `followUp` targets an ordinary work
Task. A Conversation executor consumes input admitted through Conversation;
attaching ordinary Task work to it bypasses that input contract. Host admission
checks the actual target executor and rejects incompatible input before saving
effects. An explicit incompatible follow-up gets the same feedback during
`finish` validation, so the agent can correct it in the current attempt. An App
mapper still runs only once, during settlement, under the same atomic check.

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

The shared result schema requires a nonblank response for any considered human
input, Request closure or Task control. Automated observations, background
delegation and updates retaining an open Request may stay quiet. Delegating
work and announcing work are independent decisions: retain summary, facts,
Topic links and the exact follow-up even when no response is published. The finish
tool validates the same input-specific schema as settlement, so a missing explanation can be
corrected inside the current execution. Settlement still checks current identity,
revisions and authority transactionally; tool validation cannot replace those
checks. A mixed input batch retains its human reply requirement even when a
system fact is its most recent input. The public result schema owns requirements
attached to proposed actions; the core Conversation boundary derives the human
reply requirement from the exact claimed inputs and supplies the schema to the
executor. Settlement derives it again from those persisted inputs. Executors
consume that contract without interpreting context hints as validation policy.
`humanRequested` describes provenance, including a human parent input; it does
not turn a later automated observation into a new human ask or grant authority.

Core selects the last considered direct human input as the reply destination,
or the last considered input when the batch contains no direct human input.
Context ordering, shortened history and rendered source hints cannot change
that choice, the reply requirement or control authority. Conversation history
reads are bound to the admitted App/Conversation even if those fields are absent
from the prompt.

Task references in context help the agent discover work; they are not an
allowlist. An exact installed Task can be used outside the bounded context.
Automated Task cancellation still requires the recorded creator; direct human
input carries human authority. The agent judges whether the action fits the ask.
Core rejects missing/mismatched targets, self-cancellation, duplicate controls,
stale claims and changed target versions. Delegation uses normal Task admission.
The prepared result is data only. Settlement resolves its exact App identities
and checks current state; no Task store or callback travels inside the result.
`decision.followUp` is the single handoff authority. An explicit Task is used
directly; otherwise the attempt’s captured App declaration maps the input once
at settlement. A separately supplied attachment cannot redirect the decision.

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

May returns `requestUpdates` in its bounded decision. `expectedRevision: 0`
accepts a new ask; a correction uses the same ID and observed revision. A
`followUp.requestId` links the actual admitted Task to that ask atomically.
Acceptance/refinement is stored before handoff. Fulfilled, withdrawn and
unfulfilled dispositions preserve the accepted scope and commit with the
Conversation explanation. A simple answer can accept and close an ask in one
turn without creating a Task. A failed or stopped turn never closes it.

The existing `conversation_context` read tool lists open asks in pages of 12
(`requests`, then `afterId`) and reads a full exact ask (`request`, `id`). Bounded
prompt context retains whole records, never truncated scopes; omitted asks
remain discoverable. Request updates use at most eight records per decision,
2,000 characters per scope and 32 exact Task links per ask. These are explicit
bounded-context limits, not a guarantee of bounded total SQL query cost.

Linked results and missed-change discovery enter the same Conversation Task.
The handler receives current Request records and returns `requestUpdates` through
`ConversationTurnResult`. Accepted updates and the reply settle together; stale
revisions reject. There is no separate supervisor result protocol.

The `conversation_request` tool can save a new ask, accepted scope correction,
or association with current input before work starts. An existing ask can omit
unchanged scope. Its write is fenced by the current claim and Request revision.
That saved correction survives a later failed or stopped attempt. Final closure
still requires a current decision and explanation; it cannot silently revise scope.

The [Request input associations](storage.md#request-input-associations) change
adds agent-chosen `inputIds` and presents their Requests as `assignedRequests`.
Each assigned Request, including one saved during execution, needs an explicit
final disposition. Omission rejects settlement and retains the input for ordinary
Task recovery. An open outcome explains continuing work or the remaining gap and
actual wait in that Request's own nonblank reason, as required by the result schema.
New input defers a proposal as `unacceptedResult` for reconsideration;
its effects are never automatically replayed. These additions require the matching
Host change; source changes alone do not establish installed behavior.

Core tests prove storage, fencing and context availability. They do not prove
that a model recognizes every ask or closes it truthfully. Historical messages
are not automatically converted into accepted Requests.

### Input handling remains separate

The Host uses `AppInputContext` and `app_inbox_items` for accepted input
handling. These rows are
created before May understands the input. The
[request handler](../../../may-agent/src/app/core/inbox/app-inbox-host.ts) completes a
frontend row after a direct answer or durable follow-up admission; Task-based
caller rows may instead wait for a Task result. Neither row's `done` status is
proof of human fulfillment. The separate accepted Request stores that judgment
and its Conversation explanation; it adds no execution controller or queue.

### Current response projection

Accepted replies and exact caller feedback enter the shared Conversation read
projection. Input correlation and Topic/Task links preserve their origin; missing
required identity is a failed projection, not successful communication. The input
result can be projected again without accepting another Task outcome.

Direct replies use `result:<inputId>` as their stable message identity. Historical
fallback reads prefer an explicit message when one exists. Failed handling uses
`failure:<inputId>` so an acknowledgment cannot hide a later failure. Neither a
receipt nor a rendered message independently establishes Request fulfillment.

### Naming and organization

Use `AppInputContext` for admitted input context, `ConversationTurnResult` and
`conversationTurnResultSchema` for the decision, and `modelStepCount` for internal
cycles. Retired `AppRequest`, `AppRequestDecision` and
`appRequestAgentResultSchema` aliases are no longer current exports. Existing
`turn_start` execution events and retained counters describe model activity,
not a new human Turn lifecycle.

Use `inboxId` for input correlation, the exact observed Turn identity for Stop,
and `requestId` for the accepted ask. Preserve durable IDs and published events
at compatibility boundaries rather than migrating stored data just for spelling.
The [source reading guide](../2b-manual/source-reading-guide.md) identifies the
current context, decision, state and transport modules.

### Live validation and remaining checks

The [Task runtime tests](../../../may-agent/src/app/core/tasks/conversation-runtime.test.ts) and
[state tests](../../../may-agent/src/app/core/state/conversation-task-turns.test.ts) exercise admission,
handoff, scoped Stop, accepted Requests and recovery across storage reopen. The
[test guide](../../../may-agent/test/README.md) separates these checks from process-loss and browser coverage.
Earlier model trials remain in the [Request follow-through review](../proposals/task-runtime-organization.md#request-follow-through-review)
and [workflow review](../proposals/workflow-practices-review.md).

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
path was retired. The [cutover record](../archive/reviews/conversation-input-unification.md#retained-state-compatibility)
retains the version-specific behavior; [Operations and Recovery](../2b-manual/app-operations-recovery.md)
owns operating procedures.
