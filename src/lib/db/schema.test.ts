import { describe, expect, it } from "bun:test";
import { openDatabase } from "../db.js";
import { applyDbSchemaAndMigrations } from "./schema.js";

describe("database schema migrations", () => {
  it("adds typed event columns before creating their indexes and trigger", () => {
    const db = openDatabase(":memory:");
    try {
      db.exec(`
        CREATE TABLE events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_type TEXT NOT NULL,
          source TEXT,
          owner TEXT,
          data TEXT,
          timestamp INTEGER NOT NULL
        )
      `);

      expect(() => applyDbSchemaAndMigrations(db)).not.toThrow();

      const columns = db.prepare("PRAGMA table_info(events)").all() as Array<{ name: string }>;
      const indexes = db.prepare("PRAGMA index_list(events)").all() as Array<{ name: string }>;
      const trigger = db.prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_events_referential_retention'",
      ).get() as { sql: string };

      expect(columns.some(({ name }) => name === "session_id")).toBe(true);
      expect(indexes.some(({ name }) => name === "idx_events_session")).toBe(true);
      expect(trigger.sql).toContain("OLD.session_id");
    } finally {
      db.close();
    }
  });
});
