import { describe, expect, it, vi } from "vitest";
import { execute } from "./session-recovery.js";

describe("session-recovery workflow", () => {
  it("reruns the failed agent for recoverable decisions and emits recovery evidence", async () => {
    const emit = vi.fn();
    const runAgent = vi.fn(async () => ({
      sessionId: "s_recovery",
      status: "done",
      lastAssistantText: "ok",
      messages: [],
      duration: "1s",
      outputDir: "/tmp",
    }));
    const ctx = {
      task: [
        "[session-recovery] Handle failed session s_failed.",
        "",
        "## Recovery Decision",
        "```json",
        JSON.stringify({
          sessionId: "s_failed",
          agent: "dev",
          action: "requeue",
          source: "digest",
          attempt: 1,
          maxAttempts: 2,
          error: "provider transient",
          task: "fix the bug",
        }),
        "```",
      ].join("\n"),
      runAgent,
      emit,
      done: (summary: string) => ({ type: "done", summary }),
      escalate: (reason: string, context?: unknown) => ({ type: "escalate", reason, context }),
    } as any;

    const result = await execute(ctx);

    expect(result).toMatchObject({ type: "done" });
    expect(runAgent).toHaveBeenCalledWith("dev", expect.stringContaining("## Original Task\nfix the bug"));
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({
      type: "session.recovery_attempted",
      sessionId: "s_failed",
      newSessionId: "s_recovery",
      status: "done",
    }));
  });
});
