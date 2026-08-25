# Message Lifecycle

**Design status:** Accepted.
**Implementation status:** Implemented for May Console and Telegram.

## Mental model

> **May owns the Conversation. Apps own Tasks.**

```text
Conversation may:primary
  └─ Topic: human-facing context and interest
       ├─ human and May turns
       └─ links to one or more exact App Tasks
```

Four existing records are enough:

- a **Turn** is one durable Conversation message;
- a **Topic** groups related turns and exact Task links;
- a Host **request** remembers who is owed an answer; and
- a **Task** is an executable goal owned by its responsible App.

A Topic stores only `id`, a short plain title, `openedBy`, `originMessageId`,
and Task links. It has no status, progress, result, retry, queue, scheduler, or
reconciler. Active and finished meaning is derived from unanswered requests and
linked Task state.

Console and Telegram are adapters over the same Conversation. Provider chat,
topic, terminal, and message IDs are delivery coordinates, not semantic
identity. Adapter receipts never gate work or an answer.

## Admission

Every May human surface publishes the same event:

```text
conversation.message.created
  target: app:may
  data.conversationId: may:primary
  data.author.kind: human
```

The Host persists the event and admits one idempotent May request. It does not
create a May Task. The message ID fences retries; the request remains the exact
caller correlation until May answers.

| Author                            | Durable context | Creates a request |
| --------------------------------- | --------------: | ----------------: |
| `human`                           |             Yes |               Yes |
| `agent`                           |             Yes |                No |
| meaningful `tool` or `command`   |             Yes |                No |
| any author with `transient: true` |              No |                No |

Commands may attach exact `taskRefs` and a Topic ID. Code uses those identities
as context; it does not derive intent from rendered words.

## Understanding and decision

The human-visible scope is the default conversational subject. A selected App,
watched Task, selected Topic, reply target, or rendered command view says what
the human was looking at; it does not force May to mutate that work. May decides
whether the new turn continues that subject, refers to older context, or starts
something different.

The behavior is defined first by ordinary conversation scenarios:

| Situation | Example turn | Expected decision |
| --------- | ------------ | ----------------- |
| An unfinished Task is focused and the human refines its goal | "Review all of these tasks and remove the outdated ones" | Send typed input to that exact Task when its owner can fulfill the refined goal. |
| May has just proposed bounded actions | "Agree, do it" | Apply the preceding proposal to its existing Topic and Tasks; do not create a sibling review. |
| The human broadens an in-scope detail | "Also include the pending benchmarks" | Continue the same Task when the goal and accountable owner still fit. |
| The human explicitly changes the accountable scope | "Do this across every installed App" | Create new accountable work when the focused owner cannot fulfill the expanded outcome. |
| The human starts unrelated work while watching a Task | "Review AKS normalization" | Leave the focused Task unchanged and create or continue the unrelated Topic and work. |
| The human selects, replies to, or names an exact older Topic | "Continue the cleanup we discussed there" | Load that Topic and its exact Task links, then continue an unfinished fitting Task or create a distinct follow-up after completed work. |
| The human naturally refers to an older discussion that is outside bounded context | "What happened to the terminal design we discussed last month?" | Perform bounded read-only Topic lookup, inspect likely exact Topics, and answer or continue the chosen one. Ask one compact question only when the candidates remain materially ambiguous. |
| The referred Task is completed | "Also check Telegram" | Keep the completed Task immutable and create a distinct follow-up only when new work is required. |
| The intended outcome or scope is materially ambiguous | "Clean up all the old work" | State the likely bounded interpretation and ask concrete questions only about choices that would materially change the work. |
| The human partially answers a clarification | "Gym only; keep benchmarks" | Preserve the answered constraints in the same Topic and ask only the smallest remaining question, if one still matters. |
| The human delegates the choice back to May | "Use your judgment" | Choose the recommended safe reversible interpretation, state it plainly, and proceed without another question. |
| An existing Task needs a human answer | The human answers its displayed question | Send that answer as typed input to the exact Task and wake it; do not create a sibling Task or generic conversation wrapper. |

Unqualified words such as "this", "all", "it", or "do it" are interpreted in
that visible conversational scope. They do not silently widen the request to
every App. Explicit wording or an outcome that truly crosses ownership may do
so.

Code collects bounded structured context in this order:

- the current turn and the exact human-visible scope;
- the complete focused Task decision view when one was supplied: identity,
  owner, goal, acceptance, admitted input, phase, current progress or result,
  exact waits, and evidence;
- the selected or replied-to Topic, its relevant recent turns, and exact Task
  links;
- the immediately preceding proposal or answer and bounded recent
  Conversation;
- other recent Topic candidates and their exact Task links;
- current canonical snapshots for exact Tasks represented by recent command or
  tool views;
- unfinished human requests already linked to those Topics and their exact
  delegated work;
- accepted child App results for this request; and
- compact installed App responsibilities and typed input contracts.

Exact identities are resolved deterministically. When a natural reference to
an older Topic cannot be resolved from bounded context, May may use a narrow
read-only Topic lookup: list bounded candidates, search Conversation text and
metadata, then read one exact Topic. The LLM chooses queries and judges the
candidates. Code only performs bounded reads. Lookup never selects an owner,
wakes a Task, creates work, or becomes a second memory lifecycle. If the
evidence cannot distinguish materially different candidates, May asks one
high-quality clarification instead of guessing.

### Clarification as conversation

Clarification is ordinary multi-turn Conversation, not a draft, form, hidden
state machine, or temporary Task. Before asking, May uses available context,
safe reversible defaults, and its own judgment to reduce the uncertainty. A
good clarification:

1. says what May currently understands;
2. identifies the concrete ambiguity and why it matters;
3. recommends the most likely safe interpretation;
4. asks only for the remaining decision, preferably as a short confirmation or
   small set of meaningful choices; and
5. avoids asking the human for discoverable facts or implementation choices
   owned by an App.

The human may answer fully, partially, correct an earlier answer, ask a question
in return, or tell May to decide. Each reply is another ordinary Turn in the
same Topic. May preserves facts already established by that exchange, answers a
return question directly, and asks again only when a remaining ambiguity still
materially changes the decision. There is no fixed number of turns, but May
must not repeat an answered question or prolong the exchange merely to gain
confidence.

Before durable work exists, the Topic and ordered Turns provide the Q&A
continuity. Once an exact Task exists, a clarification that changes or unblocks
that work becomes typed input to the same Task. When an App explicitly needs a
human decision, its human-owned Condition names the concrete requested action;
May presents the question and routes the answer back to that Task. A delayed
answer is checked against current canonical state before it is applied, so an
obsolete question cannot cause a stale effect.

The LLM decides meaning. Its one schema-validated decision contains an optional
plain-language message, optional exact existing or genuinely new App work,
optional controls for exact human-authorized Tasks, and one Topic choice. A
message may accompany work so May can explain what it understood immediately;
the request then remains open until the work returns its final result. Code
validates identities and schemas, applies the decision, and never adds keyword
routing or a second intent classifier.

May asks only when missing information materially changes outcome, owner,
risk, proof, or authority. A good question states the likely interpretation,
safe assumptions, recommended choice, and smallest remaining decision.

## Delegation and review

When durable work is needed:

```text
human Turn
  -> May request remains open
  -> Topic links the Turn
  -> deterministic child App request(s)
  -> destination App attaches new or exact existing Task
  -> Task events drive that work
  -> accepted child result(s) wake May
  -> May reviews them and answers the human
```

The destination App decides Task shape, workflow, executor, waits, retries, and
proof. May supplies the desired outcome, material constraints, acceptance
proof, and authority boundary.

A dependency with `taskId` is feedback or control for that exact unfinished
Task. Omitting `taskId` requests genuinely new work. A sibling Task is wrong
when the existing Task can still fulfill the intention. Completed Tasks remain
immutable; May decides whether a later turn is a distinct new outcome.

May makes that distinction explicitly: an existing-Task target means
continuation, while an App target without a Task means genuinely new work.
Runtime validates the selected identity and typed input; it does not infer the
relationship from prose or search for similar Tasks.

One Topic may link several destination Tasks. The May request wakes as child
results change and May reviews the full exact set. Repeating the human prompt,
creating a May wrapper Task, or creating a Topic work loop is not recovery.

Cancellation is different from domain feedback. When the human clearly asks
to remove one exact cancellable Task already present in focused, command-view,
or current-Topic context, May may return a typed cancellation with its answer.
The Host applies the same validated Task operation used by Console and
Telegram. May never edits persistence or assigns routine Task control to Host
Operations. Feedback, steering, and resumed work remain typed input to the
existing owner Task.

When a destination Task is attached, Runtime appends one idempotent assignment
message with its exact Task reference and a `followTask` presentation hint.
Adapters may auto-watch that Task. The hint is not work or delivery state.

## Conversation projection

The Conversation is reconstructed from durable evidence:

- human messages recorded by admitted requests;
- accepted May responses;
- accepted May responses to addressed event/API requests assigned to the
  default Conversation, without presenting those inputs as human Turns;
- durable agent/tool messages; and
- the newest command view for each adapter surface.

The projection is a bounded ordered message list plus recent lightweight Topic
links. It contains no queue, session state, delivery state, or alternate work
projection. Task state is read from canonical Task resources.

After durable admission or a persisted May response, the Host emits
`conversation.updated`. This is a coalescible wake, not a delivery guarantee.
Console and Telegram re-read the Conversation and independently render stable
message IDs they have not shown. They never forward content to each other.

`/apps`, `/topics`, `/topic`, `/tasks`, `/task`, and `/todo` remain resource
reads. Each surface may follow one Topic and attach its exact ID to later human
Turns; this adapter-local selection creates no work. When a rendered view may
shape the next turn, the adapter appends a concise command-authored message
with exact identities. Formatting stays adapter-local.

## Presentation

- A direct response becomes the accepted request result and Conversation text.
- Delegation shows the real destination Task, not a May tracking Task.
- Task progress and waits come from that Task's canonical view.
- May returns the final human answer only after reviewing exact child results.
- Adapter failures remain operational evidence and never replace semantic text
  with delivery prose.
- A later turn may arrive from another adapter and still see the same Topic and
  Task links.

## Invariants

1. Console and Telegram map ordinary May interaction to `may:primary`.
2. Every durable human Turn admits at most one May request and no generic May
   Conversation Task.
3. Agent, tool, and command messages create no human work.
4. Every executable goal is a Task owned by its responsible App.
5. Topic is context and linkage only; it never owns or schedules work.
6. Topic selection is an LLM decision over exact candidates, never keyword
   routing.
7. Relevant feedback continues an exact unfinished Task; unrelated text does
   not mutate it.
8. May controls only an exact Task supplied in canonical human context; Host
   validation and persistence remain authoritative.
9. Destination Task results wake May's correlated request for review.
10. Each request retains its own response, even when Tasks are shared.
11. Adapter delivery never gates semantic completion.
12. Restart reconstructs Conversation, Topics, pending requests, and Task links
    from durable state.
13. Cross-surface synchronization reads shared Conversation truth; adapter
    cursors remain presentation state.
14. Human-visible scope is the default conversational subject, never automatic
    mutation authority.
15. Older Topic lookup is bounded read-only context discovery; only May's
    validated decision may continue or create work.
16. Clarification is ordinary Topic-linked Q&A; answered facts are preserved,
    and an existing Task receives the answer through its exact typed input.
