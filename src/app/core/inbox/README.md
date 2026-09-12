# Input admission and caller receipts

An inbox item records accepted input and its result correlation. The owning
Task executes it through the [Task runtime](../tasks/README.md). Conversation
is a Task's human-facing role; this directory does not run a second agent loop.

Start at [`app-inbox-host.ts`](app-inbox-host.ts): validate input, resolve its
Task, persist attachment and expose the correlated result. Declared human-facing
input goes directly to its stable Task through `admitConversation`. Other typed
App input resolves synchronously through `app.task`; Task admission commits its
exact input link. There is no inbox execution claim, lease or capacity queue.
Mapping failures retain the input for the bounded recovery scan. Accepted Task
outcomes are projected by exact admission identity, using events and a recovery
scan; failure of that projection cannot roll back the Task outcome.

[`input-context.ts`](input-context.ts) reads and freezes input identity and human
origin. Returned answers enter through Task input; context preparation no longer
follows historical inbox waits. [`input-result.ts`](input-result.ts) builds the
same exact caller answer for live notification and recovery from a saved receipt.
The Task Condition recovery path can return that receipt even when publication
stopped before any completion Event was saved. It never substitutes the worker's
latest result for the caller's earlier answer.

Execution context and judgment are prepared in
[`composition/conversation-task-turn.ts`](../../composition/conversation-task-turn.ts)
under the Task's claim.

[`core/state`](../state/README.md) owns durable input, attachment and result
transactions. [`composition/app-inbox-runtime.ts`](../../composition/app-inbox-runtime.ts)
wires event routes, admission recovery and notifications, including linked
Task outcomes and missed-change discovery. It delegates Turn Stop to the Task
runtime.

`app-inbox-host.test.ts` owns generic admission, immutable attachment, result projection and caller
identity. Human replies, handoffs, controls and retry are tested through actual
Task execution in `core/tasks/conversation-runtime.test.ts` and atomic settlement
in `core/state/conversation-task-turns.test.ts`. See the
[coverage map](../../../../test/README.md#shared-task-execution-coverage).
That map records the retired callback tests and the current owner of each
retained guarantee, including public Stop, failed settlement and restart.
