import { describe, expect, test } from "bun:test";
import { EventBus } from "../event-bus.js";
import { attachTelegramOutbound } from "./telegram-outbound.js";

function harness(currentSessionId = "shared-chat") {
  const bus = new EventBus();
  const sent: Array<{ text: string; context?: Record<string, unknown> }> = [];
  const outbound = attachTelegramOutbound({
    bus,
    interfaceAgent: "may",
    projectRoot: "/app",
    pendingChatId: "human-chat",
    getSessionId: () => currentSessionId,
    sendToUser: (text, context) => sent.push({ text, context }),
  });
  return { bus, sent, outbound };
}

function start(bus: EventBus, source: string, sessionId = "shared-chat") {
  bus.emit({
    type: "session.start",
    source,
    owner: "agent:may",
    data: {
      sessionId,
      agent: "may",
      task: `${source} turn`,
      trigger: "chat",
      firedAt: Date.now(),
      kind: "chat",
    },
  });
}

function idle(bus: EventBus, source: string, summary: string, sessionId = "shared-chat") {
  bus.emit({
    type: "session.idle",
    source,
    owner: "agent:may",
    data: {
      sessionId,
      agent: "may",
      summary,
      durationMs: 1,
      status: "idle",
      kind: "chat",
    },
  });
}

describe("Telegram outbound turn ownership", () => {
  test("never forwards a CLI turn merely because it reuses the daemon chat session", () => {
    const { bus, sent, outbound } = harness();

    start(bus, "cli");
    idle(bus, "cli", "Gym smoke result");

    expect(sent).toEqual([]);
    outbound.close();
  });

  test("unbinds Telegram after its idle turn so a later CLI turn stays private", () => {
    const { bus, sent, outbound } = harness();
    bus.emit({
      type: "chat.start.requested",
      source: "telegram",
      owner: "agent:may",
      data: { message: "hello", channelMessageId: 42 },
    });
    start(bus, "telegram");
    idle(bus, "telegram", "Telegram answer");

    start(bus, "cli");
    idle(bus, "cli", "Repeated smoke answer");

    expect(sent.map((entry) => entry.text)).toEqual(["Telegram answer"]);
    expect(sent[0]?.context?.replyToMessageId).toBe(42);
    outbound.close();
  });

  test("can bind the same persistent chat session for a later Telegram turn", () => {
    const { bus, sent, outbound } = harness();
    for (const [messageId, answer] of [
      [42, "first"],
      [43, "second"],
    ] as const) {
      bus.emit({
        type: "chat.start.requested",
        source: "telegram",
        owner: "agent:may",
        data: { message: "hello", channelMessageId: messageId },
      });
      start(bus, "telegram");
      idle(bus, "telegram", answer);
    }

    expect(sent.map((entry) => entry.text)).toEqual(["first", "second"]);
    outbound.close();
  });
});
