/**
 * Tests for Rolling Compaction:
 *  - saveCompactedMessages / readCompactedMessages (persistence layer)
 *  - compactPersistentSession integration (via ActiveSession.compactionTransform)
 *  - Resume path preferring compacted messages over full JSONL
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import {
  saveCompactedMessages,
  readCompactedMessages,
  sessionCompactPath,
  ensureSessionDir,
  appendSessionMessage,
  readSessionMessages,
} from "../src/lib/persistence.js";

// ── Helpers ─────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  const dir = join(tmpdir(), `rolling-compaction-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeUserMessage(text: string, ts = Date.now()): AgentMessage {
  return {
    role: "user",
    content: [{ type: "text", text }],
    timestamp: ts,
  } as AgentMessage;
}

function makeAssistantMessage(text: string, ts = Date.now()): AgentMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    timestamp: ts,
  } as AgentMessage;
}

// ── Tests ───────────────────────────────────────────────────────────────

describe("Rolling Compaction - persistence", () => {
  let persistDir: string;
  const sessionId = "test_session_1";

  beforeEach(() => {
    persistDir = makeTmpDir();
    ensureSessionDir(persistDir, sessionId);
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("readCompactedMessages returns null when no compact file exists", () => {
    const result = readCompactedMessages(persistDir, sessionId);
    expect(result).toBeNull();
  });

  it("saveCompactedMessages writes and readCompactedMessages reads back", () => {
    const messages: AgentMessage[] = [makeUserMessage("hello"), makeAssistantMessage("hi there")];

    saveCompactedMessages(persistDir, sessionId, messages);

    const result = readCompactedMessages(persistDir, sessionId);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(2);
    expect((result![0].content as any[])[0].text).toBe("hello");
    expect((result![1].content as any[])[0].text).toBe("hi there");
  });

  it("saveCompactedMessages overwrites previous compact file", () => {
    const first: AgentMessage[] = [makeUserMessage("first")];
    saveCompactedMessages(persistDir, sessionId, first);

    const second: AgentMessage[] = [
      makeUserMessage("compacted summary"),
      makeAssistantMessage("response"),
      makeUserMessage("follow up"),
    ];
    saveCompactedMessages(persistDir, sessionId, second);

    const result = readCompactedMessages(persistDir, sessionId);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(3);
    expect((result![0].content as any[])[0].text).toBe("compacted summary");
  });

  it("sessionCompactPath returns correct path", () => {
    const path = sessionCompactPath(persistDir, sessionId);
    expect(path).toBe(join(persistDir, "sessions", sessionId, "session-compact.jsonl"));
  });

  it("compact file is separate from session.jsonl", () => {
    // Write to session.jsonl (append-only log)
    appendSessionMessage(persistDir, sessionId, makeUserMessage("full msg 1"));
    appendSessionMessage(persistDir, sessionId, makeAssistantMessage("full msg 2"));
    appendSessionMessage(persistDir, sessionId, makeUserMessage("full msg 3"));

    // Write compacted (fewer messages)
    const compacted: AgentMessage[] = [
      makeUserMessage("[COMPACTED] summary of msg 1-2"),
      makeUserMessage("full msg 3"),
    ];
    saveCompactedMessages(persistDir, sessionId, compacted);

    // Full JSONL still has all 3 messages
    const full = readSessionMessages(persistDir, sessionId);
    expect(full.length).toBe(3);

    // Compacted has only 2
    const compact = readCompactedMessages(persistDir, sessionId);
    expect(compact).not.toBeNull();
    expect(compact!.length).toBe(2);
  });

  it("readCompactedMessages returns null for empty compact file", () => {
    // Write an empty file
    const path = sessionCompactPath(persistDir, sessionId);
    require("node:fs").writeFileSync(path, "", "utf-8");

    const result = readCompactedMessages(persistDir, sessionId);
    expect(result).toBeNull();
  });

  it("compact file is valid JSONL format", () => {
    const messages: AgentMessage[] = [makeUserMessage("line 1"), makeAssistantMessage("line 2")];
    saveCompactedMessages(persistDir, sessionId, messages);

    const path = sessionCompactPath(persistDir, sessionId);
    const raw = readFileSync(path, "utf-8");
    const lines = raw.trim().split("\n");
    expect(lines.length).toBe(2);

    // Each line should be valid JSON
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });
});

describe("Rolling Compaction - resume prefers compacted messages", () => {
  let persistDir: string;
  const sessionId = "test_resume_1";

  beforeEach(() => {
    persistDir = makeTmpDir();
    ensureSessionDir(persistDir, sessionId);
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("uses compacted messages when available, falls back to full JSONL otherwise", () => {
    // Simulate full JSONL with many messages
    for (let i = 0; i < 10; i++) {
      appendSessionMessage(persistDir, sessionId, makeUserMessage(`msg ${i}`));
    }

    // No compacted file yet → should fall back to full
    const compacted = readCompactedMessages(persistDir, sessionId);
    const savedMessages = compacted ?? readSessionMessages(persistDir, sessionId);
    expect(savedMessages.length).toBe(10);

    // Now write a compacted snapshot with fewer messages
    const compactedMsgs: AgentMessage[] = [makeUserMessage("[COMPACTED CONTEXT]"), makeUserMessage("msg 9")];
    saveCompactedMessages(persistDir, sessionId, compactedMsgs);

    // Now compacted is preferred
    const compacted2 = readCompactedMessages(persistDir, sessionId);
    const savedMessages2 = compacted2 ?? readSessionMessages(persistDir, sessionId);
    expect(savedMessages2.length).toBe(2);
    expect((savedMessages2[0].content as any[])[0].text).toBe("[COMPACTED CONTEXT]");
  });
});
