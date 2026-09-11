# Task lifecycle

This directory owns durable Task execution: queue work, claim one bounded attempt,
check its proposed result, and settle it or wait for another wake. Apps define
outcomes and acceptance; concrete executors are supplied by composition.

Read in this order:

1. `app-task-capability.ts` is the private entry point used by Host composition.
2. `controller.ts` and `queue.ts` select ready work under shared capacity.
3. `app-task-runtime.ts` coordinates claim, execution, verification and settlement.
4. `app-task-reconciler.ts` checks identity/revisions and applies state transitions
   through [`core/state`](../state/README.md).
5. `app-task-recovery.ts` schedules recovery; `startup-recovery.ts` and the
   handler/session helpers decide which retained work can safely run again.

`app-task-state.ts` defines persisted Task facts. `app-task-store.ts` provides
snapshot/mutation helpers, not another database authority. Context, Conditions,
event emission and output-path helpers live beside their lifecycle callers.
`execution.ts` and `workspace.ts` are private contracts; concrete implementations
live in `adapters/` and are selected in `composition/task-execution.ts`.

The transition is intent -> claimed attempt -> checked result, wait or attention.
A finished executor call alone cannot accept a Task result. Claims, revisions,
leases and transaction boundaries are unchanged by this directory layout.

Start tests at `controller.test.ts`, `app-task-reconciler.test.ts` and
`app-task-runtime.test.ts`. Policy/context tests cover pure projections; recovery
and session tests cover restart ownership. Store transaction and reopen tests
live in [`core/state`](../state/README.md); real worker tests live in
[`composition/workers`](../../composition/workers/).
