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

function start(
  bus: EventBus,
  source: string,
  sessionId = "shared-chat",
  trace?: { traceId: string; parentEventId?: number },
  channel?: { channelMessageId: number; conversationId: string },
) {
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
      ...(channel ?? {}),
    },
    ...(trace ? { trace } : {}),
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
        projectId: "alpha-project",
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
          projectId: "alpha-project",
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

  test("keeps overlapping bounded Telegram turns attached to their own human messages", () => {
    const { bus, sent, outbound } = harness("legacy-chat");

    bus.emit({
      type: "chat.start.requested",
      source: "telegram",
      owner: "agent:may",
      data: {
        message: "review Gym",
        channelMessageId: 501,
        conversationId: "telegram:chat:123:topic:0:agent:may",
        forceNew: true,
      },
    });
    start(
      bus,
      "telegram",
      "s_gym",
      { traceId: "trace-gym", parentEventId: 11 },
      { channelMessageId: 501, conversationId: "telegram:chat:123:topic:0:agent:may" },
    );

    bus.emit({
      type: "chat.start.requested",
      source: "telegram",
      owner: "agent:may",
      data: {
        message: "review AKS",
        channelMessageId: 502,
        conversationId: "telegram:chat:123:topic:0:agent:may",
        forceNew: true,
      },
    });
    start(
      bus,
      "telegram",
      "s_aks",
      { traceId: "trace-aks", parentEventId: 12 },
      { channelMessageId: 502, conversationId: "telegram:chat:123:topic:0:agent:may" },
    );

    idle(bus, "telegram", "Gym result", "s_gym");
    idle(bus, "telegram", "AKS result", "s_aks");

    expect(sent).toEqual([
      expect.objectContaining({
        text: "Gym result",
        context: expect.objectContaining({
          sessionId: "s_gym",
          replyToMessageId: 501,
          traceId: "trace-gym",
        }),
      }),
      expect.objectContaining({
        text: "AKS result",
        context: expect.objectContaining({
          sessionId: "s_aks",
          replyToMessageId: 502,
          traceId: "trace-aks",
        }),
      }),
    ]);
    outbound.close();
  });

  test("uses the reply target captured by the session instead of another session's target", () => {
    const { bus, sent, outbound } = harness("legacy-chat");

    bus.emit({
      type: "chat.start.requested",
      source: "telegram",
      owner: "agent:may",
      data: {
        message: "old request",
        channelMessageId: 45971,
        conversationId: "telegram:chat:123:topic:0:agent:may",
        forceNew: false,
      },
    });
    start(
      bus,
      "telegram",
      "s_latest",
      { traceId: "trace-latest" },
      { channelMessageId: 45974, conversationId: "telegram:chat:123:topic:0:agent:may" },
    );
    idle(bus, "telegram", "Latest answer", "s_latest");

    expect(sent[0]).toMatchObject({
      text: "Latest answer",
      context: {
        sessionId: "s_latest",
        replyToMessageId: 45974,
        traceId: "trace-latest",
      },
    });
    outbound.close();
  });

  test("keeps the correct target when session start is emitted before outbound sees chat start", () => {
    const bus = new EventBus();
    const sent: Array<{ text: string; context?: Record<string, unknown> }> = [];

    // Command routing is attached before Telegram outbound in the daemon. It
    // synchronously starts the session while the original chat event is still
    // being delivered to subscribers.
    bus.subscribe((event: any) => {
      if (event.type !== "chat.start.requested") return;
      bus.emit({
        type: "session.start",
        source: "telegram",
        owner: "agent:may",
        data: {
          sessionId: "s_race",
          agent: "may",
          task: event.data.message,
          trigger: "chat",
          firedAt: Date.now(),
          kind: "chat",
          channelMessageId: event.data.channelMessageId,
          conversationId: event.data.conversationId,
        },
        trace: { traceId: "trace-race" },
      });
    });
    const outbound = attachTelegramOutbound({
      bus,
      interfaceAgent: "may",
      projectRoot: "/app",
      pendingChatId: "human-chat",
      getSessionId: () => "legacy-chat",
      sendToUser: (text, context) => sent.push({ text, context }),
    });

    bus.emit({
      type: "chat.start.requested",
      source: "telegram",
      owner: "agent:may",
      data: {
        message: "latest request",
        channelMessageId: 45974,
        conversationId: "telegram:chat:123:topic:0:agent:may",
        forceNew: true,
      },
    });
    idle(bus, "telegram", "Latest answer", "s_race");

    expect(sent[0]?.context).toMatchObject({
      sessionId: "s_race",
      replyToMessageId: 45974,
      traceId: "trace-race",
    });
    outbound.close();
  });

  test("acknowledges a silent Telegram turn when it starts a CLI second opinion", () => {
    const { bus, sent, outbound } = harness("legacy-chat");
    bus.emit({
      type: "chat.start.requested",
      source: "telegram",
      owner: "agent:may",
      data: {
        message: "get a Codex second opinion",
        channelMessageId: 503,
        conversationId: "telegram:chat:123:topic:0:agent:may",
        forceNew: true,
      },
    });
    start(
      bus,
      "telegram",
      "s_codex",
      { traceId: "trace-codex", parentEventId: 13 },
      { channelMessageId: 503, conversationId: "telegram:chat:123:topic:0:agent:may" },
    );
    bus.emit({
      type: "cli.task.started",
      source: "cli-task-runner",
      owner: "agent:may",
      data: { sessionId: "s_codex", tool: "codex", taskId: "cli_1" },
    } as any);
    idle(bus, "telegram", "Codex and May agree on the next action.", "s_codex");

    expect(sent.map((entry) => entry.text)).toEqual([
      "I received this. I’m checking it with codex and will reply with the result.",
      "Codex and May agree on the next action.",
    ]);
    expect(sent[0]?.context).toMatchObject({ replyToMessageId: 503, traceId: "trace-codex" });
    outbound.close();
  });
});
