import { describe, expect, it, vi } from "bun:test";
import { execute } from "../session-recovery.ts";

describe("session-recovery workflow", () => {
  it("reruns the failed agent for recoverable decisions and emits recovery evidence", async () => {
    const emit = vi.fn(async () => undefined);
    const callAgent = vi.fn(async () => ({
      id: "s_recovery",
      kind: "agent" as const,
      status: "done",
      summary: "ok",
    }));
    const ctx = {
      input: {
        sessionId: "s_failed",
        agent: "dev",
        action: "requeue",
        source: "digest",
        attempt: 1,
        maxAttempts: 2,
        error: "provider transient",
        task: "fix the bug",
      },
      agents: { call: callAgent },
      events: { emit },
      done: (summary: string, output?: unknown) => ({
        id: "wf_test",
        kind: "workflow",
        status: "done",
        summary,
        output,
      }),
      blocked: (summary: string, evidence?: unknown) => ({
        id: "wf_test",
        kind: "workflow",
        status: "blocked",
        summary,
        evidence,
      }),
    } as any;

    const result = await execute(ctx);

    expect(result).toMatchObject({
      status: "done",
      output: { state: "converged" },
    });
    expect(callAgent).toHaveBeenCalledWith(
      "dev",
      expect.stringContaining("## Original Task\nfix the bug"),
    );
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "session.recovery_attempted",
        data: expect.objectContaining({
          sessionId: "s_failed",
          newSessionId: "s_recovery",
          status: "done",
        }),
      }),
    );
  });
});
