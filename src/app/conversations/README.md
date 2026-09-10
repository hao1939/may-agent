# Conversation handling and state

This directory owns the replaceable conversational frontend, not storage.
[`context.ts`](context.ts) selects bounded context;
[`turn-handler.ts`](turn-handler.ts) validates answers/effects and calls state
operations; [`turn-agent.ts`](turn-agent.ts) invokes the shared model/tool runner.
[`composition/conversation-inbox.ts`](../composition/conversation-inbox.ts)
wires that capability into the generic inbox Host through
[`AppInputHandler`](../core/inbox/input-handler.ts). The Host keeps admission,
ordering, claims, Stop and recovery. Task-only operation can omit this frontend
without losing unrelated Task execution or retained Conversation reads.

Start storage reads at `readAppConversationResource()` in
[`core/state/conversations.ts`](../core/state/conversations.ts). It owns message
projection, Topic creation/search/pagination and exact Topic-to-Task links in
the same Host database. It reads typed input evidence through
`listAppInboxConversationItems()` in `app-inbox-store.ts`. That store retains
input admission and claim primitives; projection has no scheduler or lifecycle.

[`core/state/conversation-requests.ts`](../core/state/conversation-requests.ts)
stores the accepted human ask separately from input handling:
App/Conversation-scoped ID, current scope/revision, exact Task links, and
open/closed with closure reason and message identity. Apps return
`requestUpdates`; the Host validates versions, persists acceptance before a
handoff and commits closure with the answer. It never infers fulfillment from
a Task status. Admission links the actual Task in the same state transaction.
Request updates add exact Task links; empty or omitted `taskRefs` never erase
admitted work. Duplicate links are ignored, with at most 32 distinct links per
Request, including links added by later updates.

The `conversation_context` tool in `turn-agent.ts` uses the shared state reads
to page open asks (`requests`, `afterId`) and read full scope (`request`, `id`).
Bounded prompts keep whole records; an omitted record must be read before
changing it. The Host's
handoff path can resolve an omitted ask from the scoped store and rechecks its
open status and recorded revision at Task admission. May's existing
supervision result can supply `result.conversation.requestUpdates`; stale
closures fail without losing the accepted scope or accepting a false answer.
The existing recovery scan also selects terminal linked Tasks with an open
ask. Discussion-only asks do not create periodic work, and no Request owns
execution, retries or another controller. Historical asks are not backfilled.

The input Host binds each executing claim to its exact session. Losing claim
ownership aborts that execution locally; it does not crash the daemon. Replies,
Task controls and admissions revalidate authority at their commit boundary.
Already accepted effects are not undone. Cancellation retains capacity until
the executor settles, and database/reporting failures do not bypass cleanup.

`ConversationTurnResult` describes new interactive Turn answers/effects, without
the retained child-wait protocol. Both the agent adapter and the handler enforce
its schema for Apps using direct Task handoff. The deprecated `AppRequest` SDK
name remains an alias of `AppInputContext`, not an accepted Request resource.

Direct human turns persist a small `handling` record before model execution.
A failed or interrupted execution, or a rejected Task control/handoff, finishes
input handling with an explicit failure response, not fulfillment. It needs
new human input to try again; already admitted work continues independently.
A validated decision is saved before applying effects, so recovery can replay
idempotent admission/publication after a crash or failed result write without
rerunning the model. Rejected decisions or effects end the turn, including
when recovery finds that a handoff's target App is no longer available.
Task callers and retained child waits keep their separate handling contract.
Row `done` means input handling ended; inspect `handling` and the result for
its disposition.

Console Esc and Telegram/browser Stop buttons observe `activeTurn` and publish
`conversation.turn.stop.requested` with that exact ID and revision. The Host
persists `stopped` before aborting, without waiting behind model execution.
Recovery cannot replay it. Old/duplicate controls never select a newer turn.
Independent Tasks continue; stopping a turn does not close its accepted ask.
Console preserves drafts and dismisses completion first. Browser May chat reads
the shared Conversation over HTTP; it no longer selects a default session.
Stopping, then sending a correction can update the same accepted Request;
seamless current-turn steering remains separate follow-up work.

`app-inbox-runtime.ts` attaches cleanup before dispatch/readiness reads and
contains detached recovery failures. Structured `handler.failed` diagnostics
retain known work identity, stage, error and disposition. Failed diagnostic
persistence falls back to the independent logger, without replaying execution.

Callers pass the existing database connection. Core state operations own the
coordinated commits: [`conversation-turns.ts`](../core/state/conversation-turns.ts)
accepts decisions with Topics and Request updates;
[`inbox.ts`](../core/state/inbox.ts) attaches Task work and completes inputs with
Request closure; [`conversation-outcomes.ts`](../core/state/conversation-outcomes.ts)
records supervised outcomes with their explanation and Request updates.
Execution stays outside those transactions. There is no new database, cache,
background process or alternate state authority. Retained App-to-App child
delegation keeps its explicit transaction in the handler.

[`core/state/conversations.test.ts`](../core/state/conversations.test.ts) covers
message deduplication, bounded views, Topic discovery and reopen reads.
[`conversation-requests.test.ts`](../core/state/conversation-requests.test.ts)
covers scoped asks and revision fences. [`turn-agent.test.ts`](turn-agent.test.ts)
exercises context discovery, result schemas and a scripted real-tool repair loop;
it does not prove live model judgment. Inbox ownership, failure, completion,
Task attachment and transport tests retain the integration coverage.

The canonical design is
[Message Lifecycle](../../../../may-agent.app/docs/2a-design/message-lifecycle.md).
