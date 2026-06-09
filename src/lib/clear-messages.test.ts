import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import {
  ensureSessionDir,
  appendSessionMessage,
  readSessionMessages,
  clearSessionMessages,
  sessionJsonlPath,
  sessionDir,
} from "./persistence.js";

function userMessage(text: string): AgentMessage {
  return {
    role: "user",
    content: [{ type: "text", text }],
    timestamp: Date.now(),
  } as AgentMessage;
}

describe("clearSessionMessages", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-clear-msgs-"));
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("deletes an existing session JSONL file", () => {
    const sessionId = "sess-clear-1";
    ensureSessionDir(persistDir, sessionId);
    appendSessionMessage(persistDir, sessionId, userMessage("hello"));

    const filePath = sessionJsonlPath(persistDir, sessionId);
    expect(existsSync(filePath)).toBe(true);

    clearSessionMessages(persistDir, sessionId);

    expect(existsSync(filePath)).toBe(false);
    expect(readSessionMessages(persistDir, sessionId)).toEqual([]);
  });

  it("does not throw when the session JSONL file does not exist", () => {
    const sessionId = "sess-clear-nonexistent";
    // No directory or file created — should be a no-op
    expect(() => clearSessionMessages(persistDir, sessionId)).not.toThrow();
  });

  it("does not remove the session directory itself", () => {
    const sessionId = "sess-clear-dir";
    ensureSessionDir(persistDir, sessionId);
    appendSessionMessage(persistDir, sessionId, userMessage("keep dir"));

    clearSessionMessages(persistDir, sessionId);

    // JSONL file should be gone
    expect(existsSync(sessionJsonlPath(persistDir, sessionId))).toBe(false);
    // Session directory should still exist
    expect(existsSync(sessionDir(persistDir, sessionId))).toBe(true);
  });
});
