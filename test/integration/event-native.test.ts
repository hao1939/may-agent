/** DbWriter persists canonical envelopes, payloads, and session projections. */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
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

describe("canonical event persistence", () => {
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
      target: { sessionId: "s_trace" },
      data: { message: "continue" },
    } as any);

    const rows = db.prepare(
      "SELECT event_type, source, session_id, data FROM events ORDER BY id ASC",
    ).all() as Array<{ event_type: string; source: string | null; session_id: string | null; data: string }>;

    expect(rows.map((row) => row.event_type)).toEqual(["runtime.reload.requested", "session.cancel_all.requested", "session.steer.requested"]);
    expect(rows.map((row) => row.source)).toEqual(["telegram", "telegram", "telegram"]);
    expect(rows[2].session_id).toBe("s_trace");
    expect(JSON.parse(rows[2].data)).toEqual({ message: "continue" });
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

  it("preserves additional message.created payload fields for approval lineage queries", () => {
    const writer = new DbWriter(TEST_DIR);
    const db = getDb(TEST_DIR);

    writer.handler({
      type: "message.created",
      source: "agent:aks-explorer",
      owner: "human:operator",
      urgency: "high",
      data: {
        from: "aks-explorer",
        to: "human:operator",
        content: "Approval packet dispatch",
        priority: "P1",
        approvalId: "approval-123",
        waitId: "wait-123",
        pathId: "path.network.example",
        packetPath: "evidence/archive/example-approval.md",
        expectedResponse: {
          type: "project.approval.submitted",
          approvalId: "approval-123",
          waitId: "wait-123",
        },
      },
    });

    const row = db.prepare(
      "SELECT source, owner, urgency, data FROM events WHERE event_type = ? ORDER BY id DESC LIMIT 1",
    ).get("message.created") as { source: string; owner: string; urgency: string; data: string };

    expect(row).toMatchObject({
      source: "agent:aks-explorer",
      owner: "human:operator",
      urgency: "high",
    });
    expect(JSON.parse(row.data)).toMatchObject({
      from: "aks-explorer",
      to: "human:operator",
      content: "Approval packet dispatch",
      priority: "P1",
      approvalId: "approval-123",
      waitId: "wait-123",
      pathId: "path.network.example",
      packetPath: "evidence/archive/example-approval.md",
      expectedResponse: {
        type: "project.approval.submitted",
        approvalId: "approval-123",
        waitId: "wait-123",
      },
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
