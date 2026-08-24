# Message Lifecycle

**Design status:** Accepted.
**Implementation status:** Implemented for May Console and Telegram.

## Mental model

> **May owns the Conversation. Apps own work and outcomes.**

One stable resource represents the human conversation:

```text
Conversation may:primary
```

Console and Telegram are adapters over that resource. They may accept commands
and render content differently. Provider chat, topic, terminal, and message IDs
are delivery coordinates, not Conversation identity.

The semantic lifecycle has three small records:

- a Conversation message records durable shared context;
- a Host request correlates one human turn with its eventual result; and
- a May task owns the App work needed to produce that result.

An adapter may retain provider receipts for operational diagnosis, but those
receipts are not Conversation state and never gate work completion.

Do not add a second chat lifecycle, commitment controller, conversation store,
or adapter-local context protocol.

## Admission

Every May human surface publishes the same semantic event:

```text
conversation.message.created
  target: app:may
  data.conversationId: may:primary
  data.author.kind: human
```

The Host persists the event, admits one idempotent May request, and links it to
one resolved May task before acknowledging it. The message ID is the retry
fence. Every addressed human message keeps its own request identity and result,
even when several requests depend on the same project task or analysis.

Other authors use the same message envelope with different behavior:

| Author                            |              Durable Conversation context |           Creates work |
| --------------------------------- | ----------------------------------------: | ---------------------: |
| `human`                           |                                       Yes | One fenced App request |
| `agent`                           |                                       Yes |                     No |
| `tool`                            |       Yes, when meaningful to later turns |                     No |
| `command`                         | Yes, when the human may refer to the view |                     No |
| Any author with `transient: true` |                                        No |                     No |

The runtime `notify()` capability and cron-handler failure notice append one
tool-authored message to `may:primary`. They do not emit a raw human-targeted
message, start a hidden review session, or call a transport directly. This
keeps explicit human-visible notices shared across Console and Telegram and
available as bounded context to May.

Transient messages may drive a progress bar, reconnect notice, or notification,
but do not advance Conversation version, replay after restart, or enter May's
context.

## Reconciliation

A human request has two conversational stages, without another stored
lifecycle:

1. **Clarifying.** May may ask one concise question and complete the current
   Conversation Task with that response. The next human message carries the
   bounded Conversation context. This may repeat for several natural turns;
   the Conversation itself is the requirement draft, so no draft-Task resource
   is needed. No project Task is claimed before outcome, material constraints,
   acceptance proof, and owner are clear enough to act.
2. **Assigned.** May routes the clear outcome to the responsible App. The
   accepted waiting result appends one concise Conversation status linked to
   the stable May Task reference. `/task <ref>` exposes the responsible App
   Task when its exact dependency has been attached.

Each turn still has one durable request and one May Task. “Clarifying” and
“assigned” describe what May is doing; they are not resources, queues, or
additional states.

May receives the current request plus one bounded Conversation projection:

```text
human message
  -> one May request linked to one May task
  -> task reconciliation reads the current Task + bounded Conversation context
  -> new task intent, or revision/wake of an exactly referenced Task
  -> first-attempt result or bounded capability/dependency
  -> a reviewable dependency observation wakes the same task
  -> accepted task result completes the linked request
  -> Conversation message + conversation.updated
  -> each adapter independently reads and renders
```

The workflow or agent may converge the task during its first attempt.
Long-running work attaches an exact durable dependency and ends the current
attempt. A later fact wakes the same task. Repeating the human prompt or
creating replacement work is not recovery.

Project Apps remain responsible for project outcomes. May states intent,
constraints, approval bounds, and expected evidence. A project App decides its
task shape, workflow, waits, retries, and terminal proof.

May's pure task resolver is the admission decision and gives every human turn a
stable input task. During reconciliation, feedback such as “continue the second
one” or “that wait is invalid” may produce a typed revision, wake, or dependency
for the represented unfinished task. The Host records the feedback turn as
linked Conversation context and persists the validated task change before
scheduling more work.

Only a task linked to the same App and Conversation may be revised by human
feedback. This Host fence prevents guessed IDs or cross-conversation context
from mutating work. The task's dependency is replaceable; caller request IDs
remain stable. If replacement work is asynchronous, its terminal observation
wakes the same target task later.

A fresh admitted App input is meaningful desired-state evidence. It wakes a
waiting Task for one bounded reconsideration even while the previous Condition
remains open. The App then accepts the new evidence, replaces or preserves the
wait, changes the Task, or converges. The Host never declares an old Condition
true merely because the human spoke. Duplicate ticks and unchanged recovery
pulses remain suppressible.

Cross-App input normally resolves to new App work. When a typed dependency also
names `taskId`, Runtime attaches it to that exact existing Task instead. This is
the single feedback/decision path: the same Task sees the new evidence and its
result returns to May. A new sibling Task is incorrect unless the human asked
for a distinct outcome. A waiting or attention Task is woken once by fresh
input. A completed Task remains immutable; May must decide whether the new
message is distinct follow-up work instead of silently treating old proof as
the result of new input.

When a destination App attaches a Conversation-owned dependency to its exact
Task, Runtime appends one idempotent assignment message. Its metadata contains
the represented May and owner Task identities plus one `followTask` owner
identity. This is a presentation hint, not work or delivery state. An adapter
may follow that Task for push-to-read progress; adapters never derive focus from
message wording, session activity, or Task-list order.

During migration, a represented May request admitted before Conversation IDs
existed may have no scope value. May may continue that legacy-unscoped request
from `may:primary`; the Host assigns that scope while fencing it. A non-empty
different Conversation ID is still rejected.

## Conversation projection

The Conversation is reconstructed from existing durable evidence:

- human messages recorded by admitted requests;
- accepted May results;
- durable agent/tool Conversation events; and
- the newest durable command view for each adapter surface.

An ordinary Conversation read is only a bounded ordered message list. It does
not contain a work projection, Task status, session state, delivery state, or
another scheduler. Host request rows remain the private correlation/history
that lets the projection reconstruct human messages and accepted results.
Apps and Tasks are read through their own resource interface.

There is no separate Conversation database. Adapter delivery state is not
projected into May's answer or the human work lifecycle. Restart must
reconstruct the same bounded resource from durable state.

After durable admission of a human/command/tool message or a persisted May
result, the Host emits `conversation.updated`. This is a coalescible wake
signal, not another message or a delivery guarantee. Console and Telegram
respond by reading the Conversation and rendering stable message IDs they have
not already shown. Adapters do not forward content to one another, and
rendering the same message on another surface does not append a duplicate.

The ordinary human interface reads Apps and Tasks through `/apps`, `/tasks`,
and `/task <ref>`. When a requested view may shape the next turn, the adapter
records a concise command-authored semantic message representing what its human
saw. Formatting and markup stay adapter-local. Ordered canonical `taskRefs`
accompany Task views so a later natural-language turn has the exact resources
the human saw. Host request history is not exposed as a second work model.

The journal retains every command view. The bounded Conversation projection
keeps only the newest durable command view for each adapter surface
(`channel`, target, and thread). Thus May receives what the human most recently
saw on Console and Telegram without old `/tasks` pages evicting the actual
human/May dialogue.

## Presentation

- Human ingress is accepted after durable event persistence and request-to-task
  admission.
- Persisting the accepted May task result completes the request and appends the
  result itself to the Conversation.
- An accepted May wait appends a concise status with its exact Task identity
  and useful current finding or blocker. It is not a delivery receipt and does
  not complete the request. Unchanged retries are idempotent.
- Each adapter observes Conversation updates and renders independently. No
  adapter acknowledgement is required for semantic completion.
- Provider send failures and receipts may remain available to operational
  diagnostics, but normal Conversation and Task views never replace a result
  with delivery prose.
- A later human turn may arrive from another adapter; it still sees the shared
  durable Conversation.

## Invariants

1. Console and Telegram map ordinary May interaction to `may:primary`.
2. Adapter presentation may differ; semantic identity and work do not.
3. Every durable human message admits at most one May request and input task;
   reconciliation may link it to represented active work.
4. Agent/tool/command messages never create human work.
5. Transient messages never enter durable context or replay.
6. Dependency completion, failure, interruption, attention, or disappearance
   wakes the exact task that attached it for review.
7. Each addressed request retains its own result.
8. A persisted May result is the Conversation output; adapter delivery never
   gates its completion.
9. Restart reconstructs Conversation; it does not restore correctness from a
   mutable current chat session.
10. Project outcomes remain owned by their Apps.
11. Cross-surface synchronization reads Conversation truth; update signals and
    adapter render cursors never become conversation or work authority.
12. Continuing represented work happens in the current owner turn; only the
    attached asynchronous mechanism requires a later wake.
