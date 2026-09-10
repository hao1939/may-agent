# Message Lifecycle

**Design status:** Accepted.
**Implementation status:** Bounded direct investigation/editing/verification,
the conversational frontend, visible
`may/conversation/follow-up` maintain Task, direct responsible-Task admission,
linked-Task wakes, explicit terminal Conversation append, and
window-independent response identity are implemented. The supervision Task no
longer mediates, parents, or waits on destination work. The shared Task
projection filters progress and accepted observations by exact attempt
identity; prior-attempt observations remain history.
Host PR #112 implemented accepted Request records and fenced closure, input-lease
renewal containment, failed-turn disposition, and durable current-turn Stop.
The Console exposes `/stop`; a stopped turn cannot silently retry, and
independent Tasks continue. This does not claim every adapter implements the
complete [Stop/Steer experience](human-control-surfaces.md#current-turn-control).
The Host `AppRequest`/inbox row still tracks input handling and can finish at
Task admission; it is not the accepted ask. See
[current implementation and gaps](#current-implementation-and-gaps) for storage
and the distinction between implementation tests and live validation.

## Mental model

> Discuss and work together in Conversation. A Request is an accepted ask
> that May must close the loop on. Use a Task for independent execution.

```text
Human
  <-> May frontend
        |- recognize or refine a Request; explain the intended action
        |- discuss, clarify, or perform bounded work together
        `- admit or steer independent background work
                              |
                              v
                    Topic -> exact Task
                              |
                              v
                    Task events/results
                              |
                              v
                 May supervision Task
                    |- no-op
                    |- steer exact Task
                    `- return outcome to Conversation -> close or update Request
```

The conversation model uses these concepts:

- **Conversation** is the append-only message stream shared by Console,
  Telegram, and future adapters.
- **Request** is an accepted ask that May owes an appropriate outcome to;
  it can span several Turns and reference background Tasks.
- **Topic** connects related Turns and exact Task references. It has no work
  state.
- **Task** is an executable goal owned by one App.
- **Event** is a fact or input that wakes the component that can act on it.

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

Conversation and Task are separate responsibilities, not separate execution
engines. The Host's shared bounded executor serves:

- the **frontend**, which handles one conversational turn and may use tools;
- ordinary **May-owned Tasks**, which continue concrete work across attempts;
- the existing **supervision Task**, which keeps linked work aligned and useful.

The supervision Task is not a wrapper for a Conversation turn or a parent of
delegated Tasks. Conversation, Topic links, the actual responsible Tasks, and
the event log preserve the evidence used for Request tracking. The supervision
Task owns only May's recurring responsibility to observe those links, challenge
stale or drifting work, and return useful updates. Other concrete outcomes
that belong to May use separate normal May-owned Tasks.

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
| Turn | May returns its response or the human explicitly stops that turn. |
| Request | The accepted ask is addressed and its outcome communicated, or it is explicitly cancelled or otherwise resolved. |
| Task | A goal Task reaches accepted completion or another terminal disposition; a maintain Task can remain live while converged. |

“The benchmark is running” can finish a turn while leaving the Request to
compare implementations open. Even after the benchmark Task finishes, May
still owes the comparison and explanation. A discussion-only Request can close
with a useful answer and no Task. If the ask was only to start a benchmark,
confirmed admission may itself fulfill it; closure follows the accepted ask.

An open Request carries the current accepted ask, relevant Conversation/Topic
references, exact Task references when present, and an eventual closure message
and reason. Start with open or closed; derive progress, blockers, and execution
results from Tasks. Keep one authority for the accepted ask and closure, using
stored identities rather than reconstructing promises from full chat history.
Do not copy Task state or add a Request executor, retry policy, or per-Request
supervision Task. The storage mapping remains an implementation decision.

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

Every human surface publishes the same event:

```text
conversation.message.created
  target: app:may
  data.conversationId: may:primary
  data.author.kind: human
```

The Host admits the message once by message identity. Only a human-authored
message starts conversational understanding. Agent, tool, command, and
transient messages may update presentation or context but never recursively
invoke May.

Admission does not wait for a Conversation read or a previous May decision.
It durably records the human Turn and its Host input-handling request, returns
that receipt, and only then emits the coalesced `conversation.updated`
presentation wake.
Presentation resynchronizes from the Conversation resource, so this wake is
level-triggered and never belongs on the human admission call stack.
After admission returns, May's message handler claims Turns in Conversation
order and makes the bounded frontend decision. Serialization belongs here,
because it protects conversational meaning; it does not belong in the EventHub.
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
responsible Task; the supervision Task is not an intermediate assignment or
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
| “This needs a deeper discussion.”               | Continue the discussion; length or difficulty alone does not create a Task.          |
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
| The referenced Task already finished            | Keep it immutable; create a follow-up only for a genuinely new outcome.              |
| Task finished but the requested explanation is missing | Return the explanation; close the Request only when its accepted ask is addressed. |
| Meaning remains materially ambiguous            | State the likely interpretation and ask the smallest concrete question.              |

Clarification is ordinary multi-turn Conversation, not a draft resource or
hidden state machine. May preserves answers already given, does not ask for
discoverable facts, recommends a safe default, and proceeds when the human
delegates the choice back to May.

## Backend: one normal supervision Task

May owns one ordinary maintain-mode Task for its supervision responsibility.
It is one Task for the May App, not one per Conversation, Topic, human turn, or
delegated Task. The current stable identity is:

```text
may/conversation/follow-up
```

Its outcome is to keep human-linked Tasks aligned with their Topics and surface
useful progress, decisions, and results. It is visible in `/tasks`, uses the
same reconciliation, fencing, retry, recovery, and presentation as every other
Task, and normally rests in `converged` when linked work is healthy.
Human views render that live state as `up to date`, not terminal `done`.

Under the Request closure contract, this same supervision Task also checks
whether a linked Task's outcome leaves an accepted ask outstanding. It can
return the missing explanation or retain the unresolved Request with its next
step. These are explicit Request records, not inferred inbox statuses. A
discussion awaiting the human does not need a background Task or periodic model
turn merely because its Request is open.

It is converged at an observed event checkpoint when every changed linked Task
has one evidence-backed disposition: healthy/no-op, exact feedback accepted,
human action exposed, useful update appended, or terminal result handled. This
acceptance concerns May's reaction only; it does not claim that unfinished
linked Tasks are complete.

The first accepted Topic link resolves this stable Task intent. Later link and
Task-change Events reuse the same identity and generation instead of creating
another background object. With no linked Topics, no supervision work needs to
be admitted.

The supervision Task itself is not automatically linked into human Topics.
Doing so would make it appear to own the delegated outcome and could create a
self-wake. It remains discoverable through May's normal Task list and can be
watched explicitly for diagnostics.

The frontend and supervision Task never call or wait for each other. Both react
to persisted Events and update durable resources. An Event says what changed
and wakes interested consumers; Conversation, Topic, and Task resources remain
the truth they reread. Publishers do not wait for subscribers, and repeated
wakes are safe to coalesce by Task identity.

The supervision Task wakes on:

- meaningful progress, wait, attention, or results from Tasks linked to a
  Topic;
- a Topic-to-Task link change; and
- a coalesced low-frequency recovery tick.

Routing is structural. When Runtime admits a Topic-to-Task link, it indexes the
exact Task reference. A meaningful event or new canonical revision on that
Task creates one identity-only wake for the supervision Task containing the
Topic ID, Task reference, and event or revision identity. Repeated wakes for
the same Task revision coalesce. No keyword matching, child dependency, or
copied status is involved.

Code prepares a bounded supervision context from the referenced Topic, recent
human Turns, and event identity. The exact Task reference grants May a
single-resource cross-App read; it is not permission to list another App's
work. The LLM makes the semantic decision and code validates and applies its
selected effects. Acceptance advances the supervision Task's ordinary event
checkpoint, so retry and restart cannot silently lose or duplicate the
reaction.

Each reconciliation is bounded. It rereads the exact Topic and Task, then makes
one decision:

1. do nothing when work is healthy and no human update is useful;
2. send feedback or a decision to that same Task when human intent can move it
   forward;
3. surface a concrete human action when the Task needs one; or
4. append useful progress or an outcome to Conversation, closing the related
   Request only when its accepted ask is resolved; or
5. when the exact Task is terminal, the Request remains open, and further work
   is authorized, use evidence of the unmet outcome to request the smallest
   new responsible Task and link it to the same Topic and Request.

The supervision Task never adopts the responsible Task as a child or
dependency, copies its status, or waits for it to finish. May does not perform
the owning App's domain work or create replacement work because a Task paused.
Recent progress or a valid explicit wait is healthy. An expired lease or
interrupted attempt belongs to Runtime recovery on the same Task. A
semantically stalled or drifting Task receives bounded feedback on its exact
identity; its owning App remains responsible for reconciling it.
Waiting, age, or slow progress alone never justifies a sibling Task.

The supervision Task never waits synchronously inside event delivery and never
creates an in-memory watcher or polling loop for an individual Task. Events are
persisted quickly and reconciliation runs asynchronously. Every 15 minutes, a
recovery tick selects at most 100 unfinished Topic-linked Tasks that have
reported no update during that interval and emits the normal exact-Task wake
for each one. The supervision Task can then read that exact Task across the App
boundary. It never scans or exposes unrelated Tasks.

Human frontend requests use the higher-priority interactive lane. Supervision
wakes may coalesce while a human turn is running and then reread current truth;
they never delay an immediate answer merely to process older progress.

For new durable work, the target App decides whether the typed request maps to
an existing or new Task. Once admitted, that App owns execution and child
decomposition. Runtime validates and persists effects but does not infer
semantic relationships. The Topic records the accepted exact Task link; Task
resources remain the source of status, progress, waits, and results.

### May-owned durable work

May may request a normal May goal Task when it can own the ongoing commitment.
Use another App for existing ownership, required authority, or useful expertise
and workflows; an available App with a matching name alone does not require a
handoff. That Task uses the same Task interface, events, recovery, and executor
choices as every other Task. It may run the May agent, a workflow, Codex, or
Claude. It exists for its concrete outcome, not to shadow a Conversation or a
delegated Task.

## Results and human updates

Task events wake the supervision Task; they do not directly manufacture chat
text. May decides whether an event matters to the human and publishes a typed
result containing the Topic, exact Task references, and useful text.
Runtime validates and appends that text to the shared Conversation. The
frontend is not invoked again.

In the current implementation, the exact Host follow-up request is the durable
message correlation authority. Runtime uses its recorded Conversation and Topic
when projecting the result; an LLM-written label cannot redirect or silently
discard a valid answer. If neither that
correlation nor the named Topic resolves, Runtime reports the rejected
projection instead of treating it as successful human communication. Direct
frontend answers follow the same rule: storing the request receipt is not
enough; the response is appended as one Conversation message. When that
explicit message exists, the inbox result remains execution evidence but is
not a second Conversation message. Both the explicit Event and the bounded
compatibility projection use `result:<requestId>`; a read prefers explicit
message data when both are present. Message identity, not text comparison,
establishes the one canonical presentation.

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

| Component      | Owns                                                                          | Does not own                                      |
| -------------- | ----------------------------------------------------------------------------- | ------------------------------------------------- |
| May frontend   | interactive discussion, Request recognition/refinement and closure, bounded work, clarification, typed input/feedback | independent background execution, child waits, recovery |
| May supervision Task | review of linked work against Requests, exact steering, useful outcomes and closure | domain execution, parenting delegated work, copied Task state, adapter delivery |
| Target App     | goal interpretation inside its domain, Task execution and decomposition       | human Conversation presentation                   |
| Runtime        | event persistence, validation, scheduling, retry, mechanical recovery         | semantic ownership or intent inference            |
| Adapter        | input/output presentation and local selection                                 | work state or delivery-gated completion           |

## Recovery and performance

- Event publication persists and returns without running a long handler inline.
- Conversation snapshots are read models and never gate human-message
  publication.
- Conversation ordering is enforced by May's message handler after admission;
  the EventHub never waits for that handler.
- Task saturation delays Task attempts only. It cannot delay message admission,
  Conversation or Task reads, Console commands, or unrelated event handlers.
- Repeated wakes coalesce by Task identity.
- One May supervision Task replaces per-request coordination loops. It owns the
  recurring supervision goal but never proxies the linked work.
- Runtime retries interrupted attempts on the same Task.
- The owning App resolves semantic waits; May supplies human context or
  steering but does not create replacement work merely because a Task paused.
- A periodic recovery event is bounded and infrequent. It wakes only unfinished
  Topic-linked Tasks that stayed quiet for the review interval, at most 100 per
  tick.
- Conversation and Task reads are bounded; no full-history or full-fleet scan
  belongs in the conversational fast path.
- Request closure recovery must also find an open Request whose linked Task
  already finished. Retry the missing explanation/closure, without restarting
  completed work. The existing recovery scan includes those terminal links
  while the accepted ask remains open; it uses the normal supervision wake.

## Invariants

1. Only human-authored Turns invoke the May frontend.
2. One frontend turn finishes after its answer, clarification, or responsible
   Task admission is accepted, or ends on an explicit human Stop under the
   [turn-control contract](human-control-surfaces.md#current-turn-control).
3. Discussion stays in Conversation across turns; bounded authorized work can
   finish in a turn without a Task.
4. One normal visible May maintain Task owns recurring supervision across
   human-linked Topics.
5. That Task observes and steers exact responsible Tasks but never parents,
   waits on, copies, or automatically replaces them in Topic/watch context.
6. Every other independently executed durable outcome is an ordinary Task
   owned by its responsible App; discussion context alone is not a Task.
7. A May-owned Task represents a concrete May-owned outcome, never a proxy for
   another App's Task or a Conversation turn.
8. Topic carries context and exact links only; it never carries work state.
9. Existing unfinished work is continued by exact identity when it can still
   fulfill the outcome.
10. Completed one-off Tasks remain immutable. A live maintained Task that is
    up to date can accept another cycle under the same identity.
11. The target App chooses its Task shape; Runtime validates rather than
    guessing.
12. Task progress and results remain authoritative in Task resources.
13. May emits only useful human updates, never transport bookkeeping.
14. Conversation persistence, not adapter acknowledgement, completes the
    semantic response.
15. Runtime recovery resumes the same Task; it does not invent substitute
    work.
16. Code collects context and applies validated effects; the LLM decides
    meaning.
17. A finished turn or Host handling record does not by itself close the
    conversational Request. Closure references the current ask and its outcome.
18. A new turn may refine an existing Request. Discussion length never requires
    a Task, and Request tracking never becomes a second execution controller.

## Current implementation and gaps

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

The Host currently uses `AppRequest` and `app_inbox_items` for accepted input
handling. These rows are created before May understands the input. The
[request handler](../../../may-agent/src/app/app-inbox-host.ts) completes a
frontend row after a direct answer or durable follow-up admission; Task-based
caller rows may instead wait for a Task result. Neither row's `done` status is
proof of human fulfillment. The separate accepted Request stores that judgment
and its Conversation explanation; it adds no execution controller or queue.

### Live validation and remaining checks

The September 10 local May/Scout trial verified a new ask staying open through
handoff to the exact existing HN Task, a new source-grounded cycle, and May
returning its result before closing that ask. The standing Task retained its
identity and generation. The trial exposed and repaired two handoff gaps:
converged maintained Tasks were rejected as terminal, and the model needed
explicit guidance to leave handoff link creation to the Host. See the
[workflow validation record](../proposals/workflow-practices-review.md).

This is one observed path, not long-run certification. Continue verifying: a
multi-turn discussion creates no Task; acknowledgment needs no redundant
approval; corrections keep
the same Request; handoff leaves an unfulfilled Request open; completed Task
results still produce the owed explanation after restart; a blocked Task does
not silently close its Request; and cancellation or scope changes have explicit
outcomes. A delayed closure must not overwrite a newer accepted ask.

## Retained-state compatibility

The stable supervision identity is `may/conversation/follow-up`. Recovery and
future migrations preserve Conversation messages, exact Topic/Task links,
accepted results and audit Events. Changes to supervision semantics revise that
same Task; they do not create sibling Tasks or silently abandon retained child
obligations. See [Operations and Recovery](../2b-manual/app-operations-recovery.md)
for operating procedures.

## Instructions for the current attempt

May's shared identity supplies human authority, ownership, evidence, and plain
communication rules. The Host request prompt supplies the bounded Conversation
protocol, and the existing Task protocol covers ordinary goal execution without
copying those rules into durable input. May's supervision declaration puts its
specific guidance in Task input, which travels with the exact attempt.
Retained Tasks may still have older input: the common identity keeps a compact
supervision safety rule and directs that attempt to `mayFollowUpTask` in the
current May App before deciding. Reload alone is not assumed to rewrite Tasks.
Ordinary frontend and goal attempts need not read that procedure. Host
Operations procedures belong to its existing tech-lead profile. There is no
additional role router or prompt registry. Context tests prove available
guidance, not that the model followed it.

For a new direct-admission turn, the model's response schema excludes frontend
child-request dependencies. The installed input catalog includes May's own
durable goal contract, but excludes its conversational input kinds to avoid
routing a turn back into itself. Exact feedback and human cancellation retain
their existing validation and authority rules.

A retained request with its own child work still receives the compatibility
schema, child-result prompt, and deputy tool profile, even after its App adopts
direct admission. New turns reuse the bounded full App tool profile, not a new
conversation-specific tool list or execution engine.
Another Topic's open work or a focused Task is only context; it does not select
that compatibility path. This narrows new model attempts without deleting the
public SDK, changing retained requests, or replacing their recovery mechanism.
