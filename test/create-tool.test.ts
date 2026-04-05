/**
 * Tests for V2 agents tool (createAgentsTool).
 *
 * Covers the 5 actions: call, send, list, peek, cancel.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../src/lib/manager.js";
import type { Model } from "@mariozechner/pi-ai";

function fakeModel(): Model<any> {
  return {
    id: "test-model",
    name: "Test Model",
    api: "anthropic",
    provider: "anthropic",
    baseUrl: "http://localhost:0",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 4096,
    maxTokens: 1024,
  };
}

function registerTestAgents(manager: SubagentManager) {
  manager.register({
    name: "researcher",
    description: "Deep research on technical topics",
    domain: "academic research",
    systemPrompt: "You are a researcher.",
    model: fakeModel(),
    tools: [],
    apiKey: "fake-key",
  });
  manager.register({
    name: "writer",
    description: "Content writing and editing",
    domain: "content creation",
    systemPrompt: "You are a writer.",
    model: fakeModel(),
    tools: [],
    apiKey: "fake-key",
  });
}

function parseResult(result: { content: Array<{ type: string; text?: string }> }): any {
  const text = result.content[0]?.type === "text" ? (result.content[0] as any).text : "";
  return JSON.parse(text);
}

describe("createAgentsTool()", () => {
  let persistDir: string;
  let agentsRoot: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-agents-tool-"));
    agentsRoot = mkdtempSync(join(tmpdir(), "may-agents-root-"));
    manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    registerTestAgents(manager);
  });

  afterEach(() => {
    for (const s of manager.status()) manager.cancel(s.sessionId);
    rmSync(persistDir, { recursive: true, force: true });
    rmSync(agentsRoot, { recursive: true, force: true });
  });

  it("returns a tool with name 'agents'", () => {
    const tool = manager.createAgentsTool();
    expect(tool.name).toBe("agents");
  });

  it("has label, description, parameters, and execute", () => {
    const tool = manager.createAgentsTool();
    expect(tool.label).toBeTruthy();
    expect(tool.description).toBeTruthy();
    expect(tool.parameters).toBeDefined();
    expect(typeof tool.execute).toBe("function");
  });

  describe("action: list", () => {
    it("returns all registered agents", async () => {
      const tool = manager.createAgentsTool();
      const result = await tool.execute("tc1", { action: "list" });
      const parsed = parseResult(result);

      expect(parsed.agents).toHaveLength(2);
      const names = parsed.agents.map((a: any) => a.name);
      expect(names).toContain("researcher");
      expect(names).toContain("writer");
    });

    it("includes running sessions", async () => {
      const tool = manager.createAgentsTool();
      const sessionId = manager.run("researcher", "find papers");

      const result = await tool.execute("tc2", { action: "list" });
      const parsed = parseResult(result);

      expect(parsed.runningSessions.length).toBeGreaterThanOrEqual(1);
      const session = parsed.runningSessions.find((s: any) => s.sessionId === sessionId);
      expect(session).toBeDefined();
      expect(session.agent).toBe("researcher");

      await manager.waitFor(sessionId);
    });
  });

  describe("action: call", () => {
    it("runs agent to completion and returns result", async () => {
      const tool = manager.createAgentsTool();
      const result = await tool.execute("tc1", {
        action: "call",
        agent: "researcher",
        task: "find papers on RL",
      });

      const parsed = parseResult(result);
      expect(parsed.sessionId).toBeDefined();
      expect(parsed.status).toBeDefined();
      expect(parsed.duration).toBeDefined();
      // Should not include full messages array
      expect(parsed.messages).toBeUndefined();
    });

    it("returns error for unknown agent", async () => {
      const tool = manager.createAgentsTool();
      const result = await tool.execute("tc1", {
        action: "call",
        agent: "nonexistent",
        task: "do something",
      });

      const parsed = parseResult(result);
      expect(parsed.error).toContain("nonexistent");
    });

    it("returns error when agent/task missing", async () => {
      const tool = manager.createAgentsTool();
      const result = await tool.execute("tc1", { action: "call" });
      const parsed = parseResult(result);
      expect(parsed.error).toContain("requires");
    });
  });

  describe("action: send", () => {
    it("tracks task and returns confirmation", async () => {
      const tool = manager.createAgentsTool({
        agentsRoot,
        getCallerAgentName: () => "may",
      });

      const result = await tool.execute("tc1", {
        action: "message",
        agent: "researcher",
        message: "review the API docs",
      });
      const parsed = parseResult(result);
      expect(parsed.sent).toBe("researcher");
      expect(parsed.message).toBe("review the API docs");
    });

    it("returns confirmation for multiple sends", async () => {
      const tool = manager.createAgentsTool({
        agentsRoot,
        getCallerAgentName: () => "bob",
      });

      const r1 = parseResult(await tool.execute("tc1", { action: "message", agent: "researcher", message: "first" }));
      const r2 = parseResult(await tool.execute("tc2", { action: "message", agent: "researcher", message: "second" }));
      expect(r1.sent).toBe("researcher");
      expect(r2.sent).toBe("researcher");
    });

    it("calls triggerHeartbeat callback", async () => {
      let triggered: string | null = null;
      const tool = manager.createAgentsTool({
        agentsRoot,
        triggerHeartbeat: (name) => {
          triggered = name;
          return true;
        },
      });

      const result = await tool.execute("tc1", {
        action: "message",
        agent: "researcher",
        message: "do stuff",
      });
      const parsed = parseResult(result);
      expect(triggered).toBe("researcher");
      expect(parsed.heartbeatTriggered).toBe(true);
    });

    it("returns error when agent or message missing", async () => {
      const tool = manager.createAgentsTool({ agentsRoot });

      const r1 = await tool.execute("tc1", { action: "message", agent: "researcher" });
      expect(parseResult(r1).error).toContain("requires");

      const r2 = await tool.execute("tc2", { action: "message", message: "hi" });
      expect(parseResult(r2).error).toContain("requires");
    });

    it("returns error for unregistered agent", async () => {
      const tool = manager.createAgentsTool({ agentsRoot });
      const result = await tool.execute("tc1", {
        action: "message",
        agent: "nonexistent",
        message: "do stuff",
      });
      expect(parseResult(result).error).toContain("not registered");
    });

    it("returns error when agentsRoot not configured", async () => {
      const tool = manager.createAgentsTool(); // no agentsRoot
      const result = await tool.execute("tc1", {
        action: "message",
        agent: "researcher",
        message: "do stuff",
      });
      expect(parseResult(result).error).toContain("agentsRoot");
    });
  });

  describe("action: peek", () => {
    it("returns messages for a session", async () => {
      const tool = manager.createAgentsTool();
      const sessionId = manager.run("researcher", "find papers");
      await manager.waitFor(sessionId);

      const result = await tool.execute("tc1", {
        action: "peek",
        sessionId,
      });

      const parsed = parseResult(result);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it("returns error for unknown session", async () => {
      const tool = manager.createAgentsTool();
      const result = await tool.execute("tc1", {
        action: "peek",
        sessionId: "nonexistent",
      });

      const parsed = parseResult(result);
      expect(parsed.error).toBeDefined();
    });

    it("returns error when sessionId missing", async () => {
      const tool = manager.createAgentsTool();
      const result = await tool.execute("tc1", { action: "peek" });
      const parsed = parseResult(result);
      expect(parsed.error).toContain("requires");
    });
  });

  describe("action: cancel", () => {
    it("cancels a session and returns confirmation", async () => {
      const tool = manager.createAgentsTool();
      const sessionId = manager.run("researcher", "find papers");

      const result = await tool.execute("tc1", {
        action: "cancel",
        sessionId,
      });

      const parsed = parseResult(result);
      expect(parsed.cancelled).toBe(sessionId);

      await manager.waitFor(sessionId);
    });

    it("does not throw for unknown session", async () => {
      const tool = manager.createAgentsTool();
      const result = await tool.execute("tc1", {
        action: "cancel",
        sessionId: "nonexistent",
      });

      const parsed = parseResult(result);
      expect(parsed.cancelled).toBe("nonexistent");
    });
  });

  describe("callDeny", () => {
    it("blocks call to denied agent with hint", async () => {
      const tool = manager.createAgentsTool({
        callDeny: { agents: ["researcher"], hint: "Use workflow instead." },
      });
      const result = await tool.execute("tc1", {
        action: "call",
        agent: "researcher",
        task: "find papers",
      });
      const parsed = parseResult(result);
      expect(parsed.error).toContain("Cannot call");
      expect(parsed.error).toContain("researcher");
      expect(parsed.error).toContain("Use workflow instead.");
    });

    it("allows call to non-denied agent", async () => {
      const tool = manager.createAgentsTool({
        callDeny: { agents: ["researcher"], hint: "Use workflow instead." },
      });
      const result = await tool.execute("tc1", {
        action: "call",
        agent: "writer",
        task: "write something",
      });
      const parsed = parseResult(result);
      expect(parsed.sessionId).toBeDefined();
      if (parsed.error) {
        expect(parsed.error).not.toContain("Cannot call");
      }
    });

    it("list still works with callDeny", async () => {
      const tool = manager.createAgentsTool({
        callDeny: { agents: ["researcher"], hint: "Use workflow instead." },
      });
      const result = await tool.execute("tc1", { action: "list" });
      const parsed = parseResult(result);
      expect(parsed.agents).toHaveLength(2);
    });
  });

  describe("tool output format", () => {
    it("all actions return content with text type", async () => {
      const tool = manager.createAgentsTool();

      // list
      const listResult = await tool.execute("tc1", { action: "list" });
      expect(listResult.content).toHaveLength(1);
      expect(listResult.content[0].type).toBe("text");

      // call
      const callResult = await tool.execute("tc2", {
        action: "call",
        agent: "researcher",
        task: "test",
      });
      expect(callResult.content).toHaveLength(1);
      expect(callResult.content[0].type).toBe("text");
    });
  });

  describe("unknown action", () => {
    it("returns error for unknown action", async () => {
      const tool = manager.createAgentsTool();
      const result = await tool.execute("tc1", { action: "unknown" as any });
      const parsed = parseResult(result);
      expect(parsed.error).toContain("Unknown action");
    });
  });
});

describe("listAgents()", () => {
  it("returns empty array when no agents registered", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")), infraRetryMax: 0 });
    expect(manager.listAgents()).toEqual([]);
  });

  it("returns correct { name, description, domain } for registered agents", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")), infraRetryMax: 0 });
    registerTestAgents(manager);

    const agents = manager.listAgents();
    expect(agents).toHaveLength(2);

    const researcher = agents.find((a) => a.name === "researcher");
    expect(researcher).toEqual({
      name: "researcher",
      description: "Deep research on technical topics",
      domain: "academic research",
    });

    const writer = agents.find((a) => a.name === "writer");
    expect(writer).toEqual({
      name: "writer",
      description: "Content writing and editing",
      domain: "content creation",
    });
  });

  it("does NOT include session info (simpler than status/list)", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")), infraRetryMax: 0 });
    registerTestAgents(manager);

    const agents = manager.listAgents();
    for (const agent of agents) {
      const keys = Object.keys(agent);
      expect(keys).toEqual(["name", "description", "domain"]);
      expect(agent).not.toHaveProperty("sessions");
    }
  });
});
