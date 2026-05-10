import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { closeDb, getDb } from "./requests.js";
import { createQueryService } from "./query-service.js";

describe("QueryService", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  function harness() {
    const root = mkdtempSync(join(tmpdir(), "query-service-"));
    roots.push(root);
    const db = getDb(root);
    const query = createQueryService({ getDb: () => db, defaultLimit: 2, maxLimit: 3 });
    return { db, query };
  }

  it("queries core runtime tables with bounded filters", () => {
    const { db, query } = harness();
    const now = 10_000;

    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, projectId, startedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["s1", "may", "older", "done", "p1", now - 100],
    );
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, projectId, startedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["s2", "may", "newer", "error", "p1", now],
    );
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, projectId, startedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["s3", "scout", "other", "done", "p2", now + 100],
    );

    expect(query.sessions({ agent: "may" }).rows.map((row) => row.sessionId)).toEqual(["s2", "s1"]);
    expect(query.sessions({ projectId: "p1", status: "done" }).rows).toMatchObject([
      { sessionId: "s1", agent: "may", status: "done" },
    ]);
  });

  it("keeps arbitrary SQL read-only and bounded", () => {
    const { db, query } = harness();

    for (let i = 0; i < 4; i++) {
      db.run(
        "INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)",
        ["example", "test", "may", JSON.stringify({ i }), i],
      );
    }

    const result = query.sql("SELECT id, event_type FROM events ORDER BY id ASC", [], { limit: 3 });
    expect(result.rowCount).toBe(3);
    expect(result.truncated).toBe(true);
    expect(result.rows.map((row) => row.event_type)).toEqual(["example", "example", "example"]);
  });

  it("rejects writes and multi-statement SQL", () => {
    const { query } = harness();

    expect(() => query.sql("UPDATE sessions SET status = 'done'")).toThrow(/read-only|only allows/);
    expect(() => query.sql("SELECT 1; SELECT 2")).toThrow(/one statement/);
  });

  it("allows bounded schema inspection pragmas", () => {
    const { query } = harness();

    expect(query.sql("PRAGMA table_info(sessions)").rows.some((row) => row.name === "sessionId")).toBe(true);
    expect(() => query.sql("PRAGMA user_version = 1")).toThrow(/not allowed/);
  });
});
