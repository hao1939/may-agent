import { describe, expect, test } from "bun:test";
import { EVENT_ROW_ID, EventBus } from "../event-bus.js";
import { attachTelegramOutbound } from "./telegram-outbound.js";
import type { HumanAttentionCandidate, HumanAttentionReview } from "./human-attention-review.js";

function harness(
  currentSessionId = "shared-chat",
  reviewProactive?: (candidate: HumanAttentionCandidate) => Promise<HumanAttentionReview>,
  getSessionReplyContext?: (sessionId: string) => {
    channelMessageId?: number;
    conversationId?: string;
    requestId?: string;
  } | null,
) {
  const bus = new EventBus();
  const sent: Array<{ text: string; context?: Record<string, unknown> }> = [];
  const effectiveReview =
    reviewProactive ??
    (async (candidate: HumanAttentionCandidate): Promise<HumanAttentionReview> => ({
      status: "completed",
      sessionId: "default-review",
      disposition: "deliver",
      understoodIntent: "Deliver the useful candidate.",
      reason: "The test keeps human delivery.",
      nextAction: "Deliver the reviewed text.",
      evidence: ["Test admission."],
      deliveredMessage: candidate.eventType === "message.created" ? `📋 ${candidate.content}` : candidate.content,
    }));
  const outbound = attachTelegramOutbound({
    bus,
    interfaceAgent: "may",
    projectRoot: "/app",
    pendingChatId: "human-chat",
    getSessionId: () => currentSessionId,
    getSessionReplyContext,
    sendToUser: (text, context) => sent.push({ text, context }),
    reviewProactive: effectiveReview,
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
  test("preserves root and inherited traces on proactive notifications", async () => {
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
    await outbound.drain();

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

  test("suppresses proactive delivery when May routes the work to its owner", async () => {
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
      actionTaken: "Sent the failure and proof request to aks-owner.",
      closureCondition: "A passing rerun or a precise blocker reviewed by May.",
      reviewAgainWhen: "The owner returns the rerun result or blocker.",
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

    await outbound.drain();
    expect(sent).toEqual([]);
    expect(reviewed).toEqual([
      expect.objectContaining({
        mode: "enforce",
        admitted: false,
        delivered: false,
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

  test("delivers May's reviewed text instead of the producer's raw proposal", async () => {
    const reviewed: Array<Record<string, unknown>> = [];
    const { bus, sent, outbound } = harness("shared-chat", async () => ({
      status: "completed",
      sessionId: "review-deliver",
      disposition: "deliver",
      understoodIntent: "Ask Hao to approve the proven scorer change.",
      reason: "Evaluation meaning requires human authority.",
      nextAction: "Wait for approve or reject.",
      evidence: ["The scorer and controls pass."],
      deliveredMessage: "Approve the proven scorer change? May recommends approve.",
    }));
    const unsubscribe = bus.subscribe((event: any) => {
      if (event.type === "human.attention.reviewed") reviewed.push(event.data);
    });

    bus.emit({
      type: "message.created",
      source: "gym",
      owner: "human:operator",
      data: {
        from: "gym",
        to: "human",
        content: "RAW INTERNAL SCORER OUTPUT",
      },
    } as any);
    await outbound.drain();

    expect(sent.map((entry) => entry.text)).toEqual(["Approve the proven scorer change? May recommends approve."]);
    expect(reviewed).toEqual([
      expect.objectContaining({ mode: "enforce", admitted: true, delivered: true, attempts: 1 }),
    ]);
    unsubscribe();
    outbound.close();
  });

  test("retries one failed review and then fails closed", async () => {
    let attempts = 0;
    const reviewed: Array<Record<string, unknown>> = [];
    const ownerRequests: Array<Record<string, unknown>> = [];
    const { bus, sent, outbound } = harness("shared-chat", async () => {
      attempts += 1;
      return { status: "failed", reason: `review failure ${attempts}` };
    });
    const unsubscribe = bus.subscribe((event: any) => {
      if (event.type === "human.attention.reviewed") reviewed.push(event.data);
      if (event.type === "project.owner.requested") ownerRequests.push(event.data);
    });

    bus.emit({
      type: "message.created",
      source: "ops",
      owner: "human:operator",
      data: {
        from: "ops",
        to: "human",
        content: "Unreviewed alert text",
        approvalId: "approval-ops-1",
        waitId: "wait-ops-1",
        pathId: "ops/path-1",
        packetPath: "evidence/archive/ops-approval-1.md",
        requestedAction: "Approve or reroute the bounded operator ask.",
        reason: "Need exact owner decision",
        expectedResponse: {
          type: "project.approval.submitted",
          approvalId: "approval-ops-1",
          waitId: "wait-ops-1",
          pathId: "ops/path-1",
        },
        recovery: {
          sourceEventId: 5011463,
          previousReplayEventId: 5012077,
          reason: "telegram-admission-review-failed",
          style: "validated-fallback",
        },
      },
    } as any);
    await outbound.drain();

    expect(attempts).toBe(2);
    expect(sent).toEqual([]);
    expect(reviewed).toEqual([
      expect.objectContaining({
        mode: "enforce",
        admitted: false,
        delivered: false,
        attempts: 2,
        status: "failed",
        reason: "review failure 2",
      }),
    ]);
    expect(ownerRequests).toEqual([
      expect.objectContaining({
        project: "may-agent",
        reason: "telegram-admission-review-failed",
        params: expect.objectContaining({
          instruction: expect.stringContaining("bounded durable evidence only"),
          candidateEventType: "message.created",
          candidateFrom: "ops",
          reviewReason: "review failure 2",
          attempts: 2,
          closureCondition: expect.stringContaining("later admission review"),
          recoveryDisposition: expect.objectContaining({
            allowedDispositions: ["handle", "route", "clarify-producer", "reject", "deliver"],
            fallbackRule: expect.stringContaining("safest structured route or clarify-producer outcome"),
          }),
          approval: expect.objectContaining({
            eventType: "project.approval.requested",
            approvalId: "approval-ops-1",
            waitId: "wait-ops-1",
            pathId: "ops/path-1",
            packetPath: "evidence/archive/ops-approval-1.md",
            requestedAction: "Approve or reroute the bounded operator ask.",
            reason: "Need exact owner decision",
            expectedResponse: expect.objectContaining({
              type: "project.approval.submitted",
              approvalId: "approval-ops-1",
              waitId: "wait-ops-1",
              pathId: "ops/path-1",
            }),
          }),
          recovery: expect.objectContaining({
            sourceEventId: 5011463,
            previousReplayEventId: 5012077,
            reason: "telegram-admission-review-failed",
            style: "validated-fallback",
          }),
        }),
      }),
    ]);
    unsubscribe();
    outbound.close();
  });

  test("keeps proactive deliveries in proposal order while reviews run", async () => {
    const { bus, sent, outbound } = harness("shared-chat", async (candidate) => {
      if (candidate.content === "first") await Bun.sleep(5);
      return {
        status: "completed",
        sessionId: `review-${candidate.content}`,
        disposition: "deliver",
        understoodIntent: `Deliver ${candidate.content}.`,
        reason: "Useful ordered update.",
        nextAction: "Deliver it.",
        evidence: ["Order test."],
        deliveredMessage: candidate.content,
      };
    });

    for (const content of ["first", "second"]) {
      bus.emit({
        type: "message.created",
        source: "ops",
        owner: "human:operator",
        data: { from: "ops", to: "human", content },
      } as any);
    }
    await outbound.drain();

    expect(sent.map((entry) => entry.text)).toEqual(["first", "second"]);
    outbound.close();
  });

  test("holds alerts behind the same admission gate", async () => {
    const { sent, outbound } = harness("shared-chat", async () => ({
      status: "completed",
      sessionId: "review-alert",
      disposition: "handle",
      understoodIntent: "Report a recovered timeout.",
      reason: "Recovery already closed the issue.",
      nextAction: "Keep the recovery in the ops record.",
      evidence: ["The retry passed."],
      actionTaken: "Recorded the successful recovery.",
      closureCondition: "The successful retry is the terminal proof.",
    }));

    outbound.sendAlert("Timeout: ask Hao what to do.");
    await outbound.drain();

    expect(sent).toEqual([]);
    outbound.close();
  });

  test("holds child-session summaries for May review", async () => {
    const candidates: HumanAttentionCandidate[] = [];
    const { bus, sent, outbound } = harness("root-chat", async (candidate) => {
      candidates.push(candidate);
      return {
        status: "completed",
        sessionId: "review-child",
        disposition: "handle",
        understoodIntent: "Review a worker result before speaking for May.",
        reason: "The worker result does not require Hao.",
        nextAction: "Merge the proof into May's closeout.",
        evidence: ["The worker completed successfully."],
        actionTaken: "Recorded the worker proof for May's closeout.",
        closureCondition: "May sends one reviewed terminal result when the root request is complete.",
      };
    });
    start(bus, "telegram", "root-chat");
    bus.emit({
      type: "session.start",
      source: "agent:may",
      owner: "agent:dev",
      data: {
        sessionId: "child-session",
        parentSessionId: "root-chat",
        agent: "dev",
        task: "Investigate the failure",
        kind: "call",
      },
    } as any);
    bus.emit({
      type: "session.end",
      source: "agent:dev",
      owner: "agent:may",
      data: {
        sessionId: "child-session",
        parentSessionId: "root-chat",
        agent: "dev",
        status: "done",
        finishParams: {
          status: "success",
          summary: "The worker fixed it.",
        },
      },
    } as any);
    await outbound.drain();

    expect(sent).toEqual([]);
    expect(candidates).toEqual([
      expect.objectContaining({ eventType: "session.end", from: "dev", content: "✅ dev: The worker fixed it." }),
    ]);
    outbound.close();
  });

  test("keeps direct May replies outside proactive admission", () => {
    let reviews = 0;
    const { bus, sent, outbound } = harness("root-chat", async (candidate) => {
      reviews += 1;
      return {
        status: "completed",
        sessionId: "unexpected-review",
        disposition: "deliver",
        understoodIntent: "Deliver.",
        reason: "Test.",
        nextAction: "Deliver.",
        evidence: ["Test."],
        deliveredMessage: candidate.content,
      };
    });
    start(bus, "telegram", "root-chat");
    idle(bus, "telegram", "May's direct answer.", "root-chat");

    expect(sent.map((entry) => entry.text)).toEqual(["May's direct answer."]);
    expect(reviews).toBe(0);
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

  test("keeps a late session message on its own request instead of the latest trace anchor", async () => {
    const { bus, sent, outbound } = harness("legacy-chat");
    const conversationId = "telegram:chat:123:topic:0:agent:may";

    start(
      bus,
      "telegram",
      "s_old",
      { traceId: "shared-conversation-trace" },
      {
        channelMessageId: 45978,
        conversationId,
      },
    );
    start(
      bus,
      "telegram",
      "s_latest",
      { traceId: "shared-conversation-trace" },
      {
        channelMessageId: 45984,
        conversationId,
      },
    );
    bus.emit({
      type: "message.created",
      source: "agent:may",
      owner: "human:operator",
      data: {
        from: "may",
        to: "human",
        content: "Late correction for the earlier request.",
        sourceSessionId: "s_old",
      },
      trace: { traceId: "shared-conversation-trace" },
    } as any);
    await outbound.drain();

    expect(sent[0]).toMatchObject({
      text: "📋 Late correction for the earlier request.",
      context: {
        sessionId: "s_old",
        replyToMessageId: 45978,
        conversationId,
        traceId: "shared-conversation-trace",
      },
    });
    outbound.close();
  });

  test("recovers an idle source session's persisted reply target", async () => {
    const conversationId = "telegram:chat:123:topic:0:agent:may";
    const { bus, sent, outbound } = harness("legacy-chat", undefined, (sessionId) =>
      sessionId === "s_old" ? { channelMessageId: 45984, conversationId, requestId: "telegram:45984" } : null,
    );

    start(bus, "telegram", "s_old", { traceId: "shared-trace" }, { channelMessageId: 45984, conversationId });
    idle(bus, "telegram", "Initial answer", "s_old");
    sent.length = 0;
    start(bus, "telegram", "s_new", { traceId: "shared-trace" }, { channelMessageId: 45990, conversationId });
    bus.emit({
      type: "message.created",
      source: "agent:may",
      owner: "human:operator",
      data: {
        from: "may",
        to: "human",
        content: "Late result for the old request.",
        sourceSessionId: "s_old",
      },
      trace: { traceId: "shared-trace" },
    } as any);
    await outbound.drain();

    expect(sent[0]).toMatchObject({
      context: {
        sessionId: "s_old",
        replyToMessageId: 45984,
        conversationId,
        allowTraceReplyFallback: false,
      },
    });
    outbound.close();
  });

  test("recovers a legacy Telegram target from the persisted request id", async () => {
    const { bus, sent, outbound } = harness("legacy-chat", undefined, (sessionId) =>
      sessionId === "s_legacy" ? { requestId: "telegram:45981" } : null,
    );

    bus.emit({
      type: "message.created",
      source: "agent:may",
      owner: "human:operator",
      data: {
        from: "may",
        to: "human",
        content: "Recovered legacy result.",
        sourceSessionId: "s_legacy",
      },
    } as any);
    await outbound.drain();

    expect(sent[0]?.context).toMatchObject({
      sessionId: "s_legacy",
      replyToMessageId: 45981,
      allowTraceReplyFallback: false,
    });
    outbound.close();
  });

  test("rejects malformed legacy request ids and never guesses a newer trace target", async () => {
    const conversationId = "telegram:chat:123:topic:0:agent:may";
    const { bus, sent, outbound } = harness("legacy-chat", undefined, () => ({
      requestId: "telegram:45984:extra",
    }));
    start(bus, "telegram", "s_new", { traceId: "shared-trace" }, { channelMessageId: 45990, conversationId });

    bus.emit({
      type: "message.created",
      source: "agent:may",
      owner: "human:operator",
      data: {
        from: "may",
        to: "human",
        content: "Result with incomplete legacy routing context.",
        sourceSessionId: "s_legacy",
      },
      trace: { traceId: "shared-trace" },
    } as any);
    await outbound.drain();

    expect(sent[0]?.context).toMatchObject({
      sessionId: "s_legacy",
      allowTraceReplyFallback: false,
    });
    expect(sent[0]?.context?.replyToMessageId).toBeUndefined();
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

  test("suppresses a stale approval prompt when the approval is resolved during review", async () => {
    let reviewResolve: ((v: HumanAttentionReview) => void) | undefined;
    let markReviewStarted: (() => void) | undefined;
    const reviewStarted = new Promise<void>((resolve) => {
      markReviewStarted = resolve;
    });
    const { bus, sent, outbound } = harness(
      "shared-chat",
      () =>
        new Promise<HumanAttentionReview>((resolve) => {
          reviewResolve = resolve;
          markReviewStarted?.();
        }),
    );
    const audits: Array<Record<string, unknown>> = [];
    const unsubscribe = bus.subscribe((event: any) => {
      if (event.type === "human.attention.reviewed") audits.push(event.data);
    });

    const evt = {
      type: "message.created",
      source: "gym",
      owner: "agent:may",
      data: {
        to: "human",
        from: "gym",
        content: "Approve proposal X?",
        approvalId: "gym:review-proposal:incident-1:g1:abc123",
      },
    } as any;
    evt[EVENT_ROW_ID] = 100;
    bus.emit(evt);
    await reviewStarted;

    bus.emit({
      type: "project.approval.submitted",
      source: "command-router",
      owner: "agent:may",
      data: {
        approvalId: "gym:review-proposal:incident-1:g1:abc123",
        decision: "decline",
      },
    } as any);

    reviewResolve!({
      status: "completed",
      sessionId: "rev-1",
      disposition: "deliver",
      understoodIntent: "Ask Hao to approve.",
      reason: "Human authority remains.",
      nextAction: "Wait.",
      evidence: ["Proven."],
      deliveredMessage: "Approve proposal X?",
    });

    await outbound.drain();

    expect(sent).toHaveLength(0);
    expect(audits).toEqual([
      expect.objectContaining({
        sourceEventId: 100,
        admitted: true,
        delivered: false,
        deliveryError: "approval-resolved-during-review",
      }),
    ]);
    unsubscribe();
    outbound.close();
  });

  test("delivers approval prompt when no matching resolution arrived", async () => {
    let reviewResolve: ((v: HumanAttentionReview) => void) | undefined;
    let markReviewStarted: (() => void) | undefined;
    const reviewStarted = new Promise<void>((resolve) => {
      markReviewStarted = resolve;
    });
    const { bus, sent, outbound } = harness(
      "shared-chat",
      () =>
        new Promise<HumanAttentionReview>((resolve) => {
          reviewResolve = resolve;
          markReviewStarted?.();
        }),
    );

    const evt = {
      type: "message.created",
      source: "gym",
      owner: "agent:may",
      data: {
        to: "human",
        from: "gym",
        content: "Approve proposal Y?",
        approvalId: "gym:review-proposal:incident-2:g1:def456",
      },
    } as any;
    evt[EVENT_ROW_ID] = 101;
    bus.emit(evt);
    await reviewStarted;

    bus.emit({
      type: "project.approval.submitted",
      source: "command-router",
      owner: "agent:may",
      data: {
        approvalId: "gym:review-proposal:OTHER:g1:xyz",
        decision: "approve",
      },
    } as any);

    reviewResolve!({
      status: "completed",
      sessionId: "rev-2",
      disposition: "deliver",
      understoodIntent: "Ask Hao.",
      reason: "Human authority remains.",
      nextAction: "Wait.",
      evidence: ["Valid."],
      deliveredMessage: "Approve proposal Y?",
    });

    await outbound.drain();
    expect(sent).toHaveLength(1);
    expect(sent[0]!.text).toBe("Approve proposal Y?");
    outbound.close();
  });

  test("suppresses an approval already resolved in durable task truth", async () => {
    const bus = new EventBus();
    const sent: string[] = [];
    let reviews = 0;
    const outbound = attachTelegramOutbound({
      bus,
      interfaceAgent: "may",
      projectRoot: "/app",
      pendingChatId: "human-chat",
      getSessionId: () => "shared-chat",
      sendToUser: (text) => sent.push(text),
      isApprovalResolved: ({ taskId }) => taskId === "review/closed",
      reviewProactive: async () => {
        reviews += 1;
        return {
          status: "completed",
          disposition: "deliver",
          understoodIntent: "Ask for approval.",
          reason: "Human authority.",
          nextAction: "Wait.",
          evidence: ["Test."],
          deliveredMessage: "Approve?",
        };
      },
    });

    bus.emit({
      type: "message.created",
      source: "gym",
      owner: "human:operator",
      data: {
        to: "human",
        from: "gym",
        content: "Approve stale proposal?",
        approvalId: "old-fingerprint",
        taskId: "review/closed",
      },
    } as any);
    await outbound.drain();

    expect(sent).toEqual([]);
    expect(reviews).toBe(0);
    outbound.close();
  });

  test("suppresses duplicate approval keys before and after delivery", async () => {
    const bus = new EventBus();
    const sent: string[] = [];
    const outbound = attachTelegramOutbound({
      bus,
      interfaceAgent: "may",
      projectRoot: "/app",
      pendingChatId: "human-chat",
      getSessionId: () => "shared-chat",
      sendToUser: (text) => sent.push(text),
      hasDeliveredNotificationKey: (key) => key === "already-delivered",
      reviewProactive: async (candidate) => ({
        status: "completed",
        disposition: "deliver",
        understoodIntent: "Ask once.",
        reason: "Human authority.",
        nextAction: "Wait.",
        evidence: ["Test."],
        deliveredMessage: candidate.content,
      }),
    });

    for (const key of ["queued-once", "queued-once", "already-delivered"]) {
      bus.emit({
        type: "message.created",
        source: "gym",
        owner: "human:operator",
        data: {
          to: "human",
          from: "gym",
          content: `Approval ${key}`,
          approvalId: key,
          dedupKey: key,
        },
      } as any);
    }
    await outbound.drain();

    expect(sent).toEqual(["Approval queued-once"]);
    outbound.close();
  });

  for (const disposition of ["handle", "route", "reject"] as const) {
    test(`releases an undelivered notification key after a ${disposition} review`, async () => {
      const bus = new EventBus();
      const sent: string[] = [];
      let reviews = 0;
      const outbound = attachTelegramOutbound({
        bus,
        interfaceAgent: "may",
        projectRoot: "/app",
        pendingChatId: "human-chat",
        getSessionId: () => "shared-chat",
        sendToUser: (text) => sent.push(text),
        reviewProactive: async (candidate) => {
          reviews += 1;
          if (reviews === 2) {
            return {
              status: "completed",
              disposition: "deliver",
              understoodIntent: "Ask after the underlying state changed.",
              reason: "The exact decision is open now.",
              nextAction: "Deliver the approval request.",
              evidence: ["Test state changed."],
              deliveredMessage: candidate.content,
            };
          }
          return {
            status: "completed",
            disposition,
            understoodIntent: "Do not deliver the first candidate.",
            reason: "The first candidate is not ready for human attention.",
            nextAction: "Finish this review without delivery.",
            owner: disposition === "route" ? "gym" : undefined,
            evidence: ["Test first review."],
            actionTaken: "Recorded the first review outcome.",
            closureCondition: "The first review is complete.",
            reviewAgainWhen: disposition === "route" ? "When Gym changes the proposal state." : undefined,
          };
        },
      });
      const emit = (content: string) =>
        bus.emit({
          type: "message.created",
          source: "gym",
          owner: "human:operator",
          data: {
            to: "human",
            from: "gym",
            content,
            approvalId: `retry-after-${disposition}`,
            dedupKey: `retry-after-${disposition}`,
          },
        } as any);

      emit("First candidate");
      await outbound.drain();
      emit("Candidate after state change");
      await outbound.drain();

      expect(reviews).toBe(2);
      expect(sent).toEqual(["Candidate after state change"]);
      outbound.close();
    });
  }
});
