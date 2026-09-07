import { describe, expect, it, vi } from "bun:test";
import { createAutoResume } from "./session-subscribers.js";

describe("createAutoResume", () => {
  it("leaves interrupted calls to their caller instead of starting an orphan retry", () => {
    const timer = vi.spyOn(globalThis, "setTimeout").mockImplementation((() => 0) as any);
    try {
      const resume = vi.fn();
      const escalate = vi.fn();
      const subscriber = createAutoResume(resume, escalate);
      for (const interruptionKind of ["execution-timeout", "observation-timeout", "cancelled"]) {
        subscriber({
          type: "session.end",
          data: {
            sessionId: "bounded-call",
            agent: "owner",
            kind: "call",
            status: "interrupted",
            interruptionKind,
            opCount: 33,
            workflowRunId: "finished-workflow",
            error: "Agent timed out",
            finishParams: null,
          },
        } as any);
      }
      expect(timer).not.toHaveBeenCalled();
      expect(resume).not.toHaveBeenCalled();
      expect(escalate).not.toHaveBeenCalled();
    } finally {
      timer.mockRestore();
    }
  });

  it("does not undo explicit cancellation, while unbound interrupted jobs still resume", () => {
    const callbacks: Array<() => void> = [];
    const timer = vi.spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => void) => {
      callbacks.push(callback);
      return 0;
    }) as any);
    try {
      const resume = vi.fn();
      const subscriber = createAutoResume(resume, vi.fn());
      const data = { sessionId: "job", agent: "owner", kind: "job", status: "interrupted", opCount: 2 };
      subscriber({ type: "session.end", data: { ...data, interruptionKind: "cancelled" } } as any);
      expect(timer).not.toHaveBeenCalled();
      subscriber({ type: "session.end", data: { ...data, interruptionKind: "observation-timeout" } } as any);
      expect(callbacks).toHaveLength(1);
      callbacks[0]!();
      expect(resume).toHaveBeenCalledWith("job", "owner", 1);
    } finally {
      timer.mockRestore();
    }
  });

  it("does not resume sessions that deliberately finish blocked", () => {
    const emitResume = vi.fn();
    const emitEscalate = vi.fn();
    const subscriber = createAutoResume(emitResume, emitEscalate);

    subscriber({
      type: "session.end",
      source: "runtime",
      owner: "agent:may",
      data: {
        sessionId: "s_blocked",
        agent: "may",
        outcome: "interrupted",
        summary: "blocked on external deploy",
        durationMs: 1000,
        status: "interrupted",
        opCount: 5,
        finishParams: { status: "blocked", summary: "blocked on external deploy" },
      },
    } as any);

    expect(emitResume).not.toHaveBeenCalled();
    expect(emitEscalate).not.toHaveBeenCalled();
  });
});
