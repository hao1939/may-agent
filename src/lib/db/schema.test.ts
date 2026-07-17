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
      expect(columns.some(({ name }) => name === "handled_by")).toBe(false);
      expect(indexes.some(({ name }) => name === "idx_events_session")).toBe(true);
      const sessionIndexes = db.prepare("PRAGMA index_list(sessions)").all() as Array<{ name: string }>;
      const workflowIndexes = db.prepare("PRAGMA index_list(workflow_runs)").all() as Array<{ name: string }>;
      expect(sessionIndexes.some(({ name }) => name === "idx_sess_agent_started")).toBe(true);
      expect(sessionIndexes.some(({ name }) => name === "idx_sess_agent")).toBe(false);
      expect(workflowIndexes.some(({ name }) => name === "idx_wfr_project_started")).toBe(true);
      expect(workflowIndexes.some(({ name }) => name === "idx_wfr_project")).toBe(false);
      expect(trigger.sql).toContain("OLD.session_id");
      expect(trigger.sql).not.toContain("json_extract");
      expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'runtime_migrations'").get()).toBeNull();
    } finally {
      db.close();
    }
  });
});
