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

The Host implementation in `src/app/event-interface.ts` validates input,
assigns trusted provenance, persists events, and exposes their admission view.
Publisher authority and the live EventBus stay inside the Host. App attempts
receive their scoped publishing capability through the SDK.

The canonical design is
[Events and Task Admission](../../../may-agent.app/docs/2a-design/events.md).
