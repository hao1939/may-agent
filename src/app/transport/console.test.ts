import { afterEach, describe, expect, it, mock } from "bun:test";
import { EventBus } from "../event-bus.js";
import { attachConsoleUI } from "./console.js";

describe("console transport", () => {
  const originalLog = console.log;

  afterEach(() => {
    console.log = originalLog;
  });

  it("restores the prompt after completing an App response delivery", () => {
    const bus = new EventBus();
    const onResponseDelivered = mock(() => {});
    console.log = mock(() => {});
    attachConsoleUI(bus, () => null, false, onResponseDelivered);

    bus.emit({
      type: "app.response.delivery.requested",
      source: "app-outbox",
      owner: "app:may",
      data: {
        channel: "console",
        text: "done",
        operationId: "delivery-1",
        appInboxItemId: 1,
        appInboxRequestId: "request-1",
      },
    } as any);

    expect(onResponseDelivered).toHaveBeenCalledTimes(1);
  });
});
