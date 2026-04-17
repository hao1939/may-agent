/**
 * Tests for V2 agents tool — call, send, list, peek, cancel.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
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
  const result = (await tool.execute("tc_1", params)) as AgentToolResult<string>;
  const text = (result.content as any[])[0]?.text ?? "";
  return JSON.parse(text);
}

// ── Tests ───────────────────────────────────────────────────────────────

describe("V2 agents tool", () => {
  let persistDir: string;
  let agentsRoot: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "agents-tool-"));
    agentsRoot = mkdtempSync(join(tmpdir(), "agents-root-"));
    mkdirSync(join(persistDir, "sessions"), { recursive: true });
    mkdirSync(join(persistDir, "memory"), { recursive: true });
    manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
  });

  afterEach(() => {
    try {
      rmSync(persistDir, { recursive: true, force: true });
    } catch {}
    try {
      rmSync(agentsRoot, { recursive: true, force: true });
    } catch {}
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

  it("call to unregistered agent returns error", async () => {
    const tool = manager.createAgentsTool();
    const result = await callTool(tool, { action: "call", agent: "nonexistent", task: "test" });
    expect(result.error).toContain("not registered");
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

  it("send without agent or message returns error", async () => {
    const tool = manager.createAgentsTool({ agentsRoot });
    const result = await callTool(tool, { action: "message", agent: "coder" });
    expect(result.error).toContain("requires");
  });

  it("send to unregistered agent returns error", async () => {
    const tool = manager.createAgentsTool({ agentsRoot });
    const result = await callTool(tool, { action: "message", agent: "nonexistent", message: "do stuff" });
    expect(result.error).toContain("not registered");
  });

  it("send tracks task and returns confirmation", async () => {
    manager.register({
      name: "coder",
      description: "Writes code",
      domain: "coding",
      model: mockModel(),
      tools: [echoTool()],
    });

    const tool = manager.createAgentsTool({
      agentsRoot,
      getCallerAgentName: () => "may",
    });

    const result = await callTool(tool, { action: "message", agent: "coder", message: "fix the login bug" });
    expect(result.sent).toBe("coder");
    expect(result.message).toBe("fix the login bug");
  });

  it("send returns confirmation for multiple sends", async () => {
    manager.register({
      name: "coder",
      description: "Writes code",
      domain: "coding",
      model: mockModel(),
      tools: [echoTool()],
    });

    const tool = manager.createAgentsTool({
      agentsRoot,
      getCallerAgentName: () => "bob",
    });

    const r1 = await callTool(tool, { action: "message", agent: "coder", message: "first task" });
    const r2 = await callTool(tool, { action: "message", agent: "coder", message: "second task" });
    expect(r1.sent).toBe("coder");
    expect(r2.sent).toBe("coder");
    expect(r1.message).toBe("first task");
    expect(r2.message).toBe("second task");
  });

  it("send calls triggerHeartbeat callback", async () => {
    manager.register({
      name: "coder",
      description: "Writes code",
      domain: "coding",
      model: mockModel(),
      tools: [echoTool()],
    });

    let triggeredAgent: string | null = null;
    const tool = manager.createAgentsTool({
      agentsRoot,
      triggerHeartbeat: (name) => {
        triggeredAgent = name;
        return true;
      },
    });

    const result = await callTool(tool, { action: "message", agent: "coder", message: "do stuff" });
    expect(triggeredAgent).toBe("coder");
    expect(result.heartbeatTriggered).toBe(true);
  });

  it("send without agentsRoot returns error", async () => {
    manager.register({
      name: "coder",
      description: "Writes code",
      domain: "coding",
      model: mockModel(),
      tools: [echoTool()],
    });

    const tool = manager.createAgentsTool(); // no agentsRoot
    const result = await callTool(tool, { action: "message", agent: "coder", message: "do stuff" });
    expect(result.error).toContain("agentsRoot");
  });

  it("unknown action returns error", async () => {
    const tool = manager.createAgentsTool();
    const result = await callTool(tool, { action: "unknown" as any });
    expect(result.error).toContain("Unknown action");
  });

  it("call rejects when target matches a tool in caller's toolset", async () => {
    // Register a "bob" agent that has a tool named "checkpoint"
    const checkpointTool: AgentTool = {
      name: "checkpoint",
      label: "Checkpoint",
      description: "Save checkpoint",
      parameters: {},
      execute: async () => ({
        content: [{ type: "text" as const, text: "ok" }],
        details: "ok",
      }),
    };

    manager.register({
      name: "bob",
      description: "Architect",
      domain: "design",
      model: mockModel(),
      tools: [echoTool(), checkpointTool],
    });

    const tool = manager.createAgentsTool({
      getCallerAgentName: () => "bob",
    });

    // "checkpoint" is NOT a registered agent, but IS a tool in bob's toolset
    const result = await callTool(tool, { action: "call", agent: "checkpoint", task: "save state" });
    expect(result.error).toContain("is a tool, not an agent");
    expect(result.error).toContain("checkpoint({ ... })");
  });

  it("send rejects when target matches a tool in caller's toolset", async () => {
    const checkpointTool: AgentTool = {
      name: "checkpoint",
      label: "Checkpoint",
      description: "Save checkpoint",
      parameters: {},
      execute: async () => ({
        content: [{ type: "text" as const, text: "ok" }],
        details: "ok",
      }),
    };

    manager.register({
      name: "bob",
      description: "Architect",
      domain: "design",
      model: mockModel(),
      tools: [echoTool(), checkpointTool],
    });

    const tool = manager.createAgentsTool({
      agentsRoot,
      getCallerAgentName: () => "bob",
    });

    // "checkpoint" is NOT a registered agent, but IS a tool in bob's toolset
    const result = await callTool(tool, { action: "message", agent: "checkpoint", message: "save state" });
    expect(result.error).toContain("is a tool, not an agent");
    expect(result.error).toContain("checkpoint({ ... })");
  });

  it("call allows when target is an agent, not a tool", async () => {
    // Register "coder" agent — its name is not a tool in bob's toolset
    manager.register({
      name: "coder",
      description: "Writes code",
      domain: "coding",
      model: mockModel(),
      tools: [echoTool()],
    });

    manager.register({
      name: "bob",
      description: "Architect",
      domain: "design",
      model: mockModel(),
      tools: [echoTool()],
    });

    const tool = manager.createAgentsTool({
      getCallerAgentName: () => "bob",
    });

    // "coder" is a registered agent and not in bob's tools — should pass the guard
    // (will fail at actual callAgent since no LLM, but that's past the guard)
    const result = await callTool(tool, { action: "call", agent: "coder", task: "test" });
    // Should NOT contain "is a tool" — it should get past the guard
    expect(result.error ?? "").not.toContain("is a tool");
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
    try {
      rmSync(persistDir, { recursive: true, force: true });
    } catch {}
  });

  it("respects maxCallDepth setting", async () => {
    const manager = new SubagentManager({ persistDir, maxCallDepth: 2, infraRetryMax: 0 });

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
