import { describe, it, expect } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { SubagentManager } from "./manager.js";
import { eventData, EventBus } from "../app/event-bus.js";
import type { Model } from "@earendil-works/pi-ai";

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
  it("registers live state before publishing session.start", () => {
    const bus = new EventBus();
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")), bus });
    registerAgent(manager, "alpha");
    let activeAtStart = false;
    bus.subscribe((event) => {
      if (event.type === "session.start") {
        activeAtStart = manager.hasActiveSession(String(eventData(event).sessionId));
      }
    });

    const sessionId = manager.run("alpha", "do something");
    expect(activeAtStart).toBe(true);
    manager.cancel(sessionId);
  });

  it("rolls back live state when durable session.start persistence fails", () => {
    const bus = new EventBus();
    bus.setPersistenceSubscriber((event) => {
      if (event.type === "session.start") throw new Error("disk unavailable");
    });
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")), bus });
    registerAgent(manager, "alpha");

    expect(() => manager.run("alpha", "do something")).toThrow("disk unavailable");
    expect(manager.getSessionCount()).toBe(0);
  });

  it("returns 0 when no sessions have been created", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    expect(manager.getSessionCount()).toBe(0);
  });

  it("returns 1 after a single session is started", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    registerAgent(manager, "alpha");
    manager.run("alpha", "do something");
    expect(manager.getSessionCount()).toBe(1);
  });

  it("completed sessions are removed from active count", async () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
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
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
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
