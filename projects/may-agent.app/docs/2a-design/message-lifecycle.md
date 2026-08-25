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

Code collects bounded structured context:

- the current turn and recent Conversation;
- recent Topic candidates and their exact Task links;
- an exact focused Task observation when one was supplied;
- accepted child App results for this request; and
- installed App descriptions and typed input contracts.

The LLM decides meaning. It returns exactly one schema-validated choice:

1. a direct response or compact clarification, with no dependency; or
2. one or more typed App dependencies, with no response.

The same decision chooses no Topic, creates a short new Topic, or selects one
exact candidate. Code validates identities and schemas, applies the decision,
and never adds keyword routing or a second intent classifier.

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

One Topic may link several destination Tasks. The May request wakes as child
results change and May reviews the full exact set. Repeating the human prompt,
creating a May wrapper Task, or creating a Topic work loop is not recovery.

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

`/apps`, `/tasks`, `/task`, and `/todo` remain resource reads. When a rendered
view may shape the next turn, the adapter appends a concise command-authored
message with exact identities. Formatting stays adapter-local.

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
8. Destination Task results wake May's correlated request for review.
9. Each request retains its own response, even when Tasks are shared.
10. Adapter delivery never gates semantic completion.
11. Restart reconstructs Conversation, Topics, pending requests, and Task links
    from durable state.
12. Cross-surface synchronization reads shared Conversation truth; adapter
    cursors remain presentation state.
