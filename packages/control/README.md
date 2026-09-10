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
or `app-inbox`). Known App, Task, input request, Conversation and claim revision
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

The canonical design is
[Events and Task Admission](../../../may-agent.app/docs/2a-design/events.md).
