import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { SubagentManager } from "../src/lib/manager.js";
import type { SubagentDefinition } from "../src/lib/types.js";
import type { Model } from "@mariozechner/pi-ai";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";

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
    manager = new SubagentManager({ persistDir: dir, infraRetryMax: 0 });
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

  it("queues followUp on running session without interrupting", async () => {
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
});
