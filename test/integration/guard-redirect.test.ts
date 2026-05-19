/**
 * Tests for guard redirect/steer feature (Phase 1 of event-driven guards).
 *
 * Verifies that:
 * 1. BeforeToolCallResult.redirect triggers a steer() call on the session agent
 * 2. BeforeToolCallResult.steer (non-blocking) injects a steering message
 * 3. Backward compatible — guards without redirect/steer work as before
 */

import { describe, it, expect, vi } from "bun:test";
import { wrapToolsWithReceipts } from "../../src/lib/manager-receipts.js";
import type { BeforeToolCallResult, BeforeToolCallContext } from "../../src/lib/tools/compose-guards.js";

/** Minimal mock of an Agent with steer() */
function mockAgent(messages: any[] = []) {
  return {
    steer: vi.fn(),
    state: { messages },
  };
}

/** Minimal mock of ActiveSession */
function mockSession(agent: any) {
  return {
    agent: { ...agent, abort: vi.fn() },
    agentName: "test-agent",
    totalToolCalls: 0,
    toolErrorHistory: new Map<string, number>(),
    closed: false,
  };
}

/** Minimal tool for wrapping */
function dummyTool(name = "finish") {
  return {
    name,
    description: "test",
    schema: {},
    execute: vi.fn(async () => ({
      content: [{ type: "text" as const, text: "ok" }],
      details: undefined,
    })),
  };
}

describe("guard redirect", () => {
  it("calls agent.steer() when guard returns redirect on block", async () => {
    const agent = mockAgent();
    const session = mockSession(agent);
    const sessions = new Map([["sess-1", session as any]]);

    const guardResult: BeforeToolCallResult = {
      block: true,
      reason: "No verification evidence",
      redirect: { workflow: "verify-wrap", task: "Verify changes" },
    };

    const tools = wrapToolsWithReceipts([dummyTool()], "sess-1", {
      agentName: "test-agent",
      sessionDir: "/tmp/test-session",
      activeSessions: sessions,
      beforeToolCall: async () => guardResult,
    });

    const result = await tools[0].execute("call-1", { status: "success" });

    // Tool should be blocked (returns error output)
    const text = result.content.map((c: any) => c.text).join("");
    expect(text).toContain("No verification evidence");

    // Agent.steer() should have been called with redirect guidance
    expect(agent.steer).toHaveBeenCalledTimes(1);
    const steerMsg = agent.steer.mock.calls[0][0];
    expect(steerMsg.role).toBe("user");
    const steerText = steerMsg.content[0].text;
    expect(steerText).toContain("Guard redirect");
    expect(steerText).toContain("verify-wrap");
    expect(steerText).toContain("Verify changes");
  });

  it("does NOT call steer() when guard blocks without redirect", async () => {
    const agent = mockAgent();
    const session = mockSession(agent);
    const sessions = new Map([["sess-2", session as any]]);

    const guardResult: BeforeToolCallResult = {
      block: true,
      reason: "Missing args",
    };

    const tools = wrapToolsWithReceipts([dummyTool()], "sess-2", {
      agentName: "test-agent",
      sessionDir: "/tmp/test-session",
      activeSessions: sessions,
      beforeToolCall: async () => guardResult,
    });

    await tools[0].execute("call-2", {});

    expect(agent.steer).not.toHaveBeenCalled();
  });

  it("injects non-blocking steer message when guard returns steer field", async () => {
    const agent = mockAgent();
    const session = mockSession(agent);
    const sessions = new Map([["sess-3", session as any]]);

    const guardResult: BeforeToolCallResult = {
      block: false,
      reason: "Consider running tests",
      steer: "💡 Tip: Run tests before finishing.",
    };

    const tools = wrapToolsWithReceipts([dummyTool("bash")], "sess-3", {
      agentName: "test-agent",
      sessionDir: "/tmp/test-session",
      activeSessions: sessions,
      beforeToolCall: async () => guardResult,
    });

    await tools[0].execute("call-3", { command: "echo hi" });

    // Tool should execute (not blocked)
    const originalTool = dummyTool("bash");
    // The tool executed — steer was injected as well
    expect(agent.steer).toHaveBeenCalledTimes(1);
    const steerMsg = agent.steer.mock.calls[0][0];
    expect(steerMsg.content[0].text).toBe("💡 Tip: Run tests before finishing.");
  });

  it("backward compatible — no steer when guard returns undefined", async () => {
    const agent = mockAgent();
    const session = mockSession(agent);
    const sessions = new Map([["sess-4", session as any]]);

    const tools = wrapToolsWithReceipts([dummyTool()], "sess-4", {
      agentName: "test-agent",
      sessionDir: "/tmp/test-session",
      activeSessions: sessions,
      beforeToolCall: async () => undefined,
    });

    await tools[0].execute("call-4", {});

    expect(agent.steer).not.toHaveBeenCalled();
  });
});
