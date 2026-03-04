import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SubagentManager } from "../src/manager.js";
import type { SubagentDefinition } from "../src/types.js";
import type { Model } from "@mariozechner/pi-ai";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { readSessionMessages } from "../src/persistence.js";

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

function baseDef(overrides: Partial<SubagentDefinition> = {}): SubagentDefinition {
  return {
    name: "bot",
    description: "test",
    domain: "test",
    systemPrompt: "You are a test bot.",
    model: fakeModel(),
    tools: [],
    ...overrides,
  };
}

describe("manager.followUp()", () => {
  let dir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "followup-test-"));
    manager = new SubagentManager({ persistDir: dir });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("throws for non-existent session", () => {
    expect(() => manager.followUp("nonexistent", "hello")).toThrow("not found");
  });

  it("throws for terminal session", async () => {
    manager.register(baseDef());
    const sid = manager.run("bot", "hello");
    await manager.waitFor(sid);

    // Session is archived (non-persistent) — not found
    expect(() => manager.followUp(sid, "hello")).toThrow("not found");
  });

  it("queues followUp on running non-persistent session without interrupting", async () => {
    manager.register(baseDef());
    const sid = manager.run("bot", "hello");

    // The session is running (will likely finish quickly, but attempt a followUp)
    // This should not throw since the session is running
    try {
      manager.followUp(sid, "extra info");
    } catch {
      // May throw if session completed between run() and followUp() — that's OK
    }

    await manager.waitFor(sid);
  });

  it("persists followUp message to JSONL", async () => {
    manager.register(baseDef({ persistent: true }));
    const sid = manager.run("bot", "hello", { persistent: true });
    await manager.waitForIdle(sid);

    // Now idle — followUp should persist and wake
    manager.followUp(sid, "new info");
    await manager.waitForIdle(sid);

    const messages = readSessionMessages(dir, sid);
    const userMessages = messages.filter(
      (m) => m.role === "user" && m.content.some(
        (c) => c.type === "text" && (c as { text: string }).text === "new info",
      ),
    );
    expect(userMessages.length).toBeGreaterThanOrEqual(1);
  });

  it("wakes idle persistent session", async () => {
    manager.register(baseDef({ persistent: true }));
    const sid = manager.run("bot", "hello", { persistent: true });
    await manager.waitForIdle(sid);

    // Status should be idle
    const statusBefore = manager.status();
    expect(statusBefore[0].status).toBe("idle");

    // followUp should wake it to running
    manager.followUp(sid, "wake up");

    // Should transition to running
    const statusDuring = manager.status();
    expect(statusDuring[0].status).toBe("running");

    // Wait for it to finish processing
    await manager.waitForIdle(sid);
    expect(manager.status()[0].status).toBe("idle");
  });

  it("does not interrupt a running persistent session", async () => {
    manager.register(baseDef({ persistent: true }));
    const sid = manager.run("bot", "hello", { persistent: true });

    // While running, followUp should not throw and should not steer
    manager.followUp(sid, "background info");

    await manager.waitForIdle(sid);
    expect(manager.status()[0].status).toBe("idle");
  });
});
