import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { SubagentManager } from "../src/manager.js";
import { historyDir, sessionDir, sessionJsonlPath } from "../src/persistence.js";
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

/**
 * Read all JSONL messages from whichever location the session ended up —
 * either the active sessions dir or the archived history dir.
 */
function findSessionJsonl(persistDir: string, sessionId: string): AgentMessage[] {
  // Check archived location first (sessions/history/<id>/session.jsonl)
  const archivedPath = join(historyDir(persistDir), sessionId, "session.jsonl");
  // Check active location (sessions/<id>/session.jsonl)
  const activePath = sessionJsonlPath(persistDir, sessionId);

  // Collect messages from both locations — send() creates a new session dir
  // while the first run's archive may still exist in history/
  const messages: AgentMessage[] = [];

  for (const filePath of [archivedPath, activePath]) {
    if (existsSync(filePath)) {
      const raw = readFileSync(filePath, "utf-8").trim();
      if (raw) {
        for (const line of raw.split("\n")) {
          try {
            messages.push(JSON.parse(line) as AgentMessage);
          } catch {
            // skip corrupted lines
          }
        }
      }
    }
  }

  return messages;
}

describe("send() persistence", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-send-persist-"));
    manager = new SubagentManager({ persistDir });

    manager.register({
      name: "echo-agent",
      description: "Agent for send() persistence testing",
      domain: "test",
      systemPrompt: "You are a test agent.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });
  });

  afterEach(() => {
    if (existsSync(persistDir)) {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("persists messages from send() follow-up to session JSONL", async () => {
    // ── Round 1: run a task and wait for completion ──────────────────
    const sessionId = manager.run("echo-agent", "initial task");
    await manager.waitFor(sessionId);

    // After completion the session is archived to history/
    const archivedJsonl = join(historyDir(persistDir), sessionId, "session.jsonl");
    expect(existsSync(archivedJsonl)).toBe(true);

    // Read round-1 messages
    const round1Raw = readFileSync(archivedJsonl, "utf-8").trim();
    expect(round1Raw.length).toBeGreaterThan(0);
    const round1Messages = round1Raw.split("\n").map((l) => JSON.parse(l) as AgentMessage);
    const round1Count = round1Messages.length;

    // First persisted message should be the user's initial task
    expect(round1Messages[0].role).toBe("user");
    expect((round1Messages[0] as any).content[0].text).toBe("initial task");

    // ── Round 2: send() a follow-up on the same session ─────────────
    const sendOk = manager.send(sessionId, "follow-up message");
    expect(sendOk).toBe(true);

    await manager.waitFor(sessionId);

    // send() recreates sessions/<id>/ for JSONL writes; the second archival
    // may fail silently because history/<id>/ already exists. So messages from
    // the second round may be in either location.
    const allMessages = findSessionJsonl(persistDir, sessionId);

    // We should have *more* messages than round 1 — at minimum the follow-up
    // user message was persisted somewhere.
    expect(allMessages.length).toBeGreaterThan(round1Count);

    // Verify the follow-up user message appears in the combined messages
    const followUpMessages = allMessages.filter(
      (m) =>
        m.role === "user" &&
        m.content.some((b: any) => b.type === "text" && b.text === "follow-up message"),
    );
    expect(followUpMessages.length).toBeGreaterThanOrEqual(1);
  });

  it("session JSONL from send() is written to the recreated session dir", async () => {
    // Run and wait for completion (archives to history/)
    const sessionId = manager.run("echo-agent", "first task");
    await manager.waitFor(sessionId);

    // The active sessions/<id>/ should be gone (archived)
    const activeDir = sessionDir(persistDir, sessionId);
    expect(existsSync(activeDir)).toBe(false);

    // Send follow-up — this should recreate sessions/<id>/
    const sendOk = manager.send(sessionId, "second task");
    expect(sendOk).toBe(true);
    await manager.waitFor(sessionId);

    // The follow-up JSONL should exist in at least one location.
    // If the second archival succeeded, it's in history/<id>/.
    // If it failed (ENOTEMPTY), it remains in sessions/<id>/.
    const activePath = sessionJsonlPath(persistDir, sessionId);
    const archivedPath = join(historyDir(persistDir), sessionId, "session.jsonl");

    const activeExists = existsSync(activePath);
    const archivedExists = existsSync(archivedPath);

    // At least one location must have JSONL data
    expect(activeExists || archivedExists).toBe(true);

    // Find whichever has the follow-up data
    let followUpJsonlPath: string;
    if (activeExists) {
      // Second round couldn't archive (history/<id>/ already exists), so data is here
      followUpJsonlPath = activePath;
    } else {
      // Second round archived successfully (maybe first archive was cleaned up)
      followUpJsonlPath = archivedPath;
    }

    const raw = readFileSync(followUpJsonlPath, "utf-8").trim();
    expect(raw.length).toBeGreaterThan(0);

    const messages = raw.split("\n").map((l) => JSON.parse(l) as AgentMessage);

    // The messages written during send() should include the follow-up user message
    const hasFollowUp = messages.some(
      (m) =>
        m.role === "user" &&
        m.content.some((b: any) => b.type === "text" && b.text === "second task"),
    );
    expect(hasFollowUp).toBe(true);
  });

  it("send() re-subscribes for persistence after the initial subscription is gone", async () => {
    // This test verifies the core bug fix: after run() completes and archives,
    // the persistence subscription is effectively dead (the session dir was moved).
    // send() must create a fresh subscription that writes to a valid path.

    const sessionId = manager.run("echo-agent", "setup task");
    await manager.waitFor(sessionId);

    // Do multiple send() rounds to verify subscription is recreated each time
    for (let i = 1; i <= 2; i++) {
      const ok = manager.send(sessionId, `round ${i}`);
      expect(ok).toBe(true);
      await manager.waitFor(sessionId);
    }

    // Collect all persisted messages across all locations
    const allMessages = findSessionJsonl(persistDir, sessionId);

    // Should have the initial user message + at least messages from both send() rounds
    const roundMessages = allMessages.filter(
      (m) =>
        m.role === "user" &&
        m.content.some((b: any) => b.type === "text" && /^round \d$/.test(b.text)),
    );

    // We expect at least 2 round messages (round 1 and round 2)
    expect(roundMessages.length).toBeGreaterThanOrEqual(2);
  });
});
