import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../src/manager.js";
import {
  historyDir,
} from "../src/persistence.js";
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

function baseDef(name: string) {
  return {
    name,
    description: "Test agent",
    domain: "test",
    systemPrompt: "Test",
    model: fakeModel(),
    tools: [] as any[],
    apiKey: "fake-key",
  };
}

describe("Edge cases", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-edge-"));
    manager = new SubagentManager({ persistDir });
  });

  afterEach(() => {
    if (existsSync(persistDir)) {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  describe("re-registering an agent with the same name", () => {
    it("overwrites the definition silently", () => {
      manager.register(baseDef("agent-x"));
      manager.register({ ...baseDef("agent-x"), description: "Updated description" });

      const agents = manager.listAgents();
      expect(agents).toHaveLength(1);
      expect(agents[0].description).toBe("Updated description");
    });

    it("does not affect existing active sessions of the old definition", async () => {
      // Register, start a session, re-register with different config
      manager.register(baseDef("agent-y"));
      const sessionId = manager.run("agent-y", "task 1");

      // Re-register with a different model — session should still work
      manager.register({ ...baseDef("agent-y"), description: "New config" });

      // The active session should complete (will error due to fake model, but shouldn't crash)
      const result = await manager.waitFor(sessionId);
      expect(result).not.toBeNull();
      expect(result!.sessionId).toBe(sessionId);
    });
  });

  describe("result() edge cases", () => {
    it("throws for a session that was never created", () => {
      expect(() => manager.result("nonexistent-session")).toThrow('Session "nonexistent-session" not found');
    });

    it("throws for a still-running session", () => {
      manager.register(baseDef("agent-r"));
      const sessionId = manager.run("agent-r", "task");
      // Immediately check — session might still be running or already errored
      try {
        const result = manager.result(sessionId);
        // If it didn't throw, it already completed (errored due to fake model)
        expect(result.status).toBe("error");
      } catch (err: unknown) {
        expect((err as Error).message).toMatch(/still running/);
      }
    });
  });

  describe("progress() edge cases", () => {
    it("throws for non-existent session", () => {
      expect(() => manager.progress("nonexistent")).toThrow('Session "nonexistent" not found');
    });

    it("returns empty array for limit=0", async () => {
      manager.register(baseDef("agent-p"));
      const sessionId = manager.run("agent-p", "task");
      await manager.waitFor(sessionId);

      const messages = manager.progress(sessionId, 0);
      expect(messages).toEqual([]);
    });
  });

  describe("cancel() edge cases", () => {
    it("is a no-op for non-existent sessions", () => {
      // Should not throw
      expect(() => manager.cancel("nonexistent")).not.toThrow();
    });

    it("is a no-op for already-completed sessions", async () => {
      manager.register(baseDef("agent-c"));
      const sessionId = manager.run("agent-c", "task");
      await manager.waitFor(sessionId);

      // Session is done/error — cancel should be a no-op
      expect(() => manager.cancel(sessionId)).not.toThrow();
    });
  });

  describe("waitFor() edge cases", () => {
    it("throws for non-existent session", async () => {
      await expect(manager.waitFor("nonexistent")).rejects.toThrow('Session "nonexistent" not found');
    });

    it("multiple concurrent waitFor() calls on same session all resolve", async () => {
      manager.register(baseDef("agent-w"));
      const sessionId = manager.run("agent-w", "task");

      // Two concurrent waiters
      const [result1, result2] = await Promise.all([
        manager.waitFor(sessionId),
        manager.waitFor(sessionId),
      ]);

      expect(result1.sessionId).toBe(result2.sessionId);
    });
  });

  describe("status() with no sessions", () => {
    it("returns empty array when no sessions exist", () => {
      expect(manager.status()).toEqual([]);
    });
  });

  describe("run() with unregistered agent", () => {
    it("throws an Error with a useful message", () => {
      expect(() => manager.run("nonexistent", "task")).toThrow(
        'Agent "nonexistent" not registered',
      );
    });
  });

  describe("SubagentManager basics", () => {
    it("can run sessions", async () => {
      const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
      manager.register(baseDef("agent-np"));

      const sessionId = manager.run("agent-np", "task");
      const result = await manager.waitFor(sessionId);

      expect(result).not.toBeNull();
      expect(result!.sessionId).toBe(sessionId);
    });

    it("resume() returns empty array when no sessions to resume", () => {
      const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
      expect(manager.resume()).toEqual([]);
    });
  });

  describe("duration freezes at completion time", () => {
    it("result() returns the same duration string after a delay", async () => {
      manager.register(baseDef("agent-dur"));
      const sessionId = manager.run("agent-dur", "task");
      await manager.waitFor(sessionId);

      const result1 = manager.result(sessionId);

      // Wait 50ms and call result() again
      await new Promise((resolve) => setTimeout(resolve, 50));

      const result2 = manager.result(sessionId);

      expect(result1.duration).toBe(result2.duration);
    });
  });
});
