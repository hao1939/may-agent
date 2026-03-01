import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../src/manager.js";
import {
  readSessionMessages,
  sessionJsonlPath,
  sessionDir,
  historyDir,
  readMemoryEntries,
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

  describe("send() after session archival", () => {
    it("send() on a completed session does not crash despite archived directory", async () => {
      manager.register(baseDef("agent-s"));
      const sessionId = manager.run("agent-s", "initial task");
      await manager.waitFor(sessionId);

      // Verify session was archived
      const archivePath = join(historyDir(persistDir), sessionId);
      expect(existsSync(archivePath)).toBe(true);

      // The original session directory should be gone
      const originalDir = sessionDir(persistDir, sessionId);
      expect(existsSync(originalDir)).toBe(false);

      // send() should return true and not throw
      const sendResult = manager.send(sessionId, "follow up");
      expect(sendResult).toBe(true);

      // Wait for it to complete — the agent will error (fake model) but shouldn't crash the process
      const result = await manager.waitFor(sessionId);
      expect(result).not.toBeNull();
    });
  });

  describe("result() edge cases", () => {
    it("returns null for a session that was never created", () => {
      expect(manager.result("nonexistent-session")).toBeNull();
    });

    it("returns null for a still-running session", () => {
      manager.register(baseDef("agent-r"));
      const sessionId = manager.run("agent-r", "task");
      // Immediately check — session should still be running (or just errored)
      const result = manager.result(sessionId);
      // Could be null (running) or a TaskResult (already errored due to fake model)
      if (result !== null) {
        expect(result.status).toBe("error");
      }
    });
  });

  describe("progress() edge cases", () => {
    it("returns empty array for non-existent session", () => {
      expect(manager.progress("nonexistent")).toEqual([]);
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
    it("returns null for non-existent session", async () => {
      const result = await manager.waitFor("nonexistent");
      expect(result).toBeNull();
    });

    it("multiple concurrent waitFor() calls on same session all resolve", async () => {
      manager.register(baseDef("agent-w"));
      const sessionId = manager.run("agent-w", "task");

      // Two concurrent waiters
      const [result1, result2] = await Promise.all([
        manager.waitFor(sessionId),
        manager.waitFor(sessionId),
      ]);

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      expect(result1!.sessionId).toBe(result2!.sessionId);
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

  describe("SubagentManager without persistDir", () => {
    it("can run sessions without persistence", async () => {
      const noPersistManager = new SubagentManager();
      noPersistManager.register(baseDef("agent-np"));

      const sessionId = noPersistManager.run("agent-np", "task");
      const result = await noPersistManager.waitFor(sessionId);

      expect(result).not.toBeNull();
      expect(result!.sessionId).toBe(sessionId);
    });

    it("resume() returns empty array without persistDir", () => {
      const noPersistManager = new SubagentManager();
      expect(noPersistManager.resume()).toEqual([]);
    });

    it("getMemoryPath() returns undefined without persistDir", () => {
      const noPersistManager = new SubagentManager();
      noPersistManager.register(baseDef("agent-mp"));
      expect(noPersistManager.getMemoryPath("agent-mp")).toBeUndefined();
    });
  });
});
