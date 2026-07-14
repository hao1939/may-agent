import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { EventBus } from "./event-bus.js";
import { DbWriter } from "../lib/db-writer.js";
import { buildEventGraph } from "./http/read-model/event-graph.js";
import { backfillEventPairTraces, checkEventTraceIntegrity } from "../lib/db/event-traces.js";
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
  it("creates event trace side tables for graphable history", () => {
    const root = tempRoot();
    try {
      const db = getDb(root);
      const traceCols = db.prepare("PRAGMA table_info(event_traces)").all();
      const linkCols = db.prepare("PRAGMA table_info(event_trace_links)").all();
      const traceIndexes = db.prepare("PRAGMA index_list(event_traces)").all();
      const linkIndexes = db.prepare("PRAGMA index_list(event_trace_links)").all();

      expect(traceCols.map((row) => row.name)).toEqual([
        "event_id",
        "trace_id",
        "parent_event_id",
        "visibility",
      ]);
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

  it("returns bounded event graph data previews", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);

      bus.emit({
        type: "project.feedback.created",
        source: "test",
        owner: "agent:owner",
        data: {
          projectId: "sample",
          sessionId: "s_preview",
          workflowRunId: "wr_preview",
          task: `Review packet\n${"large context ".repeat(80)}`,
          items: ["a", "b", "c"],
          nested: { should: "not appear in preview" },
        },
      });

      const db = getDb(root);
      const event = db.prepare("SELECT id FROM events WHERE event_type = 'project.feedback.created'").get() as {
        id: number;
      };
      const graph = buildEventGraph(db, event.id);
      const node = graph.nodes.find((item) => item.id === event.id);

      expect(node?.dataPreview).toMatchObject({
        projectId: "sample",
        sessionId: "s_preview",
        workflowRunId: "wr_preview",
        items: "[3 items]",
      });
      expect(String(node?.dataPreview?.task).length).toBeLessThanOrEqual(160);
      expect(String(node?.dataPreview?.task)).toEndWith("...");
      expect(node?.dataPreview?.nested).toBeUndefined();
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns detailed session events separately from the bounded graph", () => {
    const root = tempRoot();
    try {
      const db = getDb(root);
      const now = Date.now();
      const startRow = db.run(
        `INSERT INTO events (event_type, source, owner, data, timestamp)
         VALUES (?, ?, ?, ?, ?)`,
        ["session.start", "test", "agent:owner", JSON.stringify({ sessionId: "s_detail", summary: "started" }), now],
      ) as { lastInsertRowid?: number | bigint };
      db.run(
        `INSERT INTO events (event_type, source, owner, data, timestamp)
         VALUES (?, ?, ?, ?, ?)`,
        ["guard.triggered", "test", "agent:owner", JSON.stringify({ sessionId: "s_detail", reason: "tool guard detail" }), now + 1],
      );
      db.run(
        `INSERT INTO events (event_type, source, owner, data, timestamp)
         VALUES (?, ?, ?, ?, ?)`,
        ["session.end", "test", "agent:owner", JSON.stringify({ sessionId: "s_detail", status: "completed" }), now + 2],
      );
      const start = db.prepare("SELECT id FROM events WHERE event_type = 'session.start'").get() as {
        id: number;
      };
      const graph = buildEventGraph(db, Number(startRow.lastInsertRowid ?? start.id));

      expect(graph.eventListScope).toMatchObject({ kind: "session", ids: ["s_detail"] });
      expect(graph.eventList?.map((node) => node.type)).toEqual([
        "session.start",
        "guard.triggered",
        "session.end",
      ]);
      expect(graph.eventList?.find((node) => node.type === "guard.triggered")?.visibility).toBe("detail");
      const startKey = `event:${Number(startRow.lastInsertRowid ?? start.id)}`;
      const guardDisplayNode = graph.displayNodes?.find((node) => node.type === "guard.triggered");
      expect(guardDisplayNode).toMatchObject({
        kind: "diagnostic",
        role: "diagnostic",
        parentKey: startKey,
        level: 1,
        visibility: "detail",
      });
      expect(graph.displayEdges).toContainEqual(
        expect.objectContaining({
          sourceKey: startKey,
          targetKey: guardDisplayNode?.key,
          kind: "detail",
        }),
      );
      expect(graph.displayNodes?.map((node) => node.type)).toEqual([
        "session.start",
        "guard.triggered",
        "session.end",
      ]);
      expect(graph.displayNodes?.map((node) => node.order)).toEqual([0, 1, 2]);
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps same-workflow sessions behind expandable more nodes by default", () => {
    const root = tempRoot();
    try {
      const db = getDb(root);
      const now = Date.now();
      const insertEvent = (type: string, sessionId: string, timestamp: number): number => {
        const row = db.run(
          `INSERT INTO events (event_type, source, owner, data, timestamp)
           VALUES (?, ?, ?, ?, ?)`,
          [type, "test", "agent:owner", JSON.stringify({ sessionId, workflowRunId: "wr_scope" }), timestamp],
        ) as { lastInsertRowid?: number | bigint };
        return Number(row.lastInsertRowid);
      };

      const start1 = insertEvent("session.start", "s_scope_1", now);
      const end1 = insertEvent("session.end", "s_scope_1", now + 1);
      const start2 = insertEvent("session.start", "s_scope_2", now + 2);
      insertEvent("session.end", "s_scope_2", now + 3);
      db.run(
        `INSERT INTO event_pair_runs
         (pair_name, correlation_key, open_event_id, close_event_id, owner, status, opened_at, expected_close_at, closed_at, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ["session", "s_scope_1", start1, end1, "agent:owner", "closed", now, now + 1000, now + 1, "session closed"],
      );

      const graph = buildEventGraph(db, start1);

      expect(graph.nodes.map((node) => node.id)).toEqual([start1, end1]);
      expect(graph.edges).toContainEqual(expect.objectContaining({ source: start1, target: end1, type: "closure" }));
      expect(graph.edges.find((edge) => edge.label === "same workflow")).toBeUndefined();
      expect(graph.moreNodes).toContainEqual(
        expect.objectContaining({
          parentEventId: end1,
          direction: "context",
          scope: "workflow",
          count: 1,
          label: "... 1 same-workflow session",
          nodes: [expect.objectContaining({ id: start2, type: "session.start" })],
        }),
      );
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

      const defaultGraph = buildEventGraph(db, rootEvent.id);
      expect(defaultGraph.nodes.map((node) => node.id)).toEqual([rootEvent.id]);
      expect(defaultGraph.edges).toEqual([]);

      const detailGraph = buildEventGraph(db, rootEvent.id, { detail: true });
      expect(detailGraph.traceId).toBe(`event:${rootEvent.id}`);
      expect(detailGraph.nodes.map((node) => node.id)).toEqual([rootEvent.id, closeEvent.id]);
      expect(detailGraph.edges).toEqual([
        expect.objectContaining({ source: rootEvent.id, target: closeEvent.id, type: "closure" }),
      ]);
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

      const graph = buildEventGraph(db, rootEvent.id);
      expect(graph.nodes.map((node) => node.id)).toEqual([rootEvent.id, closeEvent.id]);
      expect(graph.edges).toEqual([
        expect.objectContaining({ source: rootEvent.id, target: closeEvent.id, type: "closure" }),
      ]);
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

      const graph = buildEventGraph(db, created.id);
      expect(graph.nodes.map((node) => node.id)).toEqual([created.id, resolved.id]);
      expect(graph.edges).toEqual([
        expect.objectContaining({ source: created.id, target: resolved.id, type: "closure" }),
      ]);
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

  it("backfills event-pair lifecycle closures into trace links", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);

      bus.emit({
        type: "project.task.assigned",
        source: "test",
        owner: "project:sample",
        data: { taskId: "task-1", attemptId: "a1", sessionId: "s1" },
      } as any);
      bus.emit({
        type: "project.task.completed",
        source: "test",
        owner: "project:sample",
        data: { taskId: "task-1", attemptId: "a1", result: "done" },
      } as any);

      const db = getDb(root);
      const pair = db.prepare(
        `SELECT open_event_id, close_event_id
         FROM event_pair_runs
         WHERE pair_name = 'project.task'`,
      ).get() as { open_event_id: number; close_event_id: number };

      const fallbackGraph = buildEventGraph(db, pair.open_event_id);
      expect(fallbackGraph.diagnostics).toContain("graph includes event_pair_runs fallback edges");
      expect(fallbackGraph.nodes.map((node) => node.id)).toEqual([pair.open_event_id, pair.close_event_id]);
      expect(fallbackGraph.edges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ source: pair.open_event_id, target: pair.close_event_id, type: "closure" }),
        ]),
      );

      expect(backfillEventPairTraces(db, { createdAt: 123 })).toBeGreaterThan(0);

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
        label: "project.task",
        created_at: 123,
      });

      const graph = buildEventGraph(db, pair.open_event_id);
      expect(graph.nodes.map((node) => node.id)).toEqual([pair.open_event_id, pair.close_event_id]);
      expect(graph.edges).toEqual([
        expect.objectContaining({ source: pair.open_event_id, target: pair.close_event_id, type: "closure" }),
      ]);
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("backfills payload relation traces from openEventId and escalationId", () => {
    const root = tempRoot();
    try {
      const db = getDb(root);
      const now = Date.now();
      const open = db.run(
        `INSERT INTO events (event_type, source, owner, data, timestamp)
         VALUES (?, ?, ?, ?, ?)`,
        ["message.created", "test", "agent:owner", JSON.stringify({ content: "please review" }), now],
      ) as { lastInsertRowid?: number | bigint };
      const openEventId = Number(open.lastInsertRowid);
      const close = db.run(
        `INSERT INTO events (event_type, source, owner, data, timestamp)
         VALUES (?, ?, ?, ?, ?)`,
        [
          "message.reviewed",
          "test",
          "agent:owner",
          JSON.stringify({ openEventId, reviewedBy: "test" }),
          now + 1,
        ],
      ) as { lastInsertRowid?: number | bigint };
      const closeEventId = Number(close.lastInsertRowid);
      const created = db.run(
        `INSERT INTO events (event_type, source, owner, data, timestamp)
         VALUES (?, ?, ?, ?, ?)`,
        [
          "escalation.created",
          "test",
          "agent:may",
          JSON.stringify({ escalationId: "esc_backfill", reason: "need human" }),
          now + 2,
        ],
      ) as { lastInsertRowid?: number | bigint };
      const createdEventId = Number(created.lastInsertRowid);
      const resolved = db.run(
        `INSERT INTO events (event_type, source, owner, data, timestamp)
         VALUES (?, ?, ?, ?, ?)`,
        [
          "escalation.resolved",
          "test",
          "agent:may",
          JSON.stringify({ escalationId: "esc_backfill", outcome: "resolved" }),
          now + 3,
        ],
      ) as { lastInsertRowid?: number | bigint };
      const resolvedEventId = Number(resolved.lastInsertRowid);
      db.run(
        `INSERT INTO events (event_type, source, owner, data, timestamp)
         VALUES (?, ?, ?, ?, ?)`,
        ["legacy.corrupt", "test", "agent:owner", "{not-json", now + 4],
      );

      expect(backfillEventPairTraces(db, { createdAt: 789 })).toBeGreaterThan(0);

      expect(db.prepare("SELECT * FROM event_traces WHERE event_id = ?").get(closeEventId)).toMatchObject({
        event_id: closeEventId,
        trace_id: `event:${openEventId}`,
        parent_event_id: openEventId,
      });
      expect(db.prepare("SELECT * FROM event_trace_links WHERE from_event_id = ? AND to_event_id = ?").get(closeEventId, openEventId)).toMatchObject({
        from_event_id: closeEventId,
        to_event_id: openEventId,
        type: "closure",
        label: "message.reviewed",
      });
      expect(db.prepare("SELECT * FROM event_traces WHERE event_id = ?").get(resolvedEventId)).toMatchObject({
        event_id: resolvedEventId,
        trace_id: `event:${createdEventId}`,
        parent_event_id: createdEventId,
      });
      expect(db.prepare("SELECT * FROM event_trace_links WHERE from_event_id = ? AND to_event_id = ?").get(resolvedEventId, createdEventId)).toMatchObject({
        from_event_id: resolvedEventId,
        to_event_id: createdEventId,
        type: "closure",
        label: "escalation.resolved",
      });

      const messageGraph = buildEventGraph(db, openEventId);
      expect(messageGraph.nodes.map((node) => node.id)).toEqual([openEventId, closeEventId]);
      const escalationGraph = buildEventGraph(db, createdEventId);
      expect(escalationGraph.nodes.map((node) => node.id)).toEqual([createdEventId, resolvedEventId]);
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ignores dangling event-pair rows when backfilling traces", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);

      bus.emit({
        type: "project.task.assigned",
        source: "test",
        owner: "project:sample",
        data: { taskId: "task-1", attemptId: "a1", sessionId: "s1" },
      } as any);

      const db = getDb(root);
      const event = db.prepare("SELECT id FROM events WHERE event_type = 'project.task.assigned'").get() as {
        id: number;
      };
      const missingOpenEventId = event.id + 1000;
      const missingCloseEventId = event.id + 1001;

      db.run(
        `INSERT INTO event_pair_runs
         (pair_name, correlation_key, open_event_id, close_event_id, owner, status, opened_at, expected_close_at, closed_at, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "project.task",
          "dangling-open",
          missingOpenEventId,
          event.id,
          "project:sample",
          "closed",
          1,
          2,
          3,
          "old broken row",
        ],
      );
      db.run(
        `INSERT INTO event_pair_runs
         (pair_name, correlation_key, open_event_id, close_event_id, owner, status, opened_at, expected_close_at, closed_at, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "project.task",
          "dangling-close",
          event.id,
          missingCloseEventId,
          "project:sample",
          "closed",
          1,
          2,
          3,
          "old broken row",
        ],
      );
      db.run(
        `INSERT INTO event_traces (event_id, trace_id, parent_event_id, visibility)
         VALUES (?, ?, ?, ?)`,
        [missingCloseEventId, `event:${event.id}`, event.id, "default"],
      );
      db.run("UPDATE event_traces SET parent_event_id = ? WHERE event_id = ?", [missingOpenEventId, event.id]);
      db.run(
        `INSERT INTO event_trace_links (from_event_id, to_event_id, type, label, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [missingCloseEventId, event.id, "closure", "broken", 123],
      );

      expect(checkEventTraceIntegrity(db).ok).toBe(false);
      expect(backfillEventPairTraces(db, { createdAt: 456 })).toBeGreaterThan(0);
      expect(checkEventTraceIntegrity(db)).toMatchObject({
        eventCount: 1,
        traceCount: 1,
        danglingParentCount: 0,
        danglingLinkCount: 0,
        ok: true,
      });

      const danglingTrace = db.prepare("SELECT * FROM event_traces WHERE event_id = ?").get(missingCloseEventId);
      const eventTrace = db.prepare("SELECT * FROM event_traces WHERE event_id = ?").get(event.id);
      const links = db.prepare("SELECT COUNT(*) as c FROM event_trace_links").get() as { c: number };
      expect(danglingTrace).toBeNull();
      expect(eventTrace).toMatchObject({ event_id: event.id, parent_event_id: null });
      expect(links.c).toBe(0);
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
        `SELECT id, event_type, data, delivery_status, delivery_route
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

      const trace = db.prepare("SELECT * FROM event_traces WHERE event_id = ?").get(followup.id);
      const link = db.prepare("SELECT * FROM event_trace_links WHERE from_event_id = ?").get(followup.id);
      expect(trace).toMatchObject({
        event_id: followup.id,
        trace_id: `event:${id}`,
        parent_event_id: id,
      });
      expect(link).toMatchObject({
        from_event_id: followup.id,
        to_event_id: id,
        type: "closure",
        label: "message.reviewed",
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
