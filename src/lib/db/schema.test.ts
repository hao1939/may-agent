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
      expect(indexes.some(({ name }) => name === "idx_events_idempotency")).toBe(true);
      const sessionIndexes = db.prepare("PRAGMA index_list(sessions)").all() as Array<{ name: string }>;
      const workflowIndexes = db.prepare("PRAGMA index_list(workflow_runs)").all() as Array<{ name: string }>;
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
      expect(sessionIndexes.some(({ name }) => name === "idx_sess_agent_started")).toBe(true);
      expect(sessionIndexes.some(({ name }) => name === "idx_sess_agent")).toBe(false);
      expect(workflowIndexes.some(({ name }) => name === "idx_wfr_project_started")).toBe(true);
      expect(workflowIndexes.some(({ name }) => name === "idx_wfr_project")).toBe(false);
      expect(inboxColumns.some(({ name }) => name === "lease_generation")).toBe(true);
      expect(inboxColumns.some(({ name }) => name === "available_at")).toBe(true);
      expect(inboxColumns.some(({ name }) => name === "channel")).toBe(true);
      expect(inboxColumns.some(({ name }) => name === "channel_thread_id")).toBe(true);
      expect(inboxColumns.some(({ name }) => name === "channel_message_id")).toBe(true);
      expect(inboxColumns.some(({ name }) => name === "origin_event_id")).toBe(true);
      expect(inboxIndexes.some(({ name }) => name === "idx_app_inbox_idempotency")).toBe(true);
      expect(inboxIndexes.some(({ name }) => name === "idx_app_inbox_origin_event")).toBe(true);
      expect(inboxIndexes.some(({ name }) => name === "idx_app_inbox_conversation_sequence")).toBe(true);
      expect(deliveryColumns.map(({ name }) => name)).toEqual(
        expect.arrayContaining(["operation_id", "session_id", "request_id", "status", "receipt_event_id"]),
      );
      expect(deliveryIndexes.some(({ name }) => name === "idx_app_inbox_delivery_status")).toBe(true);
      expect(admissionPlanColumns.some(({ name }) => name === "registry_snapshot_id")).toBe(true);
      expect(admissionCommandColumns.some(({ name }) => name === "payload_version")).toBe(true);
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
        expect.arrayContaining(["channel", "channel_thread_id", "channel_message_id", "origin_event_id"]),
      );
    } finally {
      db.close();
    }
  });
});
