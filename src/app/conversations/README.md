# Conversation storage and projections

Start at `readAppConversationResource()` in `store.ts`. It assembles bounded
messages and Topics from existing durable requests and events. Topic rows and
their exact Task links live in the same Host database.

`store.ts` owns message projection, Topic creation/search/pagination, and
Topic-to-Task links. It reads typed request evidence through
`listAppInboxConversationItems()` in `../app-inbox-store.ts`. Request creation,
claims, completion, recovery, and claim-to-Topic association remain there.
Conversation projection has no scheduler or request lifecycle.

`requests.ts` stores the accepted human ask separately from input handling:
App/Conversation-scoped ID, current scope/revision, exact Task links, and
open/closed with closure reason and message identity. Apps return
`requestUpdates`; the Host validates versions, persists acceptance before a
handoff and commits closure with the answer. It never infers fulfillment from
a Task status. Admission links the actual Task in the same state transaction.

The existing `conversation_context` tool pages open asks (`requests`,
`afterId`) and reads full scope (`request`, `id`). Bounded prompts keep whole
records; an omitted record must be read before changing it. May's existing
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

Direct human turns persist a small `handling` record before model execution.
A failed or interrupted execution finishes input handling with an explicit
failure response, not fulfillment. It needs new human input to try again.
A validated decision is saved before applying effects, so recovery can replay
idempotent admission/publication without rerunning the model. Task callers and
retained child waits keep their separate handling contract. Row `done` means
input handling ended; inspect `handling` and the result for its disposition.

Console `/stop` reads `activeTurn` and publishes
`conversation.turn.stop.requested` with that exact ID and revision. The Host
persists `stopped` before aborting, without waiting behind model execution.
Recovery cannot replay it. Old/duplicate controls never select a newer turn.
Independent Tasks continue; stopping a turn does not close its accepted ask.
Steering and other human surfaces remain separate follow-up work.

Callers pass the existing database connection. This separation creates no new
database, cache, transaction boundary, or background process. The request
handler can still update a Topic and request inside the same transaction.

`store.test.ts` covers message deduplication, bounded views, Topic discovery,
and reconstruction after reopening the database. Request/Conversation
integration also remains covered by the request-handler and transport tests.

The canonical design is
[Message Lifecycle](../../../../may-agent.app/docs/2a-design/message-lifecycle.md).
