import { describe, it, expect, beforeEach } from "bun:test";
import { EventBus } from "./event-bus.js";
import { attachDaemonEventSubscribers, attachEventPersistence } from "./daemon-events.js";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getDb } from "../lib/requests.js";
import { applyDbSchemaAndMigrations } from "../lib/db/schema.js";

describe("session.receipt persistence", () => {
  let persistDir: string;
  let projectRoot: string;
  let bus: EventBus;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-receipt-test-"));
    projectRoot = persistDir;
    bus = new EventBus();

    // Initialize DB schema
    const db = getDb(persistDir);
    applyDbSchemaAndMigrations(db);

    // Attach event persistence (DbWriter) first
    attachEventPersistence({ bus, persistDir });
  });

  function emitSessionEnd(finishParams: any, agent = "test-agent") {
    const sessionId = `sess_${Date.now()}`;
    // Emit session.start first so DbWriter creates the session row
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

    // Emit session.end
    bus.emit({
      type: "session.end",
      source: "runtime",
      owner: `agent:${agent}`,
      timestamp: Date.now(),
      data: {
        sessionId,
        agent,
        status: finishParams?.status ?? "success",
        outcome: finishParams?.summary ?? "done",
        opCount: 5,
        turnCount: 3,
        finishParams,
      },
    } as any);

    return sessionId;
  }

  it("persists session.receipt event when finish(success) with evidence", () => {
    // Attach daemon subscribers which include receipt persistence
    attachDaemonEventSubscribers({
      bus,
      manager: { resumeSession: () => {} } as any,
      persistDir,
      projectRoot,
    });

    const sessionId = emitSessionEnd({
      status: "success",
      summary: "Implemented the feature",
      verification_evidence: ["Step 5: bash test exit code 0"],
      deliverables: [{ path: "src/app.ts", description: "New feature" }],
      completed_items: ["Implement feature X"],
    });

    // Check DB for session.receipt event
    const db = getDb(persistDir);
    const rows = db.prepare("SELECT * FROM events WHERE event_type = 'session.receipt'").all() as any[];
    expect(rows.length).toBe(1);

    const data = JSON.parse(rows[0].data);
    expect(data.type).toBe("session.receipt");
    expect(data.sessionId).toBe(sessionId);
    expect(data.owner).toBe("test-agent");
    expect(data.status).toBe("success");
    expect(data.summary).toBe("Implemented the feature");
    expect(data.evidence.length).toBe(3); // 1 verification + 1 deliverable + 1 completed_item
    expect(data.evidence[0].kind).toBe("command");
    expect(data.evidence[1].kind).toBe("file");
    expect(data.evidence[2].kind).toBe("task");
    expect(data.createdAt).toBeDefined();
  });

  it("does NOT persist receipt for failure/partial/blocked sessions", () => {
    attachDaemonEventSubscribers({
      bus,
      manager: { resumeSession: () => {} } as any,
      persistDir,
      projectRoot,
    });

    emitSessionEnd({ status: "failure", summary: "Failed", blockers: [{ reason: "x", context: "y" }] });
    emitSessionEnd({ status: "partial", summary: "Partial work" });
    emitSessionEnd({ status: "blocked", summary: "Blocked", blockers: [{ reason: "x", context: "y" }] });

    const db = getDb(persistDir);
    const rows = db.prepare("SELECT * FROM events WHERE event_type = 'session.receipt'").all() as any[];
    expect(rows.length).toBe(0);
  });

  it("does NOT persist receipt when no finishParams", () => {
    attachDaemonEventSubscribers({
      bus,
      manager: { resumeSession: () => {} } as any,
      persistDir,
      projectRoot,
    });

    emitSessionEnd(undefined);

    const db = getDb(persistDir);
    const rows = db.prepare("SELECT * FROM events WHERE event_type = 'session.receipt'").all() as any[];
    expect(rows.length).toBe(0);
  });

  it("receipt is queryable by owner from events table", () => {
    attachDaemonEventSubscribers({
      bus,
      manager: { resumeSession: () => {} } as any,
      persistDir,
      projectRoot,
    });

    emitSessionEnd({
      status: "success",
      summary: "Done",
      verification_evidence: ["Step 1: confirmed"],
    }, "my-agent");

    const db = getDb(persistDir);
    const rows = db.prepare("SELECT * FROM events WHERE event_type = 'session.receipt' AND owner = ?").all("agent:my-agent") as any[];
    expect(rows.length).toBe(1);
    const data = JSON.parse(rows[0].data);
    expect(data.owner).toBe("my-agent");
  });
});
