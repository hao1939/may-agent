import { afterEach, describe, expect, it, mock } from "bun:test";
import { EventBus } from "../event-bus.js";
import { attachConsoleUI } from "./console.js";

describe("console transport", () => {
  const originalLog = console.log;

  afterEach(() => {
    console.log = originalLog;
  });

  it("restores the prompt when the primary session reaches a stable boundary", async () => {
    const bus = new EventBus();
    const onResponseDelivered = mock(() => {});
    console.log = mock(() => {});
    attachConsoleUI(bus, () => "session-1", true, onResponseDelivered);

    bus.emit({
      type: "session.end",
      source: "runtime",
      owner: "agent:may",
      data: {
        sessionId: "session-1",
        agent: "may",
        status: "done",
      },
    } as any);
    await new Promise<void>((resolve) => setTimeout(resolve, 5));

    expect(onResponseDelivered).toHaveBeenCalledTimes(1);
  });
});
