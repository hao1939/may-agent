import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { EVENT_INGRESS_SOURCE, EVENT_ROW_ID, EventBus } from "./core/events/bus.js";
import { DbWriter } from "../lib/db-writer.js";
import { checkEventTraceIntegrity } from "../lib/db/event-traces.js";
import { closeDb, getDb } from "../lib/db/connection.js";
import { createQueryService } from "../lib/query-service.js";

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), "may-event-delivery-"));
}

function attachPersistence(bus: EventBus, root: string): void {
  // Delivery-expiry tests use millisecond TTLs and invoke housekeeping after
  // each persisted event. Production runs it in the maintenance process.
  const writer = new DbWriter(root, { housekeepingIntervalMs: 0 });
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  bus.subscribe(() => writer.runHousekeeping());
}

describe("retry-safe event ingress", () => {
  it("returns the original receipt and delivers an idempotent intent once", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);
      const delivered: string[] = [];
      bus.subscribe((event) => delivered.push(event.type));
      const intent = {
        type: "project.comment.created",
        source: "web-ui",
        owner: "agent:sample-owner",
        data: {
          project: "sample",
          comment: "advance the project",
          idempotencyKey: "comment-1",
        },
      } as any;

      const first = bus.emit(structuredClone(intent));
      const retry = bus.emit(structuredClone(intent));

      expect(first[EVENT_ROW_ID]).toBeGreaterThan(0);
      expect(retry[EVENT_ROW_ID]).toBe(first[EVENT_ROW_ID]);
      expect(delivered).toEqual(["project.comment.created"]);
      expect(
        getDb(root).prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'project.comment.created'").get(),
      ).toMatchObject({ count: 1 });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects reuse of an idempotency key for different input", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);
      bus.emit({
        type: "project.comment.created",
        source: "web-ui",
        owner: "agent:sample-owner",
        data: { project: "sample", comment: "first", idempotencyKey: "comment-1" },
      } as any);

      expect(() =>
        bus.emit({
          type: "project.comment.created",
          source: "web-ui",
          owner: "agent:sample-owner",
          data: { project: "sample", comment: "different", idempotencyKey: "comment-1" },
        } as any),
      ).toThrow("already used with different event input");
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps a retried persisted event pending when no explicit route accepts it", () => {
    const root = tempRoot();
    try {
      const writer = new DbWriter(root);
      const original = {
        type: "project.comment.created",
        source: "web-ui",
        owner: "agent:sample-owner",
        data: { project: "sample", comment: "advance", idempotencyKey: "pending-1" },
      } as any;
      writer.handler(original);
      const originalId = original[EVENT_ROW_ID];

      const bus = new EventBus();
      bus.setPersistenceSubscriber(writer.handler);
      bus.setDeliveryRecorder(writer.recordDelivery);
      const broadFanout: number[] = [];
      bus.subscribe((event) => {
        if (event.type !== "project.comment.created") return;
        broadFanout.push(Number(event[EVENT_ROW_ID]));
      });

      const retry = bus.emit(structuredClone(original));
      expect(retry[EVENT_ROW_ID]).toBe(originalId);
      expect(broadFanout).toEqual([]);
      expect(getDb(root).prepare("SELECT COUNT(*) AS count FROM events").get()).toMatchObject({ count: 1 });
      expect(
        getDb(root).prepare("SELECT delivery_status, delivery_route FROM events WHERE id = ?").get(originalId),
      ).toMatchObject({
        delivery_status: "pending",
        delivery_route: null,
      });
      expect(
        getDb(root)
          .prepare(
            "SELECT COUNT(*) AS count FROM event_pair_runs WHERE open_event_id = ? AND pair_name = 'owner_inbox'",
          )
          .get(originalId),
      ).toMatchObject({ count: 0 });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("scopes retries by trusted ingress identity instead of caller source", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);
      const event = {
        type: "project.comment.created",
        source: "caller-controlled",
        owner: "agent:sample-owner",
        data: { project: "sample", comment: "advance", idempotencyKey: "shared-1" },
      } as any;
      const web = structuredClone(event);
      const telegram = structuredClone(event);
      Object.defineProperty(web, EVENT_INGRESS_SOURCE, { value: "web-ui" });
      Object.defineProperty(telegram, EVENT_INGRESS_SOURCE, { value: "telegram" });

      bus.emit(web);
      bus.emit(telegram);

      expect(getDb(root).prepare("SELECT COUNT(*) AS count FROM events").get()).toMatchObject({ count: 2 });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("event delivery metadata", () => {
  it("creates event trace side tables for graphable history", () => {
    const root = tempRoot();
    try {
      const db = getDb(root);
      const traceCols = db.prepare("PRAGMA table_info(event_traces)").all();
      const linkCols = db.prepare("PRAGMA table_info(event_trace_links)").all();
      const traceIndexes = db.prepare("PRAGMA index_list(event_traces)").all();
      const linkIndexes = db.prepare("PRAGMA index_list(event_trace_links)").all();
      const pairIndexes = db.prepare("PRAGMA index_list(event_pair_runs)").all();

      expect(traceCols.map((row) => row.name)).toEqual(["event_id", "trace_id", "parent_event_id", "visibility"]);
      expect(linkCols.map((row) => row.name)).toEqual([
        "id",
        "from_event_id",
        "to_event_id",
        "type",
        "label",
        "created_at",
      ]);
      expect(traceIndexes.map((row) => row.name)).toContain("idx_event_traces_trace");
      expect(traceIndexes.map((row) => row.name)).toContain("idx_event_traces_parent");
      expect(linkIndexes.map((row) => row.name)).toContain("idx_event_trace_links_from");
      expect(linkIndexes.map((row) => row.name)).toContain("idx_event_trace_links_to");
      expect(pairIndexes.map((row) => row.name)).toContain("idx_event_pair_close_event");
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

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
      const row = db
        .prepare(
          `SELECT delivery_status, accepted_by, delivery_route
         FROM events
         WHERE event_type = 'project.feedback.created'`,
        )
        .get() as Record<string, unknown>;
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

  it("persists default trace metadata for every new event row", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);

      bus.emit({
        type: "project.feedback.created",
        source: "test",
        owner: "agent:owner",
        data: { projectId: "sample", message: "review" },
      });

      const db = getDb(root);
      const event = db.prepare("SELECT id FROM events WHERE event_type = 'project.feedback.created'").get() as {
        id: number;
      };
      const trace = db.prepare("SELECT * FROM event_traces WHERE event_id = ?").get(event.id);

      expect(trace).toMatchObject({
        event_id: event.id,
        trace_id: `event:${event.id}`,
        parent_event_id: null,
        visibility: "default",
      });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("creates a default trace for direct event inserts", () => {
    const root = tempRoot();
    try {
      const db = getDb(root);
      const inserted = db.run(
        `INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)`,
        ["test.direct", "test", "agent:owner", "{}", Date.now()],
      ) as { lastInsertRowid?: number | bigint };
      const eventId = Number(inserted.lastInsertRowid);
      expect(db.prepare("SELECT * FROM event_traces WHERE event_id = ?").get(eventId)).toMatchObject({
        event_id: eventId,
        trace_id: `event:${eventId}`,
        parent_event_id: null,
        visibility: "default",
      });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reports event trace integrity gaps", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);

      bus.emit({
        type: "project.feedback.created",
        source: "test",
        owner: "agent:owner",
        data: { projectId: "sample", message: "review" },
      });

      const db = getDb(root);
      expect(checkEventTraceIntegrity(db)).toMatchObject({
        eventCount: 1,
        traceCount: 1,
        missingTraceCount: 0,
        danglingParentCount: 0,
        danglingLinkCount: 0,
        ok: true,
      });

      const event = db.prepare("SELECT id FROM events").get() as { id: number };
      db.run("DELETE FROM event_traces WHERE event_id = ?", [event.id]);
      expect(checkEventTraceIntegrity(db)).toMatchObject({
        eventCount: 1,
        traceCount: 0,
        missingTraceCount: 1,
        ok: false,
      });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("audits May Conversation admission and result correlation without adapter delivery", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);
      bus.emit({
        type: "conversation.message.created",
        source: "console",
        owner: "app:may",
        data: {
          appId: "may",
          conversationId: "may:primary",
          author: { kind: "human", id: "console:1" },
          text: "Review this",
        },
      });

      const db = getDb(root);
      const event = db.prepare("SELECT id FROM events").get() as { id: number };
      expect(checkEventTraceIntegrity(db)).toMatchObject({
        conversationHumanWithoutSingleRequestCount: 1,
        resultWithoutConversationCount: 0,
        semanticOk: false,
      });

      db.run(
        `INSERT INTO app_inbox_items
         (id, app_id, conversation_id, source_kind, source_id, input_kind,
          input_data, status, origin_event_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "request-1",
          "may",
          "may:primary",
          "human",
          "console:1",
          "message",
          JSON.stringify({ message: "Review this" }),
          "pending",
          event.id,
          1,
          1,
        ],
      );
      expect(checkEventTraceIntegrity(db)).toMatchObject({
        conversationHumanWithoutSingleRequestCount: 0,
        resultWithoutConversationCount: 0,
        semanticOk: true,
      });

      db.run(
        "UPDATE app_inbox_items SET status = 'done', result = ?, conversation_id = NULL WHERE id = ?",
        [JSON.stringify({ response: "Reviewed." }), "request-1"],
      );
      expect(checkEventTraceIntegrity(db)).toMatchObject({
        conversationHumanWithoutSingleRequestCount: 0,
        resultWithoutConversationCount: 1,
        semanticOk: false,
      });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("persists explicit trace parent and closure links", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);

      bus.emit({
        type: "project.feedback.created",
        source: "test",
        owner: "agent:owner",
        data: { projectId: "sample", message: "open" },
      });

      const db = getDb(root);
      const rootEvent = db.prepare("SELECT id FROM events WHERE event_type = 'project.feedback.created'").get() as {
        id: number;
      };

      bus.emit({
        type: "project.feedback.reviewed",
        source: "test",
        owner: "agent:owner",
        visibility: "detail",
        trace: {
          traceId: `event:${rootEvent.id}`,
          parentEventId: rootEvent.id,
          links: [{ eventId: rootEvent.id, type: "closure", label: "reviewed" }],
        },
        data: { openEventId: rootEvent.id, reviewedBy: "test" },
      });

      const closeEvent = db.prepare("SELECT id FROM events WHERE event_type = 'project.feedback.reviewed'").get() as {
        id: number;
      };
      const trace = db.prepare("SELECT * FROM event_traces WHERE event_id = ?").get(closeEvent.id);
      const link = db.prepare("SELECT * FROM event_trace_links WHERE from_event_id = ?").get(closeEvent.id);

      expect(trace).toMatchObject({
        event_id: closeEvent.id,
        trace_id: `event:${rootEvent.id}`,
        parent_event_id: rootEvent.id,
        visibility: "detail",
      });
      expect(link).toMatchObject({
        from_event_id: closeEvent.id,
        to_event_id: rootEvent.id,
        type: "closure",
        label: "reviewed",
      });

    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("infers trace parent and closure link from openEventId", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);

      bus.emit({
        type: "project.feedback.created",
        source: "test",
        owner: "agent:owner",
        data: { projectId: "sample", message: "open" },
      });

      const db = getDb(root);
      const rootEvent = db.prepare("SELECT id FROM events WHERE event_type = 'project.feedback.created'").get() as {
        id: number;
      };

      bus.emit({
        type: "project.feedback.reviewed",
        source: "test",
        owner: "agent:owner",
        data: { openEventId: rootEvent.id, reviewedBy: "test" },
      });

      const closeEvent = db.prepare("SELECT id FROM events WHERE event_type = 'project.feedback.reviewed'").get() as {
        id: number;
      };
      const trace = db.prepare("SELECT * FROM event_traces WHERE event_id = ?").get(closeEvent.id);
      const link = db
        .prepare("SELECT * FROM event_trace_links WHERE from_event_id = ? AND to_event_id = ?")
        .get(closeEvent.id, rootEvent.id);

      expect(trace).toMatchObject({
        event_id: closeEvent.id,
        trace_id: `event:${rootEvent.id}`,
        parent_event_id: rootEvent.id,
      });
      expect(link).toMatchObject({
        from_event_id: closeEvent.id,
        to_event_id: rootEvent.id,
        type: "closure",
        label: "project.feedback.reviewed",
      });

    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("infers escalation closure traces from legacy escalationId", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);

      bus.emit({
        type: "escalation.created",
        source: "test",
        owner: "agent:may",
        data: {
          escalationId: "esc_trace_test",
          reason: "needs human input",
        },
      } as any);

      const db = getDb(root);
      const created = db.prepare("SELECT id FROM events WHERE event_type = 'escalation.created'").get() as {
        id: number;
      };

      bus.emit({
        type: "escalation.resolved",
        source: "test",
        owner: "agent:may",
        data: {
          escalationId: "esc_trace_test",
          outcome: "resolved",
          summary: "human answered",
        },
      } as any);

      const resolved = db.prepare("SELECT id FROM events WHERE event_type = 'escalation.resolved'").get() as {
        id: number;
      };
      const trace = db.prepare("SELECT * FROM event_traces WHERE event_id = ?").get(resolved.id);
      const link = db
        .prepare("SELECT * FROM event_trace_links WHERE from_event_id = ? AND to_event_id = ?")
        .get(resolved.id, created.id);

      expect(trace).toMatchObject({
        event_id: resolved.id,
        trace_id: `event:${created.id}`,
        parent_event_id: created.id,
      });
      expect(link).toMatchObject({
        from_event_id: resolved.id,
        to_event_id: created.id,
        type: "closure",
        label: "escalation.resolved",
      });

    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ignores explicit trace links to missing events", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);

      bus.emit({
        type: "project.feedback.reviewed",
        source: "test",
        owner: "agent:owner",
        trace: {
          traceId: "event:99999",
          parentEventId: 99999,
          links: [{ eventId: 99999, type: "closure", label: "missing" }],
        },
        data: { reviewedBy: "test" },
      });

      const db = getDb(root);
      const event = db.prepare("SELECT id FROM events WHERE event_type = 'project.feedback.reviewed'").get() as {
        id: number;
      };
      const trace = db.prepare("SELECT * FROM event_traces WHERE event_id = ?").get(event.id);
      const links = db.prepare("SELECT COUNT(*) as c FROM event_trace_links").get() as { c: number };

      expect(trace).toMatchObject({
        event_id: event.id,
        trace_id: "event:99999",
        parent_event_id: null,
      });
      expect(links.c).toBe(0);
      expect(checkEventTraceIntegrity(db)).toMatchObject({
        eventCount: 1,
        traceCount: 1,
        danglingTraceCount: 0,
        danglingParentCount: 0,
        danglingLinkCount: 0,
        ok: true,
      });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("persists live event-pair lifecycle closures without backfill", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);

      bus.emit({
        type: "handler.started",
        source: "test",
        owner: "project:sample",
        data: { handler: "task-controller", handlerRunId: "a1", sessionId: "s1" },
      } as any);
      bus.emit({
        type: "handler.completed",
        source: "test",
        owner: "project:sample",
        data: { handler: "task-controller", handlerRunId: "a1", result: "done" },
      } as any);

      const db = getDb(root);
      const pair = db
        .prepare(
          `SELECT open_event_id, close_event_id
         FROM event_pair_runs
         WHERE pair_name = 'handler'`,
        )
        .get() as { open_event_id: number; close_event_id: number };


      const closeTrace = db.prepare("SELECT * FROM event_traces WHERE event_id = ?").get(pair.close_event_id);
      const closureLink = db
        .prepare("SELECT * FROM event_trace_links WHERE from_event_id = ? AND to_event_id = ?")
        .get(pair.close_event_id, pair.open_event_id);

      expect(closeTrace).toMatchObject({
        event_id: pair.close_event_id,
        trace_id: `event:${pair.open_event_id}`,
        parent_event_id: pair.open_event_id,
      });
      expect(closureLink).toMatchObject({
        from_event_id: pair.close_event_id,
        to_event_id: pair.open_event_id,
        type: "closure",
        label: "handler",
      });

    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("protects retained trace and open-work facts from age deletion", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);
      bus.emit({
        type: "handler.started",
        source: "test",
        owner: "project:sample",
        data: { handler: "task-controller", handlerRunId: "retained-run" },
      } as any);

      const db = getDb(root);
      const opened = db.prepare("SELECT id FROM events WHERE event_type = 'handler.started'").get() as {
        id: number;
      };
      const detail = Number(
        db.run("INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)", [
          "audit.detail",
          "test",
          null,
          "{}",
          1,
        ]).lastInsertRowid,
      );

      db.run("DELETE FROM events WHERE id IN (?, ?)", [opened.id, detail]);
      expect(db.prepare("SELECT id FROM events WHERE id = ?").get(opened.id)).toEqual({ id: opened.id });
      expect(db.prepare("SELECT id FROM events WHERE id = ?").get(detail)).toBeNull();

      bus.emit({
        type: "handler.completed",
        source: "test",
        owner: "project:sample",
        data: { handler: "task-controller", handlerRunId: "retained-run", result: "done" },
      } as any);
      const closed = db.prepare("SELECT id FROM events WHERE event_type = 'handler.completed'").get() as {
        id: number;
      };
      db.run("DELETE FROM events WHERE id IN (?, ?)", [opened.id, closed.id]);
      expect(db.prepare("SELECT COUNT(*) AS count FROM events WHERE id IN (?, ?)").get(opened.id, closed.id)).toEqual({
        count: 2,
      });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("leaves an unhandled message pending without inventing owner work", () => {
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
      const event = db
        .prepare(
          `SELECT id, delivery_status, accepted_by, delivery_route
         FROM events
         WHERE event_type = 'message.created'`,
        )
        .get() as Record<string, unknown>;
      expect(event).toMatchObject({
        delivery_status: "pending",
        accepted_by: null,
        delivery_route: null,
      });

      const pair = db
        .prepare(
          `SELECT pair_name, open_event_id, status
         FROM event_pair_runs
         WHERE open_event_id = ?`,
        )
        .get(event.id) as Record<string, unknown>;
      expect(pair).toBeNull();
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not route lifecycle facts through an owner inbox", () => {
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
      const event = db
        .prepare(
          `SELECT id, delivery_status, accepted_by, delivery_route
         FROM events
         WHERE event_type = 'handler.started'`,
        )
        .get() as Record<string, unknown>;
      expect(event).toMatchObject({
        delivery_status: "accepted",
        accepted_by: "event-pair-tracker",
        delivery_route: "direct",
      });
      const pair = db
        .prepare(
          `SELECT pair_name, status
         FROM event_pair_runs
         WHERE open_event_id = ?`,
        )
        .get(event.id) as Record<string, unknown>;
      expect(pair).toMatchObject({
        pair_name: "handler",
        status: "open",
      });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps skill and guard facts unclassified until the App registry reviews them", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);

      bus.emit({
        type: "skill.loaded",
        source: "agent:may",
        owner: "agent:may",
        data: {
          name: "may-agent-system",
          agent: "may",
          sessionId: "s_skill",
          activation: "explicit",
          scope: "agent",
          filePath: "/app/agents/may/skills/may-agent-system/SKILL.md",
          contentHash: "abc123",
        },
      });
      bus.emit({
        type: "guard.triggered",
        source: "tool",
        owner: "agent:may",
        data: {
          sessionId: "s_skill",
          guard: "read-after-write",
          demandType: "warn",
          action: "warned",
          reason: "Read back the changed file",
          sourceEventType: "tool.write",
        },
      });

      const db = getDb(root);
      const rows = db
        .prepare(
          `SELECT event_type, delivery_status, accepted_by, delivery_route
         FROM events
         WHERE event_type IN ('skill.loaded', 'guard.triggered')
         ORDER BY id`,
        )
        .all() as Array<Record<string, unknown>>;
      expect(rows).toEqual([
        expect.objectContaining({
          event_type: "skill.loaded",
          delivery_status: "pending",
          accepted_by: null,
          delivery_route: null,
        }),
        expect.objectContaining({
          event_type: "guard.triggered",
          delivery_status: "pending",
          accepted_by: null,
          delivery_route: null,
        }),
      ]);
      expect(
        db
          .prepare(
            `SELECT COUNT(*) AS count
           FROM event_pair_runs
           WHERE pair_name = 'owner_inbox'`,
          )
          .get(),
      ).toMatchObject({ count: 0 });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not classify application observations inside the core event bus", () => {
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
        source: "app-task-runtime",
        owner: "agent:may",
        data: {
          metricId: "runtime.example",
          appId: "may-agent",
          route: "owner-app",
        },
      } as any);
      bus.emit({
        type: "handler.workflow_dispatched",
        source: "workflow-runner",
        owner: "agent:evaluator",
        data: { handler: "evaluator-aftermath", workflowRunId: "wr_1" },
      } as any);
      bus.emit({
        type: "evaluation.owner_reviewed",
        source: "evaluation.app",
        owner: "agent:evaluator",
        data: { sessionId: "s_1", lane: "routine_ok" },
      } as any);

      const db = getDb(root);
      for (const eventType of [
        "runtime.daemon.heartbeat",
        "metric.feedback.routed",
        "handler.workflow_dispatched",
        "evaluation.owner_reviewed",
      ]) {
        const event = db
          .prepare(
            `SELECT delivery_status, accepted_by, delivery_route
           FROM events
           WHERE event_type = ?`,
          )
          .get(eventType) as Record<string, unknown>;
        expect(event).toMatchObject({
          delivery_status: "pending",
          accepted_by: null,
          delivery_route: null,
        });
      }
      expect(
        db
          .prepare(
            `SELECT COUNT(*) AS count
               FROM event_pair_runs
              WHERE pair_name = 'owner_inbox'`,
          )
          .get(),
      ).toMatchObject({ count: 0 });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("leaves unknown owner-addressed requests pending for an explicit consumer", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);

      bus.emit({
        type: "project.watchdog.check.requested",
        source: "test",
        owner: "project:sample",
        data: { projectId: "sample" },
      } as any);

      const db = getDb(root);
      expect(
        db
          .prepare(
            `SELECT delivery_status, accepted_by, delivery_route
               FROM events
              WHERE event_type = 'project.watchdog.check.requested'`,
          )
          .get(),
      ).toMatchObject({
        delivery_status: "pending",
        accepted_by: null,
        delivery_route: null,
      });
      expect(
        db
          .prepare(
            `SELECT pair_name, status
               FROM event_pair_runs
              WHERE pair_name = 'owner_inbox'`,
          )
          .get(),
      ).toBeNull();
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
      const pair = db
        .prepare(
          `SELECT status, close_event_id
         FROM event_pair_runs
         WHERE pair_name = 'handler'
           AND correlation_key = 'sample'`,
        )
        .get() as Record<string, unknown>;
      expect(pair.status).toBe("closed");
      expect(typeof pair.close_event_id).toBe("number");
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("closes only the matching concurrent handler run", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);

      for (const handlerRunId of ["handler:sample:1", "handler:sample:2"]) {
        bus.emit({
          type: "handler.started",
          source: "cron",
          owner: "agent:may",
          data: { handler: "sample", handlerRunId, agent: "may" },
        } as any);
      }
      bus.emit({
        type: "handler.completed",
        source: "cron",
        owner: "agent:may",
        data: { handler: "sample", handlerRunId: "handler:sample:1", agent: "may", durationMs: 5 },
      } as any);

      const pairs = getDb(root)
        .prepare(
          `SELECT correlation_key, status
           FROM event_pair_runs
           WHERE pair_name = 'handler'
           ORDER BY correlation_key`,
        )
        .all() as Array<{ correlation_key: string; status: string }>;
      expect(pairs).toEqual([
        { correlation_key: "handler:sample:1", status: "closed" },
        { correlation_key: "handler:sample:2", status: "open" },
      ]);
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not infer lifecycle pairs from unknown event-name suffixes", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);
      bus.emit({
        type: "example.created",
        source: "test",
        owner: "agent:dev",
        data: { requestId: "legacy-request-shape" },
      } as any);

      const db = getDb(root);
      const inferred = db.prepare("SELECT id FROM event_pair_runs WHERE pair_name = 'example'").get();
      expect(inferred).toBeNull();
      expect(db.prepare("SELECT status FROM event_pair_runs WHERE pair_name = 'owner_inbox'").get()).toBeNull();
      expect(db.prepare("SELECT delivery_status FROM events WHERE event_type = 'example.created'").get()).toEqual({
        delivery_status: "pending",
      });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("closes workflow event pairs when a workflow is interrupted", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);

      bus.emit({
        type: "workflow.started",
        source: "workflow:test-workflow",
        owner: "agent:tech-lead",
        data: {
          workflowRunId: "wr_interrupted_pair",
          workflow: "test-workflow",
          task: "Test interrupted workflow pair closure",
        },
      } as any);

      bus.emit({
        type: "workflow.interrupted",
        source: "workflow:test-workflow",
        owner: "agent:tech-lead",
        data: {
          workflowRunId: "wr_interrupted_pair",
          workflow: "test-workflow",
          reason: "simulated interruption",
        },
      } as any);

      const db = getDb(root);
      expect(
        db
          .prepare(
            `SELECT status, close_event_id
             FROM event_pair_runs
             WHERE pair_name = 'workflow' AND correlation_key = 'wr_interrupted_pair'`,
          )
          .get(),
      ).toMatchObject({ status: "closed" });
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
        type: "test.unhandled",
        source: "test",
        owner: "agent:may",
        data: {},
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
      const row = db
        .prepare(
          `SELECT delivery_status
         FROM events
         WHERE event_type = 'test.unhandled'`,
        )
        .get() as Record<string, unknown>;
      expect(row.delivery_status).toBe("unhandled");

      const query = createQueryService({ getDb: () => db });
      const health = query.eventDeliveryHealth({ limit: 10 });
      expect(health.unhandledEvents).toEqual([
        expect.objectContaining({
          eventType: "test.unhandled",
          deliveryStatus: "unhandled",
        }),
      ]);
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps rate-limited delivery housekeeping outside event persistence", async () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      const writer = new DbWriter(root, { housekeepingIntervalMs: 500 });
      bus.setPersistenceSubscriber(writer.handler);
      bus.setDeliveryRecorder(writer.recordDelivery);

      bus.emit({ type: "test.unhandled", source: "test", owner: "agent:may", data: {}, ttl_ms: 1 } as any);
      await new Promise((resolve) => setTimeout(resolve, 5));
      bus.emit({
        type: "handler.completed",
        source: "cron",
        owner: "agent:may",
        data: { handler: "first", agent: "may", durationMs: 5 },
      } as any);

      const db = getDb(root);
      expect(db.prepare("SELECT delivery_status FROM events WHERE event_type = 'test.unhandled'").get()).toEqual({
        delivery_status: "pending",
      });
      expect(db.prepare("SELECT id FROM events WHERE event_type = 'handler.completed'").get()).toBeTruthy();

      await new Promise((resolve) => setTimeout(resolve, 550));
      bus.emit({
        type: "handler.completed",
        source: "cron",
        owner: "agent:may",
        data: { handler: "second", agent: "may", durationMs: 5 },
      } as any);
      expect(db.prepare("SELECT delivery_status FROM events WHERE event_type = 'test.unhandled'").get()).toEqual({
        delivery_status: "pending",
      });

      writer.runHousekeeping();
      expect(db.prepare("SELECT delivery_status FROM events WHERE event_type = 'test.unhandled'").get()).toEqual({
        delivery_status: "unhandled",
      });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("terminalizes an unaccepted exact-target plan when its event becomes unhandled", async () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);
      const db = getDb(root);
      const inserted = db
        .prepare(
          `INSERT INTO events (event_type, data, timestamp, ttl_ms, delivery_status)
           VALUES ('reload', '{}', ?, 1, 'pending')`,
        )
        .run(Date.now() - 60_000);
      const eventId = Number(inserted.lastInsertRowid);
      db.prepare(
        `INSERT INTO app_event_admission_plans
         (event_id, registry_snapshot_id, registry_generation, status, created_at, updated_at)
         VALUES (?, 'snapshot-1', 1, 'pending', ?, ?)`,
      ).run(eventId, Date.now(), Date.now());
      db.prepare(
        `INSERT INTO app_event_admission_commands
         (event_id, app_id, route_kind, route_id, payload, status, last_error, updated_at)
         VALUES (?, 'may-agent', 'exact-task', 'missing-task', '{}', 'pending', 'task is absent', ?)`,
      ).run(eventId, Date.now());

      bus.emit({
        type: "handler.completed",
        source: "cron",
        owner: "agent:may",
        data: { handler: "sample", agent: "may", durationMs: 5 },
      } as any);

      expect(db.prepare("SELECT delivery_status FROM events WHERE id = ?").get(eventId)).toEqual({
        delivery_status: "unhandled",
      });
      expect(
        db.prepare("SELECT status, last_error FROM app_event_admission_commands WHERE event_id = ?").get(eventId),
      ).toEqual({ status: "superseded", last_error: "task is absent" });
      expect(
        db
          .prepare("SELECT status, last_error, completed_at FROM app_event_admission_plans WHERE event_id = ?")
          .get(eventId),
      ).toMatchObject({ status: "superseded", last_error: "origin event became unhandled before App admission" });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each(["ordinary", "legacy", "failed-consumer"] as const)(
    "keeps lifecycle acceptance with its delivery owner across housekeeping: %s",
    (scenario) => {
      const root = tempRoot();
      try {
        const bus = new EventBus();
        const writer = new DbWriter(root, { housekeepingIntervalMs: 0 });
        bus.setPersistenceSubscriber(writer.handler);
        bus.setDeliveryRecorder(writer.recordDelivery);
        bus.subscribeDurableRoute((event) => {
          if (scenario === "failed-consumer" && event.type === "session.end") {
            throw new Error("Required consumer did not accept completion");
          }
        });
        for (const status of ["done", "error", "interrupted"]) {
          bus.emit({
            type: "session.end", source: "runtime", owner: "agent:worker", ttl_ms: 1,
            data: {
              sessionId: `s_${status}`, agent: "worker", status,
              ...(scenario !== "ordinary" ? { reconciled: true } : {}),
            },
          } as any);
        }
        const rows = () => getDb(root).prepare(`SELECT id, delivery_status, accepted_by, delivery_route
          FROM events WHERE event_type = 'session.end' ORDER BY id`).all();
        expect(rows()).toHaveLength(3);
        for (const row of rows()) {
          expect(row).toMatchObject(scenario === "failed-consumer"
            ? { delivery_status: "pending", accepted_by: null }
            : { delivery_status: "accepted", accepted_by: "event-pair-tracker", delivery_route: "direct" });
        }
        writer.runHousekeeping(Date.now() + 10);
        for (const row of rows()) {
          expect(row).toMatchObject(scenario === "failed-consumer"
            ? { delivery_status: "unhandled", accepted_by: null }
            : { delivery_status: "accepted", accepted_by: "event-pair-tracker", delivery_route: "direct" });
        }
        const retained = rows();
        closeDb(root);
        const restarted = new DbWriter(root, { housekeepingIntervalMs: 0 });
        for (let pass = 0; pass < 3; pass++) restarted.runHousekeeping(Date.now() + 20 + pass);
        expect(rows()).toEqual(retained);
      } finally {
        closeDb(root);
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  it("does not create a semantic lifecycle pair for an unaccepted message", async () => {
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
      expect(db.prepare("SELECT status FROM event_pair_runs WHERE pair_name = 'owner_inbox'").get()).toBeNull();
      expect(db.prepare("SELECT delivery_status FROM events WHERE event_type = 'message.created'").get()).toEqual({
        delivery_status: "unhandled",
      });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("closes handler lifecycle pairs when completion was recorded first", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);

      bus.emit({
        type: "handler.completed",
        source: "watchdog",
        owner: "project:sample",
        data: {
          handler: "sample-handler",
          handlerRunId: "sample-run-1",
          result: "done",
        },
      } as any);

      bus.emit({
        type: "handler.started",
        source: "planner",
        owner: "project:sample",
        data: {
          handler: "sample-handler",
          handlerRunId: "sample-run-1",
          sessionId: "s_task_sample-task",
        },
      } as any);

      const db = getDb(root);
      const pair = db
        .prepare(
          `SELECT status, close_event_id, note
           FROM event_pair_runs
           WHERE pair_name = 'handler'
             AND correlation_key = ?`,
        )
        .get("sample-run-1") as Record<string, unknown>;

      expect(pair).toMatchObject({
        status: "closed",
        note: "closed by earlier handler.completed",
      });
      expect(typeof pair.close_event_id).toBe("number");
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("finds an exact completion-first session through its indexed identity", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);
      const db = getDb(root);
      const insert = db.prepare(
        `INSERT INTO events (event_type, source, owner, data, session_id, timestamp)
         VALUES ('session.end', 'fixture', 'agent:may', ?, ?, ?)`,
      );
      const completedSessionId = "s_completion_before_start";
      db.exec("BEGIN");
      insert.run(
        JSON.stringify({ sessionId: completedSessionId, agent: "may", status: "done" }),
        completedSessionId,
        Date.now(),
      );
      for (let index = 0; index < 201; index++) {
        const sessionId = `s_decoy_${index}`;
        insert.run(JSON.stringify({ sessionId, agent: "may", status: "done" }), sessionId, Date.now() + index + 1);
      }
      db.exec("COMMIT");

      bus.emit({
        type: "session.start",
        source: "fixture",
        owner: "agent:may",
        data: {
          sessionId: completedSessionId,
          agent: "may",
          task: "completion-first session",
          trigger: "fixture",
          firedAt: Date.now(),
        },
      } as any);

      expect(
        db
          .prepare(
            `SELECT status, note
             FROM event_pair_runs
             WHERE pair_name = 'session' AND correlation_key = ?`,
          )
          .get(completedSessionId),
      ).toEqual({
        status: "closed",
        note: "closed by earlier session.end",
      });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("persists reconciliation observations without inventing a task lifecycle pair", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);

      bus.emit({
        type: "project.task.reconciled",
        source: "app-task:sample",
        owner: "project:sample",
        data: {
          taskId: "sample-task",
          attemptId: "a_sample-task_1",
          disposition: "converged",
        },
      } as any);

      bus.emit({
        type: "project.task.reconciled",
        source: "app-task:sample",
        owner: "project:sample",
        data: {
          taskId: "sample-task",
          attemptId: "a_sample-task_1",
          disposition: "stale",
        },
      } as any);

      const db = getDb(root);
      const observations = db
        .prepare(
          `SELECT id, source, data
           FROM events
           WHERE event_type = 'project.task.reconciled'
             AND json_extract(data, '$.taskId') = ?
             AND json_extract(data, '$.attemptId') = ?
           ORDER BY id ASC`,
        )
        .all("sample-task", "a_sample-task_1") as Array<{
        id: number;
        source: string;
        data: string;
      }>;
      expect(observations).toHaveLength(2);
      expect(
        db.prepare("SELECT COUNT(*) AS count FROM event_pair_runs WHERE pair_name = 'project.task'").get(),
      ).toEqual({ count: 0 });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("retains orphan lifecycle facts across later event sweeps", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);
      bus.emit({
        type: "handler.started",
        source: "cron",
        owner: "agent:may",
        data: { handler: "lost-handler", agent: "may" },
      } as any);

      const db = getDb(root);
      db.prepare("UPDATE event_pair_runs SET status = 'orphan', expected_close_at = ? WHERE pair_name = 'handler'").run(
        Date.now() - 24 * 60 * 60_000,
      );

      bus.emit({
        type: "handler.completed",
        source: "cron",
        owner: "agent:may",
        data: { handler: "another-handler", agent: "may", durationMs: 1 },
      } as any);

      expect(
        db
          .prepare(
            "SELECT status FROM event_pair_runs WHERE pair_name = 'handler' AND correlation_key = 'lost-handler'",
          )
          .get(),
      ).toMatchObject({ status: "orphan" });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
