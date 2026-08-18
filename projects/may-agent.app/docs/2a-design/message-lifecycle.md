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

The semantic lifecycle has only two relevant objects:

- a Conversation message records durable shared context;
- an App inbox request is one independently fenced unit of work.

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

The Host persists the event and admits one idempotent May App inbox request
before acknowledging it. The message ID is the retry fence. Every addressed
human message keeps its own request identity and result, even when several
requests depend on the same project task or analysis.

Other authors use the same message envelope with different behavior:

| Author | Durable Conversation context | Creates work |
| --- | ---: | ---: |
| `human` | Yes | One fenced App request |
| `agent` | Yes | No |
| `tool` | Yes, when meaningful to later turns | No |
| `command` | Yes, when the human may refer to the view | No |
| Any author with `transient: true` | No | No |

Transient messages may drive a progress bar, reconnect notice, or notification,
but do not advance Conversation version, replay after restart, or enter May's
context.

## Reconciliation

May receives the current request plus one bounded Conversation projection:

```text
human message
  -> one May App inbox turn
  -> Conversation context + other active work
  -> new work, or same-turn continuation of represented active work
  -> direct result, child App, task, session, or bounded CLI analysis
  -> a reviewable dependency observation wakes the same request
  -> reviewed App result
  -> Conversation message + conversation.updated
  -> each adapter independently reads and renders
```

The workflow or agent may finish synchronously. Long-running work attaches an
exact durable dependency and ends the current attempt. A later fact wakes the
same request. Repeating the human prompt or creating replacement work is not
recovery.

Project Apps remain responsible for project outcomes. May states intent,
constraints, approval bounds, and expected evidence. A project App decides its
task shape, workflow, waits, retries, and terminal proof.

May's owner decision is also the admission decision. An ordinary message may
start a new commitment, but feedback such as “continue the second one” or “that
wait is invalid” may instead continue a represented unfinished request. The
Host applies the selected disposition to that request before the owner turn
ends and records the feedback turn as linked conversation context. It does not
schedule May again merely to interpret May's own decision.

Only an unfinished human request owned by the same App and Conversation may be
continued. This Host fence prevents guessed IDs or cross-conversation context
from mutating work. The target's dependency is replaceable; its request ID is
not. If the replacement is asynchronous, its terminal observation wakes the
same target request later.

During migration, a represented May request admitted before Conversation IDs
existed may have no scope value. May may continue that legacy-unscoped request
from `may:primary`; the Host assigns that scope while fencing it. A non-empty
different Conversation ID is still rejected.

## Conversation projection

The Conversation is reconstructed from existing durable evidence:

- admitted human App inbox items;
- accepted May results;
- durable agent/tool/command Conversation events;
- active or historical human work derived from App inbox and dependency state.

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
result remains a durable Conversation message and `/work all` can still derive
the historical item.

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

`/work`, `/work all`, and `/work N` are Console read shortcuts over this
projection. Telegram may expose native commands, buttons, or different layout.
When a requested view may shape the next turn, the adapter records a concise
command-authored semantic message representing what its human saw. Formatting
and markup stay adapter-local. Ordered request IDs accompany numbered work
views so “work 1” resolves against the last rendered view rather than a later
ordering of active work.

## Presentation

- Human ingress is accepted after durable event persistence and App admission.
- Persisting May's result completes the request and appends the result itself to
  the Conversation.
- Each adapter observes Conversation updates and renders independently. No
  adapter acknowledgement is required for semantic completion.
- Provider send failures and receipts may remain available to operational
  diagnostics, but normal conversation and `/work` views never replace a result
  with delivery prose.
- A later human turn may arrive from another adapter; it still sees the shared
  durable Conversation.

## Invariants

1. Console and Telegram map ordinary May interaction to `may:primary`.
2. Adapter presentation may differ; semantic identity and work do not.
3. Every durable human message admits at most one App inbox turn; May may link
   that turn to one represented active request instead of creating new work.
4. Agent/tool/command messages never create human work.
5. Transient messages never enter durable context or replay.
6. Dependency completion, failure, interruption, attention, or disappearance
   wakes the exact request that attached it for review.
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
