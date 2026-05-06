/**
 * Tests for the event-native migration:
 * - loadInbox uses time-window (no status field)
 * - system-status queries events table for handler history
 * - request-status queries events/sessions for handler health & agent stats
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { getDb, closeDb } from "../requests.js";

const TEST_DIR = join(import.meta.dir, ".test-event-native");

beforeEach(() => {
  try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
  mkdirSync(TEST_DIR, { recursive: true });
  closeDb(TEST_DIR);
});

describe("event-native: events table", () => {
  test("events are immutable — no status column needed for queries", () => {
    const db = getDb(TEST_DIR);

    // Insert events as immutable facts
    db.run("INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?,?,?,?,?)",
      ["message.created", "coach", "may", JSON.stringify({ from: "coach", to: "may", content: "review skill results" }), Date.now()]);
    db.run("INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?,?,?,?,?)",
      ["handler.completed", null, null, JSON.stringify({ handler: "metrics-snapshot", agent: "may", durationMs: 5000 }), Date.now()]);

    // Query inbox by time window (no status filter)
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    const inbox = db.prepare(
      `SELECT id, event_type, data, timestamp FROM events WHERE owner = ? AND timestamp > ? ORDER BY timestamp DESC`
    ).all("may", twoHoursAgo) as any[];

    expect(inbox.length).toBe(1);
    expect(inbox[0].event_type).toBe("message.created");
  });

  test("handler health derived from paired events", () => {
    const db = getDb(TEST_DIR);
    const now = Date.now();

    // Simulate handler lifecycle: started → completed
    db.run("INSERT INTO events (event_type, data, timestamp) VALUES (?,?,?)",
      ["handler.started", JSON.stringify({ handler: "metrics-snapshot", agent: "may" }), now - 5000]);
    db.run("INSERT INTO events (event_type, data, timestamp) VALUES (?,?,?)",
      ["handler.completed", JSON.stringify({ handler: "metrics-snapshot", agent: "may", durationMs: 4500 }), now]);
    db.run("INSERT INTO events (event_type, data, timestamp) VALUES (?,?,?)",
      ["handler.failed", JSON.stringify({ handler: "heartbeat-bob", agent: "bob", error: "timeout" }), now - 1000]);

    // Query: last fire time for a handler
    const lastFire = db.prepare(
      `SELECT MAX(timestamp) as lastFire FROM events WHERE event_type = 'handler.started' AND json_extract(data, '$.handler') = ?`
    ).get("metrics-snapshot") as any;
    expect(lastFire.lastFire).toBe(now - 5000);

    // Query: handler success rate
    const sixHAgo = now - 6 * 60 * 60 * 1000;
    const completed = (db.prepare(
      `SELECT COUNT(*) as c FROM events WHERE event_type = 'handler.completed' AND timestamp > ?`
    ).get(sixHAgo) as any).c;
    const failed = (db.prepare(
      `SELECT COUNT(*) as c FROM events WHERE event_type = 'handler.failed' AND timestamp > ?`
    ).get(sixHAgo) as any).c;

    expect(completed).toBe(1);
    expect(failed).toBe(1);
  });

  test("agent work stats from sessions table", () => {
    const db = getDb(TEST_DIR);
    const now = Date.now();

    // Insert sessions
    db.run("INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt) VALUES (?,?,?,?,?,?)",
      ["s1", "coach", "growth-cycle exp1", "done", now - 60000, now]);
    db.run("INSERT INTO sessions (sessionId, agent, task, status, startedAt, endedAt) VALUES (?,?,?,?,?,?)",
      ["s2", "coach", "growth-cycle exp2", "error", now - 30000, now]);
    db.run("INSERT INTO sessions (sessionId, agent, task, status, startedAt) VALUES (?,?,?,?,?)",
      ["s3", "may", "heartbeat", "done", now - 10000]);

    // Agent stats query (replaces requests table)
    const stats = db.prepare(
      `SELECT agent, COUNT(*) as total,
              SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed,
              SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed
       FROM sessions WHERE startedAt > ? GROUP BY agent ORDER BY total DESC`
    ).all(now - 100000) as any[];

    expect(stats.length).toBe(2);
    expect(stats[0].agent).toBe("coach");
    expect(stats[0].total).toBe(2);
    expect(stats[0].completed).toBe(1);
    expect(stats[0].failed).toBe(1);
  });

  test("findings dedup uses events table", () => {
    const db = getDb(TEST_DIR);
    const now = Date.now();

    // Insert a finding event
    db.run("INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?,?,?,?,?)",
      ["agent.finding", "scout", "tech-lead", JSON.stringify({ task: "[Auto] Fix type error in utils.ts", finding: "agents/scout/findings/f1.md" }), now]);

    // Dedup check: does a finding from this source already exist?
    const existing = db.prepare(
      `SELECT id FROM events WHERE event_type = 'agent.finding' AND json_extract(data, '$.finding') = ? AND timestamp > ?`
    ).all("agents/scout/findings/f1.md", now - 7 * 24 * 60 * 60 * 1000) as any[];

    expect(existing.length).toBe(1); // Found → skip duplicate
  });
});
