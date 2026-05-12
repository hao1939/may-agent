import { describe, expect, it, vi } from "vitest";
import { createAutoResume } from "./session-subscribers.js";

describe("createAutoResume", () => {
  it("does not resume sessions that deliberately finish blocked", () => {
    const emitResume = vi.fn();
    const emitEscalate = vi.fn();
    const subscriber = createAutoResume(emitResume, emitEscalate);

    subscriber({
      type: "session.end",
      sessionId: "s_blocked",
      agent: "may",
      outcome: "interrupted",
      summary: "blocked on external deploy",
      durationMs: 1000,
      status: "interrupted",
      opCount: 5,
      finishParams: { status: "blocked", summary: "blocked on external deploy" },
    });

    expect(emitResume).not.toHaveBeenCalled();
    expect(emitEscalate).not.toHaveBeenCalled();
  });
});
