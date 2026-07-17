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
      const trigger = db.prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_events_referential_retention'",
      ).get() as { sql: string };

      expect(columns.some(({ name }) => name === "session_id")).toBe(true);
      expect(columns.some(({ name }) => name === "delivery_status")).toBe(true);
      expect(columns.some(({ name }) => name === "handled_by")).toBe(false);
      expect(indexes.some(({ name }) => name === "idx_events_session")).toBe(true);
      expect(trigger.sql).toContain("OLD.session_id");
      expect(trigger.sql).not.toContain("json_extract");
      expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'runtime_migrations'").get()).toBeNull();
    } finally {
      db.close();
    }
  });
});
