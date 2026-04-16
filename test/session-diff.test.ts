import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDatabase } from "../src/lib/db.js";
import { getSessionDiff, formatSessionDiff } from "../src/lib/session-diff.js";

// We test DB queries against a real SQLite DB with seeded data.
// Git-based file changes are tested minimally (they rely on actual git history).

describe("session-diff", () => {
  let persistDir: string;
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), "diff-test-"));
    persistDir = join(projectRoot, "persist");
    mkdirSync(persistDir, { recursive: true });

    // Seed a DB with requests and sessions tables
    const db = openDatabase(join(persistDir, "may.db"));
    db.exec(`
      CREATE TABLE IF NOT EXISTS requests (
        requestId TEXT PRIMARY KEY,
        parentRequestId TEXT,
        fromEntity TEXT NOT NULL,
        toAgent TEXT NOT NULL,
        method TEXT NOT NULL,
        task TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'CREATED',
        sessionId TEXT,
        source TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        completedAt INTEGER,
        durationMs INTEGER,
        summary TEXT,
        error TEXT,
        errorClass TEXT,
        retryable INTEGER,
        artifact TEXT,
        context TEXT,
        expectations TEXT,
        notify TEXT
      );
      CREATE TABLE IF NOT EXISTS sessions (
        sessionId TEXT PRIMARY KEY,
        agent TEXT NOT NULL,
        task TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        kind TEXT,
        source TEXT,
        parentSessionId TEXT,
        requestId TEXT,
        workflowRunId TEXT,
        startedAt INTEGER NOT NULL,
        endedAt INTEGER,
        error TEXT,
        outcome TEXT,
        opCount INTEGER DEFAULT 0
      );
    `);

    const now = Date.now();
    const hour = 3600_000;

    // Insert some requests - 2 old, 2 new
    db.prepare(`INSERT INTO requests (requestId, fromEntity, toAgent, method, task, status, createdAt, updatedAt, completedAt, summary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      "r-old-1", "may", "coder", "call", "old task", "COMPLETED", now - 5 * hour, now - 4 * hour, now - 4 * hour, "done old"
    );
    db.prepare(`INSERT INTO requests (requestId, fromEntity, toAgent, method, task, status, createdAt, updatedAt, completedAt, summary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      "r-new-1", "tech-lead", "coder", "call", "new task 1", "COMPLETED", now - 1 * hour, now - 0.5 * hour, now - 0.5 * hour, "done new"
    );
    db.prepare(`INSERT INTO requests (requestId, fromEntity, toAgent, method, task, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      "r-new-2", "may", "optimizer", "call", "new task 2", "CREATED", now - 0.5 * hour, now - 0.5 * hour
    );
    db.prepare(`INSERT INTO requests (requestId, fromEntity, toAgent, method, task, status, createdAt, updatedAt, completedAt, summary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      "r-new-3", "may", "coder", "call", "failed task", "FAILED", now - 0.8 * hour, now - 0.3 * hour, now - 0.3 * hour, "error"
    );

    // Insert some sessions - 1 old, 2 new
    db.prepare(`INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt)
      VALUES (?, ?, ?, ?, ?, ?)`).run(
      "s-old", "coder", "old session", "completed", now - 5 * hour, now - 4.9 * hour
    );
    db.prepare(`INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt)
      VALUES (?, ?, ?, ?, ?, ?)`).run(
      "s-new-1", "coder", "new session 1", "completed", now - 1 * hour, now - 0.9 * hour
    );
    db.prepare(`INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt)
      VALUES (?, ?, ?, ?, ?, ?)`).run(
      "s-new-2", "optimizer", "new session 2", "running", now - 0.5 * hour, null
    );

    db.close();
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it("returns completed requests since cutoff", () => {
    const now = Date.now();
    const diff = getSessionDiff(persistDir, now - 2 * 3600_000, { projectRoot });

    // Should include r-new-1 (completed 0.5h ago) and r-new-3 (failed 0.3h ago)
    expect(diff.completedRequests).toHaveLength(2);
    expect(diff.completedRequests.map(r => r.requestId).sort()).toEqual(["r-new-1", "r-new-3"]);
  });

  it("returns new requests since cutoff", () => {
    const now = Date.now();
    const diff = getSessionDiff(persistDir, now - 2 * 3600_000, { projectRoot });

    // Should include r-new-1, r-new-2, r-new-3 (all created within last 2h)
    expect(diff.newRequests).toHaveLength(3);
  });

  it("returns sessions since cutoff", () => {
    const now = Date.now();
    const diff = getSessionDiff(persistDir, now - 2 * 3600_000, { projectRoot });

    expect(diff.recentSessions).toHaveLength(2);
    expect(diff.recentSessions.map(s => s.sessionId).sort()).toEqual(["s-new-1", "s-new-2"]);
  });

  it("filters by agent", () => {
    const now = Date.now();
    const diff = getSessionDiff(persistDir, now - 2 * 3600_000, {
      projectRoot,
      agent: "optimizer",
    });

    expect(diff.completedRequests).toHaveLength(0); // optimizer's request is CREATED not completed
    expect(diff.newRequests).toHaveLength(1);
    expect(diff.newRequests[0].toAgent).toBe("optimizer");
    expect(diff.recentSessions).toHaveLength(1);
    expect(diff.recentSessions[0].agent).toBe("optimizer");
  });

  it("returns empty when nothing changed", () => {
    const diff = getSessionDiff(persistDir, Date.now() + 100000, { projectRoot });

    expect(diff.completedRequests).toHaveLength(0);
    expect(diff.newRequests).toHaveLength(0);
    expect(diff.recentSessions).toHaveLength(0);
  });

  it("formats diff as readable markdown", () => {
    const now = Date.now();
    const diff = getSessionDiff(persistDir, now - 2 * 3600_000, { projectRoot });
    const md = formatSessionDiff(diff);

    expect(md).toContain("What Changed Since");
    expect(md).toContain("Completed Requests");
    expect(md).toContain("New Requests");
    expect(md).toContain("Sessions");
  });

  it("formats empty diff gracefully", () => {
    const diff = getSessionDiff(persistDir, Date.now() + 100000, { projectRoot });
    const md = formatSessionDiff(diff);

    expect(md).toContain("Nothing changed since");
  });

  it("includes sinceMs and since ISO in result", () => {
    const ts = Date.now() - 3600_000;
    const diff = getSessionDiff(persistDir, ts, { projectRoot });

    expect(diff.sinceMs).toBe(ts);
    expect(diff.since).toBe(new Date(ts).toISOString());
  });
});
