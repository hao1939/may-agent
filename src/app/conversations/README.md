# Conversation storage and projections

Start at `readAppConversationResource()` in `store.ts`. It assembles bounded
messages and Topics from existing durable requests and events. Topic rows and
their exact Task links live in the same Host database.

`store.ts` owns message projection, Topic creation/search/pagination, and
Topic-to-Task links. It reads typed request evidence through
`listAppInboxConversationItems()` in `../app-inbox-store.ts`. Request creation,
claims, completion, recovery, and claim-to-Topic association remain there.
Conversation projection has no scheduler or request lifecycle.

Callers pass the existing database connection. This separation creates no new
database, cache, transaction boundary, or background process. The request
handler can still update a Topic and request inside the same transaction.

`store.test.ts` covers message deduplication, bounded views, Topic discovery,
and reconstruction after reopening the database. Request/Conversation
integration also remains covered by the request-handler and transport tests.

The canonical design is
[Message Lifecycle](../../../../may-agent.app/docs/2a-design/message-lifecycle.md).
