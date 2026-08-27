# Message Lifecycle

**Design status:** Accepted.
**Implementation status:** The bounded frontend, visible
`may/conversation/follow-up` maintain Task, direct responsible-Task admission,
linked-Task wakes, explicit terminal Conversation append, and
window-independent response identity are implemented. The supervision Task no
longer mediates, parents, or waits on destination work. The shared Task
projection filters progress and accepted observations by exact attempt
identity; prior-attempt observations remain history.

## Mental model

> May handles each human turn promptly. One normal May Task supervises the
> responsible Tasks without becoming their proxy owner.

```text
Human
  <-> May frontend
        |- answer or clarify now
        `- request or steer one exact responsible Task
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
                    `- Conversation update -> Human
```

There are four durable resources:

- **Conversation** is the append-only message stream shared by Console,
  Telegram, and future adapters.
- **Topic** connects related Turns and exact Task references. It has no work
  state.
- **Task** is an executable goal owned by one App.
- **Event** is a fact or input that wakes the component that can act on it.

There is only one kind of Task. “Conversation,” “delegated,” “maintenance,”
and “child” describe a Task's goal or relationship, never a different resource
or lifecycle. An App owns and reconciles Tasks; an agent, workflow, Codex, or
Claude is only a replaceable way to perform one attempt.

The May App has two deliberately separate execution paths:

- the **frontend** handles one conversational turn; and
- one normal visible **supervision Task** maintains the ongoing goal of keeping
  human-linked work aligned and useful.

The supervision Task is not a wrapper for a Conversation turn or a parent of
delegated Tasks. Conversation, Topic links, the actual responsible Tasks, and
the event log preserve each human promise and its state. The supervision Task
owns only May's recurring responsibility to observe those links, challenge
stale or drifting work, and return useful updates. Other concrete outcomes
that belong to May use separate normal May-owned Tasks.

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
After admission returns, May's message handler claims Turns in Conversation
order and makes the bounded frontend decision. Serialization belongs here,
because it protects conversational meaning; it does not belong in the EventHub.
One Conversation therefore remains coherent, while independent Conversations
may be handled concurrently within the interactive capacity bound.

This is handler-local serialization, not serialized event delivery. A later
Turn is already a durable, observable Event while an earlier Turn is being
handled. It waits only for May's next claim in that Conversation; EventHub can
continue admitting and fanning out every independent event.

Code collects bounded structured context:

- the current Turn and visible adapter scope;
- a focused Task's complete decision view, when supplied;
- the selected or replied-to Topic and its exact Task links;
- the previous proposal or question and bounded recent Turns;
- exact canonical snapshots represented by command or tool views;
- bounded older Topic candidates when the human refers to earlier work; and
- installed App responsibilities and typed input contracts.

The LLM decides meaning. Code validates identities and executes the decision.
There is no keyword router or second intent classifier.

The frontend makes one of three decisions:

1. **Answer now.** Questions, suggestions, opinions, and self-contained
   requests finish in this turn and create no Task.
2. **Clarify.** Ask one high-quality question only when the missing choice
   materially changes outcome, owner, risk, proof, or authority.
3. **Continue durably.** Answer anything useful now, then publish one typed App
   request or exact-Task feedback containing the chosen Topic, desired outcome,
   constraints, acceptance, and an exact Task reference when one already fits.

Durable admission to the responsible Task completes the frontend turn. The
human request does not remain open waiting for destination work and does not
become a generic Conversation Task.

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
| “Does this wait make sense?”                    | Read the focused Task and answer; no mutation.                                       |
| “It does not; fix it.”                          | Answer and publish feedback for that exact Task.                                     |
| “Agree, do it.”                                 | Apply the preceding proposal in the same Topic.                                      |
| “Also include pending benchmarks.”              | Refine the existing Task when its owner and goal still fit.                          |
| “Do this across every App.”                     | Start distinct work only when the accountable scope truly changed.                   |
| “Continue the cleanup we discussed last month.” | Resolve the older Topic with bounded read-only lookup, then continue its exact work. |
| The referenced Task already finished            | Keep it immutable; create a follow-up only for a genuinely new outcome.              |
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
4. append useful progress or a terminal result to Conversation; or
5. when the exact Task is terminal and evidence proves the human outcome is
   still unmet, request the smallest genuinely new responsible Task and link it
   to the same Topic.

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

When no installed App is a better owner, May may request a normal May goal
Task. That Task uses the same Task interface, events, recovery, and executor
choices as every other Task. It may run the May agent, a workflow, Codex, or
Claude. It exists for its concrete outcome, not to shadow a Conversation or a
delegated Task.

## Results and human updates

Task events wake the supervision Task; they do not directly manufacture chat
text. May decides whether an event matters to the human and publishes a typed
result containing the Topic, exact Task references, and useful text.
Runtime validates and appends that text to the shared Conversation. The
frontend is not invoked again.

The exact follow-up request is the durable correlation authority. Runtime uses
its recorded Conversation and Topic when projecting the result; an LLM-written
label cannot redirect or silently discard a valid answer. If neither that
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

No component tracks “delivery to web-ui.” Conversation persistence is semantic
completion. Console and Telegram independently observe `conversation.updated`
and render unseen message identities. A missed notification can trigger a
bounded Conversation reread; adapters do not promise that every message is
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
| May frontend   | understanding one Turn, direct answer, clarification, typed request/feedback   | long-running work, child waits, recovery          |
| May supervision Task | human-purpose review of linked Task events, exact steering, useful updates | domain execution, parenting delegated work, copied Task state, adapter delivery |
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

## Invariants

1. Only human-authored Turns invoke the May frontend.
2. One frontend turn finishes after its answer, clarification, or responsible
   Task admission is accepted.
3. Direct Q&A creates no Task.
4. One normal visible May maintain Task owns recurring supervision across
   human-linked Topics.
5. That Task observes and steers exact responsible Tasks but never parents,
   waits on, copies, or automatically replaces them in Topic/watch context.
6. Every other durable goal is an ordinary Task owned by its responsible App.
7. A May-owned Task represents a concrete May-owned outcome, never a proxy for
   another App's Task or a Conversation turn.
8. Topic carries context and exact links only; it never carries work state.
9. Existing unfinished work is continued by exact identity when it can still
   fulfill the outcome.
10. Completed Tasks remain immutable.
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

## Migration and recovery

The implementation retained `may/conversation/follow-up` and refined that same
Task without creating a replacement:

1. admit typed frontend decisions directly to an exact responsible Task and
   record the Topic link atomically;
2. revise the existing May Task's goal and reconciliation so meaningful events
   on linked Tasks wake it for bounded supervision;
3. recover missed supervision from Topic links, canonical Tasks, and consumed
   event/message identities;
4. project useful results into Conversation with stable identities; and
5. remove delegated Tasks from its child/dependency waits and keep it
   `converged` whenever supervision is healthy.

Any later migration must preserve existing Conversation messages, Topic links, Task
identities, results, and audit events. The stable May Task identity is revised
in place; it must not create sibling Tasks merely to replace old semantics.
