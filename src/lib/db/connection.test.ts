import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../db.js";
import { closeDb, getDb } from "./connection.js";

describe("database connection ownership", () => {
  it("does not initialize schema from a short-lived Task worker", () => {
    const root = mkdtempSync(join(tmpdir(), "may-worker-db-"));
    try {
      expect(() => getDb(root, { existingSchemaOnly: true })).toThrow("initialized Host database");
      const db = openDatabase(join(root, "may.db"));
      try {
        expect(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table'").get()).toEqual({
          count: 0,
        });
      } finally {
        db.close();
      }
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("lets a Task worker reuse an initialized Host schema without changing it", () => {
    const root = mkdtempSync(join(tmpdir(), "may-worker-db-"));
    try {
      const host = getDb(root);
      const schemaBefore = host.prepare("SELECT COUNT(*) AS count FROM sqlite_master").get();
      closeDb(root);

      const worker = getDb(root, { existingSchemaOnly: true });
      expect(worker.prepare("SELECT COUNT(*) AS count FROM sqlite_master").get()).toEqual(schemaBefore);
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
