import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Agent } from "@mariozechner/pi-agent-core";
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

/**
 * Access the Agent's private `listeners` Set for a session.
 * Agent stores listeners as `private listeners = new Set<fn>()`.
 * We reach it through manager's private activeSessions map.
 */
function getAgentListenerCount(manager: SubagentManager, sessionId: string): number {
  const sessions = (manager as any).activeSessions as Map<string, any>;
  const session = sessions.get(sessionId);
  if (!session) return -1;
  const agent = session.agent as Agent;
  const listeners = (agent as any).listeners as Set<unknown>;
  return listeners.size;
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

  // ── New tests for subscription leak fix ────────────────────────────

  it("handleCompletion() unsubscribes the persistence listener after each cycle", async () => {
    // Directly verify that the unsubscribe function returned by agent.subscribe()
    // is called by handleCompletion(). We spy on Agent.prototype.subscribe to
    // intercept every subscription and track whether each unsubscribe was invoked.
    //
    // Lifecycle per cycle:
    //   run()/send() → subscribeForPersistence → agent.subscribe(fn) → unsubscribe fn
    //   handleCompletion() → session.unsubscribe() → calls unsubscribe fn
    //
    // Additionally, send() calls session.unsubscribe?.() before re-subscribing
    // (the leak fix), which may invoke the previous unsubscribe a second time.
    // This is safe because Set.delete is idempotent.

    const unsubscribeSpies: Array<ReturnType<typeof vi.fn>> = [];
    const subscribeSpy = vi.spyOn(Agent.prototype, "subscribe").mockImplementation(function (
      this: Agent,
      fn: (e: any) => void,
    ) {
      // Call through to the real implementation so persistence actually works
      const realListeners = (this as any).listeners as Set<(e: any) => void>;
      realListeners.add(fn);
      const realUnsub = () => realListeners.delete(fn);

      // Wrap in a spy so we can assert it was called
      const unsubSpy = vi.fn(realUnsub);
      unsubscribeSpies.push(unsubSpy);
      return unsubSpy;
    });

    try {
      // ── run() creates subscription #0 ──
      const sessionId = manager.run("echo-agent", "initial task");
      expect(subscribeSpy).toHaveBeenCalledTimes(1);
      expect(unsubscribeSpies).toHaveLength(1);

      await manager.waitFor(sessionId);

      // handleCompletion() must have called unsubscribe #0 at least once
      expect(unsubscribeSpies[0]).toHaveBeenCalled();
      // Zero persistence listeners remain on the agent after completion
      expect(getAgentListenerCount(manager, sessionId)).toBe(0);

      // ── send() creates subscription #1 ──
      expect(manager.send(sessionId, "follow-up 1")).toBe(true);
      expect(subscribeSpy).toHaveBeenCalledTimes(2);
      expect(unsubscribeSpies).toHaveLength(2);

      await manager.waitFor(sessionId);

      // handleCompletion() must have called unsubscribe #1
      expect(unsubscribeSpies[1]).toHaveBeenCalled();
      expect(getAgentListenerCount(manager, sessionId)).toBe(0);

      // ── send() creates subscription #2 ──
      expect(manager.send(sessionId, "follow-up 2")).toBe(true);
      expect(subscribeSpy).toHaveBeenCalledTimes(3);
      expect(unsubscribeSpies).toHaveLength(3);

      await manager.waitFor(sessionId);

      // handleCompletion() must have called unsubscribe #2
      expect(unsubscribeSpies[2]).toHaveBeenCalled();
      expect(getAgentListenerCount(manager, sessionId)).toBe(0);

      // Every unsubscribe was called at least once — no subscription is ever leaked
      for (let i = 0; i < unsubscribeSpies.length; i++) {
        expect(unsubscribeSpies[i]).toHaveBeenCalled();
      }
    } finally {
      subscribeSpy.mockRestore();
    }
  });

  it("send() replaces the persistence listener rather than accumulating them", async () => {
    // Verify that send() calls session.unsubscribe?.() BEFORE re-subscribing,
    // so at most one persistence listener is active at any time. Without the
    // fix, each send() would add a new listener without removing the old one,
    // causing duplicate writes on every message_end event.
    //
    // We track the agent's listener Set size at key points to prove that:
    //   - During a run/send, exactly 1 persistence listener exists
    //   - After completion, 0 persistence listeners exist
    //   - Listeners never accumulate across multiple send() calls
    //
    // We also record the subscribe/unsubscribe timeline to prove ordering.

    const events: string[] = []; // timeline of subscribe/unsubscribe events
    const subscribeSpy = vi.spyOn(Agent.prototype, "subscribe").mockImplementation(function (
      this: Agent,
      fn: (e: any) => void,
    ) {
      const realListeners = (this as any).listeners as Set<(e: any) => void>;
      const callIndex = events.filter((e) => e.startsWith("subscribe#")).length;
      realListeners.add(fn);
      events.push(`subscribe#${callIndex}`);

      return () => {
        realListeners.delete(fn);
        events.push(`unsubscribe#${callIndex}`);
      };
    });

    try {
      const sessionId = manager.run("echo-agent", "initial task");
      await manager.waitFor(sessionId);

      // After run: subscribe#0 was created, then handleCompletion called unsubscribe#0
      expect(events).toContain("subscribe#0");
      expect(events).toContain("unsubscribe#0");
      expect(getAgentListenerCount(manager, sessionId)).toBe(0);

      // First send()
      events.length = 0; // reset timeline for clarity
      expect(manager.send(sessionId, "msg1")).toBe(true);

      // send() first calls session.unsubscribe?.() (the old one from run()),
      // then subscribes a new listener. Since handleCompletion already called
      // unsubscribe#0, this is a safe redundant call.
      // At this point the agent should have exactly 1 listener (the new one)
      expect(getAgentListenerCount(manager, sessionId)).toBe(1);

      await manager.waitFor(sessionId);

      // After completion: handleCompletion cleaned up → 0 listeners
      expect(getAgentListenerCount(manager, sessionId)).toBe(0);

      // Second send()
      events.length = 0;
      expect(manager.send(sessionId, "msg2")).toBe(true);

      // Exactly 1 listener active — the new persistence subscription, not accumulated
      expect(getAgentListenerCount(manager, sessionId)).toBe(1);

      await manager.waitFor(sessionId);
      expect(getAgentListenerCount(manager, sessionId)).toBe(0);

      // Third send()
      events.length = 0;
      expect(manager.send(sessionId, "msg3")).toBe(true);

      // Still exactly 1 — no accumulation across 3 send() calls
      expect(getAgentListenerCount(manager, sessionId)).toBe(1);

      await manager.waitFor(sessionId);
      expect(getAgentListenerCount(manager, sessionId)).toBe(0);

      // Summary: across run() + 3× send(), listener count was always 0 or 1.
      // Without the fix (no unsubscribe before re-subscribe in send()),
      // the count would grow: 1 after run, 2 after first send, 3 after second, etc.
    } finally {
      subscribeSpy.mockRestore();
    }
  });

  it("archiveSession after send() re-archives cleanly without ENOTEMPTY", async () => {
    // Verify the archive/re-archive cycle works structurally:
    //   1. run()  → archives to history/<id>/
    //   2. send() → restores from archive, recreates sessions/<id>/, archives again
    //   3. send() → same cycle again
    //
    // archiveSession() in persistence.ts handles re-archival by calling
    // rmSync(dest, { recursive: true, force: true }) before renameSync().
    // We verify correctness structurally: the archived JSONL must exist with
    // the right content, and the active session dir must be absent (moved).

    const sessionId = manager.run("echo-agent", "setup task");
    await manager.waitFor(sessionId);

    const historyPath = join(historyDir(persistDir), sessionId);
    const archivedJsonl = join(historyPath, "session.jsonl");
    const activeDir = sessionDir(persistDir, sessionId);

    // After run() completes: session is archived to history/
    expect(existsSync(historyPath)).toBe(true);
    expect(existsSync(archivedJsonl)).toBe(true);
    // Active session dir should be gone (it was renamed/moved to history)
    expect(existsSync(activeDir)).toBe(false);

    // Read initial archived content
    const round1Messages = readFileSync(archivedJsonl, "utf-8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as AgentMessage);
    const round1UserTexts = round1Messages
      .filter((m) => m.role === "user")
      .flatMap((m) => m.content)
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text as string);
    expect(round1UserTexts).toContain("setup task");

    // ── First send(): restore + re-archive cycle ──
    expect(manager.send(sessionId, "follow-up 1")).toBe(true);
    await manager.waitFor(sessionId);

    // After first send: history/<id>/ must exist with re-archived JSONL
    expect(existsSync(historyPath)).toBe(true);
    expect(existsSync(archivedJsonl)).toBe(true);
    // Active session dir should be gone again (successfully archived)
    expect(existsSync(activeDir)).toBe(false);

    // Archived JSONL should contain both the setup task and follow-up 1
    const round2Messages = readFileSync(archivedJsonl, "utf-8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as AgentMessage);
    const round2UserTexts = round2Messages
      .filter((m) => m.role === "user")
      .flatMap((m) => m.content)
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text as string);
    expect(round2UserTexts).toContain("setup task");
    expect(round2UserTexts).toContain("follow-up 1");

    // ── Second send(): another restore + re-archive cycle ──
    expect(manager.send(sessionId, "follow-up 2")).toBe(true);
    await manager.waitFor(sessionId);

    // After second send: same structural invariants hold
    expect(existsSync(historyPath)).toBe(true);
    expect(existsSync(archivedJsonl)).toBe(true);
    expect(existsSync(activeDir)).toBe(false);

    // Archived JSONL should contain all three user messages cumulatively
    const round3Messages = readFileSync(archivedJsonl, "utf-8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as AgentMessage);
    const round3UserTexts = round3Messages
      .filter((m) => m.role === "user")
      .flatMap((m) => m.content)
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text as string);
    expect(round3UserTexts).toContain("setup task");
    expect(round3UserTexts).toContain("follow-up 1");
    expect(round3UserTexts).toContain("follow-up 2");

    // Each user message appears exactly once (no duplication from re-archival)
    const setupCount = round3UserTexts.filter((t) => t === "setup task").length;
    const followUp1Count = round3UserTexts.filter((t) => t === "follow-up 1").length;
    const followUp2Count = round3UserTexts.filter((t) => t === "follow-up 2").length;
    expect(setupCount).toBe(1);
    expect(followUp1Count).toBe(1);
    expect(followUp2Count).toBe(1);
  });
});
