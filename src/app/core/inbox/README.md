# Input admission and caller receipts

An inbox item records accepted input and its result correlation. The owning
Task executes it through the [Task runtime](../tasks/README.md). Conversation
is a Task's human-facing role; this directory does not run a second agent loop.

Start at [`app-inbox-host.ts`](app-inbox-host.ts): validate input, resolve its
Task, persist attachment and expose the correlated result. Declared human-facing
input goes directly to its stable Task through `admitConversation`. Other typed
App input uses a claimed admission step to attach work to its responsible Task.
Those admission claims do not authorize model execution.

[`input-context.ts`](input-context.ts) reads and freezes caller context.
[`composition/conversation-inbox.ts`](../../composition/conversation-inbox.ts)
adds human context to admission. Execution context and judgment are prepared in
[`composition/conversation-task-turn.ts`](../../composition/conversation-task-turn.ts)
under the Task's claim.

[`core/state`](../state/README.md) owns durable input, attachment and result
transactions. [`composition/app-inbox-runtime.ts`](../../composition/app-inbox-runtime.ts)
wires event routes, admission scheduling and notifications, including linked
Task outcomes and missed-change discovery. It delegates Turn Stop to the Task
runtime.

`app-inbox-host.test.ts` owns generic admission, attachment, readiness and caller
context. Human replies, handoffs, controls and retry are tested through actual
Task execution in `core/tasks/conversation-runtime.test.ts` and atomic settlement
in `core/state/conversation-task-turns.test.ts`. See the
[coverage map](../../../../test/README.md#shared-task-execution-coverage).
That map records the retired callback tests and the current owner of each
retained guarantee, including public Stop, failed settlement and restart.
