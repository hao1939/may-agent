import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import {
  ensureSessionDir,
  appendSessionMessage,
  readSessionMessages,
  readSessionMessagesTail,
  sessionDir,
  sessionJsonlPath,
} from "../../src/lib/persistence.js";
import { SubagentManager } from "../../src/lib/manager.js";
import { fakeModel } from "../fixtures/model.js";

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

    it("reads only the requested transcript tail", () => {
      const sessionId = "test-session-tail";
      ensureSessionDir(persistDir, sessionId);
      for (const text of ["first", "second", "third", "fourth"]) {
        appendSessionMessage(persistDir, sessionId, userMessage(text));
      }

      const messages = readSessionMessagesTail(persistDir, sessionId, 2);

      expect(messages.map((message: any) => message.content[0].text)).toEqual(["third", "fourth"]);
    });

    it("discards a partial first line at the byte boundary", () => {
      const sessionId = "test-session-bounded-tail";
      ensureSessionDir(persistDir, sessionId);
      for (const text of ["old-".repeat(200), "recent", "latest"]) {
        appendSessionMessage(persistDir, sessionId, userMessage(text));
      }

      const lastTwoBytes = Buffer.byteLength(
        `${JSON.stringify(userMessage("recent"))}\n${JSON.stringify(userMessage("latest"))}\n`,
      );
      const messages = readSessionMessagesTail(persistDir, sessionId, 10, lastTwoBytes + 20);

      expect(messages.map((message: any) => message.content[0].text)).toEqual(["recent", "latest"]);
    });

    it("skips corrupted complete lines in the bounded tail", () => {
      const sessionId = "test-session-corrupt-tail";
      ensureSessionDir(persistDir, sessionId);
      writeFileSync(
        sessionJsonlPath(persistDir, sessionId),
        `${JSON.stringify(userMessage("first"))}\nnot-json\n${JSON.stringify(userMessage("last"))}\n`,
      );
      const warn = console.warn;
      console.warn = () => {};
      try {
        const messages = readSessionMessagesTail(persistDir, sessionId, 3, 1024 * 1024);
        expect(messages.map((message: any) => message.content[0].text)).toEqual(["first", "last"]);
      } finally {
        console.warn = warn;
      }
    });
  });

  describe("manager integration", () => {
    it("creates session directory on run()", () => {
      const manager = new SubagentManager({ persistDir });

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
      const manager = new SubagentManager({ persistDir });

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
      const manager = new SubagentManager({ persistDir });

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

      const sessionJsonl = join(sessionDir(persistDir, sessionId), "session.jsonl");
      expect(existsSync(sessionJsonl)).toBe(true);

      const raw = readFileSync(sessionJsonl, "utf-8");
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

    it("session directory persists after completion", async () => {
      const manager = new SubagentManager({ persistDir });

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

      const durableDir = sessionDir(persistDir, sessionId);
      expect(existsSync(durableDir)).toBe(true);

      // Output remains under the permanent session directory.
      const outputDir = join(durableDir, "output");
      expect(existsSync(outputDir)).toBe(true);
    });
  });
});
