# Input admission and caller receipts

An inbox item records accepted input and its result correlation. The owning
Task executes it through the [Task runtime](../tasks/README.md). Conversation
is a Task's human-facing role; this directory does not run a second agent loop.

Submission and admission are separate. Every entry point uses the Inbox store's
verified submission lookup before applying today's App schema or routing defaults.
An identical retry returns the saved receipt in any status and may link its exact
original Event; it neither runs the mapper nor advances admission. Conflicting
payload, explicit destination or provenance fails before Event correlation.
A received input is not proof of Task creation, fulfillment, caller delivery or
creator closure. Ordinary recovery advances pending admission independently.

Start at [`app-inbox-host.ts`](app-inbox-host.ts): validate input, resolve its
Task, persist attachment and expose the correlated result. Declared human-facing
input goes directly to its stable Task through `admitConversation`. Other typed
App input resolves synchronously through `app.task`; Task admission commits its
exact input link. There is no inbox execution claim, lease or capacity queue.
Mapping proposals remain provisional until Task admission atomically commits the
exact input link. Funding or transient failure may leave the input pending for
reconsideration; a committed attachment is never remapped.
Mapping failures retain the input for the bounded recovery scan. Accepted Task
outcomes are projected by exact admission identity, using events and a recovery
scan; failure of that projection cannot roll back the Task outcome.

`project.task.reconciled` and `app.task.cancelled` refresh exact input feedback
and linked Conversation observations. The runtime emits no second Task-level
dependency notification. A saved input's first accepted failure produces
`app.dependency.updated` with `blocked`; its eventual answer or owner closure
produces `done`. A pre-Task admission failure uses the same exact input identity
and a stable recovery fingerprint. It is marked reported only when an
accountable route accepts the blocker; journal persistence or the generic noop
receipt alone is not caller delivery. Until then, paced recovery replays the
same idempotent fact. The caller's retained Condition suppresses repeated
reports without satisfying the wait. Ordinary waits do not relay a caller wake.
Review deadlines and explicit App event routes remain available.

[`input-context.ts`](input-context.ts) reads and freezes input identity and human
origin. Returned feedback enters through Task input; context preparation no longer
follows historical inbox waits. [`input-result.ts`](input-result.ts) builds the
same caller event for live notification and recovery. First-report and answer
attempt references are saved independently on the exact input admission during
Task acceptance. Recovery can return them even when no notification Event was
saved. It never substitutes a later worker result for this input's answer.

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
