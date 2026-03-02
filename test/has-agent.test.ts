import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
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

describe("SubagentManager.hasAgent()", () => {
  it("returns false when no agents are registered", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    expect(manager.hasAgent("anything")).toBe(false);
  });

  it("returns true for a registered agent and false for an unregistered one", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    registerAgent(manager, "alpha");
    registerAgent(manager, "beta");

    expect(manager.hasAgent("alpha")).toBe(true);
    expect(manager.hasAgent("beta")).toBe(true);
    expect(manager.hasAgent("gamma")).toBe(false);
  });

  it("returns true after re-registering an agent", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    registerAgent(manager, "alpha");
    expect(manager.hasAgent("alpha")).toBe(true);

    // Re-register the same name — should still be found
    registerAgent(manager, "alpha");
    expect(manager.hasAgent("alpha")).toBe(true);
  });
});
