# Message Lifecycle

**Design status:** Accepted.
**Implementation status:** Migration in progress.

## Mental model

> May talks with the human in the frontend and keeps durable follow-through
> moving in one normal Task.

```text
Human
  <-> May frontend
        |- answer or clarify now
        `- publish one typed durable intent or feedback event
                              |
                              v
                    May conversation Task
                      |- continue an exact Task
                      |- request another App's Task
                      `- create an ordinary May goal Task
                              |
                              v
                  Task events and results
                              |
                              v
                    May conversation Task
                              |
                              v
                 Conversation message -> Human
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

The May App has two deliberately separate roles:

- the **frontend** handles one conversational turn; and
- one long-lived **conversation Task** maintains Topic-to-Task follow-through.

The conversation Task is a normal visible Task owned by May. It has the same
resource, lifecycle, events, reconciliation, retry, recovery, and presentation
as every other Task. Its goal is Conversation follow-through rather than a
copy of a delegated goal. A durable goal that May itself must perform is a
separate May-owned Task.

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
3. **Continue durably.** Answer anything useful now, then publish one typed
   follow-up event containing the chosen Topic, desired outcome, constraints,
   acceptance, and an exact Task reference when this is feedback for existing
   work.

Publishing the follow-up event completes the frontend turn. The human request
does not remain open waiting for child work, and it does not become a generic
Conversation Task.

### Natural conversation rules

| Human situation | May's decision |
| --- | --- |
| “Does this wait make sense?” | Read the focused Task and answer; no mutation. |
| “It does not; fix it.” | Answer and publish feedback for that exact Task. |
| “Agree, do it.” | Apply the preceding proposal in the same Topic. |
| “Also include pending benchmarks.” | Refine the existing Task when its owner and goal still fit. |
| “Do this across every App.” | Start distinct work only when the accountable scope truly changed. |
| “Continue the cleanup we discussed last month.” | Resolve the older Topic with bounded read-only lookup, then continue its exact work. |
| The referenced Task already finished | Keep it immutable; create a follow-up only for a genuinely new outcome. |
| Meaning remains materially ambiguous | State the likely interpretation and ask the smallest concrete question. |

Clarification is ordinary multi-turn Conversation, not a draft resource or
hidden state machine. May preserves answers already given, does not ask for
discoverable facts, recommends a safe default, and proceeds when the human
delegates the choice back to May.

## Backend: one normal conversation Task

May owns one ordinary maintain-mode Task per Conversation:

```text
may/conversation/follow-up
```

The current shared Conversation is `may:primary`, so this is its one Task.
If independent Conversations are introduced later, each receives one stable
Task identity derived from its Conversation identity.

It is visible in `/tasks` and wakes on:

- a typed durable intent or feedback event from the frontend;
- a linked Task's meaningful progress, wait, attention, or result;
- a Topic-to-Task link change; and
- a coalesced low-frequency recovery tick.

The frontend and backend never call or wait for each other. Both react to
persisted Events and update durable resources. An Event says what changed and
wakes interested consumers; Conversation, Topic, and Task resources remain the
truth they reread. Publishers do not wait for subscribers, and repeated wakes
are safe to coalesce by Task identity.

It never waits synchronously inside event delivery and never creates an
in-memory watcher or polling loop for an individual Task. Events are persisted
quickly; Task reconciliation runs asynchronously. The recovery tick performs
one bounded read of unfinished Tasks linked to this Conversation and only
repairs missed wakes or stale relationships from durable truth.

For each follow-up, the backend:

1. reads the Topic and current exact Task links;
2. reuses an unfinished fitting primary Task when one exists;
3. otherwise requests work from the accountable App;
4. creates an ordinary May-owned goal Task only when May is the best owner;
5. links the accepted Task identity to the Topic;
6. sends later human feedback or decisions to that exact Task;
7. reviews meaningful progress and terminal evidence; and
8. appends a useful May message to the Conversation when the human should be
   updated.

The same pass performs the semantic health check for linked unfinished Tasks:

- recent progress or a valid explicit wait is healthy and needs no steering;
- an expired lease or interrupted attempt is mechanical and belongs to Runtime
  recovery on the same Task;
- a Task with neither active execution nor a valid wait is woken or steered by
  exact identity; and
- work moving away from the human's goal receives feedback on that same Task,
  rather than a replacement Task.

When no linked Task changed, the recovery pass reschedules without an LLM
turn. It never scans unrelated Apps or Tasks.

The target App decides whether a new request maps to an existing or new Task.
Once a primary Task exists, that App owns execution and child decomposition.
The Runtime validates and persists effects but does not infer semantic
relationships.

The conversation Task stores only compact correlation needed to avoid losing a
promise: Topic, follow-up identity, primary Task identity, and the last
meaningful update already surfaced. Canonical Task resources remain the source
of status, progress, waits, and results. It does not copy Task state.

### May-owned durable work

When no installed App is a better owner, the backend creates a normal May goal
Task. That Task uses the same Task interface, events, recovery, and executor
choices as every other Task. It may run the May agent, a workflow, Codex, or
Claude. It is not the conversation Task.

## Results and human updates

Task events wake the backend; they do not directly manufacture chat text. The
backend decides whether an event matters to the human and publishes a typed
backend result containing the Topic, exact Task references, and useful text.
Runtime validates and appends that text to the shared Conversation. The
frontend is not invoked again.

Progress is deduplicated by stable event or result identity and appears at most
once in durable Conversation. Adapters may render faster transient progress
while watching a Task, but transient output is not later used as conversational
memory.

No component tracks “delivery to web-ui.” Conversation persistence is semantic
completion. Console and Telegram independently observe `conversation.updated`
and render unseen message identities. A failed adapter can catch up by reading
the Conversation.

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

| Component | Owns | Does not own |
| --- | --- | --- |
| May frontend | understanding one Turn, direct answer, clarification, typed durable intent | long-running work, child waits, recovery |
| May conversation Task | Topic-to-Task linkage, follow-through, steering, human updates | domain execution, copied Task status, adapter delivery |
| Target App | goal interpretation inside its domain, Task execution and decomposition | human Conversation presentation |
| Runtime | event persistence, validation, scheduling, retry, mechanical recovery | semantic ownership or intent inference |
| Adapter | input/output presentation and local selection | work state or delivery-gated completion |

## Recovery and performance

- Event publication persists and returns without running a long handler inline.
- Repeated wakes coalesce by Task identity.
- One conversation Task replaces per-request coordination loops; it is not added
  beside them.
- Runtime retries interrupted attempts on the same Task.
- The owning App resolves semantic waits; May supplies human context or
  steering but does not create replacement work merely because a Task paused.
- A periodic recovery event is bounded and infrequent. It compares compact
  follow-up links with canonical Tasks and wakes only discrepancies.
- Conversation and Task reads are bounded; no full-history or full-fleet scan
  belongs in the conversational fast path.

## Invariants

1. Only human-authored Turns invoke the May frontend.
2. One frontend turn finishes after its answer, clarification, or durable
   follow-up event is accepted.
3. Direct Q&A creates no Task.
4. There is one normal, visible conversation Task per Conversation.
5. The conversation Task replaces the old open-request child-wait loop.
6. Every durable goal is an ordinary Task owned by its responsible App.
7. May-owned goal Tasks and the conversation Task are ordinary Tasks with
   different goals.
8. Topic carries context and exact links only; it never carries work state.
9. Existing unfinished work is continued by exact identity when it can still
   fulfill the outcome.
10. Completed Tasks remain immutable.
11. The target App chooses its Task shape; Runtime validates rather than
    guessing.
12. Task progress and results remain authoritative in Task resources.
13. The backend emits only useful human updates, never transport bookkeeping.
14. Conversation persistence, not adapter acknowledgement, is semantic
    delivery.
15. Runtime recovery resumes the same Task; it does not invent substitute
    work.
16. Code collects context and applies validated effects; the LLM decides
    meaning.

## Migration rule

During migration, the conversation Task must not coexist with the old rule
that keeps each May human request open for child results. Cut over in this
order:

1. admit and verify the conversation Task;
2. publish typed follow-up events from bounded frontend decisions;
3. project backend results into Conversation;
4. stop frontend requests from waiting on child App work; and
5. retire legacy Conversation wrapper Tasks and request coordination.
