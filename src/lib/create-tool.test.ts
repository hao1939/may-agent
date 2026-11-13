/**
 * Agent discovery, bounded helper calls and their public tool contract.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "./manager.js";
import { closeDb } from "./db/connection.js";
import { upsertSession } from "./db/sessions.js";
import { loadAllSessionMetas } from "./persistence.js";
import { fakeModel } from "../../test/fixtures/model.js";

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
  expect(result.content).toHaveLength(1);
  expect(result.content[0]?.type).toBe("text");
  return JSON.parse(result.content[0]!.text!);
}

describe("createAgentsTool()", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-agents-tool-"));
    manager = new SubagentManager({ persistDir });
    registerTestAgents(manager);
  });

  afterEach(async () => {
    const sessions = manager.status();
    for (const s of sessions) manager.cancel(s.sessionId);
    await Promise.allSettled(sessions.map((s) => manager.waitFor(s.sessionId)));
    closeDb(persistDir);
    rmSync(persistDir, { recursive: true, force: true });
  });

  function startCaller(): string {
    manager = new SubagentManager({ persistDir, agentRunFactory: () => {
      const stopped = Promise.withResolvers<void>();
      const state = { messages: [] as any[] } as any;
      return {
        state,
        prompt: async (text: unknown) => {
          if (text === "hold caller") await stopped.promise;
          state.messages.push({ role: "assistant", content: [{ type: "text", text: "Fixture result" }] });
        },
        cancel: () => stopped.resolve(), waitForIdle: async () => undefined,
        followUp: () => undefined, continue: async () => undefined, steer: () => undefined,
        subscribe: () => () => undefined,
      };
    } });
    registerTestAgents(manager);
    return manager.run("writer", "hold caller");
  }

  describe("action: list", () => {
    it("returns all registered agents", async () => {
      const tool = manager.createAgentsTool();
      expect(tool.name).toBe("agents");
      expect(tool.label).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      const result = await tool.execute("tc1", { action: "list" });
      const parsed = parseResult(result);

      expect(parsed.agents).toHaveLength(2);
      const names = parsed.agents.map((a: any) => a.name);
      expect(names).toContain("researcher");
      expect(names).toContain("writer");
      expect(parsed.runningSessions).toEqual([]);
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

  describe("action: context", () => {
    it("returns persisted steps from the caller's workflow run", async () => {
      const callerSessionId = "caller-session";
      const workflowRunId = "workflow-run-1";
      manager.activeSessions.set(callerSessionId, { workflowRunId } as any);
      upsertSession(persistDir, {
        sessionId: "step-session-1",
        agent: "researcher",
        task: "inspect the implementation",
        status: "done",
        workflowRunId,
        stepLabel: "inspect",
        startedAt: 1,
        endedAt: 2,
        outcome: "implementation inspected",
      });
      upsertSession(persistDir, {
        sessionId: "current-running-step",
        agent: "writer",
        task: "current caller",
        status: "running",
        workflowRunId,
        startedAt: 3,
      });
      upsertSession(persistDir, {
        sessionId: "other-workflow-step",
        agent: "writer",
        task: "must not leak",
        status: "done",
        workflowRunId: "workflow-run-2",
        startedAt: 4,
      });

      const tool = manager.createAgentsTool({ getCallerSessionId: () => callerSessionId });
      const result = await tool.execute("tc-context-workflow", { action: "context", scope: "workflow" });
      manager.activeSessions.delete(callerSessionId);

      expect(parseResult(result)).toEqual({
        scope: "workflow",
        workflowRunId,
        steps: [{ step: "inspect", sessionId: "step-session-1", summary: "done: implementation inspected" }],
      });
    });
  });

  describe("action: call", () => {
    it("runs agent to completion and returns result", async () => {
      const caller = startCaller();
      const tool = manager.createAgentsTool({ getCallerSessionId: () => caller });
      const result = await tool.execute("tc1", {
        action: "call",
        agent: "researcher",
        task: "find papers on RL",
      });

      const parsed = parseResult(result);
      expect(parsed.sessionId).toBeDefined();
      expect(parsed.status).toBe("done");
      expect(parsed.summary).toBe("Fixture result");
      expect(parsed.id).toBe(parsed.sessionId);
      expect(parsed.kind).toBe("agent");
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
      expect(parsed.error).toContain('Agent "nonexistent" not registered');
    });

    it("returns error when agent/task missing", async () => {
      const tool = manager.createAgentsTool();
      const result = await tool.execute("tc1", { action: "call" });
      const parsed = parseResult(result);
      expect(parsed.error).toContain("requires");
    });
  });

  describe("action: message", () => {
    it("rejects both removed actions before validation or agent lookup", async () => {
      const deprecation = "agents.message and agents.send actions have been removed";
      const tool = manager.createAgentsTool();
      for (const action of ["message", "send"]) {
        const result = parseResult(await tool.execute("removed", { action, agent: "nonexistent" }));
        expect(result).toEqual({ error: expect.stringContaining(deprecation) });
        expect(result.error).toContain("Use the message tool");
        expect(result.error).toContain("Durable work belongs to an App Task");
      }
    });
  });

  describe("action: peek", () => {
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
      expect(parsed).toMatchObject({ accepted: true, sessionId, method: "local" });

      await manager.waitFor(sessionId);
    });

    it("does not throw for unknown session", async () => {
      const tool = manager.createAgentsTool();
      const result = await tool.execute("tc1", {
        action: "cancel",
        sessionId: "nonexistent",
      });

      const parsed = parseResult(result);
      expect(parsed.error).toContain("not known");
      expect(parsed.cancelled).toBeUndefined();
    });
  });

  describe("callDeny", () => {
    it.each(["call", "fork"] as const)("blocks %s before starting a denied helper", async (action) => {
      const caller = startCaller();
      const before = structuredClone(loadAllSessionMetas(persistDir));
      const tool = manager.createAgentsTool({
        getCallerSessionId: () => caller,
        callDeny: { agents: ["researcher"], hint: "Use workflow instead." },
      });
      const result = await tool.execute("tc1", {
        action,
        agent: "researcher",
        task: "find papers",
      });
      const parsed = parseResult(result);
      expect(parsed.error).toContain(`Cannot ${action}`);
      expect(parsed.error).toContain("researcher");
      expect(parsed.error).toContain("Use workflow instead.");
      expect(parsed.sessionId).toBeUndefined();
      expect(manager.status().map((session) => session.sessionId)).toEqual([caller]);
      expect(loadAllSessionMetas(persistDir)).toEqual(before);
    });

    it("allows call to non-denied agent", async () => {
      const caller = startCaller();
      const tool = manager.createAgentsTool({
        getCallerSessionId: () => caller,
        callDeny: { agents: ["researcher"], hint: "Use workflow instead." },
      });
      const result = await tool.execute("tc1", {
        action: "call",
        agent: "writer",
        task: "write something",
      });
      const parsed = parseResult(result);
      expect(parsed.sessionId).toBeDefined();
      expect(parsed.status).toBe("done");
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
  let persistDir: string;
  let manager: SubagentManager;
  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-list-agents-"));
    manager = new SubagentManager({ persistDir });
  });
  afterEach(() => {
    closeDb(persistDir);
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("returns empty array when no agents registered", () => {
    expect(manager.listAgents()).toEqual([]);
  });

  it("returns correct { name, description, domain } for registered agents", () => {
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
});
