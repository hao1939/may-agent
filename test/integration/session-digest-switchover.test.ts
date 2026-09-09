// Real digest persistence and bounded circuit-breaker behavior.

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { closeDb, getDb } from "../../src/lib/requests.js";
import { getLastDigest } from "../../src/lib/session-digest.js";
import { createStuckDetector } from "../../src/lib/session-subscribers.js";

// ── Helpers ────────────────────────────────────────────────────────────

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "digest-switchover-test-"));
}

function setupDb(persistDir: string) {
  const db = getDb(persistDir);
  return db;
}

function sessionStart(sessionId: string, agent: string, task: string) {
  return {
    type: "session.start",
    source: "runtime",
    owner: `agent:${agent}`,
    data: { sessionId, agent, task, trigger: "runtime", firedAt: Date.now() },
  };
}

function sessionEnd(sessionId: string, agent: string) {
  return {
    type: "session.end",
    source: "runtime",
    owner: `agent:${agent}`,
    data: { sessionId, agent, outcome: "done", summary: "done", durationMs: 0 },
  };
}

// ── Circuit Breaker Decision Logic Tests ───────────────────────────────

describe("Circuit breaker — deterministic cancellation", () => {
  it("cancels at the terminal error threshold", () => {
    const cancelledSessions: string[] = [];

    const handler = createStuckDetector((sessionId: string) => cancelledSessions.push(sessionId), undefined);

    handler(sessionStart("s_fallback", "coder", "test") as any);
    for (let i = 0; i < 7; i++) {
      handler({
        type: "turn_end",
        sessionId: "s_fallback",
        agent: "coder",
        toolCalls: 1,
        errorCount: 1,
      } as any);
    }

    expect(cancelledSessions).toContain("s_fallback");
  });

  it("stuck warning at threshold 4 does not cancel", () => {
    const cancelledSessions: string[] = [];

    const handler = createStuckDetector((sessionId: string) => cancelledSessions.push(sessionId), undefined);

    handler(sessionStart("s_warn", "coder", "test") as any);
    for (let i = 0; i < 4; i++) {
      handler({
        type: "turn_end",
        sessionId: "s_warn",
        agent: "coder",
        toolCalls: 1,
        errorCount: 1,
      } as any);
    }

    expect(cancelledSessions).not.toContain("s_warn");
  });

  it("consecutive error count resets on successful turn", () => {
    const cancelledSessions: string[] = [];

    const handler = createStuckDetector((sessionId: string) => cancelledSessions.push(sessionId), undefined);

    handler(sessionStart("s_reset", "coder", "test") as any);
    for (let i = 0; i < 5; i++) {
      handler({
        type: "turn_end",
        sessionId: "s_reset",
        agent: "coder",
        toolCalls: 1,
        errorCount: 1,
      } as any);
    }
    // One successful turn resets the counter
    handler({
      type: "turn_end",
      sessionId: "s_reset",
      agent: "coder",
      toolCalls: 2,
      errorCount: 0,
    } as any);
    // 5 more error turns — still below threshold since counter was reset
    for (let i = 0; i < 5; i++) {
      handler({
        type: "turn_end",
        sessionId: "s_reset",
        agent: "coder",
        toolCalls: 1,
        errorCount: 1,
      } as any);
    }

    expect(cancelledSessions).not.toContain("s_reset");
  });

  it("session_end cleans up state", () => {
    const cancelledSessions: string[] = [];

    const handler = createStuckDetector((sessionId: string) => cancelledSessions.push(sessionId), undefined);

    handler(sessionStart("s_cleanup", "coder", "test") as any);
    for (let i = 0; i < 3; i++) {
      handler({
        type: "turn_end",
        sessionId: "s_cleanup",
        agent: "coder",
        toolCalls: 1,
        errorCount: 1,
      } as any);
    }
    // Session ends
    handler(sessionEnd("s_cleanup", "coder") as any);
    // New errors after session_end should not accumulate
    for (let i = 0; i < 7; i++) {
      handler({
        type: "turn_end",
        sessionId: "s_cleanup",
        agent: "coder",
        toolCalls: 1,
        errorCount: 1,
      } as any);
    }

    expect(cancelledSessions).not.toContain("s_cleanup");
  });
});

// ── Integration: getLastDigest returns correct action field ────────────

describe("getLastDigest integration with switchover", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = makeTempDir();
    setupDb(persistDir);
  });

  afterEach(() => {
    closeDb(persistDir);
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("returns the action field from the most recent digest", () => {
    // Insert two digests — only the latest should be returned (highest step)
    const db = setupDb(persistDir);
    db.prepare(
      `INSERT INTO session_digests
       (sessionId, agent, trigger, step, task, what_happened, outcome, still_open,
        files_modified, details, action, action_reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)`,
    ).run("s_multi", "coder", "stuck_detected", 1, "task", "warning phase", "in_progress", "stuff", null, null, Date.now() - 1000);

    db.prepare(
      `INSERT INTO session_digests
       (sessionId, agent, trigger, step, task, what_happened, outcome, still_open,
        files_modified, details, action, action_reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)`,
    ).run("s_multi", "coder", "circuit_break", 2, "task", "killed", "failure", null, "kill", "No recoverable work", Date.now());

    const digest = getLastDigest(persistDir, "s_multi");
    expect(digest).not.toBeNull();
    expect(digest!.action).toBe("kill");
    expect(digest!.trigger).toBe("circuit_break");
    expect(digest!.step).toBe(2);
  });

  it("returns null when no digests exist for session", () => {
    const digest = getLastDigest(persistDir, "s_nonexistent");
    expect(digest).toBeNull();
  });
});
