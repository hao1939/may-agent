import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { SubagentManager } from "../../src/lib/index.js";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readSessionMeta } from "../../src/lib/persistence.js";
import { Type, type Model } from "@earendil-works/pi-ai";

// Minimal fake model that satisfies the Model interface
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

describe("Registry persistence", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-agent-test-"));
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("stores agent config in-memory on register", () => {
    const manager = new SubagentManager({ persistDir });

    manager.register({
      name: "test-agent",
      description: "A test agent",
      domain: "testing",
      systemPrompt: "You are a test agent.",
      model: fakeModel(),
      tools: [],
    });

    // Agent config is in-memory — no registry.json on disk
    expect(existsSync(join(persistDir, "registry.json"))).toBe(false);
    // But getRegistry() returns the agent
    const registry = (manager as any).registry.getRegistry();
    expect(registry.agents["test-agent"]).toBeDefined();
    expect(registry.agents["test-agent"].name).toBe("test-agent");
    expect(registry.agents["test-agent"].description).toBe("A test agent");
    expect(registry.agents["test-agent"].domain).toBe("testing");
    expect(registry.agents["test-agent"].systemPrompt).toBe("You are a test agent.");
    expect(registry.agents["test-agent"].model).toEqual({ provider: "anthropic", id: "test-model" });
  });

  it("persists fields (domain, workspace, timeoutMs, memoryLimit)", () => {
    const manager = new SubagentManager({ persistDir });

    manager.register({
      name: "full-agent",
      description: "Full config agent",
      domain: "research",
      workspace: "/path/to/workspace",
      model: fakeModel(),
      tools: [],
      timeoutMs: 600000,
      memoryLimit: 30,
    });

    const registry = (manager as any).registry.getRegistry();
    const agent = registry.agents["full-agent"];
    expect(agent.domain).toBe("research");
    expect(agent.workspace).toBe("/path/to/workspace");
    expect(agent.timeoutMs).toBe(600000);
    expect(agent.memoryLimit).toBe(30);
  });

  it("persists multiple agents", () => {
    const manager = new SubagentManager({ persistDir });

    manager.register({
      name: "agent-a",
      description: "First agent",
      domain: "domain-a",
      systemPrompt: "Prompt A",
      model: fakeModel(),
      tools: [],
    });

    manager.register({
      name: "agent-b",
      description: "Second agent",
      domain: "domain-b",
      systemPrompt: "Prompt B",
      model: fakeModel(),
      tools: [],
    });

    const registry = (manager as any).registry.getRegistry();
    expect(Object.keys(registry.agents)).toHaveLength(2);
    expect(registry.agents["agent-a"].description).toBe("First agent");
    expect(registry.agents["agent-b"].description).toBe("Second agent");
  });

  it("agent configs are in-memory only — not shared across instances", () => {
    // First manager registers
    const manager1 = new SubagentManager({ persistDir });
    manager1.register({
      name: "persisted-agent",
      description: "Survives restart",
      domain: "persistence",
      systemPrompt: "I persist",
      model: fakeModel(),
      tools: [],
    });

    // Second manager reads from same persistDir — agents are in-memory only
    const manager2 = new SubagentManager({ persistDir });
    const registry2 = (manager2 as any).registry.getRegistry();
    // Agent configs don't survive restart (by design — re-registered on every startup)
    expect(registry2.agents["persisted-agent"]).toBeUndefined();

    // But once registered again, it's available
    manager2.register({
      name: "persisted-agent",
      description: "Survives restart",
      domain: "persistence",
      systemPrompt: "I persist",
      model: fakeModel(),
      tools: [],
    });
    const registry2b = (manager2 as any).registry.getRegistry();
    expect(registry2b.agents["persisted-agent"]).toBeDefined();
  });

  it("records session as meta.json on run and updates on completion", async () => {
    const manager = new SubagentManager({ persistDir });

    manager.register({
      name: "runner",
      description: "Runs tasks",
      domain: "running",
      systemPrompt: "You are a runner.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });

    const sessionId = manager.run("runner", "do something");

    // Session should have a meta.json immediately
    const metaBefore = readSessionMeta(persistDir, sessionId);
    expect(metaBefore).toBeDefined();
    expect(metaBefore!.status).toBe("running");
    expect(metaBefore!.agent).toBe("runner");
    expect(metaBefore!.task).toBe("do something");

    // Wait for it to complete (fake model — will end as done or error)
    await manager.waitFor(sessionId);

    // Session meta.json should be updated (may be in history now)
    const metaAfter = readSessionMeta(persistDir, sessionId);
    expect(metaAfter).toBeDefined();
    expect(["done", "error"]).toContain(metaAfter!.status);
    expect(metaAfter!.endedAt).toBeDefined();
  });

  it("persists the workflow finish requirement and output schema for recovery", async () => {
    const manager = new SubagentManager({ persistDir });
    manager.register({
      name: "workflow-worker",
      description: "Runs structured workflow steps",
      domain: "workflow",
      systemPrompt: "Complete the workflow step.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });
    const outputSchema = Type.Object({ verdict: Type.Union([Type.Literal("pass"), Type.Literal("fail")]) });

    const sessionId = manager.run("workflow-worker", "review", { requireFinish: true, outputSchema });
    const meta = readSessionMeta(persistDir, sessionId);

    expect(meta?.requireFinish).toBe(true);
    expect(meta?.outputSchema).toMatchObject({ type: "object" });

    manager.cancel(sessionId);
    await manager.waitFor(sessionId);
  });

  it("works with a fresh persistDir (no prior state)", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });

    // Should work fine, just no file created
    manager.register({
      name: "ephemeral",
      description: "No persistence",
      domain: "ephemeral",
      systemPrompt: "Temp",
      model: fakeModel(),
      tools: [],
    });

    const status = manager.status();
    expect(status).toEqual([]);
  });

  it("does not persist optional fields when not provided", () => {
    const manager = new SubagentManager({ persistDir });

    manager.register({
      name: "minimal",
      description: "Minimal agent",
      domain: "minimal",
      model: fakeModel(),
      tools: [],
    });

    const registry = (manager as any).registry.getRegistry();
    const agent = registry.agents["minimal"];
    expect(agent.domain).toBe("minimal");
    expect(agent.systemPrompt).toBeUndefined();
    expect(agent.workspace).toBeUndefined();
    expect(agent.timeoutMs).toBeUndefined();
    expect(agent.memoryLimit).toBeUndefined();
  });
});
