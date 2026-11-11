# Human interaction within the Task loop

Conversation retains messages, Topics and accepted human Requests. The same Task
contract owns execution, waits, retry and results for human and machine input.
There is no separate Conversation agent, result schema or handoff executor.

Conversation turns use the App's existing workspace, including on Git Apps, so
local mounts and ignored context stay available without remote Git admission.
An explicitly selected workflow can still require its own Task worktree.

Human input is durably admitted onto one stable Task per Conversation.
`core/tasks/attempt-execution.ts` supplies exact input identities in
`attempt.events.inputs`, original payloads in events/continuedInputs, and bounded
history and Requests in `attempt.events.communication`. `attempt.read.communication`
reads further context through an input accepted by this Task. `context.ts` retains
bounded context projection for readers; it does not select an execution adapter.

Agents publish messages, choose Topics and save accepted requirements through
`attempt.apply({ communication: [...] })` or the same changes in a Task result.
`core/tasks/task-communication.ts` derives recipients and authority from saved
input admission. Sharing a Conversation or citing a Task does not transfer its
human promise. Save corrections before doing work so failure or Stop cannot lose
them. Request revisions fence changes; closing a Request requires its own
explanation. Convergence cannot leave an accepted Request open for a covered input.

Independent contributions use ordinary `requests` plus `conditions: [{ requestId } ]`.
The original Task waits and retains its human Request; the contributing Task
returns evidence through `app.dependency.updated`. New discussion can be answered
while earlier independent work waits. A message or a Request record alone does
not schedule work. Tasks use ordinary scoped controls, with no Conversation-only
control or followUp protocol.

Task result acceptance, communication and input settlement share the existing
fenced transaction. Failed settlement retains input for normal Task retry.
Committed messages have stable operation identities, and external transport
delivery has separate durable receipts. Historical results remain readable.
Restart cleans old execution and starts a fresh attempt of the same Task; it
does not resume a saved agent session.

Detailed communication behavior belongs to `core/tasks/task-communication.test.ts`:
multiple inputs, Request ownership/revisions, corrections before failure/Stop,
rollback, Topics, restart and delivery identity. Admission, backlog and Stop
behavior remains in the `core/state/conversation-task-*` tests. The real worker
suite covers conversation history, responsive delegation, nested return paths,
SQLite contention and funded capacity across processes.

Existing execution-bearing Conversation state requires the explicit offline
[Task contract conversion](../../../scripts/operations/README.md#convert-retired-task-contracts).
Startup refuses old execution contracts before opening another attempt.
