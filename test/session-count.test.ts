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

describe("SubagentManager.getSessionCount()", () => {
  it("returns 0 when no sessions have been created", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")), infraRetryMax: 0 });
    expect(manager.getSessionCount()).toBe(0);
  });

  it("returns 1 after a single session is started", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")), infraRetryMax: 0 });
    registerAgent(manager, "alpha");
    manager.run("alpha", "do something");
    expect(manager.getSessionCount()).toBe(1);
  });

  it("completed sessions are removed from active count", async () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")), infraRetryMax: 0 });
    registerAgent(manager, "alpha");

    const s1 = manager.run("alpha", "task one");
    expect(manager.getSessionCount()).toBe(1);

    await manager.waitFor(s1);

    // s1 completed and was removed from activeSessions
    expect(manager.getSessionCount()).toBe(0);

    // Start a second session
    const s2 = manager.run("alpha", "task two");
    expect(manager.getSessionCount()).toBe(1);

    await manager.waitFor(s2);
    expect(manager.getSessionCount()).toBe(0);
  });

  it("counts only running sessions across multiple agents", async () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")), infraRetryMax: 0 });
    registerAgent(manager, "alpha");
    registerAgent(manager, "beta");

    const s1 = manager.run("alpha", "alpha task");
    const s2 = manager.run("beta", "beta task");
    const s3 = manager.run("alpha", "another alpha task");

    expect(manager.getSessionCount()).toBe(3);

    await manager.waitFor(s1);
    await manager.waitFor(s2);
    await manager.waitFor(s3);

    // All completed — removed from active sessions
    expect(manager.getSessionCount()).toBe(0);
  });
});
