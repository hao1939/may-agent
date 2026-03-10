/**
 * Tests for V2 agents tool — call, list, peek, steer, cancel.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getModel } from "@mariozechner/pi-ai";
import { SubagentManager } from "../src/lib/manager.js";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";

// ── Helpers ─────────────────────────────────────────────────────────────

function echoTool(): AgentTool {
  return {
    name: "echo",
    label: "Echo",
    description: "Echoes input",
    parameters: {},
    execute: async (_id, params) => ({
      content: [{ type: "text" as const, text: JSON.stringify(params) }],
      details: JSON.stringify(params),
    }),
  };
}

function mockModel() {
  return getModel("anthropic", "claude-sonnet-4-20250514");
}

async function callTool(tool: AgentTool, params: Record<string, unknown>): Promise<any> {
  const result = await tool.execute("tc_1", params) as AgentToolResult<string>;
  const text = (result.content as any[])[0]?.text ?? "";
  return JSON.parse(text);
}

// ── Tests ───────────────────────────────────────────────────────────────

describe("V2 agents tool", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "agents-tool-"));
    mkdirSync(join(persistDir, "sessions"), { recursive: true });
    mkdirSync(join(persistDir, "memory"), { recursive: true });
    manager = new SubagentManager({ persistDir });
  });

  afterEach(() => {
    try { rmSync(persistDir, { recursive: true, force: true }); } catch {}
  });

  it("list returns registered agents and no running sessions", async () => {
    manager.register({
      name: "coder",
      description: "Writes code",
      domain: "coding",
      model: mockModel(),
      tools: [echoTool()],
    });

    const tool = manager.createAgentsTool();
    const result = await callTool(tool, { action: "list" });

    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].name).toBe("coder");
    expect(result.runningSessions).toHaveLength(0);
  });

  it("call without agent/task returns error", async () => {
    const tool = manager.createAgentsTool();
    const result = await callTool(tool, { action: "call" });
    expect(result.error).toContain("requires");
  });

  it("call with denied agent returns error", async () => {
    manager.register({
      name: "coder",
      description: "Writes code",
      domain: "coding",
      model: mockModel(),
      tools: [echoTool()],
    });

    const tool = manager.createAgentsTool({
      callDeny: { agents: ["coder"], hint: "Use tech-lead instead" },
    });

    const result = await callTool(tool, { action: "call", agent: "coder", task: "test" });
    expect(result.error).toContain("Cannot call");
    expect(result.error).toContain("Use tech-lead instead");
  });

  it("cancel on non-existent session returns cancelled (no-op)", async () => {
    const tool = manager.createAgentsTool();
    const result = await callTool(tool, { action: "cancel", sessionId: "s_nonexistent" });
    expect(result.cancelled).toBe("s_nonexistent");
  });

  it("peek without sessionId returns error", async () => {
    const tool = manager.createAgentsTool();
    const result = await callTool(tool, { action: "peek" });
    expect(result.error).toContain("requires");
  });

  it("steer without sessionId or message returns error", async () => {
    const tool = manager.createAgentsTool();
    const result = await callTool(tool, { action: "steer", sessionId: "s_1" });
    expect(result.error).toContain("requires");
  });

  it("asyncCall mode returns sessionId immediately", async () => {
    manager.register({
      name: "coder",
      description: "Writes code",
      domain: "coding",
      model: mockModel(),
      tools: [echoTool()],
    });

    const tool = manager.createAgentsTool({ asyncCall: true });
    const result = await callTool(tool, { action: "call", agent: "coder", task: "test" });

    expect(result.sessionId).toBeDefined();
    expect(result.status).toBe("started");

    // Clean up — cancel the running session
    const sessions = manager.status();
    for (const s of sessions) {
      manager.cancel(s.sessionId);
    }
  });

  it("unknown action returns error", async () => {
    const tool = manager.createAgentsTool();
    const result = await callTool(tool, { action: "unknown" as any });
    expect(result.error).toContain("Unknown action");
  });
});

describe("callAgent depth limit", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "depth-limit-"));
    mkdirSync(join(persistDir, "sessions"), { recursive: true });
    mkdirSync(join(persistDir, "memory"), { recursive: true });
  });

  afterEach(() => {
    try { rmSync(persistDir, { recursive: true, force: true }); } catch {}
  });

  it("respects maxCallDepth setting", async () => {
    const manager = new SubagentManager({ persistDir, maxCallDepth: 2 });

    // Manually test depth tracking
    // Set depth to 2 for a fake root session
    (manager as any).callDepths.set("root_session", 2);

    const result = await manager.callAgent("nonexistent", "test", {
      parentSessionId: "root_session",
    });

    expect(result.status).toBe("error");
    expect(result.error).toContain("Call depth limit exceeded");
  });
});
