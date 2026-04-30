import { describe, it, expect, vi } from "vitest";

// verify-wrap exports simple values and an async execute function
// We need to mock the WorkflowContext since it's an injected dependency

interface MockResult {
  status: string;
  error?: string;
  lastAssistantText?: string;
}

function createMockContext(overrides: Partial<{
  agent: string;
  task: string;
  runAgent: (agent: string, task: string) => Promise<MockResult>;
  escalate: (msg: string) => string;
  summarize: (result: MockResult, opts: any) => string;
  done: (msg: string) => string;
}> = {}) {
  return {
    agent: overrides.agent ?? "test-agent",
    task: overrides.task ?? "test task",
    runAgent: overrides.runAgent ?? vi.fn().mockResolvedValue({ status: "success" }),
    escalate: overrides.escalate ?? vi.fn((msg: string) => `ESCALATED: ${msg}`),
    summarize: overrides.summarize ?? vi.fn((_r: any, _o: any) => "summary text"),
    done: overrides.done ?? vi.fn((msg: string) => `DONE: ${msg}`),
  };
}

describe("verify-wrap", () => {
  let mod: { name: string; description: string; execute: (ctx: any) => Promise<any> };

  it("exports name as verify-wrap", async () => {
    mod = await import("../workflows/verify-wrap.js");
    expect(mod.name).toBe("verify-wrap");
  });

  it("exports a description string", async () => {
    mod = await import("../workflows/verify-wrap.js");
    expect(typeof mod.description).toBe("string");
    expect(mod.description.length).toBeGreaterThan(0);
  });

  it("exports an execute function", async () => {
    mod = await import("../workflows/verify-wrap.js");
    expect(typeof mod.execute).toBe("function");
  });

  it("calls runAgent with ctx.agent and ctx.task", async () => {
    mod = await import("../workflows/verify-wrap.js");
    const runAgent = vi.fn().mockResolvedValue({ status: "success" });
    const ctx = createMockContext({ agent: "my-agent", task: "my task", runAgent });
    await mod.execute(ctx);
    expect(runAgent).toHaveBeenCalledWith("my-agent", "my task");
  });

  it("calls escalate on error status", async () => {
    mod = await import("../workflows/verify-wrap.js");
    const runAgent = vi.fn().mockResolvedValue({ status: "error", error: "something broke" });
    const escalate = vi.fn((msg: string) => `ESC: ${msg}`);
    const ctx = createMockContext({ runAgent, escalate });
    await mod.execute(ctx);
    expect(escalate).toHaveBeenCalled();
    expect(escalate.mock.calls[0][0]).toContain("failed");
  });

  it("includes error message in escalation", async () => {
    mod = await import("../workflows/verify-wrap.js");
    const runAgent = vi.fn().mockResolvedValue({ status: "error", error: "timeout" });
    const escalate = vi.fn((msg: string) => msg);
    const ctx = createMockContext({ runAgent, escalate });
    await mod.execute(ctx);
    expect(escalate.mock.calls[0][0]).toContain("timeout");
  });

  it("uses lastAssistantText when no error field", async () => {
    mod = await import("../workflows/verify-wrap.js");
    const runAgent = vi.fn().mockResolvedValue({ status: "error", lastAssistantText: "I got stuck on X" });
    const escalate = vi.fn((msg: string) => msg);
    const ctx = createMockContext({ runAgent, escalate });
    await mod.execute(ctx);
    expect(escalate.mock.calls[0][0]).toContain("I got stuck");
  });

  it("calls done on success", async () => {
    mod = await import("../workflows/verify-wrap.js");
    const runAgent = vi.fn().mockResolvedValue({ status: "success" });
    const done = vi.fn((msg: string) => msg);
    const ctx = createMockContext({ runAgent, done });
    await mod.execute(ctx);
    expect(done).toHaveBeenCalled();
  });

  it("passes summarize result to done", async () => {
    mod = await import("../workflows/verify-wrap.js");
    const runAgent = vi.fn().mockResolvedValue({ status: "success" });
    const summarize = vi.fn(() => "my summary");
    const done = vi.fn((msg: string) => msg);
    const ctx = createMockContext({ runAgent, done, summarize });
    await mod.execute(ctx);
    expect(done).toHaveBeenCalledWith("my summary");
  });

  it("uses fallback message when summarize returns non-string", async () => {
    mod = await import("../workflows/verify-wrap.js");
    const runAgent = vi.fn().mockResolvedValue({ status: "success" });
    const summarize = vi.fn(() => null);
    const done = vi.fn((msg: string) => msg);
    const ctx = createMockContext({ agent: "coder", runAgent, done, summarize });
    await mod.execute(ctx);
    expect(done.mock.calls[0][0]).toContain("completed task successfully");
  });

  it("truncates lastAssistantText to 200 chars in escalation", async () => {
    mod = await import("../workflows/verify-wrap.js");
    const longText = "x".repeat(500);
    const runAgent = vi.fn().mockResolvedValue({ status: "error", lastAssistantText: longText });
    const escalate = vi.fn((msg: string) => msg);
    const ctx = createMockContext({ runAgent, escalate });
    await mod.execute(ctx);
    // The slice(0, 200) means max 200 chars of lastAssistantText
    const escalateMsg = escalate.mock.calls[0][0];
    expect(escalateMsg.length).toBeLessThan(500);
  });
});
