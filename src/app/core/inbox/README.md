# Input handling

This directory owns generic input admission and dispatch, independent of how a
Conversation chooses an answer. An inbox item records input handling; an accepted
Request and a background Task have their own state and lifetimes.

Start at `app-inbox-host.ts`: admission -> durable claim -> selected input handler
-> completion or exact wait. It enforces ordering, claim ownership and Stop.
`input-handler.ts` is the handler contract; `input-context.ts` reads and freezes
the context for that claim.

[`core/state`](../state/README.md) persists claims and commits coordinated changes.
[`composition/app-inbox-runtime.ts`](../../composition/app-inbox-runtime.ts) wires
routes, scheduling and notifications. `composition/conversation-inbox.ts` selects
the replaceable Conversation handler. Core does not import that handler.

`app-inbox-host.test.ts` covers admission, handoff and completion.
`app-inbox-ownership.test.ts` checks stale claims and aborts;
`app-inbox-failure.test.ts` checks bounded failures and preserved accepted asks.
Runtime and containment tests live beside their composition owner.
