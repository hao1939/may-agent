import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SubagentManager } from "../src/index.js";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Registry } from "../src/persistence.js";
import type { Model } from "@mariozechner/pi-ai";

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

  it("creates registry.json on register", () => {
    const manager = new SubagentManager({ persistDir });

    manager.register({
      name: "test-agent",
      description: "A test agent",
      domain: "testing",
      systemPrompt: "You are a test agent.",
      model: fakeModel(),
      tools: [],
    });

    const registryPath = join(persistDir, "registry.json");
    expect(existsSync(registryPath)).toBe(true);

    const registry: Registry = JSON.parse(readFileSync(registryPath, "utf-8"));
    expect(registry.agents["test-agent"]).toBeDefined();
    expect(registry.agents["test-agent"].name).toBe("test-agent");
    expect(registry.agents["test-agent"].description).toBe("A test agent");
    expect(registry.agents["test-agent"].domain).toBe("testing");
    expect(registry.agents["test-agent"].systemPrompt).toBe("You are a test agent.");
    expect(registry.agents["test-agent"].model).toEqual({ provider: "anthropic", id: "test-model" });
  });

  it("persists new fields (domain, systemPromptFiles, workspace, timeoutMs, memoryLimit)", () => {
    const manager = new SubagentManager({ persistDir });

    manager.register({
      name: "full-agent",
      description: "Full config agent",
      domain: "research",
      systemPromptFiles: ["/path/to/knowledge.md", "/path/to/tools/INDEX.md"],
      workspace: "/path/to/workspace",
      model: fakeModel(),
      tools: [],
      timeoutMs: 600000,
      memoryLimit: 30,
    });

    const registryPath = join(persistDir, "registry.json");
    const registry: Registry = JSON.parse(readFileSync(registryPath, "utf-8"));
    const agent = registry.agents["full-agent"];
    expect(agent.domain).toBe("research");
    expect(agent.systemPromptFiles).toEqual(["/path/to/knowledge.md", "/path/to/tools/INDEX.md"]);
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

    const registryPath = join(persistDir, "registry.json");
    const registry: Registry = JSON.parse(readFileSync(registryPath, "utf-8"));
    expect(Object.keys(registry.agents)).toHaveLength(2);
    expect(registry.agents["agent-a"].description).toBe("First agent");
    expect(registry.agents["agent-b"].description).toBe("Second agent");
  });

  it("loads existing registry on construction", () => {
    // First manager writes
    const manager1 = new SubagentManager({ persistDir });
    manager1.register({
      name: "persisted-agent",
      description: "Survives restart",
      domain: "persistence",
      systemPrompt: "I persist",
      model: fakeModel(),
      tools: [],
    });

    // Second manager reads from same persistDir
    const manager2 = new SubagentManager({ persistDir });
    // Registry should have the agent from manager1
    // (The agent is in registry.json; we verify by registering another and checking both exist)
    manager2.register({
      name: "new-agent",
      description: "Added after restart",
      domain: "new",
      systemPrompt: "I am new",
      model: fakeModel(),
      tools: [],
    });

    const registryPath = join(persistDir, "registry.json");
    const registry: Registry = JSON.parse(readFileSync(registryPath, "utf-8"));
    expect(registry.agents["persisted-agent"]).toBeDefined();
    expect(registry.agents["new-agent"]).toBeDefined();
  });

  it("records session in registry on run and updates on completion", async () => {
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

    // Session should be recorded immediately as running
    const registryPath = join(persistDir, "registry.json");
    const registryBefore: Registry = JSON.parse(readFileSync(registryPath, "utf-8"));
    expect(registryBefore.sessions[sessionId]).toBeDefined();
    expect(registryBefore.sessions[sessionId].status).toBe("running");
    expect(registryBefore.sessions[sessionId].agent).toBe("runner");
    expect(registryBefore.sessions[sessionId].task).toBe("do something");

    // Wait for it to complete (fake model — will end as done or error)
    await manager.waitFor(sessionId);

    // Session status should be updated to a terminal state
    const registryAfter: Registry = JSON.parse(readFileSync(registryPath, "utf-8"));
    expect(["done", "error"]).toContain(registryAfter.sessions[sessionId].status);
    expect(registryAfter.sessions[sessionId].endedAt).toBeDefined();
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

    const registryPath = join(persistDir, "registry.json");
    const registry: Registry = JSON.parse(readFileSync(registryPath, "utf-8"));
    const agent = registry.agents["minimal"];
    expect(agent.domain).toBe("minimal");
    expect(agent.systemPrompt).toBeUndefined();
    expect(agent.systemPromptFiles).toBeUndefined();
    expect(agent.workspace).toBeUndefined();
    expect(agent.timeoutMs).toBeUndefined();
    expect(agent.memoryLimit).toBeUndefined();
  });
});
