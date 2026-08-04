# Message Lifecycle

**Design status:** Accepted.
**Implementation status:** App-owner open-to-resolved reconciliation is
implemented; broader inbound-human and outbound-channel semantic closure
remains partial.

Strengthen the existing message path; do not create a second message task
system or an approval-only controller. The source task, escalation, owner inbox
item, or conversation remains the work authority. Message lifecycle is a
derived projection over existing events, delivery records, trace, and expected
closure.

Every inbound and outbound message has one stable semantic identity and one
target: properly handled and closed as `resolved` with a typed outcome and
closure evidence.

```text
source event
  -> accepted by May, an owner, or a channel
  -> admission disposition when proactive
  -> delivery or durable non-deliver action
  -> expected semantic closure
  -> resolved { fulfilled | rejected | superseded | expired | failed }
```

Admission and transfer states are never terminal. `route` means another owner
accepted responsibility; the message remains open through that owner's result
and required verification. `clarify-producer` remains open until the producer
supplies the missing facts and the candidate is reviewed again. `deliver`
remains open until delivery-only meaning is proven or the requested human input
is applied and verified. `handle` remains open until its claimed action passes
the closure check. `reject` resolves only after the source request is durably
rejected with the reason and no hidden work remains.

## App-owner messages

An unhandled message whose `to` and `owner` both name an app owner wakes that
app's stable owner task. The task trigger retains the original message event ID
and content. A specialized app message selector takes precedence.

The owner task may answer directly or delegate through task children. Review,
routing, task creation, task update, waiting, and attention record progress but
keep the message open. Verified convergence with no live delegated work emits
`message.resolved` and closes the original inbox pair. The existing 15-minute
event-pair pass re-wakes open or orphaned owner messages; age alone never closes
unfinished owner work.

Use existing context and conventions instead of per-message configuration:

- A direct reply or informational digest resolves on confirmed delivery.
- An inbound human request resolves when fulfilled directly or when its source
  task produces a verified result.
- An action request links to its source task or escalation and expected closure.
- Owner acceptance plus a truthful tracking reply acknowledges long-running
  work but never completes it.
- A proactive action request without live backing work returns to its producer.

## Delivery recovery

Before calling Telegram, reserve the stable message key. Confirm delivery with
the returned Telegram message IDs. A crash or partial multi-part send remains
`delivery-uncertain`; recovery never blindly sends the same proactive message
again. Normal progress is event-driven. Periodic reconciliation catches missed
wakes and uncertain delivery.

When an open message makes no progress, resync wakes its accountable owner and
May for a bounded check-in or steering action. It does not close a message
because it was routed, acknowledged, retried, or old. Expiry and failure are
resolved outcomes only when policy permits them and final evidence is recorded.

Apps retain domain authority, May retains intention and attention judgment, and
the shared runtime owns correlation, delivery bookkeeping, wake-up, and
recovery.

## Approval specialization

- One approval ID produces at most one delivered human message across restarts.
- `project.approval.submitted` or `project.approval.resolved` closes approval.
- Superseded or invalid proposals emit `project.approval.resolved`.
- A delivered approval without a live waiting task is orphaned, not pending.
- Human inbox views derive openness from durable task and approval truth.

## Channel conveniences

- Give exact reply examples on actionable notifications.
- Describe outcomes rather than internal event names in acknowledgements.
- Include useful task, trace, or feature links.
- Group repeated low-priority events into digests.
- Reject stale replies to terminal work.
- Measure conversation context and reply follow-through quality.
