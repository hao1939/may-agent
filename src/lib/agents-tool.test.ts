/**
 * Tests for V2 agents tool — call, send, list, peek, cancel.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getModel } from "@mariozechner/pi-ai";
import { SubagentManager } from "./manager.js";
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

  it("call appends context_files to the dispatched task", async () => {
    manager.register({
      name: "coder",
      description: "Writes code",
      domain: "coding",
      model: mockModel(),
      tools: [echoTool()],
    });

    let dispatchedTask = "";
    (manager as any).callAgent = async (_agent: string, task: string) => {
      dispatchedTask = task;
      return { status: "done", agent: "coder", summary: "ok", messages: [] };
    };

    const tool = manager.createAgentsTool();
    const result = await callTool(tool, {
      action: "call",
      agent: "coder",
      task: "Drive the project loop",
      context_files: [
        "shared/skills/project-loop-driver/SKILL.md",
        "shared/skills/reading-metrics/skill.md",
      ],
    });

    expect(result.status).toBe("done");
    expect(dispatchedTask).toContain("Drive the project loop");
    expect(dispatchedTask).toContain("Context files the receiving agent must read before acting:");
    expect(dispatchedTask).toContain("shared/skills/project-loop-driver/SKILL.md");
    expect(dispatchedTask).toContain("shared/skills/reading-metrics/skill.md");
  });

  it("fork appends context_files to the session task", async () => {
    manager.register({
      name: "coder",
      description: "Writes code",
      domain: "coding",
      model: mockModel(),
      tools: [echoTool()],
    });

    let dispatchedTask = "";
    (manager as any).runAgent = (_agent: string, task: string) => {
      dispatchedTask = task;
      return "s_context_files";
    };

    const tool = manager.createAgentsTool();
    const result = await callTool(tool, {
      action: "fork",
      agent: "coder",
      task: "Investigate the socket route",
      context_files: ["shared/skills/control-plane-operation/SKILL.md"],
    });

    expect(result.status).toBe("started");
    expect(result.sessionId).toBe("s_context_files");
    expect(dispatchedTask).toContain("Investigate the socket route");
    expect(dispatchedTask).toContain("Context files the receiving agent must read before acting:");
    expect(dispatchedTask).toContain("shared/skills/control-plane-operation/SKILL.md");
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

  // The agents.message action was removed in commit d15c5249 (notify-split).
  // It now returns a fixed deprecation error regardless of inputs. Callers should
  // use notify({ agent, message }) or agents.fork({ agent, task }) instead.
  it("message action returns deprecation error regardless of inputs", async () => {
    const deprecation = "agents.message and agents.send actions have been removed";
    manager.register({
      name: "coder",
      description: "Writes code",
      domain: "coding",
      model: mockModel(),
      tools: [echoTool()],
    });

    // Missing message — deprecation error (not "requires")
    const t1 = manager.createAgentsTool({ agentsRoot });
    const r1 = await callTool(t1, { action: "message", agent: "coder" });
    expect(r1.error).toContain(deprecation);

    // Unregistered agent — deprecation error (not "not registered")
    const r2 = await callTool(t1, { action: "message", agent: "nonexistent", message: "do stuff" });
    expect(r2.error).toContain(deprecation);

    // With full config — deprecation error, no sent/message confirmation
    let triggeredAgent: string | null = null;
    const t2 = manager.createAgentsTool({
      agentsRoot,
      getCallerAgentName: () => "may",
      triggerHeartbeat: (name) => {
        triggeredAgent = name;
        return true;
      },
    });
    const r3 = await callTool(t2, { action: "message", agent: "coder", message: "fix the login bug" });
    expect(r3.error).toContain(deprecation);
    expect(r3.sent).toBeUndefined();
    expect(r3.heartbeatTriggered).toBeUndefined();
    expect(triggeredAgent).toBeNull();

    // No agentsRoot — still deprecation error (not "agentsRoot")
    const t3 = manager.createAgentsTool();
    const r4 = await callTool(t3, { action: "message", agent: "coder", message: "do stuff" });
    expect(r4.error).toContain(deprecation);
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

  it("message action returns deprecation error even when target is a tool", async () => {
    // Since the message action now short-circuits with a deprecation error
    // (commit d15c5249), the tool-vs-agent guard is not reached. Callers
    // that attempt message on a tool name still get the deprecation error.
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

    const result = await callTool(tool, { action: "message", agent: "checkpoint", message: "save state" });
    expect(result.error).toContain("agents.message and agents.send actions have been removed");
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
