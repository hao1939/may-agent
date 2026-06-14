# Design: Telegram Channel

**Status**: implemented foundation, needs interaction refinement
**Updated**: 2026-06-14

## Purpose

Telegram is the mobile human-control surface for May-agent. It should feel like
talking to the system, not operating a separate bot UI.

The channel has three jobs:

1. Let the human ask questions and steer active work.
2. Notify the human only when attention is useful.
3. Turn every human reply into one durable conversation that May can handle,
   delegate, resume, or close.

The rule is:

> A Telegram reply belongs to the conversation of the message it replies to.
> A Telegram message that is not a reply starts a new conversation.

## Current Implementation

The current code path is:

```text
outbound event
  -> telegram-outbound formats message
  -> telegram-client sends message and stores notification_messages row
  -> human replies to that Telegram message
  -> telegram-reply-router reconstructs context
  -> telegram.ts acknowledges the reply and starts May with enriched context
```

What works now:

- Allowed-chat enforcement.
- Long-polling inbound messages.
- `message.created` to `human` is forwarded to Telegram.
- Root chat responses stream back to Telegram.
- Child-session completions are summarized.
- Telegram message IDs are stored in `notification_messages`.
- Replies to stored notifications are enriched with notification/session
  context.
- Bot acknowledgements can be sent as Telegram replies, preserving the visible
  message chain.

Observed weaknesses:

- Many notifications are too noisy or repetitive, especially recurring metric
  and handler-failure alerts.
- Some notification rows still miss `conversationId`, so May may need to infer
  intent from legacy notification/session context.
- Reply context is stored as a generic JSON blob. It works, but lacks a stable
  typed shape for subject, severity, action hints, and resolution state.
- The bot still needs better final-result confirmations after May handles a
  human reply.
- Slash-command help advertises status-like flows, but `/status` currently
  becomes a normal chat request rather than a fast read-model response.
- Stale notifications remain actionable. A reply to an old message may wake the
  wrong session or reopen already-resolved work.

## Desired Interaction Model

Telegram messages should look like compact action cards:

```text
AKS RP E2E needs approval

Decision
Approve live staging execution for aad-rbac and ossku-migration?

Why now
Check-mode coverage is high, but evidence quality is missing live staging.

Current state
153/173 paths pass. 20 non-passing paths remain classified.

Reply
approve
adjust <changes>
hold

Open: /projects/aks-rp-e2e.app/ui/kanban/
```

The message should answer four questions without requiring a web UI:

- What happened?
- Why am I being notified?
- What can I say?
- What happens after I reply?

After May receives the enriched reply, May or the project owner may produce a
small typed event:

```json
{
  "type": "project.focus.approval.submitted",
  "source": "telegram",
  "owner": "agent:aks-explorer",
  "data": {
    "projectPath": "projects/aks-rp-e2e.app",
    "planId": "focus-proposal-live-staging-20260613",
    "decision": "approve",
    "reply": "approved",
    "author": "hao"
  }
}
```

The human-facing acknowledgement should describe the effect:

```text
Approved. aks-rp-e2e planner is reviewing the focus plan now.
```

Not:

```text
Approval sent to project event project.focus.approval.submitted.
```

## Priority 1: Conversation Continuity

The first priority is smooth communication:

> The Telegram reply chain is the conversation boundary.

That is the rule humans expect. If the human replies to an existing bot message,
the reply continues that conversation. If the human sends a bare message, it
starts a new conversation.

May owns the Telegram channel. A reply should go to May with the conversation
context attached. May then decides how to handle it:

- fix the issue directly,
- delegate to another agent,
- resume the original session,
- emit a project or escalation event,
- ask the human a follow-up,
- or close the conversation with a result.

This keeps Telegram simple. The transport does not need to know whether a reply
should become a project event, a session steer, an escalation resolution, or a
new investigation. It only needs to preserve the conversation and deliver the
packet to May.

Transport boundary:

- Store the Telegram message id and compact conversation context.
- On reply, recover that context from `reply_to_message_id`.
- Enrich the human text with conversation/session/notification context.
- Acknowledge delivery in the same Telegram reply chain.
- Do not execute project decisions, classify approvals, or repair blockers in
  transport code. May and project agents do that work.

The channel needs a conversation envelope:

```ts
interface TelegramConversationContext {
  conversationId: string;

  originalIssue?: {
    eventType?: string;
    eventId?: string;
    escalationId?: string;
    sourceAgent?: string;
    sourceSessionId?: string;
    projectPath?: string;
    taskId?: string;
    reason?: string;
    requestedAction?: string;
  };

  lastHandledBy?: {
    agent?: string;
    sessionId?: string;
  };

  expectedClosure?: string[]; // e.g. ["escalation.resolved", "project.planning.requested"]
  staleAfterMs?: number;
}
```

Human-visible text is not routing data. Prose like `From: aks-explorer` or
`Project: aks-rp-e2e` is useful to the human, but the router should use the
stored `conversationId` and `originalIssue`.

Recommended flow:

1. Human replies to a Telegram message.
2. Router looks up `reply_to_message_id` in `notification_messages`.
3. If the stored notification has `conversationId`, the reply continues that
   conversation.
4. If it has no `conversationId`, the router creates a conversation around the
   stored notification as legacy fallback.
5. The reply is delivered to May as a conversation input with original issue
   context attached.
6. May replies to the latest Telegram message in that conversation when asking
   follow-up questions or reporting the result.

The router may still support direct typed events for legacy narrow UI-style
actions, but that is compatibility, not the default design.

This preserves natural conversation while keeping the original issue attached.

### Conversation Examples

Message sent while May brokers a project escalation:

```json
{
  "conversationId": "tg_12345",
  "originalIssue": {
    "eventType": "escalation.created",
    "escalationId": "esc_1",
    "sourceAgent": "aks-explorer",
    "sourceSessionId": "s_blocked",
    "projectPath": "projects/aks-rp-e2e.app",
    "reason": "No ready work while gaps remain.",
    "requestedAction": "Ask human how to proceed."
  },
  "lastHandledBy": {
    "agent": "may",
    "sessionId": "s_may_broker_456"
  },
  "expectedClosure": [
    "escalation.resolved",
    "project.planning.requested"
  ]
}
```

Plain May chat response:

```json
{
  "conversationId": "tg_67890",
  "lastHandledBy": {
    "agent": "may",
    "sessionId": "s_chat_789"
  }
}
```

### Message Responsibility

The component that sends a human-facing message should provide:

- `conversationId` when continuing a conversation
- `originalIssue` when the message is about an escalation, project, task, or
  blocked session
- `lastHandledBy` when May delegated or resumed work
- `expectedClosure` when the producer knows what event should eventually close
  the loop

Telegram transport should not infer ownership from prose. It may keep best
effort fallback for legacy messages, but new messages must carry conversation
context.

### Original Session Gone

If the original or last-handling session is gone, the reply is still not lost:

```text
reply to Telegram message
  -> read conversationId + originalIssue + lastHandledBy
  -> deliver conversation input to May
  -> May decides whether to resume, delegate, replan, or ask follow-up
  -> May confirms what happened
```

The fallback prompt should be compact:

```text
Human replied in Telegram conversation tg_12345.

Original issue:
<structured issue summary>

Previous handling session: s_old
Human reply: <reply>

Handle the reply. Close or update the original issue when done.
```

Do not silently drop the reply if the previous session cannot be resumed.

### May As Broker For Escalations

It is acceptable, and often desirable, for `escalation.created` to route to May
first. May is the human-facing broker and can decide whether the issue needs a
human, another agent, or an automatic repair.

When May reaches out to the human, the human reply returns to the same
conversation. May's notification must include the original escalation as
`originalIssue`, so May can fix, delegate, resolve, or replan the real problem.

Current weak pattern:

```text
escalation.created
  -> May receives it
  -> May sends plain message to human:
       "[escalation] esc_1 ... Reason: ..."
  -> human replies
  -> reply routes to May chat with only prose context
  -> original escalation may remain unresolved
```

Desired pattern:

```text
escalation.created
  -> May receives it
  -> May sends message.created to human with conversationId + originalIssue
  -> human replies to that Telegram message
  -> reply continues the same conversation and returns to May
  -> May fixes/delegates/resolves/replans the original issue
  -> May replies with the result in the same Telegram conversation
```

May should receive a packet like:

```json
{
  "conversationId": "tg_12345",
  "originalIssue": {
    "eventType": "escalation.created",
    "escalationId": "esc_1",
    "sourceAgent": "aks-explorer",
    "sourceSessionId": "s_blocked",
    "projectPath": "projects/aks-rp-e2e.app",
    "reason": "No ready work while gaps remain.",
    "requestedAction": "Ask human how to proceed."
  },
  "lastHandledBy": {
    "agent": "may",
    "sessionId": "s_may_broker_456"
  },
  "humanReply": "Investigate and push the project forward"
}
```

May does not have to emit `escalation.resolved` immediately. It may first
investigate and fix the issue. But it must keep the original issue attached
until it has emitted some closure/update event.

## Notification Context

Keep the existing `notification_messages.data` JSON blob, but standardize its
shape. This avoids a schema migration while giving the router a reliable
contract.

```ts
interface TelegramNotificationData {
  text: string;
  summary?: string;

  subject?: string;        // "AKS RP E2E focus approval"
  kind?: string;           // "approval" | "blocker" | "failure" | "digest" | "session"
  severity?: "P0" | "P1" | "P2" | "P3";

  projectPath?: string;
  sessionId?: string;
  taskId?: string;
  eventId?: string;

  conversationId?: string;
  conversation?: TelegramConversationContext;
  actionHints?: string[];  // ["approve", "adjust <changes>", "hold"]

  staleAfterMs?: number;
  dedupKey?: string;
  supersedesKey?: string;
}
```

New producers should prefer `conversationId` plus
`conversation.originalIssue`. Telegram transport should not execute the domain
decision itself.

## Routing Rules

Reply routing should stay deterministic:

1. If the human message replies to a Telegram message with a stored
   `conversationId`, deliver the reply to May as input for that conversation.
2. Else if it replies to a stored notification without `conversationId`, create
   a new conversation seeded by the stored notification and deliver it to May.
3. Else if it replies to a Telegram quote with no DB row, create a new
   conversation seeded by the quoted text and deliver it to May.
4. Else if it is a bare Telegram message, create a new conversation and deliver
   it to May.
5. Legacy notifications without a conversation envelope should still be
   enriched with the stored notification/session context and delivered to May.
6. Project-specific events, escalation resolution, session resume, and task
   steering are agent decisions after May receives the enriched context.

If the notification is stale, do not silently execute it. Send a short message:

```text
That request is stale. I opened a fresh status check instead.
```

Then emit a normal chat/status request with the stale context attached.

## No Silent Drops

Every Telegram reply must produce a human-visible confirmation.

There are two levels:

1. **Delivery confirmation**: sent immediately after the router accepts the
   reply.
2. **Result confirmation**: sent when May finishes handling the reply or records
   a closure/update event.

Examples:

```text
Received. I attached your reply to this conversation and May is handling it.
```

```text
Received. I found the original issue and May is checking it now.
```

```text
Received. The previous worker session is gone, so May opened a fresh turn with
the original issue attached.
```

```text
Done. May classified the blocker as stale and updated the project status.
```

If routing fails, Telegram must say so:

```text
I could not resume the previous worker session. I sent the reply to May with
the original issue attached.
```

Current implementation gap: `telegram.ts` sends delivery acknowledgements when
it accepts a reply, but final result confirmation still depends on May sending a
follow-up in the same conversation. The conversation design requires that
closure to be explicit.

## Noise Control

Telegram should be attention-first, not event-log-first.

Recommended policy:

- `P0`: immediate, always send.
- `P1`: immediate, dedupe by `dedupKey` with cooldown.
- `P2`: batch into a digest unless it asks for human input.
- `P3`: do not push by default; visible in web/console.

Repeated notifications with the same `dedupKey` should update or collapse:

```text
AKS RP E2E still blocked

Same blocker repeated 5 times in 42m.
Latest: task not found: network-acns-cilium-network-policy...

Reply: investigate / mute 2h / show details
```

Telegram supports editing messages. When practical, store the message ID and
edit the existing notification instead of sending a new one for the same
dedupKey. If editing is unavailable or fails, send a collapsed follow-up.

## Status And Control Commands

Natural language should remain primary. Slash commands are for fast mobile
read-models and safety controls:

- `/status` - compact system/project status, no LLM session required.
- `/projects` - list project health: active, blocked, backlog, last progress.
- `/project <id>` - focused project status and useful links.
- `/tasks <id>` - project task summary / current active leaves.
- `/sessions` - active sessions and what they are doing.
- `/quiet <duration>` - mute P2/P3 notifications.
- `/watch <project>` - raise attention level for one project.
- `/cancel <session>` and `/cancel all` - explicit cancellation.
- `/help` - show the above plus examples.

These commands should query read models directly where possible. They should not
spawn a general chat session unless the command asks for analysis.

## Convenience Features

High-value refinements:

- **Reply examples**: every actionable notification includes the exact replies
  it understands.
- **Human acknowledgements**: confirmations describe the outcome, not internal
  event names.
- **Project links**: include web links for kanban, task, event trace, or feature
  page when relevant.
- **Digest mode**: grouped summary for repeated low-priority events.
- **Stale reply detection**: avoid applying old approvals or steering to
  terminal work.
- **Context health metric**: track percentage of Telegram notifications with
  `conversationId` and useful `originalIssue`.
- **Reply-actionable metric**: track replies that reach May with conversation
  context and produce a delivery/result confirmation without needing a
  clarification turn.

## Implementation Plan

1. Tighten notification formatting.
   - Add a small formatter for `message.created` to human.
   - Preserve `subject`, `kind`, `severity`, `conversationId`,
     `conversation.originalIssue`, and `actionHints` in
     `notification_messages.data`.

2. Improve reply acknowledgement.
   - Confirm delivery to May immediately.
   - Confirm final result or closure when May finishes handling the reply.
   - Keep internal event names in logs, not the chat message.

3. Add direct read-model commands.
   - Implement `/status`, `/projects`, `/project`, `/tasks`, `/sessions`.
   - Keep them fast and deterministic.

4. Add notification lifecycle controls.
   - Dedupe by `dedupKey`.
   - Support quiet mode.
   - Detect stale replies using `staleAfterMs`.

5. Add metrics.
   - `telegram.notification-context-rate`
   - `telegram.reply-actionable-rate`
   - `telegram.notification-dedupe-suppressed`

## Non-Goals

- Telegram should not become the full web UI.
- The channel should not require buttons or custom clients to be useful.
- The router should not hide state changes in free-form chat when a typed event
  exists.
