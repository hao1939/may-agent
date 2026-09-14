import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { EventBus } from "../../src/app/core/events/bus.js";
import {
  attachDaemonEventSubscribers,
  attachEventPersistence,
} from "../../src/app/daemon-events.js";
import { closeDb, getDb, insertWorkflowRun } from "../../src/lib/requests.js";
import { createEventInterface } from "../../src/app/core/events/interface.js";

describe("daemon event subscribers", () => {
  it("metric admission rolls back on storage failure; retry and replay retain the latest edit", () => {
    const root = mkdtempSync(join(tmpdir(), "metric-admission-"));
    try {
      const db = getDb(root);
      const bus = new EventBus();
      attachEventPersistence({ bus, persistDir: root });
      const events = createEventInterface({ bus, db, hasApp: () => false, hasAgent: () => false,
        hasSession: () => false, acceptsAppInput: () => false });
      db.exec("INSERT INTO metrics(id, threshold, updated_at) VALUES ('health', 10, 0)");
      db.exec("CREATE TRIGGER refuse_metric BEFORE UPDATE ON metrics BEGIN SELECT RAISE(ABORT, 'write failed'); END");
      const edit = (to: number) => events.publish({ type: "metric.threshold_changed", idempotencyKey: `edit-${to}`,
        data: { metricId: "health", to } }, { source: "test" });
      expect(() => edit(20)).toThrow("write failed");
      expect(db.prepare("SELECT count(*) AS n FROM events WHERE event_type = 'metric.threshold_changed'").get()).toEqual({ n: 0 });
      expect(db.prepare("SELECT threshold FROM metrics WHERE id = 'health'").get()).toEqual({ threshold: 10 });
      db.exec("DROP TRIGGER refuse_metric");
      const first = edit(20);
      edit(30);
      expect(edit(20).eventId).toBe(first.eventId);
      closeDb(root);
      expect(getDb(root).prepare("SELECT threshold FROM metrics WHERE id = 'health'").get()).toEqual({ threshold: 30 });
    } finally { closeDb(root); rmSync(root, { recursive: true, force: true }); }
  });
  for (const kind of ["call", "job"] as const) {
    it(`keeps errors and interruption as evidence for a ${kind}, without automatic intervention`, async () => {
      const persistDir = mkdtempSync(join(tmpdir(), "daemon-stuck-ownership-"));
      const bus = new EventBus();
      const events: any[] = [];
      try {
        attachEventPersistence({ bus, persistDir });
        let resumes = 0;
        attachDaemonEventSubscribers({ bus, manager: { resumeSession: () => { resumes++; } } as any, persistDir, projectRoot: persistDir });
        bus.subscribe(event => events.push(event));
        bus.emit({ type: "session.start", data: { sessionId: "stuck", agent: "worker", kind } } as any);
        for (let turn = 0; turn < 6; turn++) {
          bus.emit({ type: "turn_end", sessionId: "stuck", agent: "worker", toolCalls: 1, errorCount: 1 } as any);
        }
        bus.emit({ type: "session.end", data: { sessionId: "stuck", agent: "worker", kind,
          status: "interrupted", outcome: "interrupted", opCount: 6, summary: "Caller stopped" } } as any);
        await new Promise<void>(resolve => setImmediate(resolve));
        expect(events.filter(event => event.type === "turn_end")).toHaveLength(6);
        expect(events.filter(event => event.type === "session.cancel.requested")).toEqual([]);
        expect(events.filter(event => event.type === "escalation.created")).toEqual([]);
        expect(resumes).toBe(0);

      } finally {
        closeDb(persistDir);
        rmSync(persistDir, { recursive: true, force: true });
      }
    });
  }

  it("projects metric mutations only from their durable canonical events", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "daemon-metric-events-"));
    const bus = new EventBus();
    try {
      const db = getDb(persistDir);
      db.run("INSERT INTO metrics (id, threshold, updated_at) VALUES (?, ?, ?)", ["metric.test", 1, 0]);
      db.run("INSERT INTO metric_alerts (id, metric_id, created_at) VALUES (?, ?, ?)", [7, "metric.test", 1]);
      attachEventPersistence({ bus, persistDir });
      bus.emit({
        type: "metric.threshold_changed",
        source: "test",
        owner: "agent:may",
        timestamp: 123,
        data: { metricId: "metric.test", from: 1, to: 3 },
      });
      bus.emit({
        type: "metric.alert_resolved",
        source: "test",
        owner: "agent:may",
        timestamp: 456,
        data: { metricId: "metric.test", alertId: 7 },
      });
      expect(db.prepare("SELECT threshold, updated_at FROM metrics WHERE id = ?").get("metric.test")).toEqual({
        threshold: 3,
        updated_at: 123,
      });
      expect(db.prepare("SELECT resolved_at FROM metric_alerts WHERE id = ?").get(7)).toEqual({ resolved_at: 456 });
    } finally {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("keeps blocked session.end local until an owner explicitly escalates", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "daemon-events-"));
    const bus = new EventBus();
    const events: any[] = [];
    const manager = {
      resumeSession: () => {
        throw new Error("test: resume not wired");
      },
    };

    try {
      attachDaemonEventSubscribers({
        bus,
        manager: manager as any,
        persistDir,
        projectRoot: persistDir,
      });
      bus.subscribe((event) => events.push(event));

      bus.emit({
        type: "session.end",
        sessionId: "s_1",
        agent: "scout",
        outcome: "need input",
        summary: "blocked",
        durationMs: 10,
        status: "done",
        finishParams: {
          status: "blocked",
          summary: "need input",
          blockers: [{ reason: "missing deployment approval", context: "deploy cannot continue" }],
          next_steps: "Ask May to route the approval request.",
        },
      });

      expect(events.some((event) => event.type === "escalation.created")).toBe(false);
      expect(events.some((event) => event.type === "session.escalated")).toBe(false);
      expect(events.some((event) => event.type === "session.completed")).toBe(false);
      expect(events.some((event) => event.type === "session.receipt")).toBe(false);
    } finally {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("does not manufacture another terminal event for error session.end", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "daemon-events-error-"));
    const bus = new EventBus();
    const events: any[] = [];
    const manager = {
      resumeSession: () => {
        throw new Error("test: resume not wired");
      },
    };

    try {
      attachDaemonEventSubscribers({
        bus,
        manager: manager as any,
        persistDir,
        projectRoot: persistDir,
      });
      bus.subscribe((event) => events.push(event));

      bus.emit({
        type: "session.end",
        sessionId: "s_error",
        agent: "dev",
        outcome: "error",
        summary: "failed",
        durationMs: 10,
        status: "error",
        error: "boom",
        task: "fix issue",
      });

      expect(events.some((event) => event.type === "session.completed")).toBe(false);
      expect(events.some((event) => event.type === "session.receipt")).toBe(false);
      expect(events.some((event) => event.type === "session.failed")).toBe(false);
    } finally {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });


  it("closes stale handler pairs on daemon startup after a restart", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "daemon-events-handler-restart-"));
    const seedBus = new EventBus();
    attachEventPersistence({ bus: seedBus, persistDir });
    seedBus.emit({
      type: "handler.started",
      source: "cron",
      owner: "agent:may",
      data: { handler: "metrics-snapshot", handlerRunId: "handler:metrics-snapshot:seed:1", agent: "may" },
    } as any);
    const openEventId = Number(
      (
        getDb(persistDir)
          .prepare("SELECT id FROM events WHERE event_type = 'handler.started' ORDER BY id DESC LIMIT 1")
          .get() as { id: number }
      ).id,
    );

    const bus = new EventBus();
    const events: any[] = [];
    const manager = {
      resumeSession: () => {
        throw new Error("test: resume not wired");
      },
      activeSessions: new Map<string, unknown>(),
    };

    try {
      attachEventPersistence({ bus, persistDir });
      bus.subscribe((event) => events.push(event));
      attachDaemonEventSubscribers({
        bus,
        manager: manager as any,
        persistDir,
        projectRoot: persistDir,
      });

      const db = getDb(persistDir);
      expect(
        db.prepare("SELECT status, close_event_id FROM event_pair_runs WHERE open_event_id = ?").get(openEventId),
      ).toMatchObject({
        status: "closed",
        close_event_id: expect.any(Number),
      });
      expect(
        db
          .prepare(
            `SELECT event_type, source,
                    json_extract(data, '$.error') AS error,
                    json_extract(data, '$.handlerRunId') AS handlerRunId
             FROM events
             WHERE event_type = 'handler.failed'
               AND json_extract(data, '$.handlerRunId') = ?`,
          )
          .get("handler:metrics-snapshot:seed:1"),
      ).toEqual({
        event_type: "handler.failed",
        source: "runtime:restart-recovery",
        error: "Process restarted before the handler completed",
        handlerRunId: "handler:metrics-snapshot:seed:1",
      });
      expect(db.prepare("SELECT close_event_id FROM event_pair_runs WHERE open_event_id = ?").get(openEventId)).toEqual(
        db
          .prepare(
            "SELECT id AS close_event_id FROM events WHERE event_type = 'handler.failed' AND json_extract(data, '$.handlerRunId') = ?",
          )
          .get("handler:metrics-snapshot:seed:1"),
      );
      expect(events).toContainEqual(
        expect.objectContaining({
          type: "info",
          message: "[handler-recovery] Closed 1 stale handler pair(s) after restart",
        }),
      );
    } finally {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("closes stale workflow pairs on daemon startup after a restart", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "daemon-events-workflow-restart-"));
    const seedBus = new EventBus();
    attachEventPersistence({ bus: seedBus, persistDir });
    seedBus.emit({
      type: "workflow.started",
      source: "workflow:platform-owner-review",
      owner: "agent:tech-lead",
      data: {
        workflowRunId: "wr_restart_seed",
        workflow: "platform-owner-review",
        task: "seed workflow pair",
        projectId: "may-agent",
      },
    } as any);
    insertWorkflowRun(persistDir, {
      runId: "wr_restart_seed",
      workflow: "platform-owner-review",
      task: "seed workflow pair",
      parentSessionId: null,
      parentWorkflowRunId: null,
      projectId: "may-agent",
      depth: 1,
      status: "interrupted",
      startedAt: Date.now() - 60_000,
      endedAt: Date.now() - 1_000,
      result_summary: null,
      result_reason: "Process restarted",
      resumedFromRunId: null,
    });
    const openEventId = Number(
      (
        getDb(persistDir)
          .prepare("SELECT id FROM events WHERE event_type = 'workflow.started' ORDER BY id DESC LIMIT 1")
          .get() as { id: number }
      ).id,
    );

    const bus = new EventBus();
    const events: any[] = [];
    const manager = {
      resumeSession: () => {
        throw new Error("test: resume not wired");
      },
      activeSessions: new Map<string, unknown>(),
    };

    try {
      attachEventPersistence({ bus, persistDir });
      bus.subscribe((event) => events.push(event));
      attachDaemonEventSubscribers({
        bus,
        manager: manager as any,
        persistDir,
        projectRoot: persistDir,
      });

      const db = getDb(persistDir);
      expect(
        db.prepare("SELECT status, close_event_id FROM event_pair_runs WHERE open_event_id = ?").get(openEventId),
      ).toMatchObject({
        status: "closed",
        close_event_id: expect.any(Number),
      });
      expect(
        db
          .prepare(
            `SELECT event_type, source,
                    json_extract(data, '$.reason') AS reason,
                    json_extract(data, '$.workflowRunId') AS workflowRunId,
                    json_extract(data, '$.workflow') AS workflow,
                    json_extract(data, '$.workflowRunId') AS correlationKey
             FROM events
             WHERE event_type = 'workflow.interrupted'
               AND json_extract(data, '$.workflowRunId') = ?`,
          )
          .get("wr_restart_seed"),
      ).toEqual({
        event_type: "workflow.interrupted",
        source: "runtime:restart-recovery",
        reason: "runtime-restarted",
        correlationKey: "wr_restart_seed",
        workflowRunId: "wr_restart_seed",
        workflow: "platform-owner-review",
      });
      expect(events).toContainEqual(
        expect.objectContaining({
          type: "info",
          message: "[workflow-recovery] Closed 1 stale workflow pair(s) after restart",
        }),
      );
    } finally {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });


});
