# Shared scheduling mechanics

`host-capacity.ts` is the shared capacity limit used by input decisions and Task
attempts. Start at `HostCapacity`: acquisition reserves a slot, cancellation can
withdraw a pending acquisition, and release makes capacity available again.
Composition selects the foreground Conversation App and existing limits.

`timer.ts` provides owned timers and shutdown cleanup. App schedules in
`adapters/producers/app-schedules.ts` produce declared input/events; they do not
claim Task attempts or decide whether a result is accepted.

`host-capacity.test.ts` checks capacity and cancellation; `timer.test.ts` checks
timer ownership. Controller tests cover Task dispatch, and composition's inbox
runtime/containment tests cover shared capacity and cleanup across input lanes.
