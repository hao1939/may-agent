/**
 * Tests for the event-native migration:
 * - loadInbox uses time-window (no status field)
 * - system-status queries events table for handler history
 * - request-status queries events/sessions for handler health & agent stats
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getDb, closeDb } from "../../src/lib/requests.js";
import { DbWriter } from "../../src/lib/db-writer.js";

let TEST_DIR: string;

beforeEach(() => {
  TEST_DIR = mkdtempSync(join(tmpdir(), "may-event-native-"));
  closeDb(TEST_DIR);
});

afterEach(() => {
  closeDb(TEST_DIR);
  try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
});

describe("event-native: events table", () => {
  it("events are immutable — no status column needed for queries", () => {
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

  it("handler health derived from paired events", () => {
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

  it("agent work stats from sessions table", () => {
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

  it("findings dedup uses events table", () => {
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

  it("persists canonical human control intents for runtime traceability", () => {
    const writer = new DbWriter(TEST_DIR);
    const db = getDb(TEST_DIR);

    writer.handler({ type: "runtime.reload.requested", source: "telegram", owner: "agent:may", data: {} } as any);
    writer.handler({
      type: "session.cancel_all.requested",
      source: "telegram",
      owner: "agent:may",
      urgency: "high",
      data: { reason: "human requested cancel all" },
    } as any);
    writer.handler({
      type: "session.steer.requested",
      source: "telegram",
      owner: "agent:may",
      data: { sessionId: "s_trace", message: "continue" },
    } as any);

    const rows = db.prepare(
      "SELECT event_type, source, data FROM events ORDER BY id ASC",
    ).all() as Array<{ event_type: string; source: string | null; data: string }>;

    expect(rows.map((row) => row.event_type)).toEqual(["runtime.reload.requested", "session.cancel_all.requested", "session.steer.requested"]);
    expect(rows.map((row) => row.source)).toEqual(["telegram", "telegram", "telegram"]);
    expect(JSON.parse(rows[2].data)).toMatchObject({ sessionId: "s_trace", message: "continue" });
  });

  it("persists canonical event envelopes with only event.data in the data column", () => {
    const writer = new DbWriter(TEST_DIR);
    const db = getDb(TEST_DIR);

    writer.handler({
      type: "metric.breach",
      source: "metrics-snapshot",
      owner: "human:operator",
      urgency: "high",
      ttl_ms: 30_000,
      data: {
        metricId: "handler.success-rate",
        reason: "below threshold",
      },
    } as any);

    const row = db.prepare(
      "SELECT event_type, source, owner, urgency, ttl_ms, data FROM events WHERE event_type = ?",
    ).get("metric.breach") as { event_type: string; source: string; owner: string; urgency: string; ttl_ms: number; data: string };
    expect(row).toMatchObject({
      event_type: "metric.breach",
      source: "metrics-snapshot",
      owner: "human:operator",
      urgency: "high",
      ttl_ms: 30_000,
    });
    expect(JSON.parse(row.data)).toEqual({
      metricId: "handler.success-rate",
      reason: "below threshold",
    });
  });

  it("persists message.created with canonical owner while keeping payload context", () => {
    const writer = new DbWriter(TEST_DIR);
    const db = getDb(TEST_DIR);

    writer.handler({
      type: "message.created",
      source: "agent:dev",
      owner: "agent:reviewer",
      data: {
        from: "dev",
        to: "reviewer",
        content: "Please inspect this change.",
        priority: "P2",
      },
    });

    writer.handler({
      type: "message.created",
      source: "agent:dev",
      owner: "human:operator",
      urgency: "high",
      data: {
        from: "dev",
        to: "human",
        content: "Need operator input.",
        priority: "P1",
      },
    });

    const rows = db.prepare(
      "SELECT source, owner, data FROM events WHERE event_type = ? ORDER BY id ASC",
    ).all("message.created") as Array<{ source: string; owner: string; data: string }>;

    expect(rows.map((row) => row.source)).toEqual(["agent:dev", "agent:dev"]);
    expect(rows.map((row) => row.owner)).toEqual(["agent:reviewer", "human:operator"]);
    expect(JSON.parse(rows[0].data)).toEqual({
      from: "dev",
      to: "reviewer",
      content: "Please inspect this change.",
      intent: null,
      artifact: null,
      priority: "P2",
    });
    expect(JSON.parse(rows[1].data)).toEqual({
      from: "dev",
      to: "human",
      content: "Need operator input.",
      intent: null,
      artifact: null,
      priority: "P1",
    });
  });

  it("does not persist flat message.created events", () => {
    const writer = new DbWriter(TEST_DIR);
    const db = getDb(TEST_DIR);

    writer.handler({
      type: "message.created",
      from: "dev",
      to: "human",
      content: "legacy flat message",
    } as any);

    const count = db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = ?").get("message.created") as { count: number };
    expect(count.count).toBe(0);
  });

  it("does not persist flat domain events", () => {
    const writer = new DbWriter(TEST_DIR);
    const db = getDb(TEST_DIR);

    writer.handler({
      type: "metric.breach",
      source: "metrics",
      owner: "agent:may",
      metricId: "system.health",
      message: "flat metric event",
    } as any);
    writer.handler({
      type: "escalation.created",
      source: "agent:dev",
      owner: "agent:may",
      escalationId: "esc_flat",
      reason: "flat escalation",
    } as any);
    writer.handler({
      type: "handler.started",
      source: "cron",
      owner: "agent:may",
      handler: "flat-handler",
      agent: "may",
    } as any);

    const count = db.prepare(
      "SELECT COUNT(*) AS count FROM events WHERE event_type IN ('metric.breach', 'escalation.created', 'handler.started')",
    ).get() as { count: number };
    expect(count.count).toBe(0);
  });

  it("does not duplicate owner/source envelope fields into canonical event data", () => {
    const writer = new DbWriter(TEST_DIR);
    const db = getDb(TEST_DIR);

    writer.handler({
      type: "escalation.created",
      source: "agent:dev",
      owner: "agent:may",
      urgency: "normal",
      data: {
        escalationId: "esc_test",
        reason: "need help",
      },
    } as any);

    const row = db.prepare(
      "SELECT source, owner, data FROM events WHERE event_type = ?",
    ).get("escalation.created") as { source: string; owner: string; data: string };
    const data = JSON.parse(row.data);
    expect(row).toMatchObject({ source: "agent:dev", owner: "agent:may" });
    expect(data).toEqual({ escalationId: "esc_test", reason: "need help" });
    expect(data).not.toHaveProperty("owner");
    expect(data).not.toHaveProperty("source");
  });

  it("updates session rows from canonical session.end envelopes", () => {
    const writer = new DbWriter(TEST_DIR);
    const db = getDb(TEST_DIR);

    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, startedAt) VALUES (?, ?, ?, ?, ?)",
      ["s_done", "dev", "task", "running", Date.now() - 1_000],
    );

    writer.handler({
      type: "session.end",
      source: "runtime",
      owner: "agent:dev",
      data: {
        sessionId: "s_done",
        agent: "dev",
        status: "error",
        outcome: "error",
        error: "boom",
        opCount: 2,
      },
    } as any);

    const session = db.prepare(
      "SELECT status, outcome, error, opCount, endedAt FROM sessions WHERE sessionId = ?",
    ).get("s_done") as { status: string; outcome: string; error: string; opCount: number; endedAt: number };
    expect(session).toMatchObject({ status: "error", outcome: "error", error: "boom", opCount: 2 });
    expect(session.endedAt).toBeGreaterThan(0);

    const eventRow = db.prepare(
      "SELECT source, owner, data FROM events WHERE event_type = ?",
    ).get("session.end") as { source: string; owner: string; data: string };
    expect(eventRow).toMatchObject({ source: "runtime", owner: "agent:dev" });
    expect(JSON.parse(eventRow.data)).toMatchObject({ sessionId: "s_done", status: "error", outcome: "error" });
  });
});
