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
      expect(sessionIndexes.some(({ name }) => name === "idx_sess_agent_started")).toBe(true);
      expect(sessionIndexes.some(({ name }) => name === "idx_sess_agent")).toBe(false);
      expect(workflowIndexes.some(({ name }) => name === "idx_wfr_project_started")).toBe(true);
      expect(workflowIndexes.some(({ name }) => name === "idx_wfr_project")).toBe(false);
      expect(inboxColumns.some(({ name }) => name === "lease_generation")).toBe(true);
      expect(inboxColumns.some(({ name }) => name === "available_at")).toBe(true);
      expect(inboxIndexes.some(({ name }) => name === "idx_app_inbox_idempotency")).toBe(true);
      expect(inboxIndexes.some(({ name }) => name === "idx_app_inbox_conversation_sequence")).toBe(true);
      expect(trigger.sql).toContain("OLD.session_id");
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
});
