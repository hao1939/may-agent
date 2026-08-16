# Message Lifecycle

**Design status:** Accepted.
**Implementation status:** Implemented through May App admission, typed
delegation, exact dependencies, and correlated channel delivery.

Messages carry information. App requests and tasks own work. Execution sessions
are replaceable attempts.

## The Loud Rule

> **May owns the conversation. Apps own the work.**

May is Hao's immediate bridge to the App system. For every admitted human
request, May either:

- answers directly;
- asks one focused clarification;
- rejects the request with a reason; or
- delegates one typed child request to the accountable App.

May owns no standing schedules or task attachment. A domain App may complete a
delegated request directly or attach durable desired work to its task
reconciler. The parent May request remains unfinished until the exact child
result is available and May has produced the final human response.

## Ordinary Human Input

Console, Web, Telegram, and control clients normalize ordinary May input onto
one path:

```text
human.input.received
  -> app.input.requested (appId=may)
    -> durable May App inbox item
      -> bounded owner attempt
        -> direct result
           or typed child App dependency
             -> child result
               -> May review
        -> app.response.delivery.requested
          -> channel delivery terminal state
```

The May inbox item is the durable request authority. A trace explains causality
inside and between attempts; it does not replace the inbox item. A session may
finish, fail, or be replaced without losing the request.

Every ordinary human turn creates its own inbox item. Conversation identity,
reply anchors, nearby requests, and durable preferences provide bounded
context, but later text never implicitly steers or wakes a mutable “current
session.”

## Explicit Session Control And Direct Chat

Session control is deterministic and always names its target:

```text
session.steer.requested(sessionId, message)
session.cancel.requested(sessionId)
session.cancel_all.requested
```

An explicitly addressed non-May agent may use direct chat:

```text
chat.start.requested(agent != may)
  -> persistent direct-agent session
    -> session.idle
```

That chat session is execution context only. It owns neither May App input nor
domain work. Ordinary May input never resumes it. Each direct-chat turn retains
its own trace even when the session ID is reused.

## App And Agent Messages

`message.created` is a durable communication fact, not a generic work queue.

- A message addressed to an agent owned unambiguously by one App may be
  admitted as one correlated App inbox request.
- A human-directed message is a notification and requires channel-delivery
  evidence.
- Cross-App work uses a typed child App request and exact dependency, not a
  message acknowledgement.
- Desired long-running outcomes use canonical App tasks.
- Unknown or ambiguous addressed messages remain unaccepted; no generic owner
  fallback invents work.

The historical “created -> delivered -> resolved” message state machine is not
the current ownership model. Request completion belongs to App inbox and
dependency records. Human delivery belongs to a correlated delivery operation.

## Closure Rules

- A direct May answer completes only after its response reaches the terminal
  delivery state required by the channel's certainty policy.
- A delegated May request waits for the exact child App result, then completes
  only after May reviews it and the final response reaches terminal delivery.
- A domain App request that attaches task work waits for the exact task
  dependency; task completion alone does not complete the parent request until
  the App records its disposition.
- An outbound notification is not a request. It is complete only as a delivery
  operation, and an uncertain send is never retried blindly.
- A deterministic control is complete when its controller records the
  correlated outcome; it does not create an App owner pass.

Bookkeeping acceptance is never semantic completion.

## Recovery

At startup, the App inbox rescans durable unfinished items. An interrupted
owner claim becomes an exact session wait or is fenced and replaced according
to the observed session state. Completed dependencies wake the same parent
request. Pending delivery operations follow their channel certainty policy.

Recovery never:

- reconstructs work from a transcript;
- resumes the latest May session;
- promotes a worker artifact into request authority;
- infers a parent from similar text; or
- resends an uncertain external delivery without review.

This keeps the eventual-handling guarantee in one place: the owning App record.

## Delivery Convention

Reserve the delivery operation before sending. Carry its operation ID, App
inbox item ID, request ID, channel, and reply anchor through the transport.
Record a terminal delivery observation only when the channel supplies the
required evidence.

Web and attached socket clients can acknowledge after rendering the exact
response. Telegram uses its provider result and stored reply context. A process
crash after an external send but before confirmation is uncertain, not failed
and not safely retryable.

## Review Checklist

For every human-rooted request, verify:

1. one normalized human input produced one idempotent May App admission;
2. one durable inbox item owns the request;
3. every delegated child or task wait uses an exact dependency identity;
4. owner attempts are bounded and replaceable;
5. the authored App result is distinct from execution/session success; and
6. the final channel delivery is correlated to the same request.

Any design that needs a global current May session, a second message queue, or
an uncorrelated owner event violates this lifecycle.
