# Conversation storage and projections

Start at `readAppConversationResource()` in `store.ts`. It assembles bounded
messages and Topics from existing durable requests and events. Topic rows and
their exact Task links live in the same Host database.

`store.ts` owns message projection, Topic creation/search/pagination, and
Topic-to-Task links. It reads typed request evidence through
`listAppInboxConversationItems()` in `../app-inbox-store.ts`. Request creation,
claims, completion, recovery, and claim-to-Topic association remain there.
Conversation projection has no scheduler or request lifecycle.

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

Callers pass the existing database connection. This separation creates no new
database, cache, transaction boundary, or background process. The request
handler can still update a Topic and request inside the same transaction.

`store.test.ts` covers message deduplication, bounded views, Topic discovery,
and reconstruction after reopening the database. Request/Conversation
integration also remains covered by the request-handler and transport tests.

The canonical design is
[Message Lifecycle](../../../../may-agent.app/docs/2a-design/message-lifecycle.md).
