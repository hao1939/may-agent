import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { EventBus } from "../../src/app/event-bus.js";
import {
  attachDaemonEventSubscribers,
  attachEventPersistence,
  createMetricMutationSubscriber,
} from "../../src/app/daemon-events.js";
import { getDb, insertWorkflowRun } from "../../src/lib/requests.js";

describe("daemon event subscribers", () => {
  it("projects metric mutations only from their durable canonical events", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "daemon-metric-events-"));
    const bus = new EventBus();
    try {
      const db = getDb(persistDir);
      db.run("INSERT INTO metrics (id, threshold, updated_at) VALUES (?, ?, ?)", ["metric.test", 1, 0]);
      db.run("INSERT INTO metric_alerts (id, metric_id, created_at) VALUES (?, ?, ?)", [7, "metric.test", 1]);
      bus.subscribe(createMetricMutationSubscriber(persistDir));
      bus.emit({
        type: "metric.threshold_changed",
        owner: "agent:may",
        timestamp: 123,
        data: { metricId: "metric.test", from: 1, to: 3 },
      });
      bus.emit({
        type: "metric.alert_resolved",
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
      resumeSession: () => { throw new Error("test: resume not wired"); },
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
      resumeSession: () => { throw new Error("test: resume not wired"); },
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

  it("emits canonical escalation.created when auto-resume attempts are exhausted", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "daemon-events-resume-"));
    const bus = new EventBus();
    const events: any[] = [];
    const manager = {
      resumeSession: () => { throw new Error("test: resume not wired"); },
    };
    const originalSetTimeout = globalThis.setTimeout;

    try {
      (globalThis as any).setTimeout = (fn: () => void) => {
        fn();
        return 0;
      };
      attachDaemonEventSubscribers({
        bus,
        manager: manager as any,
        persistDir,
        projectRoot: persistDir,
      });
      bus.subscribe((event) => events.push(event));

      const interrupted = {
        type: "session.end",
        sessionId: "s_retry",
        agent: "scout",
        outcome: "interrupted",
        summary: "interrupted",
        durationMs: 10,
        status: "interrupted",
        error: "network reset",
        task: "finish investigation",
        opCount: 1,
        turnCount: 3,
      } as const;

      bus.emit(interrupted);
      bus.emit(interrupted);
      bus.emit(interrupted);

      const escalation = events.find((event) => event.type === "escalation.created");
      expect(escalation).toMatchObject({
        type: "escalation.created",
        source: "runtime:auto-resume",
        owner: "agent:may",
        urgency: "high",
        data: expect.objectContaining({
          sourceAgent: "scout",
          sourceSessionId: "s_retry",
          reason: expect.stringContaining("Interrupted 3x"),
          severity: "P1",
          dedupKey: "runtime:resume_exhausted:s_retry",
          resume: expect.objectContaining({ kind: "session", sessionId: "s_retry" }),
        }),
      });
      expect(events.some((event) => event.type === "message.created" && event.owner === "human:operator")).toBe(false);
      expect(existsSync(join(persistDir, "escalations.jsonl"))).toBe(false);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
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
      resumeSession: () => { throw new Error("test: resume not wired"); },
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
      expect(db.prepare("SELECT status, close_event_id FROM event_pair_runs WHERE open_event_id = ?").get(openEventId)).toMatchObject({
        status: "closed",
        close_event_id: expect.any(Number),
      });
      expect(
        db
          .prepare(
            `SELECT event_type, source, json_extract(data, '$.reason') AS reason, json_extract(data, '$.openEventId') AS openEventId
             FROM events
             WHERE event_type = 'event-pair.orphan-gc.close'
               AND json_extract(data, '$.openEventId') = ?`,
          )
          .get(openEventId),
      ).toEqual({
        event_type: "event-pair.orphan-gc.close",
        source: "runtime:restart-recovery",
        reason: "runtime-restarted",
        openEventId,
      });
      expect(
        db.prepare("SELECT close_event_id FROM event_pair_runs WHERE open_event_id = ?").get(openEventId),
      ).toEqual(
        db.prepare("SELECT id AS close_event_id FROM events WHERE event_type = 'event-pair.orphan-gc.close' AND json_extract(data, '$.openEventId') = ?").get(openEventId),
      );
      expect(events).toContainEqual(
        expect.objectContaining({ type: "info", message: "[handler-recovery] Closed 1 stale handler pair(s) after restart" }),
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
      resumeSession: () => { throw new Error("test: resume not wired"); },
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
                    json_extract(data, '$.pairName') AS pairName,
                    json_extract(data, '$.correlationKey') AS correlationKey,
                    json_extract(data, '$.workflow') AS workflow,
                    json_extract(data, '$.openEventId') AS openEventId
             FROM events
             WHERE event_type = 'event-pair.orphan-gc.close'
               AND json_extract(data, '$.openEventId') = ?`,
          )
          .get(openEventId),
      ).toEqual({
        event_type: "event-pair.orphan-gc.close",
        source: "runtime:restart-recovery",
        reason: "runtime-restarted",
        pairName: "workflow",
        correlationKey: "wr_restart_seed",
        workflow: "platform-owner-review",
        openEventId,
      });
      expect(events).toContainEqual(
        expect.objectContaining({ type: "info", message: "[workflow-recovery] Closed 1 stale workflow pair(s) after restart" }),
      );
    } finally {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("emits canonical escalation.created when the circuit breaker terminates a stuck session", async () => {
    const persistDir = mkdtempSync(join(tmpdir(), "daemon-events-circuit-"));
    const bus = new EventBus();
    const events: any[] = [];
    const manager = {
      resumeSession: () => { throw new Error("test: resume not wired"); },
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
        type: "session.start",
        source: "runtime",
        owner: "agent:builder",
        data: { sessionId: "s_stuck", agent: "builder", task: "fix build", trigger: "runtime", firedAt: Date.now() },
      } as any);
      for (let i = 0; i < 6; i++) {
        bus.emit({
          type: "turn_end",
          sessionId: "s_stuck",
          agent: "builder",
          toolCalls: 1,
          errorCount: 1,
        } as any);
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(events).toContainEqual(expect.objectContaining({ type: "cancel", sessionId: "s_stuck" }));
      const escalation = events.find((event) => event.type === "escalation.created");
      expect(escalation).toMatchObject({
        type: "escalation.created",
        source: "runtime:circuit-breaker",
        owner: "agent:may",
        urgency: "high",
        data: expect.objectContaining({
          sourceAgent: "builder",
          sourceSessionId: "s_stuck",
          reason: expect.stringContaining("Stuck: 6 consecutive error-only turns"),
          requestedAction: expect.stringContaining("Investigate the root cause"),
          severity: "P1",
          dedupKey: "runtime:circuit_break:s_stuck",
          resume: expect.objectContaining({ kind: "session", sessionId: "s_stuck" }),
        }),
      });
      expect(escalation.data).not.toHaveProperty("owner");
      expect(events.some((event) => event.type === "message.created" && event.source === "system:circuit-breaker")).toBe(false);
    } finally {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });
});
