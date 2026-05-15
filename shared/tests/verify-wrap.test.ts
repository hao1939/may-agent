/**
 * Tests for verify-wrap.ts workflow
 */
import { describe, it, expect, vi } from "bun:test";
import { name, description, execute } from "../workflows/verify-wrap.js";

describe("verify-wrap metadata", () => {
  it("exports correct name", () => {
    expect(name).toBe("verify-wrap");
  });

  it("exports a description string", () => {
    expect(typeof description).toBe("string");
    expect(description.length).toBeGreaterThan(0);
  });

  it("exports execute as a function", () => {
    expect(typeof execute).toBe("function");
  });
});

describe("verify-wrap execute", () => {
  function makeCtx(overrides: Partial<any> = {}) {
    return {
      agent: "test-agent",
      task: "do something",
      runAgent: vi.fn().mockResolvedValue({ status: "success", lastAssistantText: "done" }),
      escalate: vi.fn((msg: string) => ({ escalated: true, message: msg })),
      summarize: vi.fn().mockReturnValue("Task completed."),
      done: vi.fn((msg: string) => ({ done: true, message: msg })),
      ...overrides,
    } as any;
  }

  it("calls runAgent with ctx.agent and ctx.task", async () => {
    const ctx = makeCtx();
    await execute(ctx);
    expect(ctx.runAgent).toHaveBeenCalledWith("test-agent", "do something");
  });

  it("escalates on error status", async () => {
    const ctx = makeCtx({
      runAgent: vi.fn().mockResolvedValue({ status: "error", error: "something broke" }),
    });
    const result = await execute(ctx);
    expect(ctx.escalate).toHaveBeenCalled();
    expect(ctx.escalate.mock.calls[0][0]).toContain("test-agent");
    expect(ctx.escalate.mock.calls[0][0]).toContain("something broke");
  });

  it("escalates with lastAssistantText when no error field", async () => {
    const ctx = makeCtx({
      runAgent: vi.fn().mockResolvedValue({ status: "error", lastAssistantText: "long text here" }),
    });
    await execute(ctx);
    expect(ctx.escalate).toHaveBeenCalled();
    expect(ctx.escalate.mock.calls[0][0]).toContain("long text");
  });

  it("truncates lastAssistantText to 200 chars in escalation", async () => {
    const longText = "a".repeat(500);
    const ctx = makeCtx({
      runAgent: vi.fn().mockResolvedValue({ status: "error", lastAssistantText: longText }),
    });
    await execute(ctx);
    const msg = ctx.escalate.mock.calls[0][0];
    expect(msg.length).toBeLessThan(300); // agent name + truncated text
  });

  it("calls done with summary on success", async () => {
    const ctx = makeCtx();
    await execute(ctx);
    expect(ctx.done).toHaveBeenCalledWith("Task completed.");
  });

  it("calls summarize with result", async () => {
    const ctx = makeCtx();
    await execute(ctx);
    expect(ctx.summarize).toHaveBeenCalledWith(
      { status: "success", lastAssistantText: "done" },
      { maxLength: 300 }
    );
  });

  it("uses fallback message when summarize returns non-string", async () => {
    const ctx = makeCtx({
      summarize: vi.fn().mockReturnValue({ object: true }),
    });
    await execute(ctx);
    expect(ctx.done).toHaveBeenCalledWith("test-agent completed task successfully.");
  });

  it("uses summary string directly when summarize returns string", async () => {
    const ctx = makeCtx({
      summarize: vi.fn().mockReturnValue("Custom summary"),
    });
    await execute(ctx);
    expect(ctx.done).toHaveBeenCalledWith("Custom summary");
  });

  it("passes different agent names correctly", async () => {
    const ctx = makeCtx({ agent: "custom-agent", task: "custom task" });
    await execute(ctx);
    expect(ctx.runAgent).toHaveBeenCalledWith("custom-agent", "custom task");
  });

  it("handles empty error and empty lastAssistantText", async () => {
    const ctx = makeCtx({
      runAgent: vi.fn().mockResolvedValue({ status: "error", error: "", lastAssistantText: "" }),
    });
    await execute(ctx);
    expect(ctx.escalate).toHaveBeenCalled();
  });
});
