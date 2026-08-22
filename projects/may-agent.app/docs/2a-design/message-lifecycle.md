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

May receives the current request plus one bounded Conversation projection:

```text
human message
  -> one May request linked to one May task
  -> task reconciliation reads Conversation context + other active work
  -> new task intent, or revision/wake of represented active work
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

During migration, a represented May request admitted before Conversation IDs
existed may have no scope value. May may continue that legacy-unscoped request
from `may:primary`; the Host assigns that scope while fencing it. A non-empty
different Conversation ID is still rejected.

## Conversation projection

The Conversation is reconstructed from existing durable evidence:

- admitted human requests and their linked tasks;
- accepted May results;
- durable agent/tool/command Conversation events;
- active or historical human work derived from task and dependency state.

An ordinary Conversation read contains the active-work projection derived from
unfinished root human requests. A later human turn linked as feedback is a
durable message, but not another projected work item. The projection is never
persisted or reconciled separately.
Each item is rooted at its stable request ID and may expose its most recent
execution resource and exact dependency. Sessions and tasks remain replaceable
mechanisms, not Conversation-owned work.

`createdAt`, first `startedAt`, and semantic `changedAt` make request age and
stale progress visible. Infrastructure heartbeats do not count as semantic
change. Completion removes an item from the ordinary active projection; the
result remains a durable Conversation message. A hidden diagnostic request
view can still derive the historical correlation when an operator needs it.

There is no separate Conversation database. Adapter delivery state is not
projected into May's answer or the human work lifecycle. Restart must
reconstruct the same bounded resource from durable state.

After durable admission of a human/command/tool message, a visible active-work
change, or a persisted May result, the Host emits `conversation.updated`. This
is a coalescible wake signal, not another message or a delivery guarantee.
Console and Telegram respond by reading the Conversation and rendering stable
message IDs they have not already shown. Adapters do not forward content to one
another, and rendering the same message on another surface does not append a
duplicate.

The ordinary human interface reads Apps and Tasks through `/apps`, `/tasks`,
and `/task <ref>`. When a requested view may shape the next turn, the adapter
records a concise command-authored semantic message representing what its human
saw. Formatting and markup stay adapter-local. Ordered canonical `taskRefs`
accompany Task views so a later natural-language turn has the exact resources
the human saw. The old numbered `/work` request projection remains a hidden
diagnostic compatibility view only; it is not a second work model.

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
