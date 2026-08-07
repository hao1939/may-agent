import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { EVENT_INGRESS_SOURCE, EVENT_ROW_ID, EventBus } from "./event-bus.js";
import { DbWriter } from "../lib/db-writer.js";
import {
  addSessionTranscriptToEventGraph,
  buildEventGraph,
  type EventGraphNode,
  type EventGraphResponse,
} from "./http/read-model/event-graph.js";
import { backfillEventPairTraces, checkEventTraceIntegrity } from "../lib/db/event-traces.js";
import { closeDb, getDb } from "../lib/requests.js";
import { createQueryService } from "../lib/query-service.js";
import { createCommandService } from "../lib/command-service.js";

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), "may-event-delivery-"));
}

function selectedEvents(graph: EventGraphResponse, ids: number[]): EventGraphNode[] {
  const selected = new Set(ids);
  return graph.events.filter((event) => selected.has(event.id));
}

function graphEvents(graph: EventGraphResponse): EventGraphNode[] {
  return selectedEvents(graph, graph.scope.graphEventIds);
}

function timelineEvents(graph: EventGraphResponse): EventGraphNode[] {
  return selectedEvents(graph, graph.scope.timelineEventIds);
}

function attachPersistence(bus: EventBus, root: string): void {
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
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

  it("recovers a persisted pending event through the idempotent owner inbox route", () => {
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
      expect(getDb(root).prepare("SELECT delivery_status, delivery_route FROM events WHERE id = ?").get(originalId)).toMatchObject({
        delivery_status: "accepted",
        delivery_route: "owner_inbox",
      });
      expect(getDb(root).prepare(
        "SELECT COUNT(*) AS count FROM event_pair_runs WHERE open_event_id = ? AND pair_name = 'owner_inbox'",
      ).get(originalId))
        .toMatchObject({ count: 1 });
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
  it("rolls back owner-inbox acceptance when its durable continuation cannot be created", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);
      const db = getDb(root);
      db.exec(`
        CREATE TRIGGER reject_owner_inbox_pair
        BEFORE INSERT ON event_pair_runs
        WHEN NEW.pair_name = 'owner_inbox'
        BEGIN
          SELECT RAISE(ABORT, 'owner inbox unavailable');
        END;
      `);

      const event = bus.emit({
        type: "custom.requested",
        source: "test",
        owner: "agent:owner",
        data: { message: "review" },
      } as any);
      const rowId = event[EVENT_ROW_ID];

      expect(db.prepare("SELECT delivery_status FROM events WHERE id = ?").get(rowId)).toMatchObject({
        delivery_status: "pending",
      });
      expect(db.prepare("SELECT COUNT(*) AS count FROM event_pair_runs WHERE open_event_id = ?").get(rowId))
        .toMatchObject({ count: 0 });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("creates event trace side tables for graphable history", () => {
    const root = tempRoot();
    try {
      const db = getDb(root);
      const traceCols = db.prepare("PRAGMA table_info(event_traces)").all();
      const linkCols = db.prepare("PRAGMA table_info(event_trace_links)").all();
      const traceIndexes = db.prepare("PRAGMA index_list(event_traces)").all();
      const linkIndexes = db.prepare("PRAGMA index_list(event_trace_links)").all();

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

  it("returns compact data previews for the complete event graph", () => {
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
          nested: { should: "remain inspectable" },
        },
      });

      const db = getDb(root);
      const event = db.prepare("SELECT id FROM events WHERE event_type = 'project.feedback.created'").get() as {
        id: number;
      };
      const graph = buildEventGraph(db, event.id);
      const node = graphEvents(graph).find((item) => item.id === event.id);

      expect(node?.dataPreview).toMatchObject({
        projectId: "sample",
        sessionId: "s_preview",
        workflowRunId: "wr_preview",
        items: '["a","b","c"]',
        nested: '{"should":"remain inspectable"}',
      });
      expect(String(node?.dataPreview?.task).length).toBeLessThanOrEqual(220);
      expect(String(node?.dataPreview?.task)).toEndWith("...");
      expect(graph.focusEvent?.data).toMatchObject({
        projectId: "sample",
        task: expect.stringContaining("large context"),
        nested: { should: "remain inspectable" },
      });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("includes detailed session events in the complete graph", () => {
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
        [
          "guard.triggered",
          "test",
          "agent:owner",
          JSON.stringify({ sessionId: "s_detail", reason: "tool guard detail" }),
          now + 1,
        ],
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

      expect(graph.scope).toMatchObject({ kind: "session", ids: ["s_detail"] });
      expect(timelineEvents(graph).map((node) => node.type)).toEqual([
        "session.start",
        "guard.triggered",
        "session.end",
      ]);
      expect(timelineEvents(graph).find((node) => node.type === "guard.triggered")?.visibility).toBe("detail");
      const startKey = `event:${Number(startRow.lastInsertRowid ?? start.id)}`;
      const guardDisplayNode = graph.nodes.find((node) => node.type === "guard.triggered");
      expect(guardDisplayNode).toMatchObject({
        kind: "diagnostic",
        role: "diagnostic",
        parentKey: startKey,
        level: 1,
        visibility: "detail",
      });
      expect(graph.edges).toContainEqual(
        expect.objectContaining({
          sourceKey: startKey,
          targetKey: guardDisplayNode?.key,
          kind: "detail",
          provenance: "projection",
        }),
      );
      expect(graph.nodes.map((node) => node.type)).toEqual(["session.start", "guard.triggered", "session.end"]);
      expect(graph.nodes.map((node) => node.order)).toEqual([0, 1, 2]);
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("projects transcript turns and tools into the canonical graph", () => {
    const root = tempRoot();
    try {
      const db = getDb(root);
      const now = Date.now();
      const start = Number(
        (
          db.run(`INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)`, [
            "session.start",
            "test",
            "agent:owner",
            JSON.stringify({ sessionId: "s_transcript" }),
            now,
          ]) as { lastInsertRowid?: number | bigint }
        ).lastInsertRowid,
      );
      db.run(`INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)`, [
        "session.end",
        "test",
        "agent:owner",
        JSON.stringify({ sessionId: "s_transcript" }),
        now + 100,
      ]);
      const graph = addSessionTranscriptToEventGraph(buildEventGraph(db, start), "s_transcript", {
        sessionId: "s_transcript",
        source: ".state/sessions/s_transcript/session.jsonl",
        messages: [
          { role: "user", text: "Investigate the issue", rawLine: 1 },
          {
            role: "assistant",
            text: "Checking",
            rawLine: 2,
            timestamp: now + 20,
            toolCalls: [{ id: "call-1", tool: "read", args: { path: "a.ts" } }],
          },
          {
            role: "tool_result",
            toolCallId: "call-1",
            toolName: "read",
            content: "ok",
            rawLine: 3,
            timestamp: now + 30,
          },
        ],
      });

      expect(graph.nodes.map((node) => node.kind)).toEqual(
        expect.arrayContaining(["turn", "tool_call", "tool_result"]),
      );
      const user = graph.nodes.find((node) => node.type === "llm.user")!;
      const assistant = graph.nodes.find((node) => node.type === "llm.assistant")!;
      const toolCall = graph.nodes.find((node) => node.kind === "tool_call")!;
      const toolResult = graph.nodes.find((node) => node.kind === "tool_result")!;
      expect(user.timestamp).toBeGreaterThan(now);
      expect(user.timestamp).toBeLessThan(assistant.timestamp!);
      expect(assistant.timestamp).toBe(toolCall.timestamp);
      expect(toolCall.timestamp).toBeLessThan(toolResult.timestamp!);
      expect([user.level, assistant.level, toolCall.level, toolResult.level]).toEqual([1, 1, 2, 3]);
      expect(graph.nodes.map((node) => node.timestamp)).toEqual(
        [...graph.nodes.map((node) => node.timestamp)].sort((a, b) => Number(a) - Number(b)),
      );
      expect(graph.edges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: "sequence", provenance: "transcript" }),
          expect.objectContaining({ kind: "tool_call", provenance: "transcript" }),
          expect.objectContaining({ kind: "tool_result", provenance: "transcript" }),
        ]),
      );
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("includes same-workflow sessions in the complete graph", () => {
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
      const end2 = insertEvent("session.end", "s_scope_2", now + 3);
      db.run(
        `INSERT INTO event_pair_runs
         (pair_name, correlation_key, open_event_id, close_event_id, owner, status, opened_at, expected_close_at, closed_at, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ["session", "s_scope_1", start1, end1, "agent:owner", "closed", now, now + 1000, now + 1, "session closed"],
      );

      const graph = buildEventGraph(db, start1);

      expect(graphEvents(graph).map((node) => node.id)).toEqual([start1, end1, start2, end2]);
      expect(graph.relations).toContainEqual(
        expect.objectContaining({ source: start1, target: end1, type: "closure" }),
      );
      expect(graph.relations).toContainEqual(
        expect.objectContaining({ source: end1, target: start2, type: "reference", label: "same workflow" }),
      );
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("infers session.completed as the result of session.end for legacy session events", () => {
    const root = tempRoot();
    try {
      const db = getDb(root);
      const now = Date.now();
      const insertEvent = (type: string, timestamp: number): number => {
        const row = db.run(
          `INSERT INTO events (event_type, source, owner, data, timestamp)
           VALUES (?, ?, ?, ?, ?)`,
          [type, "test", "agent:owner", JSON.stringify({ sessionId: "s_completed" }), timestamp],
        ) as { lastInsertRowid?: number | bigint };
        return Number(row.lastInsertRowid);
      };

      insertEvent("session.start", now);
      const end = insertEvent("session.end", now + 1);
      const completed = insertEvent("session.completed", now + 2);

      const graph = buildEventGraph(db, end);

      expect(graphEvents(graph).map((node) => node.id)).toContain(completed);
      expect(graph.relations).toContainEqual(
        expect.objectContaining({ source: end, target: completed, type: "reference", label: "completed" }),
      );
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("includes the complete trace with sibling branches", () => {
    const root = tempRoot();
    try {
      const db = getDb(root);
      const now = Date.now();
      const insertEvent = (type: string, data: Record<string, unknown>, timestamp: number): number => {
        const row = db.run(
          `INSERT INTO events (event_type, source, owner, data, timestamp)
           VALUES (?, ?, ?, ?, ?)`,
          [type, "test", "agent:owner", JSON.stringify(data), timestamp],
        ) as { lastInsertRowid?: number | bigint };
        return Number(row.lastInsertRowid);
      };
      const insertTrace = (eventId: number, traceId: string, parentEventId: number | null = null): void => {
        db.run(
          `INSERT OR REPLACE INTO event_traces (event_id, trace_id, parent_event_id, visibility)
           VALUES (?, ?, ?, ?)`,
          [eventId, traceId, parentEventId, "default"],
        );
      };

      const start = insertEvent("metric.breach", { metricId: "m_scope", summary: "scope started" }, now);
      const owner = insertEvent("owner.inbox.created", { metricId: "m_scope" }, now + 1);
      const workflow = insertEvent("workflow.started", { workflowRunId: "wr_scope" }, now + 2);
      const session = insertEvent("session.start", { sessionId: "s_scope", workflowRunId: "wr_scope" }, now + 3);
      const sibling = insertEvent("session.start", { sessionId: "s_sibling", workflowRunId: "wr_scope" }, now + 4);
      const selected = insertEvent("project.task.reconciled", { taskId: "t_scope", sessionId: "s_scope" }, now + 5);
      const directChild = insertEvent("project.owner.reviewed", { projectId: "sample" }, now + 6);
      const traceId = `event:${start}`;
      insertTrace(start, traceId);
      insertTrace(owner, traceId, start);
      insertTrace(workflow, traceId, owner);
      insertTrace(session, traceId, workflow);
      insertTrace(sibling, traceId, workflow);
      insertTrace(selected, traceId, session);
      insertTrace(directChild, traceId, selected);

      const graph = buildEventGraph(db, selected);

      expect(graphEvents(graph).map((node) => node.id)).toEqual([
        start,
        owner,
        workflow,
        session,
        sibling,
        selected,
        directChild,
      ]);
      expect(graph.relations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ source: start, target: owner, type: "parent" }),
          expect.objectContaining({ source: owner, target: workflow, type: "parent" }),
          expect.objectContaining({ source: workflow, target: session, type: "parent" }),
          expect.objectContaining({ source: workflow, target: sibling, type: "parent" }),
          expect.objectContaining({ source: session, target: selected, type: "parent" }),
          expect.objectContaining({ source: selected, target: directChild, type: "parent" }),
        ]),
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
      expect(graphEvents(defaultGraph).map((node) => node.id)).toEqual([rootEvent.id, closeEvent.id]);
      expect(defaultGraph.edges).toContainEqual(
        expect.objectContaining({
          sourceKey: `event:${rootEvent.id}`,
          targetKey: `event:${closeEvent.id}`,
          kind: "detail",
        }),
      );

      expect(defaultGraph.traceId).toBe(`event:${rootEvent.id}`);
      expect(defaultGraph.relations).toEqual([
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
      expect(graphEvents(graph).map((node) => node.id)).toEqual([rootEvent.id, closeEvent.id]);
      expect(graph.relations).toEqual([
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
      expect(graphEvents(graph).map((node) => node.id)).toEqual([created.id, resolved.id]);
      expect(graph.relations).toEqual([
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

      const fallbackGraph = buildEventGraph(db, pair.open_event_id);
      expect(fallbackGraph.diagnostics).not.toContain("graph includes event_pair_runs fallback edges");
      expect(graphEvents(fallbackGraph).map((node) => node.id)).toEqual([pair.open_event_id, pair.close_event_id]);
      expect(fallbackGraph.relations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ source: pair.open_event_id, target: pair.close_event_id, type: "closure" }),
        ]),
      );

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

      const graph = buildEventGraph(db, pair.open_event_id);
      expect(graphEvents(graph).map((node) => node.id)).toEqual([pair.open_event_id, pair.close_event_id]);
      expect(graph.relations).toEqual([
        expect.objectContaining({ source: pair.open_event_id, target: pair.close_event_id, type: "closure" }),
      ]);
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("protects retained trace and open-work evidence from age deletion", () => {
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
        ["message.reviewed", "test", "agent:owner", JSON.stringify({ openEventId, reviewedBy: "test" }), now + 1],
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
      expect(
        db
          .prepare("SELECT * FROM event_trace_links WHERE from_event_id = ? AND to_event_id = ?")
          .get(closeEventId, openEventId),
      ).toMatchObject({
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
      expect(
        db
          .prepare("SELECT * FROM event_trace_links WHERE from_event_id = ? AND to_event_id = ?")
          .get(resolvedEventId, createdEventId),
      ).toMatchObject({
        from_event_id: resolvedEventId,
        to_event_id: createdEventId,
        type: "closure",
        label: "escalation.resolved",
      });

      const messageGraph = buildEventGraph(db, openEventId);
      expect(graphEvents(messageGraph).map((node) => node.id)).toEqual([openEventId, closeEventId]);
      const escalationGraph = buildEventGraph(db, createdEventId);
      expect(graphEvents(escalationGraph).map((node) => node.id)).toEqual([createdEventId, resolvedEventId]);
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
        type: "handler.started",
        source: "test",
        owner: "project:sample",
        data: { handler: "task-controller", handlerRunId: "a1", sessionId: "s1" },
      } as any);

      const db = getDb(root);
      const event = db.prepare("SELECT id FROM events WHERE event_type = 'handler.started'").get() as {
        id: number;
      };
      const missingOpenEventId = event.id + 1000;
      const missingCloseEventId = event.id + 1001;

      db.run(
        `INSERT INTO event_pair_runs
         (pair_name, correlation_key, open_event_id, close_event_id, owner, status, opened_at, expected_close_at, closed_at, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "handler",
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
          "handler",
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
      const event = db
        .prepare(
          `SELECT id, delivery_status, accepted_by, delivery_route
         FROM events
         WHERE event_type = 'message.created'`,
        )
        .get() as Record<string, unknown>;
      expect(event).toMatchObject({
        delivery_status: "accepted",
        accepted_by: "owner-inbox:agent:dev",
        delivery_route: "owner_inbox",
      });

      const pair = db
        .prepare(
          `SELECT pair_name, open_event_id, status
         FROM event_pair_runs
         WHERE open_event_id = ?`,
        )
        .get(event.id) as Record<string, unknown>;
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

  it("accepts skill and guard diagnostics as evidence without creating owner work", () => {
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
          delivery_status: "accepted",
          accepted_by: "event-store:evidence-projection",
          delivery_route: "direct",
        }),
        expect.objectContaining({
          event_type: "guard.triggered",
          delivery_status: "accepted",
          accepted_by: "event-store:evidence-projection",
          delivery_route: "direct",
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

  it("accepts observation events through the evidence projection without opening inbox work", () => {
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
      bus.emit({
        type: "handler.workflow_dispatched",
        source: "workflow-runner",
        owner: "agent:evaluator",
        data: { handler: "evaluator-aftermath", workflowRunId: "wr_1" },
      } as any);
      bus.emit({
        type: "evaluation.routed",
        source: "evaluation.app",
        owner: "agent:evaluator",
        data: { sessionId: "s_1", lane: "routine_ok" },
      } as any);

      const db = getDb(root);
      for (const eventType of [
        "runtime.daemon.heartbeat",
        "metric.feedback.routed",
        "handler.workflow_dispatched",
        "evaluation.routed",
      ]) {
        const event = db
          .prepare(
            `SELECT delivery_status, accepted_by, delivery_route
           FROM events
           WHERE event_type = ?`,
          )
          .get(eventType) as Record<string, unknown>;
        expect(event).toMatchObject({
          delivery_status: "accepted",
          accepted_by: "event-store:evidence-projection",
          delivery_route: "direct",
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

  it("keeps unknown owner-addressed requests visible in the owner inbox", () => {
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
        delivery_status: "accepted",
        accepted_by: "owner-inbox:project:sample",
        delivery_route: "owner_inbox",
      });
      expect(
        db
          .prepare(
            `SELECT pair_name, status
               FROM event_pair_runs
              WHERE pair_name = 'owner_inbox'`,
          )
          .get(),
      ).toMatchObject({ pair_name: "owner_inbox", status: "open" });
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
      expect(db.prepare("SELECT status FROM event_pair_runs WHERE pair_name = 'owner_inbox'").get()).toMatchObject({
        status: "open",
      });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("closes the canonical project owner review lifecycle by project identity", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);
      bus.emit({
        type: "project.owner.requested",
        source: "test",
        owner: "project:sample",
        data: { project: "sample", reason: "review" },
      } as any);
      bus.emit({
        type: "project.owner.reviewed",
        source: "test",
        owner: "project:sample",
        data: { project: "sample", summary: "reviewed" },
      } as any);

      const db = getDb(root);
      const pair = db
        .prepare(
          `SELECT p.status, p.open_event_id, p.close_event_id, l.type AS link_type
           FROM event_pair_runs p
           LEFT JOIN event_trace_links l
             ON l.from_event_id = p.close_event_id
            AND l.to_event_id = p.open_event_id
            AND l.type = 'closure'
           WHERE p.pair_name = 'project.owner'`,
        )
        .get() as Record<string, unknown>;
      expect(pair).toMatchObject({ status: "closed", link_type: "closure" });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("closes a project intent with the correlated owner result", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);
      const comment = bus.emit({
        type: "project.comment.created",
        source: "test",
        owner: "agent:sample-owner",
        data: { project: "sample", comment: "advance" },
      } as any);
      const openEventId = Number(comment[EVENT_ROW_ID]);
      bus.emit({
        type: "project.owner.reviewed",
        source: "project-app:sample:task-reconciler",
        owner: "agent:sample-owner",
        data: {
          project: "sample",
          openEventId,
          summary: "owner reviewed current state",
          taskRefs: [{ projectId: "sample", taskId: "runtime/owner-review" }],
        },
      } as any);

      expect(
        getDb(root)
          .prepare(
            `SELECT status, open_event_id, close_event_id
             FROM event_pair_runs
             WHERE pair_name = 'project.intent'`,
          )
          .get(),
      ).toMatchObject({ status: "closed", open_event_id: openEventId });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not close new project work with an older owner result", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);
      bus.emit({
        type: "project.owner.reviewed",
        source: "project-app:sample:task-reconciler",
        owner: "agent:sample-owner",
        data: { project: "sample", summary: "reviewed earlier work" },
      } as any);

      const comment = bus.emit({
        type: "project.comment.created",
        source: "test",
        owner: "agent:sample-owner",
        data: { project: "sample", comment: "new instruction" },
      } as any);
      const ownerRequest = bus.emit({
        type: "project.owner.requested",
        source: "test",
        owner: "agent:sample-owner",
        data: { project: "sample", reason: "new review" },
      } as any);

      const db = getDb(root);
      for (const [pairName, openEventId] of [
        ["project.intent", Number(comment[EVENT_ROW_ID])],
        ["project.owner", Number(ownerRequest[EVENT_ROW_ID])],
      ] as const) {
        expect(
          db
            .prepare(
              `SELECT status, close_event_id
               FROM event_pair_runs
               WHERE pair_name = ? AND open_event_id = ?`,
            )
            .get(pairName, openEventId),
        ).toMatchObject({ status: "open", close_event_id: null });
      }
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("closes only the project intent named by a correlated owner result", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);
      const first = bus.emit({
        type: "project.comment.created",
        source: "test",
        owner: "agent:sample-owner",
        data: { project: "sample", comment: "first instruction" },
      } as any);
      const second = bus.emit({
        type: "project.comment.created",
        source: "test",
        owner: "agent:sample-owner",
        data: { project: "sample", comment: "second instruction" },
      } as any);
      const firstId = Number(first[EVENT_ROW_ID]);
      const secondId = Number(second[EVENT_ROW_ID]);

      bus.emit({
        type: "project.owner.reviewed",
        source: "project-app:sample:task-reconciler",
        owner: "agent:sample-owner",
        data: {
          project: "sample",
          openEventId: firstId,
          summary: "reviewed only the first instruction",
        },
      } as any);

      const db = getDb(root);
      expect(
        db
          .prepare(
            `SELECT status FROM event_pair_runs
             WHERE pair_name = 'project.intent' AND open_event_id = ?`,
          )
          .get(firstId),
      ).toMatchObject({ status: "closed" });
      expect(
        db
          .prepare(
            `SELECT status, close_event_id FROM event_pair_runs
             WHERE pair_name = 'project.intent' AND open_event_id = ?`,
          )
          .get(secondId),
      ).toMatchObject({ status: "open", close_event_id: null });
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
      const row = db
        .prepare(
          `SELECT delivery_status
         FROM events
         WHERE event_type = 'reload'`,
        )
        .get() as Record<string, unknown>;
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

      const row = db
        .prepare(
          `SELECT delivery_status, accepted_by, delivery_route
         FROM events
         WHERE event_type = 'session.end'`,
        )
        .get() as Record<string, unknown>;
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

  it("keeps overdue messages open for semantic lifecycle reconciliation", async () => {
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
      expect(health.orphanPairs).toEqual([]);
      expect(
        db.prepare("SELECT status FROM event_pair_runs WHERE pair_name = 'owner_inbox'").get(),
      ).toMatchObject({ status: "open" });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("late follow-up events close overdue owner-inbox messages", async () => {
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
      const event = db.prepare(`SELECT id FROM events WHERE event_type = 'message.created'`).get() as Record<
        string,
        unknown
      >;

      await new Promise((resolve) => setTimeout(resolve, 5));
      bus.emit({
        type: "handler.completed",
        source: "cron",
        owner: "agent:may",
        data: { handler: "sample", agent: "may", durationMs: 5 },
      } as any);

      expect(
        (
          db.prepare(`SELECT status FROM event_pair_runs WHERE open_event_id = ?`).get(event.id) as Record<
            string,
            unknown
          >
        ).status,
      ).toBe("open");

      bus.emit({
        type: "message.reviewed",
        source: "test",
        owner: "agent:dev",
        data: { openEventId: event.id, reviewedBy: "dev" },
      } as any);

      expect(
        (
          db.prepare(`SELECT status FROM event_pair_runs WHERE open_event_id = ?`).get(event.id) as Record<
            string,
            unknown
          >
        ).status,
      ).toBe("closed");
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

  it("persists reconciliation observations without inventing a task lifecycle pair", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);

      bus.emit({
        type: "project.task.reconciled",
        source: "project-app:sample",
        owner: "project:sample",
        data: {
          taskId: "sample-task",
          attemptId: "a_sample-task_1",
          disposition: "converged",
        },
      } as any);

      bus.emit({
        type: "project.task.reconciled",
        source: "project-app:sample",
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

  it("owner inbox review records progress and keeps the message open", () => {
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
      const commands = createCommandService({ getDb: () => db, emit: (event) => bus.emit(event as any) });
      const inbox = query.heartbeatContext({ agent: "dev" }).inbox;
      expect(inbox).toHaveLength(1);
      const id = inbox[0]!.id as number;

      expect(commands.reviewInboxEvents([id], "dev")).toBe(1);

      const followup = db
        .prepare(
          `SELECT id, event_type, data, delivery_status, delivery_route
         FROM events
         WHERE event_type = 'message.progressed'`,
        )
        .get() as Record<string, unknown>;
      expect(followup).toMatchObject({
        event_type: "message.progressed",
        delivery_status: "accepted",
        delivery_route: "direct",
      });
      expect(JSON.parse(String(followup.data))).toMatchObject({
        sourceEventId: id,
        sourceEventType: "message.created",
        reviewedBy: "dev",
        disposition: "reviewed",
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
        type: "reference",
        label: "message.progressed",
      });

      const pair = db
        .prepare(
          `SELECT status
         FROM event_pair_runs
         WHERE open_event_id = ?`,
        )
        .get(id) as Record<string, unknown>;
      expect(pair.status).toBe("open");
      expect(query.heartbeatContext({ agent: "dev" }).inbox).toHaveLength(1);
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not retire unfinished messages because they are old", () => {
    const root = tempRoot();
    try {
      const bus = new EventBus();
      attachPersistence(bus, root);
      bus.emit({
        type: "message.created",
        source: "test",
        owner: "agent:dev",
        data: { from: "test", to: "dev", content: "stale review" },
      });

      const db = getDb(root);
      const event = db
        .prepare(
          `SELECT id, data
         FROM events
         WHERE event_type = 'message.created'`,
        )
        .get() as { id: number; data: string };
      db.prepare("UPDATE events SET timestamp = ? WHERE id = ?").run(Date.now() - 48 * 60 * 60_000, event.id);

      const commands = createCommandService({ getDb: () => db, emit: (event) => bus.emit(event as any) });
      expect(commands.expireStaleMessages(24 * 60 * 60_000)).toBe(0);
      expect(db.prepare("SELECT data FROM events WHERE id = ?").get(event.id)).toEqual({ data: event.data });
      expect(
        db
          .prepare(
            `SELECT status, note
           FROM event_pair_runs
           WHERE open_event_id = ? AND pair_name = 'owner_inbox'`,
          )
          .get(event.id),
      ).toMatchObject({
        status: "open",
      });
      expect(db.prepare("SELECT data FROM events WHERE event_type = 'message.expired'").get()).toBeNull();
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("retains orphan lifecycle evidence across later event sweeps", () => {
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
