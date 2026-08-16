import { describe, expect, it } from "bun:test";
import { EventBus } from "../../src/app/event-bus.js";
import { attachTelegramOutbound } from "../../src/app/transport/telegram-outbound.js";

function sessionStart(data: Record<string, unknown>, source = "runtime") {
  return { type: "session.start", source, owner: `agent:${data.agent}`, data };
}

function sessionEnd(data: Record<string, unknown>, source = "runtime") {
  return { type: "session.end", source, owner: `agent:${data.agent}`, data };
}

function sessionIdle(data: Record<string, unknown>, source = "runtime") {
  return { type: "session.idle", source, owner: `agent:${data.agent}`, data };
}

async function admitProactive(candidate: { eventType: string; content: string }) {
  return {
    status: "completed" as const,
    sessionId: "attention-review",
    disposition: "deliver" as const,
    understoodIntent: "Deliver the useful test notification.",
    reason: "The integration fixture admits this notification.",
    nextAction: "Deliver the reviewed text.",
    evidence: ["Integration admission fixture."],
    deliveredMessage: candidate.eventType === "message.created" ? `📋 ${candidate.content}` : candidate.content,
  };
}

describe("telegram outbound routing", () => {
  it("binds a Telegram-started direct chat and replies to the triggering message", () => {
    const bus = new EventBus();
    const sent: Array<{ text: string; replyToMessageId?: number }> = [];
    const outbound = attachTelegramOutbound({
      bus,
      interfaceAgent: "may",
      projectRoot: "/tmp/project",
      pendingChatId: "12345",
      sendToUser: (text, context) => sent.push({ text, replyToMessageId: context?.replyToMessageId }),
    });

    bus.emit({
      type: "chat.start.requested",
      source: "telegram",
      owner: "agent:may",
      data: {
        agent: "may",
        message: "please check this",
        channel: "telegram",
        channelThreadId: "12345",
        channelMessageId: 701,
      },
    } as any);
    bus.emit(sessionStart({ sessionId: "s_existing", agent: "may", kind: "chat" }, "telegram") as any);
    bus.emit({ type: "text", sessionId: "s_existing", agent: "may", text: "I am checking it." } as any);

    expect(sent).toEqual([{ text: "I am checking it.", replyToMessageId: 701 }]);
    outbound.close();
  });

  it("streams root chat text and avoids duplicate end summaries", () => {
    const bus = new EventBus();
    const sent: string[] = [];
    const outbound = attachTelegramOutbound({
      bus,
      interfaceAgent: "may",
      projectRoot: "/tmp/project",
      pendingChatId: "12345",
      sendToUser: (text) => sent.push(text),
    });

    bus.emit(sessionStart({ sessionId: "s_root", agent: "may", kind: "chat" }, "telegram") as any);
    bus.emit({ type: "text", sessionId: "s_root", agent: "may", text: "hello" } as any);
    bus.emit(sessionEnd({ sessionId: "s_root", agent: "may", status: "done", summary: "hello" }) as any);

    expect(sent).toEqual(["hello"]);
    outbound.close();
  });

  it("uses session.idle as root chat turn completion and releases Telegram ownership", () => {
    const bus = new EventBus();
    const sent: Array<{ text: string; eventType?: string }> = [];
    const outbound = attachTelegramOutbound({
      bus,
      interfaceAgent: "may",
      projectRoot: "/tmp/project",
      pendingChatId: "12345",
      sendToUser: (text, context) => sent.push({ text, eventType: context?.eventType }),
    });

    bus.emit(sessionStart({ sessionId: "s_root", agent: "may", kind: "chat" }, "telegram") as any);
    bus.emit(
      sessionIdle({ sessionId: "s_root", agent: "may", status: "idle", summary: "ready for the next turn" }) as any,
    );

    expect(sent).toEqual([{ text: "ready for the next turn", eventType: "session.idle" }]);
    outbound.close();
  });

  it("summarizes child sessions in the active Telegram chat tree", async () => {
    const bus = new EventBus();
    const sent: string[] = [];
    const outbound = attachTelegramOutbound({
      bus,
      interfaceAgent: "may",
      projectRoot: "/tmp/project",
      pendingChatId: "12345",
      sendToUser: (text) => sent.push(text),
      reviewProactive: admitProactive,
    });

    bus.emit(sessionStart({ sessionId: "s_root", agent: "may", kind: "chat" }, "telegram") as any);
    bus.emit(sessionStart({ sessionId: "s_child", parentSessionId: "s_root", agent: "scout" }) as any);
    bus.emit(
      sessionEnd({
        sessionId: "s_child",
        agent: "scout",
        status: "done",
        finishParams: { summary: "found a path" },
      }) as any,
    );

    await outbound.drain();

    expect(sent).toEqual(["✅ scout: found a path"]);
    outbound.close();
  });

  it("forwards canonical may-to-human messages", async () => {
    const bus = new EventBus();
    const sent: string[] = [];
    const outbound = attachTelegramOutbound({
      bus,
      interfaceAgent: "may",
      projectRoot: "/tmp/project",
      pendingChatId: "12345",
      sendToUser: (text) => sent.push(text),
      reviewProactive: admitProactive,
    });

    bus.emit({
      type: "message.created",
      source: "agent:may",
      owner: "human:operator",
      data: { from: "may", to: "human", content: "please review", priority: "P2" },
    } as any);

    await outbound.drain();

    expect(sent).toEqual(["📋 please review"]);
    outbound.close();
  });

  it("forwards approval packets addressed to human:operator and preserves approval reply context", async () => {
    const bus = new EventBus();
    const sent: Array<{ text: string; context?: Record<string, unknown> }> = [];
    const outbound = attachTelegramOutbound({
      bus,
      interfaceAgent: "may",
      projectRoot: "/tmp/project",
      pendingChatId: "12345",
      sendToUser: (text, context) => sent.push({ text, context: context as Record<string, unknown> | undefined }),
      reviewProactive: admitProactive,
    });

    bus.emit({
      type: "message.created",
      source: "agent:aks-explorer",
      owner: "human:operator",
      data: {
        from: "aks-explorer",
        to: "human:operator",
        content: "Approval packet dispatch",
        priority: "P1",
        projectPath: "projects/aks-rp-e2e.app",
        approvalId: "approval-123",
        waitId: "wait-123",
        pathId: "path.network.example",
        packetPath: "evidence/archive/example-approval.md",
        requestedAction: "Approve one bounded replay",
        reason: "Need exact owner decision",
        expectedResponse: {
          type: "project.approval.submitted",
          approvalId: "approval-123",
          waitId: "wait-123",
          pathId: "path.network.example",
        },
      },
    } as any);

    await outbound.drain();

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      text: "📋 Approval packet dispatch",
      context: {
        eventType: "message.created",
        agent: "aks-explorer",
        projectId: "projects/aks-rp-e2e.app",
        summary: "📋 Approval packet dispatch",
      },
    });
    expect(sent[0].context?.data).toMatchObject({
      approvalId: "approval-123",
      waitId: "wait-123",
      pathId: "path.network.example",
      packetPath: "evidence/archive/example-approval.md",
      requestedAction: "Approve one bounded replay",
      reason: "Need exact owner decision",
      expectedResponse: {
        type: "project.approval.submitted",
        approvalId: "approval-123",
        waitId: "wait-123",
        pathId: "path.network.example",
      },
      conversationId: "approval:approval-123",
      originalIssue: {
        eventType: "project.approval.requested",
        approvalId: "approval-123",
        waitId: "wait-123",
        pathId: "path.network.example",
        packetPath: "evidence/archive/example-approval.md",
        requestedAction: "Approve one bounded replay",
        reason: "Need exact owner decision",
        expectedResponse: {
          type: "project.approval.submitted",
          approvalId: "approval-123",
          waitId: "wait-123",
          pathId: "path.network.example",
        },
      },
      expectedClosure: ["project.approval.submitted"],
    });
    outbound.close();
  });

  it("preserves escalation reply context on human notifications", async () => {
    const bus = new EventBus();
    const sent: Array<{ text: string; context?: Record<string, unknown> }> = [];
    const outbound = attachTelegramOutbound({
      bus,
      interfaceAgent: "may",
      projectRoot: "/tmp/project",
      pendingChatId: "12345",
      sendToUser: (text, context) => sent.push({ text, context: context as Record<string, unknown> | undefined }),
      reviewProactive: admitProactive,
    });

    bus.emit({
      type: "message.created",
      source: "agent:may",
      owner: "human:operator",
      data: {
        from: "may",
        to: "human:operator",
        content: "Approval return path needs a human decision.",
        projectPath: "projects/aks-rp-e2e.app",
        escalationId: "esc_1",
        reason: "Approval return path is not visibly closing.",
        requestedAction: "Approve retry or dismiss the escalation.",
        originalIssue: {
          eventType: "escalation.created",
          escalationId: "esc_1",
          sourceSessionId: "s_blocked",
        },
        expectedClosure: ["escalation.resolved", "escalation.dismissed"],
        resume: {
          sourceSessionId: "s_blocked",
          checkpointRef: "checkpoint:esc_1",
        },
      },
    } as any);

    await outbound.drain();

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      text: "📋 Approval return path needs a human decision.",
      context: {
        eventType: "message.created",
        agent: "may",
        projectId: "projects/aks-rp-e2e.app",
      },
    });
    expect(sent[0].context?.data).toMatchObject({
      escalationId: "esc_1",
      reason: "Approval return path is not visibly closing.",
      requestedAction: "Approve retry or dismiss the escalation.",
      originalIssue: {
        eventType: "escalation.created",
        escalationId: "esc_1",
        sourceSessionId: "s_blocked",
      },
      expectedClosure: ["escalation.resolved", "escalation.dismissed"],
      resume: {
        sourceSessionId: "s_blocked",
        checkpointRef: "checkpoint:esc_1",
      },
    });
    outbound.close();
  });

  it("stops forwarding after close", () => {
    const bus = new EventBus();
    const sent: string[] = [];
    const outbound = attachTelegramOutbound({
      bus,
      interfaceAgent: "may",
      projectRoot: "/tmp/project",
      pendingChatId: "12345",
      sendToUser: (text) => sent.push(text),
    });

    outbound.close();
    bus.emit(sessionStart({ sessionId: "s_root", agent: "may", kind: "chat" }, "telegram") as any);
    bus.emit({ type: "text", sessionId: "s_root", agent: "may", text: "after close" } as any);

    expect(sent).toEqual([]);
  });
});
