# Message Lifecycle

**Design status:** Accepted; one Task lifecycle baseline refined September 11, 2026.
**Implementation status:** Reviewed Host `649d801c` implements human Turns,
direct Task handoff, accepted Requests and atomic closure. Human input and linked
Task/timer reviews execute through one stable Conversation Task, merged in #158.
The [unification review](../proposals/conversation-input-unification.md) records
the paired App changes and acceptance evidence. Remaining old SDK mode names
are a separate contract cleanup, not a second inbox or supervision executor.
Current-turn steering remains separate work. Conversational child waits were
retired in Host #140; retained-state behavior is described below.

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
| Request | An accepted ask May owes an outcome to; it can span Turns and link Tasks |
| Topic | Related discussion and exact Task links, with no execution lifecycle |
| Task | An App-owned execution identity that handles inputs, records outcomes and stays available until its owner closes it |
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

Recognizing a Request is semantic judgment by May after message admission. A
new message may answer a question, supply context, or correct the same Request;
it does not automatically create another promise. Keep distinct independent
asks distinguishable, without mechanically splitting every sentence into a
Request. A simple question can be recognized and answered in the same turn.
Its direct answer can also acknowledge the ask; routine replies need no formal
restatement or separate confirmation step.

Acknowledge clear asks naturally: “I'll compare the approaches and explain the
tradeoffs.” This confirms understanding and intended action without demanding
another approval. Ask a question when an unresolved choice materially changes
the work, cost, risk, or authority. Preserve existing authorization and follow
the [background authorization policy](#authorization-for-background-work).

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

An open Request carries the current accepted ask, relevant Conversation/Topic
references, exact Task references when present, and an eventual closure message
and reason. Start with open or closed; derive progress, blockers, and execution
results from Tasks. Keep one authority for the accepted ask and closure, using
stored identities rather than reconstructing promises from full chat history.
Do not copy Task state or add a Request executor, retry policy, or per-Request
supervision Task. [Storage](storage.md#conversation-state-api) owns persistence
and atomic operations; May owns the meaning of the accepted ask.

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

## Frontend: one bounded turn

The conversation handler serves both human and routed system inputs. For human
input, a Turn is a complete interactive work cycle, not one model response:

```text
input -> understand -> act -> inspect evidence -> answer
                        ^           |
                        +-- repair -+
```

Continue authorized work until the ask is addressed, human input is necessary,
independent work is durably handed off, or execution must stop. A bug fix may
include reproduction, edits, tests and corrections in the same Turn. A design
discussion may end this Turn with a useful explanation and continue when the
human replies. A progress message alone is not a reason to end executable work.

| Stopping point | Effect on the accepted Request |
| --- | --- |
| The answer or verified work addresses the ask | May may close it with the explanation |
| A material question needs human input | Leave it open; continue the discussion on the reply |
| Independent work is durably admitted | Usually leave it open; admission fulfills it only if starting work was the accepted ask |
| Budget, failure or interruption stops execution | Preserve evidence and the unresolved ask; never report the limit as fulfillment |

The existing executor owns the model/tool loop. No outer Request controller or
second LLM judge is needed for every Turn. Code enforces authority, shapes and
execution limits; the App/agent judges usefulness and whether further work is
worth its cost. Progress should remain visible and Stop available while work
runs. Current ordinary input queues behind the active Turn; admission remaining
responsive is not a claim of seamless steering or concurrent conversation.

Every human surface publishes the same event:

```text
conversation.message.created
  target: app:may
  data.conversationId: may:primary
  data.author.kind: human
```

The Host admits the message once by message identity. Human-authored messages
enter the handler as human input. Selected linked Task facts enter through an
explicit system-input route, never by forging a human message. Agent, tool,
command, and transient Conversation messages remain context/presentation and
do not recursively invoke May. `conversation.updated` remains a presentation
hint, never an execution trigger.

Admission does not wait for a Conversation read or a previous May decision.
It durably records the human message and its inbox item, returns
that receipt, and only then emits the coalesced `conversation.updated`
presentation wake.
Presentation resynchronizes from the Conversation resource, so this wake is
level-triggered and never belongs on the human admission call stack.
After admission returns, the handler claims one Turn per Conversation. Human
messages retain their order and take priority over pending system reviews.
An active Turn finishes or is stopped before another starts. Serialization
belongs here because it protects conversational meaning, not in the EventHub.
One Conversation therefore remains coherent, while independent Conversations
may be handled concurrently within the interactive capacity bound.

This is handler-local serialization, not serialized event delivery. A later
Turn is already a durable, observable Event while an earlier Turn is being
handled. It waits only for May's next claim in that Conversation; EventHub can
continue admitting and fanning out every independent event.
Explicit [current-turn control](human-control-surfaces.md#current-turn-control)
must bypass this ordinary turn queue. The public Stop event does so; it commits
the exact turn disposition before aborting that execution.

Code collects bounded structured context:

- the current Turn and visible adapter scope;
- a focused Task's complete decision view, when supplied;
- the selected or replied-to Topic and its exact Task links;
- the previous proposal or question and bounded recent Turns;
- the relevant accepted Requests, current scope, and closure evidence;
- exact canonical snapshots represented by command or tool views;
- bounded older Topic candidates when the human refers to earlier work; and
- installed App responsibilities and typed input contracts.

The LLM decides meaning. Code validates identities and executes the decision.
There is no keyword router or second intent classifier.
Human input's `metadata.topicId` is preserved as `input.data.context.conversationTopicId`
during admission. Context preparation validates its App/Conversation scope and
prefers an explicit reply's Topic. This hint is distinct from the committed
inbox Topic: the agent may choose another Topic or none.

The frontend makes one of three decisions:

1. **Respond in this turn.** Discuss, answer, investigate, edit, and verify
   authorized work using the supplied bounded tools. A reply may continue the
   discussion without concluding it. Tool use alone requires
   neither a Task nor a handoff. Check current evidence before retrying an
   interrupted effect; do not launch detached work or bypass an existing Task's
   owner or operation controls.
2. **Clarify.** Ask one high-quality question only when the missing choice
   materially changes outcome, owner, risk, proof, or authority.
3. **Admit or steer background work.** For an authorized outcome that can
   advance independently, answer anything useful now, then publish one typed
   App request or exact-Task feedback containing the chosen Topic, desired
   outcome, constraints, acceptance, and an exact Task reference when one
   already fits. Keep any ongoing discussion in Conversation.

Use a Task when independent work needs background continuation, later work
control, or restart-safe execution. Creating a Task is not necessarily
delegation: May may own and execute an ordinary Task. Choose another App for
existing ownership, specific authority, or useful expertise/workflows, not
merely a matching name.

Direct work uses the existing bounded App tool profile, guards and timeouts.
Its stored result is not transactional with arbitrary external tool effects.
After interruption, read current evidence before repeating a consequential
action; do not claim exactly-once execution or launch detached work.

Durable admission completes the background handoff and allows the frontend
turn and its Host handling record to finish. The conversational Request stays
open when its promised outcome is still outstanding. It retains exact Task
links without keeping the frontend execution waiting. May remains available
for the next turn while the Task runs.

Handoff allows the turn to end; it does not require abandoning useful independent
work within its budget. A later turn can answer another question while older
results remain outstanding. Preserve each ask and return link separately:
answering the new question does not fulfill the earlier Request. See
[execution and outstanding results](system-model.md#execution-and-outstanding-results)
for the common contract and the limits of current Task dependency submission.

### Authorization for background work

Approval concerns the work, not whether it runs in the current turn or in the
background. May may admit already-authorized, in-scope work as a Task without
asking again just for that execution choice. A request to discuss alternatives
authorizes discussion, not implementation or an unsolicited background project.

When a proposed Task needs a human decision about scope, cost, risk, or authority
that existing instructions do not cover, explain the concrete work and obtain
that decision in Conversation. Respect an explicit preference to review
background assignments first. Reuse ordinary proposals and replies such as
“yes, proceed”; no separate approval resource or configurable approval engine
is required. The App/LLM interprets intent and scope; code validates and executes
the selected action within existing operation controls.

### Visible admission and progress

Speech and action remain visibly distinct. May's message explains what it
understood, recommends, or intends. Once Runtime has durably admitted the
follow-up to an exact Task, it appends one structured tool-authored activity to
Conversation with that Task identity. The activity is evidence of what the
system actually accepted; it is not another May reply. An adapter may use the
identity to begin a local watch immediately. This activity references only the
responsible Task; result follow-up needs no intermediate assignment or
automatic watch target.

Only human-relevant semantic activity is presented by default: Task admission,
meaningful progress, a real wait or human decision, recovery that changes the
Task, and completion. Heartbeats, database writes, queue movement, duplicate
wakes, transport receipts, and executor lifecycle chatter remain diagnostic.
The current Task resource is always authoritative; activity is a presentation
and correlation aid, not another work state.

### Natural conversation rules

| Human situation                                 | May's decision                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| “Let's discuss the controller design.”          | Work through it together in Conversation, across as many turns as useful.            |
| “This needs a deeper discussion.”               | Continue the discussion; length or difficulty alone does not justify delegation.          |
| “Run the comparison in the background while we discuss the tradeoffs.” | Admit the authorized comparison as a Task; keep the discussion interactive. |
| “Any result from that comparison?”             | Read the Request's exact Task and explain what is complete and what remains.         |
| “Actually, compare memory use too.”             | Refine the same Request and send authorized feedback to its exact unfinished Task.   |
| “Does this wait make sense?”                    | Read the focused Task and answer; no mutation.                                       |
| “Fix this typo and check it.”                  | Use authorized tools directly; return the verified result without a handoff.         |
| “Keep working after I close the console.”      | Admit one ordinary Task; May can own it and retain the findings.                     |
| “It does not; fix it.”                          | Answer and publish feedback for that exact Task.                                     |
| “Agree, do it.”                                 | Apply the preceding proposal in the same Topic.                                      |
| “Also include pending benchmarks.”              | Refine the existing Task when its owner and goal still fit.                          |
| “Do this across every App.”                     | Start distinct work only when the accountable scope truly changed.                   |
| “Continue the cleanup we discussed last month.” | Resolve the older Topic with bounded read-only lookup, then continue its exact work. |
| The referenced Task already has an accepted result | Keep that evidence immutable; send authorized follow-up to the open Task, or create new linked work if it is closed. |
| Task finished but the requested explanation is missing | Return the explanation; close the Request only when its accepted ask is addressed. |
| Meaning remains materially ambiguous            | State the likely interpretation and ask the smallest concrete question.              |

Clarification is ordinary multi-turn Conversation, not a draft resource or
hidden state machine. May preserves answers already given, does not ask for
discoverable facts, recommends a safe default, and proceeds when the human
delegates the choice back to May.

## One conversation input path

The Conversation's stable Task uses the same [reconciliation model](architecture.md#one-reconciliation-model)
as every other Task. Durable input wakes it, one bounded attempt handles the
input, and fenced settlement records the outcome and any conversation decisions.
When a child returns a result, that result enters the same loop. This replaces
separate conversation execution and recovery; it does not make every linked
Task a prerequisite for answering the next human input.

Every admitted input names its Conversation and retains its source. A linked
Task input also carries the exact App/Task and Topic references and originating
change identity. Request scope and Task evidence are reread at handling time;
event text cannot grant authority or replace the latest accepted ask.

| Trigger | Admission and handling |
| --- | --- |
| Human message | Admit by message identity; understand or refine the ask and handle authorized work |
| Linked Task change | Resolve saved links; admit a system input; review current evidence and return a useful outcome |
| Timer review | Query bounded pending follow-up; admit the same system input only when a relevant change remains unhandled |

Reuse `conversation.task.changed` for linked work, with a typed App input
selected by an explicit route. No additional `conversation.wake` wrapper is
needed. The timer can keep `conversation.supervision.review` as its existing
publication name during migration; that name does not require a supervision
Task. Public event renaming is not a prerequisite for this simplification.

### Routing and authority

A small composition function connects Task facts to the conversation inbox.
The durable Topic-to-Task link acts as the subscription. Runtime publishes Task
facts independently of Conversation; routing finds the exact interested links.
No per-Task watcher, adapter framework or App-owned queue is required. Creating
a link also checks current Task evidence, covering work that finished before
the link was saved. Multiple linked Conversations retain separate input and
response identities.

Start with accepted results, cancellation, and states needing a human decision,
including an explicit wait or exhausted failure. Any open Task can report
a useful accepted outcome without closing. Routine progress remains
available in Task views; do not invoke the model for heartbeats or every attempt
update. Any later proactive progress trigger must justify its recurring cost.

A system input is evidence about existing work, not a new human ask. It does
not automatically create a Request, expand authority, enable an App or restart
stopped work. The handler checks current links and Request revisions before
applying a decision. An exact link permits the bounded cross-App read already
needed for follow-up, not a scan of another App's Tasks.

A result subscription asks for a later review; a required dependency can also
prevent an owner's execution or completion. Both use exact retained links and
events, but they are not interchangeable. Discussion remains available while
linked work runs. Keep existing Topic/Task and Task dependency relations rather
than introducing a universal relationship resource.

A closed Request does not suppress a new useful result from an open Task.
Report the new finding on its evidence without claiming another fulfillment of
the old ask or inventing a new human request.

### One bounded decision

The handler prepares the same bounded Conversation context used for human
input, plus the trigger and current linked evidence. Code gathers facts and
checks effects; May judges what matters. The same result contract can:

- return an explanation and close a Request as fulfilled, withdrawn or
  unfulfilled when its latest accepted scope permits that disposition;
- ask for a concrete human decision, leaving the Request open;
- send authorized feedback to the same unfinished Task; or
- complete quietly when the change was already addressed or needs no response.

A system review is a bounded follow-up, not authority to carry out an extended
repair in the interactive lane. Independent further work follows ordinary Task
admission and the existing authorization rules. The target App decides whether
that input maps to existing or new work. Accepted results remain immutable;
open Tasks may accept follow-up input. Closed Tasks require new linked work.

Result return and human decisions are retained from the old supervision policy.
Automatic model investigation of every quiet Task is removed from the default.
Evidence of drift can still be considered on a relevant event or human question;
Task owners retain execution, retry and recovery. Age alone does not create a
new Task, a repair strategy or a model turn.

### Ordering and Stop

Retain durable ordered input and use the conversation Task's claim fence and
execution limits. At most one Turn executes for a Conversation. Pending human
messages have priority over system reviews; there is no new preemption mechanism or mid-turn event injection.
An active system review can therefore delay a human answer until it finishes
or the human stops it. Reads, admission and Stop remain responsive.

System reviews use the existing background capacity lane; the interactive
reserve remains available to human input. Selecting the same handler or App
must not automatically give a timer review human priority. At a single total
execution slot there is no physical reserve, so bounded execution and Stop
remain the responsiveness limit.

For the common Task lifecycle, allow one human Turn per App in addition to its
declared background-attempt limit, within the total Host limit. Multiple human
Conversations in the same App share that interactive slot. A paused App can
handle admitted human input while its background Tasks and system reviews wait.
The [source checkpoint](../proposals/controller-poc-recovery-review.md#conversation-capacity-and-background-pause)
exercises this through the common queue and storage claim; installed cutover
remains unfinished.

The active Turn exposes the same exact Stop control regardless of its trigger.
Stop cancels that execution, preserves accepted Requests and leaves independent
Tasks under their own controls. A timer must not recreate the same stopped or
retry-exhausted review. A later meaningful change or explicit human input can
justify a fresh review; an open Request alone cannot.

### Timer safety net

The schedule produces a tick; code queries current state before admitting any
model work. Start with the existing 15-minute interval and at most 100 eligible
links per tick. Select unhandled accepted outcomes or decisions still needing
follow-up, including terminal Tasks whose explanation is missing. An open
Request on unchanged healthy work, or a discussion awaiting the human, does
not by itself qualify.

Use stable paging/order so a bounded batch can make progress across all eligible
links. An existing pending review retains its handling identity; repeated ticks
do not create another review or reset its failure budget. Record handled and
quiet outcomes against the relevant change and observed Request revision using
existing inbox/result evidence. The next unchanged tick should require no LLM
call. A newly linked or revised Request can need a fresh review of an older
Task result; admission identity must distinguish that obligation from an
already handled one. A new meaningful Task result is likewise reviewable.

Events and timer discovery both enter the same durable admission path. Event
publication is not proof of follow-up acceptance, and a passive subscriber is
not the queue. Recover admitted unfinished handling through the common Task
claim/recovery path; retain admission recovery for inputs not yet attached.
If a notification was missed before admission, the database check can discover
the outstanding outcome later. There is no guaranteed 15-minute response
latency: capacity, paging, failures and deliberate Stop can delay or prevent it.

This optional App schedule improves eventual follow-through. Removing it leaves
normal event-driven responses and accepted state intact, but removes this
fallback discovery. Required Task/admission recovery timing remains Host-owned and
independent of the App schedule.

### May-owned durable work

May may request a normal May goal Task when it can own the ongoing commitment.
Use another App for existing ownership, required authority, or useful expertise
and workflows; an available App with a matching name alone does not require a
handoff. That Task uses the same Task interface, events, recovery, and executor
choices as every other Task. It may run the May agent, a workflow, Codex, or
Claude. It exists for its concrete outcome, not to shadow a Conversation or a
delegated Task.

## Results and human updates

Task events admit system inputs to the same conversation handler. May judges
whether current evidence deserves a response and proposes useful text with the
exact links and any Request updates. The Host checks the claim and revisions,
then commits the input outcome, response and closure consistently. A quiet
system review records handled evidence without an empty chat message.

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

## Recovery and performance

- Admission and reads do not wait for a model call. EventHub never waits for
  conversation execution or adapter rendering.
- One inbox handles human and system inputs with per-Conversation execution
  ordering. Human priority applies to pending work, not instantaneous preemption.
- Duplicate Task wakes reuse durable identity. Do not coalesce distinct linked
  outcomes by overwriting a single in-memory Conversation flag.
- The timer checks stored follow-up evidence first. Completed or quiet handling
  prevents repeated model calls for the same unchanged facts.
- Failed or stopped inputs remain visible. Ordinary bounded recovery may redo
  permitted work; the timer does not bypass failure limits or Stop.
- Task runtime recovery continues independently on the original Task. Returning
  a missing explanation never reexecutes the completed Task.
- Reads and scans are bounded. An output limit alone does not prove cheap SQL;
  measure query plans and candidate paging before claiming scale or latency.

### Cancelled Conversation execution and successors

Task cancellation remains a real fence: it stops that execution identity and
retains its history. It does not prove that the human withdrew the whole
Conversation, nor may routine hygiene infer withdrawal from quietness, a done
Turn, or a fulfilled Request. Conversation and maintenance Tasks are standing
by convention and must be preserved unless current canonical evidence contains
an explicit owner decision to end the responsibility.

When a Conversation execution Task is already cancelled, the recovery rule is:

1. An exact replay of an old input/idempotency key returns its original receipt
   and remains bound to its historical execution Task.
2. Fresh **human** input may create the next deterministic Task in the same
   Conversation lineage, linked to the cancelled predecessor. It does not
   resurrect or mutate that predecessor.
3. Background feedback, timer input, or a late child result cannot create a
   successor by itself. It may be routed only after fresh human input has
   established a live successor.
4. Turn preparation and completion, Request updates, Stop, linked-result
   routing, pending-change discovery, and restart recovery resolve the retained
   execution binding rather than recomputing only the first Task ID.
5. Request creator checks accept an execution Task proven by the Conversation's
   stored inbox binding, while retaining existing claim, revision, App, and
   foreign-actor guards.

This is a narrow compatibility mechanism for terminal Conversation execution,
not permission to replace arbitrary cancelled Tasks. Explicit Task Stop and
cancellation controls retain their current scope. App policy must prevent the
avoidable case: cleanup and hygiene reviews preserve Conversation execution
Tasks and linked successors unless the human or owning App explicitly withdraws
the whole Conversation.

**Reviewed candidate, not deployment evidence.** Host candidate `fe605220`
implements this rule on the deployed `4bdd5384` line. Its final portable suite
recorded 3,110 passes, three intentional installation-fixture skips, zero
failures, and 14,132 assertions; `check:ci` also passed. Independent variants
covered base and successor execution for Stop with newer input/restart,
same-App delegation and steering/restart, and cross-App waiting-result delivery,
repair, and restart. The retained review is
`/app/.state/review-pilots/evaluation-setup-20260918/recovery-review.md`; exact
source hashes are in `recovery-import-snapshot.json`, and final logs are
`recovery-final-check.log` and `recovery-final-test.log`. These receipts establish
the reviewed source candidate only. The running Host and natural May message
path must be read after coordinated activation before rollout is claimed.

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
   by exact identity; completed one-off Tasks stay immutable.
8. Closure uses the latest accepted Request scope and commits its explanation
   consistently. Adapter acknowledgements do not gate closure.
9. Event and timer reviews use the same admission, decision and commit path.
   Duplicate or stopped input cannot become fresh work; failed input retains
   its paced retry under the continuing-Task baseline.
10. Code enforces identity, authority and consistency; the App/LLM judges
    usefulness, fulfillment and any authorized next step.

## Current implementation and gaps

### Shared execution is implemented; adoption is a separate fact

Host #158 replaced separate conversational execution and supervision with
the common Task runtime. Linked results, owner closure and timer-discovered
follow-up enter that same Conversation Task. Human and system origin remain
distinct for capacity and control authority; a system review cannot acquire
human permissions or close its own execution Task.

The [implementation review](../proposals/conversation-input-unification.md)
owns the paired App revision, retained-state cutover and validation evidence.
Earlier unsuccessful trials and the previous `may/conversation/follow-up`
design remain in the linked review history, not as another current execution
path. Source integration does not establish the installed version or prove
that every real conversation receives appropriate App judgment.

### Accepted Request storage

The Host stores one `conversation_requests` row per
accepted ask, keyed by App, Conversation and App-chosen ID. It holds current
scope/revision, optional Topic, exact Task links, and open/closed with a closure
reason and message identity. It owns no execution state.

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

The existing supervision wake includes current Request records. May may return
the same `requestUpdates` contract in `result.conversation`; its closure and
message are stored together, with stale revisions rejected. The existing
recovery scan includes terminal linked Tasks while their accepted ask remains
open, so losing the first completion wake need not lose the owed explanation.
An open discussion without linked work waits for human input, not another
controller. Stopped-turn recovery remains suppressed even when its ask is open.

Host and May App changes must be reviewed together: the Host validates and
stores the decision; May's supervision guidance supplies meaning and judgment.
Portable tests prove storage, fencing and context availability, not that a live
model always recognizes or fulfills every ask. Existing historical messages
are not automatically converted into accepted Requests.

### Input handling remains separate

The Host uses `AppInputContext` and `app_inbox_items` for accepted input
handling; `AppRequest` remains a deprecated compatibility alias. These rows are
created before May understands the input. The
[request handler](../../../may-agent/src/app/core/inbox/app-inbox-host.ts) completes a
frontend row after a direct answer or durable follow-up admission; Task-based
caller rows may instead wait for a Task result. Neither row's `done` status is
proof of human fulfillment. The separate accepted Request stores that judgment
and its Conversation explanation; it adds no execution controller or queue.

### Current response projection

The current follow-up projection uses stored Host input correlation where
available, otherwise the validated Conversation/Topic named in the Task result.
If neither resolves, it reports rejection rather than successful communication.
Unification moves this response through normal conversation input completion.

Direct answers use `result:<requestId>` for both their explicit message and
bounded compatibility projection; reads prefer the explicit message. The
inbox result remains execution evidence, not a second message. Failed handling
uses `failure:<inputId>` so an earlier acknowledgment cannot hide its failure.
Preserve these identities and historical messages when retiring the old path.

### Naming and organization

Use `AppInputContext` for admitted input context, `ConversationTurnResult` for
the conversational result, and `modelStepCount` for internal cycles. These
names and the shared state/handler boundary landed through
[#129](https://github.com/hao1939/may-agent/pull/129) as `0bedd93a`; the
[implementation review](../proposals/storage-state-service.md#candidate-review-and-landing-order)
records the code map and verification. `AppRequest` remains a deprecated input
context alias. With child-wait retirement, `AppRequestDecision` and
`appRequestAgentResultSchema` become deprecated aliases of the single
`ConversationTurnResult` contract; they no longer accept `dependencies`. Existing execution event names such as `turn_start` and retained
`turnCount` counters describe model steps, not human Conversation Turns.

Use `inboxId` for input correlation, `turnId` when targeting its human execution,
and `requestId` for the accepted ask. A Turn can reuse its inbox identity; this
requires no new record or identity generator.

Keep durable IDs and existing external compatibility at explicit boundaries;
do not migrate SQLite columns or published events merely for spelling. The
[storage proposal](../proposals/storage-state-service.md#conversation-state-and-handler-extraction)
owns the coordinated extraction and caller migration. Current ten-minute turn
timeouts and shared tool-count/elapsed-time finish prompts are execution cost
controls, not evidence of fulfillment. Tune them from observed premature stops
or excess cost; this refinement does not change their values or add auto-retry.

### Live validation and remaining checks

The [September 11 Request follow-through review](../proposals/task-runtime-organization.md#request-follow-through-review)
checks Stop plus queued correction across SQLite reopen, linked Task non-success,
recovery of missing explanation, stale-scope rejection and atomic closure. These
are deterministic checks of Host mechanics with supplied App decisions; they do
not establish the model judgments below. Candidate source and validation status
remain in the review.

The September 10 local May/Scout trial verified a new ask staying open through
handoff to the exact existing HN Task, a new source-grounded cycle, and May
returning its result before closing that ask. The standing Task retained its
identity and generation. The trial exposed and repaired two handoff gaps:
converged maintained Tasks were rejected as terminal, and the model needed
explicit guidance to leave handoff link creation to the Host. See the
[workflow validation record](../proposals/workflow-practices-review.md).

This is one observed path, not long-run certification. Continue verifying: a
multi-turn discussion creates no delegated Task; acknowledgment needs no redundant
approval; corrections keep
the same Request; handoff leaves an unfulfilled Request open; completed Task
results still produce the owed explanation after restart; a blocked Task does
not silently close its Request; and cancellation or scope changes have explicit
outcomes. A delayed closure must not overwrite a newer accepted ask.

## Retained-state compatibility

The current supervision identity is `may/conversation/follow-up`. Its retirement
must preserve messages, exact Topic/Task links, Requests, accepted results and
audit Events. Drain or fence its active execution before switching to the new
consumer; do not run both response writers for the same work. Retire that exact
Task through a verified scoped retirement procedure and retain its history
rather than deleting it or minting a successor supervisor. Current generic Task
cancellation rejects maintained Tasks; do not assume it can perform this
retirement. The implementation must establish the supported procedure before
cutover. Reconstruct eligible pending follow-up from canonical linked evidence
through the normal new admission path, honoring
handled and stopped dispositions. The [unification review](../proposals/conversation-input-unification.md#implementation-order)
owns the source/cutover sequence; [Operations and Recovery](../2b-manual/app-operations-recovery.md)
owns separately authorized operating procedures.

The retirement upgrade ends unfinished old child waits with
`handling.phase: failed` and a visible explanation. A separate `failure:<inputId>`
message keeps that explanation visible alongside an earlier `result:<inputId>`
acknowledgment.
The old input is no longer scheduled. Accepted Requests stay open, and already
admitted child inputs and Tasks continue independently with their history and
results intact. A new human turn can review that work and decide what remains.
This deliberately gives up automatic aggregation by the original turn; it does
not claim fulfillment or create replacement work. The accepted rule is tracked
with candidate evidence in the [simplification proposal](../proposals/authority-boundary-simplification.md#1-one-durable-delegation-path).

## Instructions for the current attempt

May's shared identity supplies human authority, ownership, evidence and plain
communication rules. The conversation prompt supplies the common bounded
protocol with explicit human or system origin; linked-result judgment belongs
to May's policy. Ordinary Task attempts keep the existing Task protocol.
There is no new role router or prompt registry.

The #158 cutover retires the separate supervision Task and its special
follow-up prompt dependency. Retained historical input may still mention
`mayFollowUpTask`; it does not authorize restoring the retired executor.
Context tests prove available guidance, not model judgment. Use the existing
cutover evidence to assess an older installation rather than assuming a
definition reload rewrites its stored work.

Every conversational Turn uses the same result schema: answer, authorized Task
control, or direct `followUp`; the unified design also admits an explicit quiet
system result without a Conversation message. It cannot return child-request dependencies.
The installed input catalog includes May's own durable goal contract and excludes
its conversational input kinds. Exact feedback and human cancellation retain
their validation and authority rules. Frontends reuse the bounded full App tool
profile; there is no separate child-result prompt or deputy execution mode.
