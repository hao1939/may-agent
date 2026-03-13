import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import {
  ensureSessionDir,
  appendSessionMessage,
  readSessionMessages,
  sessionDir,
  sessionJsonlPath,
  historyDir,
} from "../src/lib/persistence.js";
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

function userMessage(text: string): AgentMessage {
  return {
    role: "user",
    content: [{ type: "text", text }],
    timestamp: Date.now(),
  } as AgentMessage;
}

function assistantMessage(text: string): AgentMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    timestamp: Date.now(),
  } as AgentMessage;
}

describe("Session JSONL persistence", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-session-jsonl-"));
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  describe("low-level helpers", () => {
    it("ensureSessionDir creates the session directory", () => {
      const sessionId = "test-session-1";
      ensureSessionDir(persistDir, sessionId);
      const dir = sessionDir(persistDir, sessionId);
      expect(existsSync(dir)).toBe(true);
    });

    it("ensureSessionDir is idempotent", () => {
      const sessionId = "test-session-2";
      ensureSessionDir(persistDir, sessionId);
      ensureSessionDir(persistDir, sessionId); // should not throw
      expect(existsSync(sessionDir(persistDir, sessionId))).toBe(true);
    });

    it("appendSessionMessage creates the JSONL file and writes a line", () => {
      const sessionId = "test-session-3";
      ensureSessionDir(persistDir, sessionId);

      const msg = userMessage("hello");
      appendSessionMessage(persistDir, sessionId, msg);

      const filePath = sessionJsonlPath(persistDir, sessionId);
      expect(existsSync(filePath)).toBe(true);

      const raw = readFileSync(filePath, "utf-8");
      const lines = raw.trim().split("\n");
      expect(lines).toHaveLength(1);
      const parsed = JSON.parse(lines[0]);
      expect(parsed.role).toBe("user");
      expect(parsed.content[0].text).toBe("hello");
    });

    it("appendSessionMessage appends multiple messages", () => {
      const sessionId = "test-session-4";
      ensureSessionDir(persistDir, sessionId);

      appendSessionMessage(persistDir, sessionId, userMessage("first"));
      appendSessionMessage(persistDir, sessionId, assistantMessage("second"));
      appendSessionMessage(persistDir, sessionId, userMessage("third"));

      const filePath = sessionJsonlPath(persistDir, sessionId);
      const raw = readFileSync(filePath, "utf-8");
      const lines = raw.trim().split("\n");
      expect(lines).toHaveLength(3);
    });

    it("readSessionMessages returns empty array for non-existent session", () => {
      const messages = readSessionMessages(persistDir, "non-existent");
      expect(messages).toEqual([]);
    });

    it("readSessionMessages reads back all appended messages", () => {
      const sessionId = "test-session-5";
      ensureSessionDir(persistDir, sessionId);

      const msg1 = userMessage("question");
      const msg2 = assistantMessage("answer");
      appendSessionMessage(persistDir, sessionId, msg1);
      appendSessionMessage(persistDir, sessionId, msg2);

      const messages = readSessionMessages(persistDir, sessionId);
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe("user");
      expect(messages[1].role).toBe("assistant");
      expect((messages[0] as any).content[0].text).toBe("question");
      expect((messages[1] as any).content[0].text).toBe("answer");
    });

    it("readSessionMessages returns empty array for empty file", () => {
      const sessionId = "test-session-6";
      ensureSessionDir(persistDir, sessionId);
      // Create an empty file
      const { writeFileSync } = require("node:fs");
      writeFileSync(sessionJsonlPath(persistDir, sessionId), "", "utf-8");

      const messages = readSessionMessages(persistDir, sessionId);
      expect(messages).toEqual([]);
    });
  });

  describe("manager integration", () => {
    it("creates session directory on run()", () => {
      const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });

      manager.register({
        name: "test-agent",
        description: "A test agent",
        domain: "testing",
        systemPrompt: "You are a test agent.",
        model: fakeModel(),
        tools: [],
        apiKey: "fake-key",
      });

      const sessionId = manager.run("test-agent", "do something");

      // Session directory should exist
      const dir = sessionDir(persistDir, sessionId);
      expect(existsSync(dir)).toBe(true);
    });

    it("creates output subdirectory on run()", () => {
      const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });

      manager.register({
        name: "test-agent",
        description: "A test agent",
        domain: "testing",
        systemPrompt: "You are a test agent.",
        model: fakeModel(),
        tools: [],
        apiKey: "fake-key",
      });

      const sessionId = manager.run("test-agent", "do something");

      // Output directory should exist inside the session directory
      const outputDir = join(sessionDir(persistDir, sessionId), "output");
      expect(existsSync(outputDir)).toBe(true);
    });

    it("persists messages to session.jsonl via message_end events", async () => {
      const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });

      manager.register({
        name: "test-agent",
        description: "A test agent",
        domain: "testing",
        systemPrompt: "You are a test agent.",
        model: fakeModel(),
        tools: [],
        apiKey: "fake-key",
      });

      const sessionId = manager.run("test-agent", "do something");

      // Wait for the session to complete (will error or complete with fake model)
      await manager.waitFor(sessionId);

      // After completion, session is archived to history/
      // Read back the persisted messages from the archived location
      const archivedJsonl = join(historyDir(persistDir), sessionId, "session.jsonl");
      expect(existsSync(archivedJsonl)).toBe(true);

      const raw = readFileSync(archivedJsonl, "utf-8");
      const messages = raw
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as AgentMessage);

      // Should have at least the user message (the task).
      expect(messages.length).toBeGreaterThanOrEqual(1);

      // The first message should be the user's task (with session context prefix)
      expect(messages[0].role).toBe("user");
      expect((messages[0] as any).content[0].text).toContain("do something");
    });

    it("archives session directory to history after completion", async () => {
      const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });

      manager.register({
        name: "test-agent",
        description: "A test agent",
        domain: "testing",
        systemPrompt: "You are a test agent.",
        model: fakeModel(),
        tools: [],
        apiKey: "fake-key",
      });

      const sessionId = manager.run("test-agent", "do something");
      await manager.waitFor(sessionId);

      // Original session dir should no longer exist
      expect(existsSync(sessionDir(persistDir, sessionId))).toBe(false);

      // Archived session dir should exist in history
      const archivedDir = join(historyDir(persistDir), sessionId);
      expect(existsSync(archivedDir)).toBe(true);

      // Output dir should exist in archived location
      const archivedOutput = join(archivedDir, "output");
      expect(existsSync(archivedOutput)).toBe(true);
    });
  });
});
