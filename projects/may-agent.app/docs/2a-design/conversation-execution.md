# Conversation execution

**Supports:** [Message Lifecycle](message-lifecycle.md). Keeps human discussion responsive while accepted asks and delegated work continue through the shared Task runtime.

**Choice basis:** [One authority for each resource](../1-principles/core-principles.md#one-authority-for-each-resource).

**Design status:** Accepted.
**Implementation status:** Conversation uses the shared Task runtime for turns, routed facts, Stop and recovery. Current-turn steering remains limited; the [control surface contract](human-control-surfaces.md#current-turn-control) states the supported behavior.

[Message Lifecycle](message-lifecycle.md) owns what an accepted ask means and
when it is fulfilled. This chapter owns how its bounded turn runs: admission,
ordering, authority, live control and return. The agent chooses the response;
infra runs and records it through [Task attempt admission](task-attempts.md).

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

Following [layered context](../1-principles/core-principles.md#context-is-discovered-not-dumped), the Host preserves full records and presents:

- the current Turn's complete claimed input batch, in order, and its separate reply destination;
- a focused Task's identity, revision, phase, closure, outcome and latest summary;
- the selected or replied-to Topic and its exact Task links;
- the previous proposal or question and bounded recent Turns;
- the relevant accepted Requests, current scope, and closure evidence;
- exact Task links represented by command or tool views, without expanding their bodies;
- bounded older Topic candidates, installed App responsibilities and typed input contracts.

Read exact Task detail before acting on its requirements, waits or results.
`/todo` links are navigation, not a reading list. Summary text can be bounded;
accepted Request scopes and reply/proposal identity remain intact. The LLM
decides meaning; code validates and executes its decision.

The turn prompt identifies the current Topic choices and assigned open Requests
as `selectableConversationIdentities`. This is a compact selection aid, derived
from the same context, not a second authority or a new resource. An existing
Topic must come from those choices or a successful scoped `conversation_context`
read during the turn. A follow-up's optional `requestId` must name an assigned
open Request or one saved as open through `conversation_request` during the
turn. History and `previousAttempt` can contain stale references; read or save
the current record before using them. Omit the optional link when the work does
not serve an accepted Request; preserve a real promise through its current
Request rather than dropping its link to avoid a rejection.

**Source status:** Host candidate `34eb0f33b87bf30b9b20ae0aab8ce9fdec1aada0`
provides this prompt guidance on top of merged #295. It reuses the independently
reviewed candidate `c217e5df49f71f210e90d9765626225d40c0e149`; activation is
separate. Tests cover prompt construction and scoped lookup, not model
compliance. The existing settlement checks remain authoritative. Conversation
Topic/Request errors can still be discovered after model finish; bringing their
read-only checks into the existing finish feedback path is a separate remaining
gap, not a guarantee supplied by this selection aid.

The reply destination selects delivery, not which input matters. The capability presents each batch input
once in `inputs`, with its source, and labels response routing separately as
`replyTo`. Bounded history, Requests and previous-attempt evidence remain context.
This is a presentation choice, not an SDK schema or authority change: core still
derives the reply requirement and allowed effects from the claimed inputs.

The agent considers independent asks together and applies corrections to the
same accepted ask. It saves unfinished accepted asks through the existing
Request capability before work, and returns their disposition with the answer.
Observations and corrections do not each require a new Request. Settlement
marks the considered input batch handled; it does not mechanically prove that
every ask was recognized. See [accepted Request storage](message-lifecycle.md#accepted-request-storage)
for that behavioral limit. The [batch-context trial](../../experiments/conversation-batch-context-20260928/README.md)
records the candidate source, controlled comparison and activation status.
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

Within one Conversation, one exact Task result or closure is delivered once with
its currently eligible `topicIds` (up to 100 per admission). The inbox retains
that grouped delivery receipt. Additional Topics linked later receive the same
saved evidence only for their missing links. Existing per-Topic receipts remain
valid, including across restart. Selected reports still reach only the Topics
whose caller inputs selected that report; grouping never broadens eligibility.

The purpose is to avoid repeated judgments and copied result bodies. Every
Request retains its own scope, revision and fulfillment decision. Delivery of a
shared result neither closes those Requests nor marks their requirements done.
The agent reads the supplied Topic links and decides which asks the result
answers. Separate Conversations still receive separate inputs. Already pending
legacy inputs remain accountable and are not rewritten or silently consumed.

**Availability:** grouped return admission is implemented in [Host `7b416af40`](https://github.com/hao1939/may-agent/commit/7b416af40).
Activate that Host revision before relying on grouped input. Source validation
and App integration are recorded in the [repeat-pattern follow-up](../../../may.app/design/token-efficiency-proposal-20261002.md#october-3-source-follow-up).

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
The [source checkpoint](../archive/reviews/controller-poc-recovery-review.md#conversation-capacity-and-background-pause)
records the queue/storage trial. Deployment must be verified independently.

The active Turn exposes the same exact Stop control regardless of its trigger.
Stop cancels that execution, preserves accepted Requests and leaves independent
Tasks under their own controls. A timer must not recreate the same stopped
review. Failed attempts retain paced retry; a later meaningful change or human input can
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


## Recovery and performance

- Admission and reads do not wait for a model call. EventHub never waits for
  conversation execution or adapter rendering.
- One inbox handles human and system inputs with per-Conversation execution
  ordering. Human priority applies to pending work, not instantaneous preemption.
- One wake lets the Conversation attempt handle its pending input batch. Repeated
  scheduling signals coalesce; distinct messages and linked outcomes remain in
  durable storage. A later state check does not call the agent when that work is
  already handled. The [Task attempt contract](task-attempts.md) owns batching,
  live input, bounded overflow and clock wakes.
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

1. An exact replay of a **completed** old input/idempotency key returns its
   original receipt and remains bound to its historical execution Task. An
   unfinished old input remains fenced to its predecessor and is never silently
   rebound to a successor.
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

**Deployed and live-checked.** Host revision `fe605220` implements this rule and
was activated on 2026-09-18 without a database migration or history rewrite. Its
final portable suite recorded 3,110 passes, three intentional
installation-fixture skips, zero failures, and 14,132 assertions; `check:ci` also
passed. Independent variants covered base and successor execution for Stop with
newer input/restart, same-App delegation and steering/restart, and cross-App
waiting-result delivery, repair, and restart. After coordinated activation, a
fresh human input established deterministic successor
`conversation_ec854e2f09f1c38566a25857_successor_2` in the unchanged
`may:primary` lineage while the old primary remained cancelled. The retained
source review is `/app/.state/review-pilots/evaluation-setup-20260918/recovery-review.md`;
exact source hashes are in `recovery-import-snapshot.json`, final checks are in
`recovery-final-check.log` and `recovery-final-test.log`, and the live activation
receipt is `deployment/conversation-host-activation.json` under that same review
root.


## Instructions for the current attempt

May's shared identity supplies human authority, ownership, evidence and plain communication.
The Conversation prompt supplies its bounded protocol with explicit human/system
origin; May owns linked-result judgment. Ordinary Tasks keep their existing
protocol. No role router or prompt registry is added.

The [cutover record](../archive/reviews/conversation-input-unification.md) owns retirement
of the separate supervision Task and `mayFollowUpTask` prompt. Historical input
cannot restore that executor. Context tests establish available guidance, not
model judgment; definition reload does not rewrite stored work.

Conversational Turns return an answer, authorized Task control, direct `followUp`,
or an explicit quiet system result. They cannot declare child requests.
Ordinary App requests accept text or structured input through the receiving Task
mapper, preserving requirements; `message` alone does not select Conversation.
A caller Condition expresses whether it needs the reply. Human and explicitly
routed Conversation inputs retain this bounded frontend contract, its authority
checks and full App tools, without a separate child-result coordinator or prompt.
