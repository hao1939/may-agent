import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "./manager.js";
import { fakeModel } from "../../test/fixtures/model.js";
import { closeDb } from "./requests.js";

describe("cascading cancel", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-cascade-"));
    manager = new SubagentManager({ persistDir });
    manager.register({
      name: "agent",
      description: "Test agent",
      domain: "test",
      systemPrompt: "Test",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });
  });

  afterEach(async () => {
    const sessions = manager.status();
    for (const session of sessions) manager.cancel(session.sessionId);
    await Promise.allSettled(sessions.map((session) => manager.waitFor(session.sessionId)));
    closeDb(persistDir);
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("cancel cascades parent → child", async () => {
    const parent = manager.run("agent", "parent task");
    const child = manager.run("agent", "child task", { parentSessionId: parent });

    manager.cancel(parent);

    const rc = await manager.waitFor(child);
    const rp = await manager.waitFor(parent);

    expect(["done", "error", "interrupted"]).toContain(rc.status);
    expect(["done", "error", "interrupted"]).toContain(rp.status);
  });

  it("cancel cascades grandparent → parent → child", async () => {
    const grandparent = manager.run("agent", "grandparent");
    const parent = manager.run("agent", "parent", { parentSessionId: grandparent });
    const child = manager.run("agent", "child", { parentSessionId: parent });

    manager.cancel(grandparent);

    const rc = await manager.waitFor(child);
    const rp = await manager.waitFor(parent);
    const rg = await manager.waitFor(grandparent);

    expect(["done", "error", "interrupted"]).toContain(rc.status);
    expect(["done", "error", "interrupted"]).toContain(rp.status);
    expect(["done", "error", "interrupted"]).toContain(rg.status);
  });

  it("cancel is no-op for already-completed children", async () => {
    const parent = manager.run("agent", "parent");
    const child = manager.run("agent", "child", { parentSessionId: parent });

    // Wait for child to finish naturally
    await manager.waitFor(child);

    // Cancel parent — child already done, should not error
    manager.cancel(parent);

    const rp = await manager.waitFor(parent);
    expect(["done", "error", "interrupted"]).toContain(rp.status);
  });

  it("cancel does not affect unrelated sessions", async () => {
    const target = manager.run("agent", "target");
    const unrelated = manager.run("agent", "unrelated"); // no parentSessionId

    manager.cancel(target);
    await manager.waitFor(target);

    const result = await manager.waitFor(unrelated);
    expect(result).toBeDefined();
    expect(result.sessionId).toBe(unrelated);
  });
});

describe("parentSessionId via createAgentsTool", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-parent-"));
    manager = new SubagentManager({ persistDir, agentRunFactory: () => {
      const stopped = Promise.withResolvers<void>();
      const state = { messages: [] as any[] } as any;
      return {
        state,
        prompt: async (text: unknown) => {
          if (text === "caller") await stopped.promise;
          state.messages.push({ role: "assistant", content: [{ type: "text", text: "Fixture result" }] });
        },
        cancel: () => stopped.resolve(), waitForIdle: async () => undefined,
        followUp: () => undefined, continue: async () => undefined, steer: () => undefined,
        subscribe: () => () => undefined,
      };
    } });
    manager.register({
      name: "worker",
      description: "Worker agent",
      domain: "test",
      systemPrompt: "Test",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });
  });

  afterEach(async () => {
    const sessions = manager.status();
    for (const session of sessions) manager.cancel(session.sessionId);
    await Promise.allSettled(sessions.map((session) => manager.waitFor(session.sessionId)));
    closeDb(persistDir);
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("call action sets parentSessionId from getCallerSessionId", async () => {
    const callerSid = manager.run("worker", "caller");
    const tool = manager.createAgentsTool({
      getCallerSessionId: () => callerSid,
    });

    const result = await tool.execute("tc1", {
      action: "call",
      agent: "worker",
      task: "do work",
    });

    const parsed = JSON.parse(result.content[0].type === "text" ? result.content[0].text : "");
    const sessionId = parsed.sessionId;

    const registry = (manager as any).registry.getRegistry();
    expect(registry.sessions[sessionId].parentSessionId).toBe(callerSid);
  });

  it("call action inherits workflowRunId and projectId from the caller session", async () => {
    const callerSid = manager.run("worker", "caller", {
      workflowRunId: "wr_project",
      projectId: "scout/scout-second-brain-learning",
    });
    const tool = manager.createAgentsTool({
      getCallerSessionId: () => callerSid,
    });

    const result = await tool.execute("tc1", {
      action: "call",
      agent: "worker",
      task: "do work",
    });

    const parsed = JSON.parse(result.content[0].type === "text" ? result.content[0].text : "");
    const sessionId = parsed.sessionId;

    const registry = (manager as any).registry.getRegistry();
    expect(registry.sessions[sessionId].parentSessionId).toBe(callerSid);
    expect(registry.sessions[sessionId].workflowRunId).toBe("wr_project");
    expect(registry.sessions[sessionId].projectId).toBe("scout/scout-second-brain-learning");
  });

  it("fork action sets parentSessionId and inherits workflow/project lineage", async () => {
    const callerSid = manager.run("worker", "caller", {
      workflowRunId: "wr_fork_project",
      projectId: "scout/scout-second-brain-learning",
    });
    const tool = manager.createAgentsTool({
      getCallerSessionId: () => callerSid,
    });

    const result = await tool.execute("tc1", {
      action: "fork",
      agent: "worker",
      task: "do async work",
    });

    const parsed = JSON.parse(result.content[0].type === "text" ? result.content[0].text : "");
    const sessionId = parsed.sessionId;

    const registry = (manager as any).registry.getRegistry();
    expect(registry.sessions[sessionId].parentSessionId).toBe(callerSid);
    expect(registry.sessions[sessionId].workflowRunId).toBe("wr_fork_project");
    expect(registry.sessions[sessionId].projectId).toBe("scout/scout-second-brain-learning");
  });

  it("call without a live caller is rejected without starting a session", async () => {
    const tool = manager.createAgentsTool();

    const result = await tool.execute("tc1", {
      action: "call",
      agent: "worker",
      task: "do work",
    });

    const parsed = JSON.parse(result.content[0].type === "text" ? result.content[0].text : "");
    expect(parsed.error).toContain("live caller");
    expect(manager.status()).toEqual([]);
  });
});
