import { describe, expect, it } from "bun:test";
import { openDatabase } from "../db.js";
import { applyDbSchema } from "./schema.js";

describe("canonical database schema", () => {
  it("creates the complete schema idempotently without migration state", () => {
    const db = openDatabase(":memory:");
    try {
      expect(() => applyDbSchema(db)).not.toThrow();
      expect(() => applyDbSchema(db)).not.toThrow();

      const columns = db.prepare("PRAGMA table_info(events)").all() as Array<{ name: string }>;
      const indexes = db.prepare("PRAGMA index_list(events)").all() as Array<{ name: string }>;
      const trigger = db
        .prepare("SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_events_referential_retention'")
        .get() as { sql: string };

      expect(columns.some(({ name }) => name === "session_id")).toBe(true);
      expect(columns.some(({ name }) => name === "delivery_status")).toBe(true);
      expect(columns.some(({ name }) => name === "idempotency_key")).toBe(true);
      expect(columns.some(({ name }) => name === "idempotency_scope")).toBe(true);
      expect(columns.some(({ name }) => name === "idempotency_hash")).toBe(true);
      expect(columns.some(({ name }) => name === "ingress_source")).toBe(true);
      expect(columns.some(({ name }) => name === "handled_by")).toBe(false);
      expect(indexes.some(({ name }) => name === "idx_events_session")).toBe(true);
      expect(indexes.some(({ name }) => name === "idx_events_task_executor_progress")).toBe(true);
      expect(indexes.some(({ name }) => name === "idx_events_idempotency")).toBe(true);
      const sessionIndexes = db.prepare("PRAGMA index_list(sessions)").all() as Array<{ name: string }>;
      const sessionColumns = db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
      const workflowIndexes = db.prepare("PRAGMA index_list(workflow_runs)").all() as Array<{ name: string }>;
      const workflowColumns = db.prepare("PRAGMA table_info(workflow_runs)").all() as Array<{ name: string }>;
      const inboxColumns = db.prepare("PRAGMA table_info(app_inbox_items)").all() as Array<{ name: string }>;
      const inboxIndexes = db.prepare("PRAGMA index_list(app_inbox_items)").all() as Array<{ name: string }>;
      const deliveryColumns = db.prepare("PRAGMA table_info(app_inbox_deliveries)").all() as Array<{ name: string }>;
      const deliveryIndexes = db.prepare("PRAGMA index_list(app_inbox_deliveries)").all() as Array<{ name: string }>;
      const admissionPlanColumns = db.prepare("PRAGMA table_info(app_event_admission_plans)").all() as Array<{
        name: string;
      }>;
      const admissionCommandColumns = db.prepare("PRAGMA table_info(app_event_admission_commands)").all() as Array<{
        name: string;
      }>;
      const conditionRouteIndexes = db.prepare("PRAGMA index_list(app_task_condition_routes)").all() as Array<{
        name: string;
      }>;
      const conditionIndexes = db.prepare("PRAGMA index_list(app_task_conditions)").all() as Array<{ name: string }>;
      expect(sessionIndexes.some(({ name }) => name === "idx_sess_agent_started")).toBe(true);
      expect(sessionIndexes.some(({ name }) => name === "idx_sess_task_binding")).toBe(true);
      expect(sessionColumns.map(({ name }) => name)).toEqual(
        expect.arrayContaining(["app_id", "task_id", "task_generation", "attempt_id"]),
      );
      expect(sessionIndexes.some(({ name }) => name === "idx_sess_agent")).toBe(false);
      expect(workflowIndexes.some(({ name }) => name === "idx_wfr_project_started")).toBe(true);
      expect(workflowIndexes.some(({ name }) => name === "idx_wfr_task_binding")).toBe(true);
      expect(workflowColumns.map(({ name }) => name)).toEqual(
        expect.arrayContaining(["app_id", "task_id", "task_generation", "attempt_id"]),
      );
      expect(workflowIndexes.some(({ name }) => name === "idx_wfr_project")).toBe(false);
      expect(inboxColumns.some(({ name }) => name === "lease_generation")).toBe(true);
      expect(inboxColumns.some(({ name }) => name === "available_at")).toBe(true);
      expect(inboxColumns.some(({ name }) => name === "channel")).toBe(true);
      expect(inboxColumns.some(({ name }) => name === "channel_target_id")).toBe(true);
      expect(inboxColumns.some(({ name }) => name === "channel_thread_id")).toBe(true);
      expect(inboxColumns.some(({ name }) => name === "channel_message_id")).toBe(true);
      expect(inboxColumns.some(({ name }) => name === "reply_to_source_id")).toBe(true);
      expect(inboxColumns.some(({ name }) => name === "origin_event_id")).toBe(true);
      expect(inboxColumns.some(({ name }) => name === "topic_id")).toBe(true);
      expect(inboxIndexes.some(({ name }) => name === "idx_app_inbox_idempotency")).toBe(true);
      expect(inboxIndexes.some(({ name }) => name === "idx_app_inbox_origin_event")).toBe(true);
      expect(inboxIndexes.some(({ name }) => name === "idx_app_inbox_conversation_sequence")).toBe(true);
      expect(inboxIndexes.some(({ name }) => name === "idx_app_inbox_available")).toBe(true);
      expect(inboxIndexes.some(({ name }) => name === "idx_app_inbox_expired")).toBe(true);
      expect(inboxIndexes.some(({ name }) => name === "idx_app_inbox_task_wait_recovery")).toBe(true);
      const inboxSql = db
        .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'app_inbox_items'")
        .get() as { sql: string };
      expect(inboxSql.sql).toContain("'analysis'");
      expect(deliveryColumns.map(({ name }) => name)).toEqual(
        expect.arrayContaining([
          "operation_id",
          "item_id",
          "kind",
          "text",
          "session_id",
          "request_id",
          "status",
          "receipt_event_id",
        ]),
      );
      expect(deliveryIndexes.some(({ name }) => name === "idx_app_inbox_delivery_status")).toBe(true);
      expect(admissionPlanColumns.some(({ name }) => name === "registry_snapshot_id")).toBe(true);
      expect(admissionCommandColumns.some(({ name }) => name === "payload_version")).toBe(true);
      expect(conditionRouteIndexes.some(({ name }) => name === "idx_app_task_condition_routes_task")).toBe(true);
      expect(conditionIndexes.some(({ name }) => name === "idx_app_task_conditions_type_app")).toBe(true);
      expect(conditionIndexes.some(({ name }) => name === "idx_app_task_conditions_type_subject_app")).toBe(true);
      expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'conversation_topics'").get()).not.toBeNull();
      expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'conversation_topic_tasks'").get()).not.toBeNull();
      expect(trigger.sql).toContain("OLD.session_id");
      expect(trigger.sql).toContain("i.origin_event_id = OLD.id");
      expect(trigger.sql).not.toContain("json_extract");
      expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'runtime_migrations'").get()).toBeNull();
    } finally {
      db.close();
    }
  });

  it("upgrades an existing events table before creating dependent indexes", () => {
    const db = openDatabase(":memory:");
    try {
      db.exec(`
        CREATE TABLE events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_type TEXT NOT NULL,
          data TEXT,
          timestamp INTEGER NOT NULL
        );
      `);

      expect(() => applyDbSchema(db)).not.toThrow();
      expect(() => applyDbSchema(db)).not.toThrow();

      const columns = db.prepare("PRAGMA table_info(events)").all() as Array<{ name: string }>;
      const indexes = db.prepare("PRAGMA index_list(events)").all() as Array<{ name: string }>;

      expect(columns.some(({ name }) => name === "session_id")).toBe(true);
      expect(columns.some(({ name }) => name === "workflow_run_id")).toBe(true);
      expect(columns.some(({ name }) => name === "delivery_status")).toBe(true);
      expect(columns.some(({ name }) => name === "idempotency_scope")).toBe(true);
      expect(indexes.some(({ name }) => name === "idx_events_session")).toBe(true);
      expect(indexes.some(({ name }) => name === "idx_events_idempotency")).toBe(true);
    } finally {
      db.close();
    }
  });

  it("backfills event traces once when upgrading a pre-trace database", () => {
    const db = openDatabase(":memory:");
    try {
      db.exec(`
        CREATE TABLE events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_type TEXT NOT NULL,
          data TEXT,
          timestamp INTEGER NOT NULL
        );
        INSERT INTO events (event_type, data, timestamp) VALUES ('legacy.event', '{}', 1);
      `);

      applyDbSchema(db);
      expect(db.prepare("SELECT * FROM event_traces WHERE event_id = 1").get()).toMatchObject({
        event_id: 1,
        trace_id: "event:1",
        parent_event_id: null,
        visibility: "default",
      });

      // Existing trace schema means compatibility migration already ran.
      // Integrity checks, not every process startup, report later corruption.
      db.run("DELETE FROM event_traces WHERE event_id = 1");
      applyDbSchema(db);
      expect(db.prepare("SELECT * FROM event_traces WHERE event_id = 1").get()).toBeNull();

      db.run("INSERT INTO events (event_type, data, timestamp) VALUES ('current.event', '{}', 2)");
      expect(db.prepare("SELECT * FROM event_traces WHERE event_id = 2").get()).toMatchObject({
        event_id: 2,
        trace_id: "event:2",
      });
    } finally {
      db.close();
    }
  });

  it("adds channel metadata to an existing App inbox table", () => {
    const db = openDatabase(":memory:");
    try {
      db.exec(`
        CREATE TABLE app_inbox_items (
          id TEXT PRIMARY KEY,
          app_id TEXT NOT NULL,
          parent_id TEXT,
          conversation_id TEXT,
          conversation_seq INTEGER,
          source_kind TEXT NOT NULL,
          source_id TEXT NOT NULL,
          input_kind TEXT NOT NULL,
          input_data TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          session_id TEXT,
          waiting_on_kind TEXT,
          waiting_on_id TEXT,
          result TEXT,
          available_at INTEGER,
          review_at INTEGER,
          lease_generation INTEGER NOT NULL DEFAULT 0,
          lease_owner TEXT,
          lease_expires_at INTEGER,
          idempotency_key TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          completed_at INTEGER
        );
      `);

      expect(() => applyDbSchema(db)).not.toThrow();
      expect(() => applyDbSchema(db)).not.toThrow();

      const columns = db.prepare("PRAGMA table_info(app_inbox_items)").all() as Array<{ name: string }>;
      expect(columns.map(({ name }) => name)).toEqual(
        expect.arrayContaining([
          "channel",
          "channel_target_id",
          "channel_thread_id",
          "channel_message_id",
          "reply_to_source_id",
          "origin_event_id",
        ]),
      );
      expect(() =>
        db.run(
          `INSERT INTO app_inbox_items (
             id, app_id, source_kind, source_id, input_kind, input_data, status,
             waiting_on_kind, waiting_on_id, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ["analysis-wait", "may", "human", "human:1", "message", "{}", "handling", "analysis", "a-1", 1, 1],
        ),
      ).not.toThrow();
    } finally {
      db.close();
    }
  });

  it("upgrades the one-row delivery table to progress and final operations", () => {
    const db = openDatabase(":memory:");
    try {
      db.exec(`
        CREATE TABLE app_inbox_deliveries (
          item_id TEXT PRIMARY KEY,
          operation_id TEXT NOT NULL UNIQUE,
          session_id TEXT NOT NULL,
          request_id TEXT NOT NULL,
          channel TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          external_message_id TEXT,
          failure_reason TEXT,
          receipt_event_id INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          attempted_at INTEGER,
          completed_at INTEGER
        );
        INSERT INTO app_inbox_deliveries (
          item_id, operation_id, session_id, request_id, channel, status, created_at, updated_at
        ) VALUES ('item-1', 'legacy-operation', 'session-1', 'request-1', 'telegram', 'pending', 1, 1);
      `);

      expect(() => applyDbSchema(db)).not.toThrow();
      expect(() => applyDbSchema(db)).not.toThrow();
      const columns = db.prepare("PRAGMA table_info(app_inbox_deliveries)").all() as Array<{
        name: string;
        pk: number;
      }>;
      expect(columns.find(({ name }) => name === "operation_id")?.pk).toBe(1);
      expect(columns.map(({ name }) => name)).toEqual(expect.arrayContaining(["kind", "text"]));
      expect(db.prepare("SELECT operation_id, item_id, kind FROM app_inbox_deliveries").get()).toEqual({
        operation_id: "legacy-operation",
        item_id: "item-1",
        kind: "final",
      });
      expect(() =>
        db.run(
          `INSERT INTO app_inbox_deliveries (
             operation_id, item_id, kind, text, session_id, request_id, channel, status, created_at, updated_at
           ) VALUES ('progress-operation', 'item-1', 'progress', 'Working', 'session-2', 'request-1', 'telegram', 'pending', 2, 2)`,
        ),
      ).not.toThrow();
    } finally {
      db.close();
    }
  });
});
