import { beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { attachDaemonEventSubscribers, attachEventPersistence } from "./daemon-events.js";
import { EventBus } from "./event-bus.js";
import { applyDbSchemaAndMigrations } from "../lib/db/schema.js";
import { getDb } from "../lib/requests.js";

describe("canonical session terminal event", () => {
  let persistDir: string;
  let bus: EventBus;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-session-terminal-test-"));
    bus = new EventBus();
    applyDbSchemaAndMigrations(getDb(persistDir));
    attachEventPersistence({ bus, persistDir });
    attachDaemonEventSubscribers({
      bus,
      manager: { resumeSession: () => {} } as any,
      persistDir,
      projectRoot: persistDir,
    });
  });

  function emitSessionEnd(finishParams?: Record<string, unknown>, agent = "test-agent"): string {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    bus.emit({
      type: "session.start",
      source: "runtime",
      owner: `agent:${agent}`,
      timestamp: Date.now(),
      data: {
        sessionId,
        agent,
        task: "test task",
        trigger: "test",
        firedAt: Date.now(),
      },
    } as any);
    bus.emit({
      type: "session.end",
      source: "runtime",
      owner: `agent:${agent}`,
      timestamp: Date.now(),
      data: {
        sessionId,
        agent,
        status: finishParams?.status === "failure" ? "error" : "done",
        outcome: finishParams?.status === "failure" ? "error" : "done",
        summary: finishParams?.summary ?? "Done",
        durationMs: 10,
        opCount: 5,
        turnCount: 3,
        finishParams,
      },
    } as any);
    return sessionId;
  }

  it("keeps the structured result on session.end without derivative completion events", () => {
    const sessionId = emitSessionEnd({
      status: "success",
      summary: "Implemented the feature",
      verification_evidence: ["bun test: exit 0"],
      deliverables: [{ path: "src/app.ts", description: "New feature" }],
      completed_items: ["Implement feature X"],
    });

    const db = getDb(persistDir);
    const row = db.prepare(
      "SELECT * FROM events WHERE event_type = 'session.end' AND json_extract(data, '$.sessionId') = ?",
    ).get(sessionId) as any;
    const data = JSON.parse(row.data);

    expect(data.summary).toBe("Implemented the feature");
    expect(data.finishParams).toMatchObject({
      status: "success",
      verification_evidence: ["bun test: exit 0"],
      deliverables: [{ path: "src/app.ts", description: "New feature" }],
      completed_items: ["Implement feature X"],
    });
    expect(db.prepare(
      "SELECT COUNT(*) AS count FROM events WHERE event_type IN ('session.completed', 'session.receipt')",
    ).get()).toEqual({ count: 0 });
  });

  it("keeps one terminal trace row instead of tracing derivative copies", () => {
    const sessionId = emitSessionEnd({ status: "success", summary: "Done" }, "trace-agent");
    const db = getDb(persistDir);
    const terminal = db.prepare(
      "SELECT id FROM events WHERE event_type = 'session.end' AND json_extract(data, '$.sessionId') = ?",
    ).get(sessionId) as { id: number };

    expect(db.prepare("SELECT * FROM event_traces WHERE event_id = ?").get(terminal.id)).toMatchObject({
      event_id: terminal.id,
      visibility: "default",
    });
    expect(db.prepare(
      "SELECT COUNT(*) AS count FROM events WHERE json_extract(data, '$.sessionId') = ? AND event_type != 'session.start' AND event_type != 'session.end'",
    ).get(sessionId)).toEqual({ count: 0 });
  });

  it("keeps oversized terminal payloads as valid structured JSON", () => {
    const sessionId = `sess_large_${Date.now()}`;
    bus.emit({
      type: "session.end",
      source: "runtime",
      owner: "agent:test-agent",
      timestamp: Date.now(),
      data: {
        sessionId,
        agent: "test-agent",
        status: "done",
        outcome: "done",
        summary: "Large task completed",
        durationMs: 10,
        task: "x".repeat(210_000),
        finishParams: {
          status: "success",
          verification_evidence: ["bun test: exit 0"],
        },
      },
    } as any);

    const db = getDb(persistDir);
    const row = db.prepare(
      "SELECT data, json_valid(data) AS valid FROM events WHERE event_type = 'session.end' AND json_extract(data, '$.sessionId') = ?",
    ).get(sessionId) as { data: string; valid: number };
    const data = JSON.parse(row.data);

    expect(row.valid).toBe(1);
    expect(data).toMatchObject({
      sessionId,
      status: "done",
      summary: "Large task completed",
      finishParams: {
        status: "success",
        verification_evidence: ["bun test: exit 0"],
      },
    });
    expect(data.task).toContain("[TRUNCATED:");
    expect(data._truncated.originalLength).toBeGreaterThan(200_000);
  });

  it("keeps the valid JSON fallback within the persistence limit", () => {
    const sessionId = `sess_many_large_fields_${Date.now()}`;
    const largeFields = Object.fromEntries(
      Array.from({ length: 40 }, (_, index) => [`large${index}`, "x".repeat(10_000)]),
    );
    bus.emit({
      type: "session.end",
      source: "runtime",
      owner: "agent:test-agent",
      timestamp: Date.now(),
      data: {
        sessionId,
        agent: "test-agent",
        status: "done",
        outcome: "done",
        summary: "Many large fields completed",
        durationMs: 10,
        ...largeFields,
      },
    } as any);

    const db = getDb(persistDir);
    const row = db.prepare(
      "SELECT data, json_valid(data) AS valid FROM events WHERE event_type = 'session.end' AND json_extract(data, '$.sessionId') = ?",
    ).get(sessionId) as { data: string; valid: number };
    const data = JSON.parse(row.data);

    expect(row.valid).toBe(1);
    expect(row.data.length).toBeLessThanOrEqual(200_000);
    expect(data).toMatchObject({
      sessionId,
      agent: "test-agent",
      status: "done",
      summary: "Many large fields completed",
    });
    expect(data._truncated.originalLength).toBeGreaterThan(200_000);
  });

  it("still escalates an explicit blocked finish from session.end", () => {
    const sessionId = emitSessionEnd({
      status: "blocked",
      summary: "Needs approval",
      blockers: [{ reason: "Human approval required", context: "deployment" }],
    });
    const db = getDb(persistDir);
    const escalation = db.prepare(
      "SELECT data FROM events WHERE event_type = 'escalation.created' AND json_extract(data, '$.sourceSessionId') = ?",
    ).get(sessionId) as { data: string };

    expect(JSON.parse(escalation.data)).toMatchObject({
      sourceSessionId: sessionId,
      reason: "Needs approval",
      blockedOn: "Human approval required",
      evidence: {
        finishParams: { status: "blocked" },
      },
    });
  });
});
