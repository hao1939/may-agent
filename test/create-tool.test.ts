import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../src/manager.js";
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

describe("createTool()", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-create-tool-"));
    manager = new SubagentManager({ persistDir });
    registerTestAgents(manager);
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("returns a tool with name 'subagents'", () => {
    const tool = manager.createTool();
    expect(tool.name).toBe("subagents");
  });

  it("has label, description, parameters, and execute", () => {
    const tool = manager.createTool();
    expect(tool.label).toBeTruthy();
    expect(tool.description).toBeTruthy();
    expect(tool.parameters).toBeDefined();
    expect(typeof tool.execute).toBe("function");
  });

  describe("action: list", () => {
    it("returns all registered agents with descriptions and domains", async () => {
      const tool = manager.createTool();
      const result = await tool.execute("tc1", { action: "list" as const });

      const parsed = JSON.parse(result.content[0].type === "text" ? result.content[0].text : "");
      expect(parsed).toHaveLength(2);

      const names = parsed.map((a: any) => a.name);
      expect(names).toContain("researcher");
      expect(names).toContain("writer");

      const researcher = parsed.find((a: any) => a.name === "researcher");
      expect(researcher.description).toBe("Deep research on technical topics");
      expect(researcher.domain).toBe("academic research");
      expect(researcher.sessions).toEqual([]);
    });

    it("includes active sessions for each agent", async () => {
      const tool = manager.createTool();

      // Start a session
      const sessionId = manager.run("researcher", "find papers");

      const result = await tool.execute("tc2", { action: "list" as const });
      const parsed = JSON.parse(result.content[0].type === "text" ? result.content[0].text : "");

      const researcher = parsed.find((a: any) => a.name === "researcher");
      expect(researcher.sessions).toHaveLength(1);
      expect(researcher.sessions[0].sessionId).toBe(sessionId);
      expect(researcher.sessions[0].task).toBe("find papers");

      // Writer should have no sessions
      const writer = parsed.find((a: any) => a.name === "writer");
      expect(writer.sessions).toEqual([]);

      await manager.waitFor(sessionId);
    });
  });

  describe("action: run", () => {
    it("starts a session and returns sessionId", async () => {
      const tool = manager.createTool();
      const result = await tool.execute("tc1", {
        action: "run" as const,
        agent: "researcher",
        task: "find papers on RL",
      });

      const parsed = JSON.parse(result.content[0].type === "text" ? result.content[0].text : "");
      expect(parsed.sessionId).toBeDefined();
      expect(typeof parsed.sessionId).toBe("string");

      await manager.waitFor(parsed.sessionId);
    });

    it("returns error for unknown agent", async () => {
      const tool = manager.createTool();
      const result = await tool.execute("tc1", {
        action: "run" as const,
        agent: "nonexistent",
        task: "do something",
      });

      const parsed = JSON.parse(result.content[0].type === "text" ? result.content[0].text : "");
      expect(parsed.error).toContain("nonexistent");
      expect(parsed.error).toContain("not registered");
    });
  });

  describe("action: status", () => {
    it("returns session info for a valid session", async () => {
      const tool = manager.createTool();
      const sessionId = manager.run("researcher", "find papers");

      const result = await tool.execute("tc1", {
        action: "status" as const,
        sessionId,
      });

      const parsed = JSON.parse(result.content[0].type === "text" ? result.content[0].text : "");
      expect(parsed.sessionId).toBe(sessionId);
      expect(parsed.agent).toBe("researcher");
      expect(parsed.task).toBe("find papers");
      expect(parsed.status).toBeDefined();

      await manager.waitFor(sessionId);
    });

    it("returns error for unknown session", async () => {
      const tool = manager.createTool();
      const result = await tool.execute("tc1", {
        action: "status" as const,
        sessionId: "nonexistent",
      });

      const parsed = JSON.parse(result.content[0].type === "text" ? result.content[0].text : "");
      expect(parsed.error).toContain("nonexistent");
    });
  });

  describe("action: progress", () => {
    it("returns messages for a session", async () => {
      const tool = manager.createTool();
      const sessionId = manager.run("researcher", "find papers");
      await manager.waitFor(sessionId);

      const result = await tool.execute("tc1", {
        action: "progress" as const,
        sessionId,
      });

      const parsed = JSON.parse(result.content[0].type === "text" ? result.content[0].text : "");
      // There should be at least the user message
      expect(Array.isArray(parsed)).toBe(true);
    });

    it("returns error for unknown session", async () => {
      const tool = manager.createTool();
      const result = await tool.execute("tc1", {
        action: "progress" as const,
        sessionId: "nonexistent",
      });

      const parsed = JSON.parse(result.content[0].type === "text" ? result.content[0].text : "");
      expect(parsed.error).toContain("nonexistent");
    });

    it("respects limit parameter", async () => {
      const tool = manager.createTool();
      const sessionId = manager.run("researcher", "find papers");
      await manager.waitFor(sessionId);

      const result = await tool.execute("tc1", {
        action: "progress" as const,
        sessionId,
        limit: 1,
      });

      const parsed = JSON.parse(result.content[0].type === "text" ? result.content[0].text : "");
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeLessThanOrEqual(1);
    });
  });

  describe("action: result", () => {
    it("returns result for a completed session", async () => {
      const tool = manager.createTool();
      const sessionId = manager.run("researcher", "find papers");
      await manager.waitFor(sessionId);

      const result = await tool.execute("tc1", {
        action: "result" as const,
        sessionId,
      });

      const parsed = JSON.parse(result.content[0].type === "text" ? result.content[0].text : "");
      expect(parsed.sessionId).toBe(sessionId);
      expect(parsed.status).toBeDefined();
      expect(parsed.duration).toBeDefined();
      // Should not include full messages array
      expect(parsed.messages).toBeUndefined();
    });

    it("returns error for running session", async () => {
      const tool = manager.createTool();
      const sessionId = manager.run("researcher", "find papers");

      // Query immediately while still running (may or may not be running depending on speed)
      const result = await tool.execute("tc1", {
        action: "result" as const,
        sessionId,
      });

      const parsed = JSON.parse(result.content[0].type === "text" ? result.content[0].text : "");
      // Either returns error (still running) or a result (already done)
      if (parsed.error) {
        expect(parsed.error).toContain(sessionId);
      } else {
        expect(parsed.sessionId).toBe(sessionId);
      }

      await manager.waitFor(sessionId);
    });

    it("returns error for unknown session", async () => {
      const tool = manager.createTool();
      const result = await tool.execute("tc1", {
        action: "result" as const,
        sessionId: "nonexistent",
      });

      const parsed = JSON.parse(result.content[0].type === "text" ? result.content[0].text : "");
      expect(parsed.error).toContain("nonexistent");
    });
  });

  describe("action: cancel", () => {
    it("cancels a session and returns confirmation", async () => {
      const tool = manager.createTool();
      const sessionId = manager.run("researcher", "find papers");

      const result = await tool.execute("tc1", {
        action: "cancel" as const,
        sessionId,
      });

      const parsed = JSON.parse(result.content[0].type === "text" ? result.content[0].text : "");
      expect(parsed.cancelled).toBe(sessionId);

      await manager.waitFor(sessionId);
    });

    it("does not throw for unknown session", async () => {
      const tool = manager.createTool();
      const result = await tool.execute("tc1", {
        action: "cancel" as const,
        sessionId: "nonexistent",
      });

      const parsed = JSON.parse(result.content[0].type === "text" ? result.content[0].text : "");
      expect(parsed.cancelled).toBe("nonexistent");
    });
  });

  describe("without persistDir", () => {
    it("works without persistence", async () => {
      const mgr = new SubagentManager(); // no persistDir
      mgr.register({
        name: "ephemeral",
        description: "Test agent",
        domain: "test",
        systemPrompt: "You are a test.",
        model: fakeModel(),
        tools: [],
        apiKey: "fake-key",
      });

      const tool = mgr.createTool();

      // list
      const listResult = await tool.execute("tc1", { action: "list" as const });
      const agents = JSON.parse(listResult.content[0].type === "text" ? listResult.content[0].text : "");
      expect(agents).toHaveLength(1);
      expect(agents[0].name).toBe("ephemeral");

      // run
      const runResult = await tool.execute("tc2", {
        action: "run" as const,
        agent: "ephemeral",
        task: "do stuff",
      });
      const { sessionId } = JSON.parse(runResult.content[0].type === "text" ? runResult.content[0].text : "");
      expect(sessionId).toBeDefined();

      await mgr.waitFor(sessionId);

      // result
      const resultResult = await tool.execute("tc3", {
        action: "result" as const,
        sessionId,
      });
      const taskResult = JSON.parse(resultResult.content[0].type === "text" ? resultResult.content[0].text : "");
      expect(taskResult.sessionId).toBe(sessionId);
    });
  });

  describe("tool output format", () => {
    it("all actions return content with text type", async () => {
      const tool = manager.createTool();

      // list
      const listResult = await tool.execute("tc1", { action: "list" as const });
      expect(listResult.content).toHaveLength(1);
      expect(listResult.content[0].type).toBe("text");
      expect(listResult.details).toBeDefined();

      // run
      const runResult = await tool.execute("tc2", {
        action: "run" as const,
        agent: "researcher",
        task: "test",
      });
      expect(runResult.content).toHaveLength(1);
      expect(runResult.content[0].type).toBe("text");

      const { sessionId } = JSON.parse(runResult.content[0].type === "text" ? runResult.content[0].text : "");
      await manager.waitFor(sessionId);

      // status
      const statusResult = await tool.execute("tc3", {
        action: "status" as const,
        sessionId,
      });
      expect(statusResult.content).toHaveLength(1);
      expect(statusResult.content[0].type).toBe("text");

      // result
      const resultResult = await tool.execute("tc5", {
        action: "result" as const,
        sessionId,
      });
      expect(resultResult.content).toHaveLength(1);
      expect(resultResult.content[0].type).toBe("text");
    });
  });
});
