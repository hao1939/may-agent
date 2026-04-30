/**
 * Tests for verify-wrap.ts workflow
 * Covers: execute function behavior with various ctx scenarios
 */

import { describe, it, expect, vi } from "vitest";

function makeCtx(overrides: Partial<any> = {}) {
  return {
    agent: "test-agent",
    task: "do something",
    runAgent: vi.fn().mockResolvedValue({ status: "success", lastAssistantText: "done" }),
    escalate: vi.fn((msg: string) => ({ escalated: true, message: msg })),
    done: vi.fn((msg: string) => ({ done: true, message: msg })),
    summarize: vi.fn().mockReturnValue("Task completed"),
    ...overrides,
  };
}

async function getModule() {
  return await import("../workflows/verify-wrap.js");
}

describe("verify-wrap", () => {
  describe("module exports", () => {
    it("exports name as 'verify-wrap'", async () => {
      const mod = await getModule();
      expect(mod.name).toBe("verify-wrap");
    });

    it("exports a description string", async () => {
      const mod = await getModule();
      expect(typeof mod.description).toBe("string");
      expect(mod.description.length).toBeGreaterThan(0);
    });

    it("exports an execute function", async () => {
      const mod = await getModule();
      expect(typeof mod.execute).toBe("function");
    });
  });

  describe("execute", () => {
    it("calls runAgent with ctx.agent and ctx.task", async () => {
      const mod = await getModule();
      const ctx = makeCtx();
      await mod.execute(ctx);
      expect(ctx.runAgent).toHaveBeenCalledWith("test-agent", "do something");
    });

    it("escalates when agent returns error status", async () => {
      const mod = await getModule();
      const ctx = makeCtx({
        runAgent: vi.fn().mockResolvedValue({ status: "error", error: "timeout" }),
      });
      await mod.execute(ctx);
      expect(ctx.escalate).toHaveBeenCalled();
      expect(ctx.escalate.mock.calls[0][0]).toContain("test-agent");
      expect(ctx.escalate.mock.calls[0][0]).toContain("failed");
    });

    it("includes error message in escalation", async () => {
      const mod = await getModule();
      const ctx = makeCtx({
        runAgent: vi.fn().mockResolvedValue({ status: "error", error: "OOM killed" }),
      });
      await mod.execute(ctx);
      expect(ctx.escalate.mock.calls[0][0]).toContain("OOM killed");
    });

    it("uses lastAssistantText when error is empty", async () => {
      const mod = await getModule();
      const ctx = makeCtx({
        runAgent: vi.fn().mockResolvedValue({ status: "error", error: "", lastAssistantText: "Something went wrong in step 3" }),
      });
      await mod.execute(ctx);
      expect(ctx.escalate.mock.calls[0][0]).toContain("Something went wrong");
    });

    it("calls done on success", async () => {
      const mod = await getModule();
      const ctx = makeCtx();
      await mod.execute(ctx);
      expect(ctx.done).toHaveBeenCalled();
    });

    it("calls summarize on success", async () => {
      const mod = await getModule();
      const ctx = makeCtx();
      await mod.execute(ctx);
      expect(ctx.summarize).toHaveBeenCalled();
    });

    it("passes result to summarize", async () => {
      const mod = await getModule();
      const agentResult = { status: "success", lastAssistantText: "all good" };
      const ctx = makeCtx({
        runAgent: vi.fn().mockResolvedValue(agentResult),
      });
      await mod.execute(ctx);
      expect(ctx.summarize).toHaveBeenCalledWith(agentResult, { maxLength: 300 });
    });

    it("uses summarize output in done call", async () => {
      const mod = await getModule();
      const ctx = makeCtx({
        summarize: vi.fn().mockReturnValue("Custom summary here"),
      });
      await mod.execute(ctx);
      expect(ctx.done).toHaveBeenCalledWith("Custom summary here");
    });

    it("uses fallback message when summarize returns non-string", async () => {
      const mod = await getModule();
      const ctx = makeCtx({
        summarize: vi.fn().mockReturnValue(null),
      });
      await mod.execute(ctx);
      expect(ctx.done).toHaveBeenCalledWith("test-agent completed task successfully.");
    });

    it("truncates lastAssistantText to 200 chars in escalation", async () => {
      const mod = await getModule();
      const longText = "x".repeat(300);
      const ctx = makeCtx({
        runAgent: vi.fn().mockResolvedValue({ status: "error", error: "", lastAssistantText: longText }),
      });
      await mod.execute(ctx);
      const escalationMsg = ctx.escalate.mock.calls[0][0];
      expect(escalationMsg.length).toBeLessThan(longText.length);
    });
  });
});
