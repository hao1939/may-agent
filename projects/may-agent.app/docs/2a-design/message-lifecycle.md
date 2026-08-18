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
  -> one May App inbox request
  -> Conversation context + other active work
  -> direct result, child App, task, session, or bounded CLI analysis
  -> exact dependency completion wakes the same request
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

## Conversation projection

The Conversation is reconstructed from existing durable evidence:

- admitted human App inbox items;
- accepted May results;
- durable agent/tool/command Conversation events;
- active or historical human work derived from App inbox and dependency state.

There is no separate Conversation database. Adapter delivery state is not
projected into May's answer or the human work lifecycle. Restart must
reconstruct the same bounded resource from durable state.

After durable admission of a human/command/tool message, or after a May result
is persisted, the Host emits `conversation.updated`. This is a coalescible wake
signal, not another message or a delivery guarantee. Console and Telegram
respond by reading the Conversation and rendering stable message IDs they have
not already shown. Adapters do not forward content to one another, and
rendering the same message on another surface does not append a duplicate.

`/work`, `/work all`, and `/work N` are Console read shortcuts over this
projection. Telegram may expose native commands, buttons, or different layout.
When a requested view may shape the next turn, the adapter records a concise
command-authored semantic message representing what its human saw. Formatting
and markup stay adapter-local.

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
3. Every durable human message admits at most one App inbox request.
4. Agent/tool/command messages never create human work.
5. Transient messages never enter durable context or replay.
6. Dependency completion wakes the exact request that attached it.
7. Each addressed request retains its own result.
8. A persisted May result is the Conversation output; adapter delivery never
   gates its completion.
9. Restart reconstructs Conversation; it does not restore correctness from a
   mutable current chat session.
10. Project outcomes remain owned by their Apps.
11. Cross-surface synchronization reads Conversation truth; update signals and
    adapter render cursors never become conversation or work authority.
