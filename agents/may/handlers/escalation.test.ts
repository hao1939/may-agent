import { describe, expect, it, vi } from "vitest";
import { create } from "./escalation.js";

function makeCtx(action?: string) {
  return {
    agentName: "may",
    sdk: {
      emit: vi.fn(),
      log: vi.fn(),
      message: vi.fn(),
      getDb: vi.fn(() => ({
        prepare: vi.fn(() => ({ get: vi.fn(() => ({ id: 42 })) })),
      })),
    },
    getLastDigest: vi.fn(() =>
      action
        ? {
            outcome: "blocked",
            still_open: "needs human",
            what_happened: "blocked on human decision",
          }
        : null,
    ),
    classifyDigest: vi.fn(() => ({
      action: action ?? "escalate",
      reason: "needs human",
    })),
  } as any;
}

describe("escalation handler", () => {
  it("routes escalation.created events to the target owner", async () => {
    const ctx = makeCtx();
    const handler = create(ctx, {} as any);

    await handler({
      type: "escalation.created",
      source: "agent:dev",
      owner: "human:operator",
      timestamp: Date.now(),
      data: {
        escalationId: "esc_1",
        openEventId: 42,
        sourceAgent: "dev",
        sourceSessionId: "s_blocked",
        reason: "blocked: needs human",
        requestedAction: "Decide the next step",
      },
    });

    // escalation.routed no longer emitted (was orphaning as pending rows)
    expect(ctx.sdk.emit).not.toHaveBeenCalledWith(
      "escalation.routed",
      expect.anything(),
      expect.anything(),
    );
    expect(ctx.sdk.emit).toHaveBeenCalledWith(
      "handler.routed",
      expect.objectContaining({
        handler: "escalation",
        escalationId: "esc_1",
        sourceAgent: "dev",
        route: "human:operator",
      }),
    );
    expect(ctx.sdk.message).not.toHaveBeenCalled();
    expect(ctx.sdk.emit).toHaveBeenCalledWith(
      "message.created",
      expect.objectContaining({
        to: "human",
        intent: "escalation",
        conversationId: "escalation:esc_1",
        originalIssue: expect.objectContaining({
          eventType: "escalation.created",
          escalationId: "esc_1",
          openEventId: 42,
          sourceAgent: "dev",
          sourceSessionId: "s_blocked",
          reason: "blocked: needs human",
          requestedAction: "Decide the next step",
        }),
        expectedClosure: ["escalation.resolved", "escalation.dismissed"],
        actionHints: expect.arrayContaining([
          "answered <decision or missing input>",
        ]),
      }),
      expect.objectContaining({
        owner: "human:operator",
        source: "agent:may",
      }),
    );
    const messageCall = (ctx.sdk.emit as any).mock.calls.find(
      (call: unknown[]) => call[0] === "message.created",
    );
    expect(messageCall?.[1]?.content).toContain("May-agent needs a decision");
    expect(messageCall?.[1]?.content).toContain("What happened");
    expect(messageCall?.[1]?.content).toContain("Decision needed");
    expect(messageCall?.[1]?.content).toContain("You can reply with");
    expect(messageCall?.[1]?.content).toContain("What happens next");
    expect(messageCall?.[1]?.content).not.toContain("Escalation id:");
    expect(messageCall?.[1]?.content).not.toContain("Session:");
    expect(messageCall?.[1]?.content).not.toContain("Event type:");
  });

  it("records malformed escalation.created events as skipped", async () => {
    const ctx = makeCtx();
    const handler = create(ctx, {} as any);

    await handler({
      type: "escalation.created",
      source: "agent:dev",
      owner: "agent:may",
      timestamp: Date.now(),
      data: {
        escalationId: "esc_2",
        sourceAgent: "dev",
      },
    });

    expect(ctx.sdk.message).not.toHaveBeenCalled();
    expect(ctx.sdk.emit).toHaveBeenCalledWith(
      "handler.skipped",
      expect.objectContaining({
        handler: "escalation",
        escalationId: "esc_2",
        reason: "escalation.created missing required data",
      }),
    );
  });
});
