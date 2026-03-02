import { describe, it, expect } from "vitest";
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

describe("SubagentManager.getSessionCount()", () => {
  it("returns 0 when no sessions have been created", () => {
    const manager = new SubagentManager();
    expect(manager.getSessionCount()).toBe(0);
  });

  it("returns 1 after a single session is started", () => {
    const manager = new SubagentManager();
    registerAgent(manager, "alpha");
    manager.run("alpha", "do something");
    expect(manager.getSessionCount()).toBe(1);
  });

  it("counts completed sessions as well as active ones", async () => {
    const manager = new SubagentManager();
    registerAgent(manager, "alpha");

    const s1 = manager.run("alpha", "task one");
    await manager.waitFor(s1);

    // s1 is now completed but should still be counted
    expect(manager.getSessionCount()).toBe(1);

    // Start a second session — total should be 2
    const s2 = manager.run("alpha", "task two");
    expect(manager.getSessionCount()).toBe(2);

    await manager.waitFor(s2);
    expect(manager.getSessionCount()).toBe(2);
  });

  it("counts sessions across multiple agents", async () => {
    const manager = new SubagentManager();
    registerAgent(manager, "alpha");
    registerAgent(manager, "beta");

    const s1 = manager.run("alpha", "alpha task");
    const s2 = manager.run("beta", "beta task");
    const s3 = manager.run("alpha", "another alpha task");

    expect(manager.getSessionCount()).toBe(3);

    await manager.waitFor(s1);
    await manager.waitFor(s2);
    await manager.waitFor(s3);

    // All completed — count should still be 3
    expect(manager.getSessionCount()).toBe(3);
  });
});
