import { describe, it, expect } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
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

describe("SubagentManager.agentCount()", () => {
  it("returns 0 when no agents are registered", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")), infraRetryMax: 0 });
    expect(manager.agentCount()).toBe(0);
  });

  it("returns the correct count after registering multiple agents", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")), infraRetryMax: 0 });
    registerAgent(manager, "alpha");
    expect(manager.agentCount()).toBe(1);

    registerAgent(manager, "beta");
    expect(manager.agentCount()).toBe(2);

    registerAgent(manager, "gamma");
    expect(manager.agentCount()).toBe(3);
  });

  it("does not double-count when re-registering the same agent name", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")), infraRetryMax: 0 });
    registerAgent(manager, "alpha");
    registerAgent(manager, "alpha");
    expect(manager.agentCount()).toBe(1);

    registerAgent(manager, "beta");
    expect(manager.agentCount()).toBe(2);
  });
});
