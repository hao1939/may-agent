import { describe, it, expect } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
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

function registerAgent(manager: SubagentManager, name: string) {
  manager.register({
    name,
    description: `${name} description`,
    domain: "test",
    systemPrompt: "You are a test agent.",
    model: fakeModel(),
    tools: [],
    apiKey: "fake-key",
  });
}

describe("SubagentManager.listAgentNames()", () => {
  it("returns an empty array when no agents are registered", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    expect(manager.listAgentNames()).toEqual([]);
  });

  it("returns a single name after one registration", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    registerAgent(manager, "alpha");
    expect(manager.listAgentNames()).toEqual(["alpha"]);
  });

  it("returns all names after multiple registrations", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    registerAgent(manager, "alpha");
    registerAgent(manager, "beta");
    registerAgent(manager, "gamma");
    expect(manager.listAgentNames()).toEqual(["alpha", "beta", "gamma"]);
  });

  it("returns string[] (every element is a string)", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    registerAgent(manager, "agent-1");
    registerAgent(manager, "agent-2");
    const names = manager.listAgentNames();
    for (const name of names) {
      expect(typeof name).toBe("string");
    }
  });

  it("reflects the latest registration when an agent is re-registered", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    registerAgent(manager, "alpha");
    registerAgent(manager, "beta");
    // Re-register alpha — Map.set replaces the value but key order is preserved
    registerAgent(manager, "alpha");
    const names = manager.listAgentNames();
    // "alpha" should appear exactly once (Map keys are unique)
    expect(names.filter((n) => n === "alpha")).toHaveLength(1);
    expect(names).toContain("alpha");
    expect(names).toContain("beta");
  });

  it("is consistent with listAgents() names", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    registerAgent(manager, "x");
    registerAgent(manager, "y");
    const names = manager.listAgentNames();
    const agentObjects = manager.listAgents();
    expect(names).toEqual(agentObjects.map((a) => a.name));
  });
});
