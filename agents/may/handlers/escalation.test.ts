import { describe, expect, it, vi } from "vitest";
import { create } from "./escalation.js";

function makeCtx(action?: string) {
  return {
    agentName: "may",
    sdk: {
      emit: vi.fn(),
      log: vi.fn(),
      message: vi.fn(),
    },
    getLastDigest: vi.fn(() => action ? {
      outcome: "blocked",
      still_open: "needs human",
      what_happened: "blocked on human decision",
    } : null),
    classifyDigest: vi.fn(() => ({ action: action ?? "escalate", reason: "needs human" })),
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
        sourceAgent: "dev",
        sourceSessionId: "s_blocked",
        reason: "blocked: needs human",
        requestedAction: "Decide the next step",
      },
    });

    expect(ctx.sdk.emit).toHaveBeenCalledWith("escalation.routed", {
      escalationId: "esc_1",
      route: "human:operator",
      reason: "blocked: needs human",
    }, {
      source: "agent:may",
      owner: "human:operator",
    });
    expect(ctx.sdk.emit).toHaveBeenCalledWith("handler.routed", expect.objectContaining({
      handler: "escalation",
      escalationId: "esc_1",
      sourceAgent: "dev",
      route: "human:operator",
    }));
    expect(ctx.sdk.message).toHaveBeenCalledWith("human", expect.stringContaining("blocked: needs human"));
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
    expect(ctx.sdk.emit).toHaveBeenCalledWith("handler.skipped", expect.objectContaining({
      handler: "escalation",
      escalationId: "esc_2",
      reason: "escalation.created missing required data",
    }));
  });
});
