import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { EventBus } from "./event-bus.js";
import { DbWriter } from "../lib/db-writer.js";
import { closeDb, getDb } from "../lib/requests.js";
import { createQueryService } from "../lib/query-service.js";

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), "may-event-delivery-"));
}

function attachPersistence(bus: EventBus, root: string): void {
  const writer = new DbWriter(root);
  bus.subscribe(writer.handler, { priority: "first" });
  bus.setDeliveryRecorder(writer.recordDelivery);
}

describe("event delivery metadata", () => {
  it("records direct subscriber acceptance on the original event row", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);
      bus.subscribe((event) => {
        if (event.type !== "project.feedback.created") return;
        return { accepted: true, by: "test:handler", route: "direct" };
      });

      bus.emit({
        type: "project.feedback.created",
        source: "test",
        owner: "agent:owner",
        data: { projectId: "sample", message: "review" },
      } as any);

      const db = getDb(root);
      const row = db.prepare(
        `SELECT delivery_status, accepted_by, delivery_route
         FROM events
         WHERE event_type = 'project.feedback.created'`,
      ).get() as Record<string, unknown>;
      expect(row).toMatchObject({
        delivery_status: "accepted",
        accepted_by: "test:handler",
        delivery_route: "direct",
      });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("routes owner-addressed unhandled events to owner inbox and opens a pair", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);

      bus.emit({
        type: "message.created",
        source: "test",
        owner: "agent:dev",
        data: { from: "test", to: "dev", content: "please review" },
      } as any);

      const db = getDb(root);
      const event = db.prepare(
        `SELECT id, delivery_status, accepted_by, delivery_route
         FROM events
         WHERE event_type = 'message.created'`,
      ).get() as Record<string, unknown>;
      expect(event).toMatchObject({
        delivery_status: "accepted",
        accepted_by: "owner-inbox:agent:dev",
        delivery_route: "owner_inbox",
      });

      const pair = db.prepare(
        `SELECT pair_name, open_event_id, status
         FROM event_pair_runs
         WHERE open_event_id = ?`,
      ).get(event.id) as Record<string, unknown>;
      expect(pair).toMatchObject({
        pair_name: "owner_inbox",
        open_event_id: event.id,
        status: "open",
      });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not owner-inbox lifecycle facts that should have explicit consumers", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);

      bus.emit({
        type: "handler.started",
        source: "cron",
        owner: "agent:may",
        data: { handler: "sample", agent: "may" },
      } as any);

      const db = getDb(root);
      const event = db.prepare(
        `SELECT id, delivery_status, accepted_by, delivery_route
         FROM events
         WHERE event_type = 'handler.started'`,
      ).get() as Record<string, unknown>;
      expect(event).toMatchObject({
        delivery_status: "accepted",
        accepted_by: "event-pair-tracker",
        delivery_route: "direct",
      });
      const pair = db.prepare(
        `SELECT pair_name, status
         FROM event_pair_runs
         WHERE open_event_id = ?`,
      ).get(event.id) as Record<string, unknown>;
      expect(pair).toMatchObject({
        pair_name: "handler",
        status: "open",
      });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts unclaimed owned events with the default owner route", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);

      bus.emit({
        type: "runtime.daemon.heartbeat",
        source: "daemon",
        owner: "agent:may",
        data: { pid: 123, interfaceAgent: "may", socketEnabled: true },
      } as any);
      bus.emit({
        type: "metric.feedback.routed",
        source: "project-app-loader",
        owner: "agent:may",
        data: {
          metricId: "runtime.example",
          appId: "may-agent",
          route: "owner-app",
        },
      } as any);

      const db = getDb(root);
      for (const eventType of ["runtime.daemon.heartbeat", "metric.feedback.routed"]) {
        const event = db.prepare(
          `SELECT delivery_status, accepted_by, delivery_route
           FROM events
           WHERE event_type = ?`,
        ).get(eventType) as Record<string, unknown>;
        expect(event).toMatchObject({
          delivery_status: "accepted",
          accepted_by: "default-owner:agent:may",
          delivery_route: "direct",
        });
      }
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("closes convention-tracked lifecycle pairs by correlation key", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);

      bus.emit({
        type: "handler.started",
        source: "cron",
        owner: "agent:may",
        data: { handler: "sample", agent: "may" },
      } as any);
      bus.emit({
        type: "handler.completed",
        source: "cron",
        owner: "agent:may",
        data: { handler: "sample", agent: "may", durationMs: 5 },
      } as any);

      const db = getDb(root);
      const pair = db.prepare(
        `SELECT status, close_event_id
         FROM event_pair_runs
         WHERE pair_name = 'handler'
           AND correlation_key = 'sample'`,
      ).get() as Record<string, unknown>;
      expect(pair.status).toBe("closed");
      expect(typeof pair.close_event_id).toBe("number");
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("marks new unaccepted events unhandled after their ttl", async () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);

      bus.emit({
        type: "reload",
        ttl_ms: 1,
      } as any);
      await new Promise((resolve) => setTimeout(resolve, 5));
      bus.emit({
        type: "handler.completed",
        source: "cron",
        owner: "agent:may",
        data: { handler: "sample", agent: "may", durationMs: 5 },
      } as any);

      const db = getDb(root);
      const row = db.prepare(
        `SELECT delivery_status
         FROM events
         WHERE event_type = 'reload'`,
      ).get() as Record<string, unknown>;
      expect(row.delivery_status).toBe("unhandled");

      const query = createQueryService({ getDb: () => db });
      const health = query.eventDeliveryHealth({ limit: 10 });
      expect(health.unhandledEvents).toEqual([
        expect.objectContaining({
          eventType: "reload",
          deliveryStatus: "unhandled",
        }),
      ]);
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts reconciled session.end lifecycle facts as terminal no-ops", async () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);
      const db = getDb(root);

      db.prepare(
        `INSERT INTO events
         (event_type, source, owner, data, timestamp, ttl_ms)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        "session.end",
        null,
        null,
        JSON.stringify({
          sessionId: "s_123",
          agent: "evaluator",
          status: "done",
          reconciled: true,
        }),
        Date.now(),
        1,
      );

      await new Promise((resolve) => setTimeout(resolve, 5));
      bus.emit({
        type: "handler.completed",
        source: "cron",
        owner: "agent:may",
        data: { handler: "sample", agent: "may", durationMs: 5 },
      } as any);

      const row = db.prepare(
        `SELECT delivery_status, accepted_by, delivery_route
         FROM events
         WHERE event_type = 'session.end'`,
      ).get() as Record<string, unknown>;
      expect(row).toMatchObject({
        delivery_status: "accepted",
        accepted_by: "terminal-noop",
        delivery_route: "noop",
      });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reports orphan owner-inbox pairs in delivery health", async () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);

      bus.emit({
        type: "message.created",
        source: "test",
        owner: "agent:dev",
        ttl_ms: 1,
        data: { from: "test", to: "dev", content: "please review quickly" },
      } as any);
      await new Promise((resolve) => setTimeout(resolve, 5));
      bus.emit({
        type: "handler.completed",
        source: "cron",
        owner: "agent:may",
        data: { handler: "sample", agent: "may", durationMs: 5 },
      } as any);

      const db = getDb(root);
      const query = createQueryService({ getDb: () => db });
      const health = query.eventDeliveryHealth({ limit: 10 });
      expect(health.orphanPairs).toEqual([
        expect.objectContaining({
          pairName: "owner_inbox",
          status: "orphan",
          openEventType: "message.created",
        }),
      ]);
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("late follow-up events close orphaned owner-inbox pairs", async () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);

      bus.emit({
        type: "message.created",
        source: "test",
        owner: "agent:dev",
        ttl_ms: 1,
        data: { from: "test", to: "dev", content: "please review quickly" },
      } as any);

      const db = getDb(root);
      const event = db.prepare(
        `SELECT id FROM events WHERE event_type = 'message.created'`,
      ).get() as Record<string, unknown>;

      await new Promise((resolve) => setTimeout(resolve, 5));
      bus.emit({
        type: "handler.completed",
        source: "cron",
        owner: "agent:may",
        data: { handler: "sample", agent: "may", durationMs: 5 },
      } as any);

      expect(
        (
          db.prepare(
            `SELECT status FROM event_pair_runs WHERE open_event_id = ?`,
          ).get(event.id) as Record<string, unknown>
        ).status,
      ).toBe("orphan");

      bus.emit({
        type: "message.reviewed",
        source: "test",
        owner: "agent:dev",
        data: { openEventId: event.id, reviewedBy: "dev" },
      } as any);

      expect(
        (
          db.prepare(
            `SELECT status FROM event_pair_runs WHERE open_event_id = ?`,
          ).get(event.id) as Record<string, unknown>
        ).status,
      ).toBe("closed");
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("closes task assignment pairs when completion was recorded first", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);

      bus.emit({
        type: "project.task.completed",
        source: "watchdog",
        owner: "project:sample",
        data: {
          taskId: "sample-task",
          attemptId: "a_sample-task_1",
          result: "done",
        },
      } as any);

      bus.emit({
        type: "project.task.assigned",
        source: "planner",
        owner: "project:sample",
        data: {
          taskId: "sample-task",
          attemptId: "a_sample-task_1",
          sessionId: "s_task_sample-task",
        },
      } as any);

      const db = getDb(root);
      const pair = db
        .prepare(
          `SELECT status, close_event_id, note
           FROM event_pair_runs
           WHERE pair_name = 'project.task'
             AND correlation_key = ?`,
        )
        .get("sample-task:a_sample-task_1") as Record<string, unknown>;

      expect(pair).toMatchObject({
        status: "closed",
        note: "closed by earlier project.task.completed",
      });
      expect(typeof pair.close_event_id).toBe("number");

      db.run(
        `UPDATE event_pair_runs
         SET status = 'open', close_event_id = NULL, closed_at = NULL, note = 'legacy open pair'
         WHERE pair_name = 'project.task'
           AND correlation_key = ?`,
        ["sample-task:a_sample-task_1"],
      );

      bus.emit({
        type: "handler.started",
        source: "cron",
        owner: "agent:may",
        data: { handler: "sample" },
      } as any);

      const repaired = db
        .prepare(
          `SELECT status, close_event_id, note
           FROM event_pair_runs
           WHERE pair_name = 'project.task'
             AND correlation_key = ?`,
        )
        .get("sample-task:a_sample-task_1") as Record<string, unknown>;
      expect(repaired).toMatchObject({
        status: "closed",
        note: "closed by earlier project.task.completed",
      });
      expect(typeof repaired.close_event_id).toBe("number");
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("owner inbox review emits a follow-up event and closes the owner-inbox pair", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);

      bus.emit({
        type: "message.created",
        source: "test",
        owner: "agent:dev",
        data: { from: "test", to: "dev", content: "please review" },
      } as any);

      const db = getDb(root);
      const query = createQueryService({ getDb: () => db });
      const inbox = query.heartbeatContext({ agent: "dev" }).inbox;
      expect(inbox).toHaveLength(1);
      const id = inbox[0]!.id as number;

      expect(query.reviewInboxEvents([id], "dev")).toBe(1);

      const followup = db.prepare(
        `SELECT event_type, data, delivery_status, delivery_route
         FROM events
         WHERE event_type = 'message.reviewed'`,
      ).get() as Record<string, unknown>;
      expect(followup).toMatchObject({
        event_type: "message.reviewed",
        delivery_status: "accepted",
        delivery_route: "direct",
      });
      expect(JSON.parse(String(followup.data))).toMatchObject({
        openEventId: id,
        openEventType: "message.created",
        reviewedBy: "dev",
      });

      const pair = db.prepare(
        `SELECT status
         FROM event_pair_runs
         WHERE open_event_id = ?`,
      ).get(id) as Record<string, unknown>;
      expect(pair.status).toBe("closed");
      expect(query.heartbeatContext({ agent: "dev" }).inbox).toHaveLength(0);
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
