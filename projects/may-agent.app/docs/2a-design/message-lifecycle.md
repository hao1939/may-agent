# Message Lifecycle

**Design status:** Accepted.
**Implementation status:** Implemented. Human turns use a structured bounded
disposition, app-result follow-through is correlated, break glass is audited,
and May owns no standing schedules.

A task or approval owns the work. A message only carries information between
people and agents. Do not create a second task system for messages.

## The loud rule

> **May owns the conversation. Apps own the work.**

May is Hao's immediate bridge to the agent system. May always responds to a
message: answer it, clarify the intent, reject it with a reason, or route it to
one accountable project app. May never becomes the background worker for that
request.

The bounded exception is break glass: when the normal ownership path cannot
fulfill the human outcome, May may temporarily own one linked privileged
attempt. That attempt has an explicit reason, scope, proof, and stop or
hand-back condition. It never becomes a standing May queue or schedule.

When work must continue after May's response, the runtime correlates the
original message with `project.owner.requested`. The app's stable owner task
then owns execution, waits, retries, and verification. Its terminal result
closes the original message and is carried back through May to the sender.

```text
person or agent -> May understands and responds
                         |
                         +-> app owner task -> terminal evidence
                                                  |
                         May carries the result <-+
```

May has no standing background schedule, polling loop, project task tree, or
durable work queue. If no existing app clearly owns a request, May routes the
ownership gap to the `may-agent` platform owner instead of silently
accumulating work. A bounded break-glass worker remains linked to the original
message and must close or hand back; it does not weaken this rule.

All ordinary human input to May follows one path, regardless of Telegram,
console, web, or control client:

```text
human.input.received -> fresh structured May turn -> one disposition
```

A new `chat.start.requested` for May uses the same structured turn by default.
Only explicit `session.steer.requested` control may continue a particular
execution session. Conversation continuity comes from durable context, not
from silently reusing whichever May session is attached.

Every message has one durable event ID and moves through three states:

```text
created -> delivered -> resolved
```

Only `resolved` is terminal. Routing, review, acknowledgement, and retry are
progress.

## Closure rules

- An inbound message to an app owner resolves when the stable owner task
  finishes the request with no live delegated work.
- An inbound message to May receives an immediate bridge response. A direct
  answer resolves immediately; delegated work stays open through the
  correlated app-owner result and final bridge response.
- A route acknowledgement says acceptance is pending and references the app
  intent event. May says the owner accepted or started only after the durable
  owner response proves it.
- An outbound notification resolves when channel delivery is confirmed.
- An outbound request must declare its exact `expectedResponse`. It resolves
  when a matching response is durably accepted.
- A specialized handler must preserve the original message ID. It either
  resolves that message after its bounded handoff succeeds or sends unclear
  input to the ordinary owner task.
- A message expires only when its producer supplied an explicit `expiresAt` or
  event TTL.
- A send without delivery proof becomes `failed` after the bounded delivery
  window. Recovery never sends it again blindly; a producer may create a new
  message with a new semantic identity after reviewing the failure.

Terminal outcomes are `fulfilled`, `rejected`, `superseded`, `expired`, and
`failed`. Each terminal event references the original message ID and records
the reason and evidence.

## Reconciliation

The shared runtime owns one message lifecycle:

```text
message, delivery, response, or owner-task event
  -> reconcile immediately

15-minute maintenance pass
  -> reconcile any message whose event was missed
```

The pass is a safety net, not a scheduler. It re-wakes unfinished owner work,
closes delivered notifications, applies exact response matches, and resolves
explicit expiry or bounded delivery failure. Age alone never completes a
request.

An open break-glass attempt never resumes privileged work after a runtime
restart. Recovery records `may.break-glass.failed` with `runtime-restarted`,
then starts one non-privileged May review. That review closes the request,
states the blocker, or hands work to an app. Repeated recovery is idempotent.

Apps provide normal message data and, for requests, one exact expected response.
The shared runtime owns correlation, delivery evidence, terminal events, and
recovery. May interprets unclear human intent. The source task or approval
continues to own the underlying work.

## Delivery convention

Reserve the message identity before sending. Channel results carry the original
message ID. A confirmed provider message ID proves delivery. A timeout or crash
without that proof is uncertain and is never retried blindly.

Closed messages ignore later progress and stale replays. Human-facing requests
include a clear reply example and enough context to decide.
