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

`app-schedules.test.ts` covers schedule production and ownership.
`app-observer-runtime.test.ts` covers bounded execution, publication failures and
cleanup. Composition's inbox tests cover routing and reload; daemon tests cover
scheduled execution across real process boundaries.
