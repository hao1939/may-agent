# Control clients and event contracts

Use `@may-agent/control` to communicate with a running Host. App definitions
and bounded App work use `@may-agent/sdk` instead.

```ts
import { getEvent, publishEvent } from "@may-agent/control/client";
import type { EventInput, EventView } from "@may-agent/control/events";

const socketPath = "/path/to/may.sock";
const input: EventInput = {
  type: "app.input.requested",
  target: { appId: "sample" },
  data: { input: { kind: "message", data: { message: "Review the project" } } },
  idempotencyKey: "review-request-1",
};
const receipt = await publishEvent(socketPath, input);
const view: EventView = await getEvent(socketPath, receipt.eventId);
```

Supply the installation's socket endpoint as `socketPath`. `recorded` and
`accepted` describe event admission; follow the linked request or Task to
observe the work's result. Reuse an idempotency key only for the same input.
Reads of unknown event IDs fail. `waitForSocketEvent()` subscribes and waits
for one matching notification; after reconnecting, read durable state again.

Formal `project.approval.submitted` publication is a privileged Host operation,
not an ordinary self-asserted fact. Telegram and the local operator socket both
submit the exact current Task, generation, Condition generation, displayed
action, expected proposal, decision, actor, and authorization evidence. The
Host validates that anchor against current Task state, stamps `hostApproval`,
and journals the event; App emitters cannot manufacture the stamp. Exact replay
is idempotent, while stale, changed, or differently scoped proposals are
rejected. The operator socket is an installation trust boundary, not an OS
sandbox against code that already has arbitrary shell access.

Human channels submit one ordinary `conversation.message.created` input. For an
explicit proposal reply, `data.replyTo` names the displayed message and
`data.approvalReply` contains `{ target: { appId, taskId }, proposal }` from that
same Task detail. Telegram resolves its native reply; Console uses
`/task <ref>` followed by `/reply <ref> <text>`. Bare text and automatic watch
updates never select an approval. Socket submissions supply frame-level
`operatorId`, `authorizationReference`, and `authorizationEvidence`; the operator
name is attribution, not authenticated human identity.

`/todo` lists requests for attention. Open `/task <ref>` to read the full
proposal and any other pending human actions, then reply to that detail.
Automatic Telegram cards label the Task purpose, exact requested action and
supported reply values when the Condition declares them; the full current state
and evidence stay behind **Details**. Apps remain responsible for putting the
plain-language reason, meaningful choices and consequences, recommendation and
material uncertainty in `requestedAction` when those are needed for a decision.
The transport preserves and labels that content; it does not invent a rationale
or choose on the App's behalf.

An incomplete proposal binding leaves the message as conversation and records
no approval. For feedback, use the same reply gesture with ordinary text, for example
`/reply <ref> Please simplify this before I approve.` Feedback remains
conversation for the App to interpret. A qualified or ambiguous reply is likewise
feedback rather than approval; exact supported decisions keep their displayed
Task, generation, Condition and proposal correlation.

The Host recognizes exact decisions, preserves the input and proposal, then
publishes the existing decision event from its durable Conversation route. Its
`inputEventId` links to the original text. A receipt's optional `approval` reports
the decision event ID or why none was recorded. Conditional text remains App
conversation. Interrupted publication resumes from the saved input through the
existing recovery scan, without another channel delivery or a replacement
proposal. Direct privileged decision publication remains available and retries
through the same event delivery path. Publication and Task wake use one
Condition matcher so a recorded decision agrees with its declared constraints.

Apps can import `readVerifiedApprovalDecision` from `@may-agent/sdk` to read the
common stamp without maintaining a Telegram/operator source allowlist. The App
still owns domain checks such as packet hashes and approved application scope.
Rejection and deferral are durable decisions but do not authorize application.

The project comment box uses this ordinary App-input route with `kind: "message"`.
The selected App must accept that input and declare a Task or Conversation
handler. A matching schema or comment-event subscription alone is insufficient.
Unsupported submissions fail visibly and retain the browser text. Apps that
previously relied on the HTTP comment-event fallback must add message handling
before adopting this change. Explicit event subscriptions and historical
discussion reads remain available.

## Source map

- `src/events.ts`: public input, receipt, observation, and persisted-view types.
  It has no Host, database, or socket dependencies.
- `src/client.ts`: socket connection, commands, publication, reads, and waits.
- `src/protocol.ts`: socket command/frame classification.
- `src/server.ts`: server transport with callbacks supplied by the Host.
- `src/event-envelope.ts` and `src/task-wake.ts`: transport envelope and wake helpers.

The Host implementation in `src/app/core/events/interface.ts` validates input,
assigns trusted provenance, persists events, and exposes their admission view.
Publisher authority and the live EventBus stay inside the Host. App attempts
receive their scoped publishing capability through the SDK.

## Observe facts; read results

| Surface | Meaning and consumer rule |
| --- | --- |
| `publish` receipt | Durable event identity and admission only; follow its request/Task links for the result |
| `app.task.updated` | Exact `{appId, taskId}` wake for a watched Task/list; reread it, never infer completion |
| `conversation.updated` | Exact Conversation wake; read messages since the last known sequence |
| `getEvent` / HTTP `GET /api/events/:id` | Trusted operator diagnostics, including internal types; linked route state is not Task state |
| Explicit raw event/session subscription | Best-effort diagnostic stream; payloads outside documented integrations may change |

`PublicEvent` names the transport shape, not a promise that every bus type is a
supported domain API. The Host's `PUBLIC_EVENT_TYPES` is an **ingress allowlist**,
not an outbound filter. Seeing a diagnostic does not authorize publishing it.
Normal `publish`/HTTP rejects unregistered types; trusted local operator frames
may record facts. Neither can turn diagnostic text into accepted Task results.

`project.task.reconciled` includes stale/rejected attempts. Its raw summary or
`state` is not completion evidence. Task subscribers receive identity-only
wakes and use canonical Task reads, which retain result/cancellation fences.
Profiling, handler health, and subscriber-failure events remain observable to
their diagnostic readers, not promoted into new work APIs.

`handler.failed` identifies its actual source (`cron`, `app-task-controller`,
`app-inbox`, or `runtime:restart-recovery`). Known App, Task, input request, Conversation and claim revision
are separate fields, alongside stage, error and disposition. `requestId` here
identifies input handling; it is not an accepted conversational Request ID.
Reporting remains best effort and cannot decide whether work is fulfilled.

Listeners run after publication with bounded, independent FIFO notification
buffers. Their async promises preserve per-listener ordering and failures become
`subscriber.failed` diagnostics. Slow listeners do not block other listeners or
accepted state; a synchronous CPU-heavy callback still occupies the process and
must be bounded or moved out of process. Overflow/reconnect can lose notifications:
reread canonical resources; never use this stream as a durable work queue.

To add an integration, identify the independent consumer and its existing
resource first. Reuse a wake/read pair where sufficient. Keep domain schemas and
subscriptions in the owning App; only add a public event when that integration
needs one. Private claims, leases, result admission and timer callbacks remain
ordinary calls/transactions. There is no general event plugin or second router.

The [Host source map](../../src/app/README.md) locates event admission and
Task persistence; the public protocol lives in this package.

## SQL diagnostics

The existing `status` socket read with `diagnostics: true` includes
`diagnostics.sql` in the Host. It reports process-lifetime calls, failures, total,
average and worst elapsed SQLite time. `queries` and optional `previousQueries`
contain timestamped five-minute windows, with the top ten query shapes by total
time, worst time and calls. Each window tracks at most 512 operation/shape pairs;
the lifetime `untracked` counters expose omissions from the rankings. Ordinary
status reads do not collect or return diagnostic snapshots.

The shared SQLite adapter records prepare/get/all/run/exec calls in this process.
Raw driver connections and other processes are outside its scope. Parameters,
rows, database paths and error messages are omitted; SQL literals and comments
are masked. SQL structure remains operator diagnostic data. Lock waits count as
elapsed SQL time; sleeps outside SQLite do not.

Compact cumulative counters also accompany the existing minute
`runtime.daemon.heartbeat` observation. A consumer can compare samples from the
same PID and `sql.since`, resetting across restarts. This adds no per-query writes
or new scheduler. Thresholds, review and remediation remain App policy.

## Selecting a human interface

The CLI resolves one interface binding before selecting runtime, send, emit,
web-only or maintenance mode. Agent precedence is `--agent` (including
`--agent=name`), then `AGENT`, then `DAEMON_AGENT`, then `host`. The App and
Conversation come from `CONVERSATION_APP` and optional `CONVERSATION_ID`;
an agent override preserves both. Modes receive the resolved binding or socket
path rather than selecting the agent again from the environment.

| Setting | Selects |
| --- | --- |
| `--agent` / `AGENT` | Interface identity and daemon socket name |
| `--send <recipient>` | Agent receiving this message |
| `CONVERSATION_APP` | App admitting human-interface input |
| `CONVERSATION_ID` | Retained communication context; defaults to `<app>:primary` |

Missing App wiring permits headless Task execution, but input addressed to the
selected human interface fails explicitly. Client and Host admission enforce
this boundary; missing configuration cannot turn it into direct agent chat.
Other agents and explicit session controls keep their existing paths and scope.
Console rejection remains local and leaves unrelated background Tasks running.

Client and maintenance commands must select the same instance and interface
identity as their target daemon. For example, a daemon started with
`--agent helper` can be probed using `--maintenance --agent helper` or shared
`AGENT=helper` configuration. A CLI flag affects that invocation only; it does
not rewrite a separately started maintenance process or supervisor. The supplied
container shares its environment with both processes; its shell restarter uses
that environment or an explicit `MAY_AGENT_HEALTH_SOCKET` override.
`daemonSocketPath()` uses `host.sock` when no identity is supplied.

`sendDaemonInput` requires an explicit `appId` and accepts a retained `conversationId`.
`sendAgentMessage` sends to an agent; for the configured human interface it uses App
admission with both the selected App and Conversation. An explicit
`interface` option can supply the same binding to clients outside the daemon's
environment. Ordinary agents need only the desired message and recipient; the
adapter owns transport and saved Conversation references.
