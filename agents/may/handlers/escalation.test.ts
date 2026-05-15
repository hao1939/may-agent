import { describe, expect, it, vi } from "vitest";
import { create } from "./escalation.js";

function makeCtx(action?: string) {
  return {
    agentName: "may",
    sdk: {
      emit: vi.fn(),
      log: vi.fn(),
      escalate: vi.fn(),
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
  it("routes session.escalated events to the target owner", async () => {
    const ctx = makeCtx("escalate");
    const handler = create(ctx, {} as any);

    await handler({
      type: "session.escalated",
      source: "event",
      entry: "escalation",
      timestamp: Date.now(),
      data: {
        sessionId: "s_blocked",
        agent: "dev",
        finishParams: { status: "blocked", summary: "needs human" },
      },
    });

    expect(ctx.sdk.escalate).toHaveBeenCalledWith("dev", "blocked: needs human");
    expect(ctx.sdk.emit).toHaveBeenCalledWith("handler.routed", expect.objectContaining({
      handler: "escalation",
      sessionId: "s_blocked",
      agent: "dev",
      action: "escalate",
    }));
  });

  it("records non-escalation decisions as skipped", async () => {
    const ctx = makeCtx("nothing");
    const handler = create(ctx, {} as any);

    await handler({
      type: "session.escalated",
      source: "event",
      entry: "escalation",
      timestamp: Date.now(),
      data: {
        sessionId: "s_ok",
        agent: "dev",
        finishParams: { status: "failure", summary: "already handled" },
      },
    });

    expect(ctx.sdk.escalate).not.toHaveBeenCalled();
    expect(ctx.sdk.emit).toHaveBeenCalledWith("handler.skipped", expect.objectContaining({
      handler: "escalation",
      sessionId: "s_ok",
      reason: "classifier chose nothing",
    }));
  });
});
