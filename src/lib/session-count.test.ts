import { afterEach, describe, it, expect } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { SubagentManager } from "./manager.js";
import { closeDb } from "./requests.js";
import { eventData, EventBus } from "../app/event-bus.js";
import { fakeModel } from "../../test/fixtures/model.js";

const fixtures: Array<{ root: string; manager: SubagentManager }> = [];
function createManager(bus?: EventBus) {
  const root = mkdtempSync(join(tmpdir(), "manager-count-"));
  const manager = new SubagentManager({ persistDir: root, bus });
  fixtures.push({ root, manager });
  return manager;
}
afterEach(async () => {
  for (const { root, manager } of fixtures.splice(0)) {
    const sessions = manager.status().filter((s) => manager.hasActiveSession(s.sessionId));
    for (const session of sessions) manager.cancel(session.sessionId);
    try {
      await Promise.all(sessions.map((s) => manager.waitFor(s.sessionId)));
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  }
});

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
    const manager = createManager(bus);
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
    const manager = createManager(bus);
    registerAgent(manager, "alpha");

    expect(() => manager.run("alpha", "do something")).toThrow("disk unavailable");
    expect(manager.getSessionCount()).toBe(0);
  });

  it("returns 0 when no sessions have been created", () => {
    const manager = createManager();
    expect(manager.getSessionCount()).toBe(0);
  });

  it("returns 1 after a single session is started", () => {
    const manager = createManager();
    registerAgent(manager, "alpha");
    manager.run("alpha", "do something");
    expect(manager.getSessionCount()).toBe(1);
  });

  it("completed sessions are removed from active count", async () => {
    const manager = createManager();
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
    const manager = createManager();
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
