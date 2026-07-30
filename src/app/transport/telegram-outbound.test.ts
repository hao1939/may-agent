import { describe, expect, test } from "bun:test";
import { EVENT_ROW_ID, EventBus } from "../event-bus.js";
import { attachTelegramOutbound } from "./telegram-outbound.js";
import type { HumanAttentionCandidate, HumanAttentionReview } from "./human-attention-review.js";

function harness(
  currentSessionId = "shared-chat",
  reviewProactive?: (candidate: HumanAttentionCandidate) => Promise<HumanAttentionReview>,
) {
  const bus = new EventBus();
  const sent: Array<{ text: string; context?: Record<string, unknown> }> = [];
  const outbound = attachTelegramOutbound({
    bus,
    interfaceAgent: "may",
    projectRoot: "/app",
    pendingChatId: "human-chat",
    getSessionId: () => currentSessionId,
    sendToUser: (text, context) => sent.push({ text, context }),
    reviewProactive,
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
  test("preserves root and inherited traces on proactive notifications", () => {
    const { bus, sent, outbound } = harness();
    const rootEvent = {
      type: "message.created",
      source: "gym",
      owner: "human:operator",
      data: {
        from: "gym",
        to: "human",
        content: "Gym needs a decision.",
        taskId: "train-may",
      },
    } as any;
    Object.defineProperty(rootEvent, EVENT_ROW_ID, { value: 91 });

    bus.emit(rootEvent);
    bus.emit({
      type: "message.created",
      source: "gym",
      owner: "human:operator",
      trace: { traceId: "trace-human-92", parentEventId: 91 },
      data: {
        from: "gym",
        to: "human",
        content: "Gym has a follow-up.",
      },
    } as any);

    expect(sent[0]?.context?.data).toMatchObject({
      traceId: "event:91",
      taskId: "train-may",
    });
    expect(sent[1]?.context?.data).toMatchObject({
      traceId: "trace-human-92",
      parentEventId: 91,
    });
    outbound.close();
  });

  test("records May's shadow judgment while preserving current proactive delivery", async () => {
    const reviewed: Array<Record<string, unknown>> = [];
    const { bus, sent, outbound } = harness("shared-chat", async () => ({
      status: "completed",
      sessionId: "review-1",
      disposition: "route",
      understoodIntent: "Recover the project-owned failure.",
      reason: "The project owner can act before Hao is needed.",
      nextAction: "Route to the project owner and require rerun proof.",
      owner: "aks-owner",
      evidence: ["The owner has not attempted recovery."],
    }));
    const unsubscribe = bus.subscribe((event: any) => {
      if (event.type === "human.attention.reviewed") reviewed.push(event.data);
    });

    bus.emit({
      type: "message.created",
      source: "evaluator",
      owner: "agent:may",
      data: {
        from: "evaluator",
        to: "human",
        content: "AKS failed. Hao, decide what to do.",
        projectId: "aks-rp-e2e",
      },
    } as any);

    for (let attempt = 0; attempt < 20 && reviewed.length === 0; attempt++) {
      await Bun.sleep(1);
    }
    expect(sent.map((entry) => entry.text)).toEqual(["📋 AKS failed. Hao, decide what to do."]);
    expect(reviewed).toEqual([
      expect.objectContaining({
        mode: "shadow",
        delivered: true,
        status: "completed",
        disposition: "route",
        owner: "aks-owner",
        candidate: expect.objectContaining({
          content: "AKS failed. Hao, decide what to do.",
          projectId: "aks-rp-e2e",
        }),
      }),
    ]);
    unsubscribe();
    outbound.close();
  });

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
