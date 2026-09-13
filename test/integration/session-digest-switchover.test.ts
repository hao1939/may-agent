// Real digest persistence.

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { closeDb, getDb } from "../../src/lib/requests.js";
import { getLastDigest } from "../../src/lib/session-digest.js";

// ── Helpers ────────────────────────────────────────────────────────────

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "digest-switchover-test-"));
}

function setupDb(persistDir: string) {
  const db = getDb(persistDir);
  return db;
}

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
