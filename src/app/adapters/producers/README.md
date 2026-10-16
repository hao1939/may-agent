# App input producers

These adapters produce facts and declared work. Apps decide what those facts
mean; core owns admission, claims, attempts and accepted results.

Start with `app-schedules.ts` for declared timing, or `app-observer-runtime.ts`
for observer execution and event publication. Both are selected and cleaned up
by `composition/app-inbox-runtime.ts`. Their callbacks use the existing event
and input routes; they do not introduce another Task controller.

A schedule firing does not claim an attempt. An observer returning an event
does not prove a Task is complete. Without these producers, event/input-driven
work and retained Task state continue under the same core contracts.

For an input schedule, a retained publication consumes that time slot. Reloading
the declaration, re-enabling it or restarting the Host must leave that original
input unchanged; revised instructions apply to the next unpublished slot. The
producer checks the existing event journal using the App, schedule and slot
identity. No separate scheduling ledger is needed.

Publication and delivery are separate: ordinary App admission recovery still
handles a saved input whose delivery is unfinished. A failed publication or
journal read leaves the slot due for the next scan. At-least-once delivery is
acceptable, including after journal retention expires; this is not an exactly-once
guarantee. The purpose is to avoid persistent conflicting publication attempts,
not to eliminate every duplicate consideration.

`app-schedules.test.ts` covers schedule production and ownership.
`app-observer-runtime.test.ts` covers bounded execution, publication failures and
cleanup. Composition's inbox tests cover routing and reload; daemon tests cover
scheduled execution across real process boundaries.
