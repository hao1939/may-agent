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

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("cancel cascades parent → child", async () => {
    const parent = manager.run("agent", "parent task");
    const child = manager.run("agent", "child task", { parentSessionId: parent });

    manager.cancel(parent);

    const rc = await manager.waitFor(child);
    const rp = await manager.waitFor(parent);

    expect(["done", "error"]).toContain(rc.status);
    expect(["done", "error"]).toContain(rp.status);
  });

  it("cancel cascades grandparent → parent → child", async () => {
    const grandparent = manager.run("agent", "grandparent");
    const parent = manager.run("agent", "parent", { parentSessionId: grandparent });
    const child = manager.run("agent", "child", { parentSessionId: parent });

    manager.cancel(grandparent);

    const rc = await manager.waitFor(child);
    const rp = await manager.waitFor(parent);
    const rg = await manager.waitFor(grandparent);

    expect(["done", "error"]).toContain(rc.status);
    expect(["done", "error"]).toContain(rp.status);
    expect(["done", "error"]).toContain(rg.status);
  });

  it("cancel is no-op for already-completed children", async () => {
    const parent = manager.run("agent", "parent");
    const child = manager.run("agent", "child", { parentSessionId: parent });

    // Wait for child to finish naturally
    await manager.waitFor(child);

    // Cancel parent — child already done, should not error
    manager.cancel(parent);

    const rp = await manager.waitFor(parent);
    expect(["done", "error"]).toContain(rp.status);
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

describe("parentSessionId via createTool", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-parent-"));
    manager = new SubagentManager({ persistDir });
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

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("run action sets parentSessionId from getCallerSessionId", async () => {
    const callerSid = "caller_123";
    const tool = manager.createTool({
      getCallerSessionId: () => callerSid,
    });

    const result = await tool.execute("tc1", {
      action: "run" as const,
      agent: "worker",
      task: "do work",
    });

    const parsed = JSON.parse(result.content[0].type === "text" ? result.content[0].text : "");
    const sessionId = parsed.sessionId;

    const registry = (manager as any).registry.getRegistry();
    expect(registry.sessions[sessionId].parentSessionId).toBe(callerSid);

    await manager.waitFor(sessionId);
  });

  it("delegate action sets parentSessionId from getCallerSessionId", async () => {
    const callerSid = "caller_456";
    const tool = manager.createTool({
      getCallerSessionId: () => callerSid,
    });

    const result = await tool.execute("tc1", {
      action: "delegate" as const,
      agent: "worker",
      task: "do work",
    });

    const parsed = JSON.parse(result.content[0].type === "text" ? result.content[0].text : "");
    const sessionId = parsed.sessionId;

    const registry = (manager as any).registry.getRegistry();
    expect(registry.sessions[sessionId].parentSessionId).toBe(callerSid);
  });

  it("run without getCallerSessionId has no parentSessionId", async () => {
    const tool = manager.createTool();

    const result = await tool.execute("tc1", {
      action: "run" as const,
      agent: "worker",
      task: "do work",
    });

    const parsed = JSON.parse(result.content[0].type === "text" ? result.content[0].text : "");
    const sessionId = parsed.sessionId;

    const registry = (manager as any).registry.getRegistry();
    expect(registry.sessions[sessionId].parentSessionId).toBeUndefined();

    await manager.waitFor(sessionId);
  });

  it("onSessionStart fires for both run and delegate", async () => {
    const started: Array<{ agent: string; sessionId: string }> = [];
    const tool = manager.createTool({
      onSessionStart: (agent, sessionId) => {
        started.push({ agent, sessionId });
      },
    });

    const runResult = await tool.execute("tc1", {
      action: "run" as const,
      agent: "worker",
      task: "run task",
    });
    const runParsed = JSON.parse(runResult.content[0].type === "text" ? runResult.content[0].text : "");
    await manager.waitFor(runParsed.sessionId);

    const delegateResult = await tool.execute("tc2", {
      action: "delegate" as const,
      agent: "worker",
      task: "delegate task",
    });
    const delegateParsed = JSON.parse(delegateResult.content[0].type === "text" ? delegateResult.content[0].text : "");

    expect(started).toHaveLength(2);
    expect(started[0].sessionId).toBe(runParsed.sessionId);
    expect(started[1].sessionId).toBe(delegateParsed.sessionId);
  });
});
