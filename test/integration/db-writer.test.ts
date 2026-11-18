import { afterEach, describe, expect, it, beforeEach } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DbWriter } from "../../src/lib/db-writer.js";
import { closeDb, getDb } from "../../src/lib/db/connection.js";

let testDir: string;
beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), "may-agent-db-writer-test-"));
});
afterEach(() => {
  closeDb(testDir);
  rmSync(testDir, { recursive: true, force: true });
});

describe("DbWriter", () => {
  it("ignores flat session lifecycle events", () => {
    const writer = new DbWriter(testDir);
    const db = getDb(testDir);

    writer.handler({
      type: "session.start",
      sessionId: "s_flat",
      agent: "dev",
      task: "flat start",
      source: "runtime",
      owner: "agent:dev",
    } as any);

    expect(db.prepare("SELECT COUNT(*) AS count FROM sessions WHERE sessionId = ?").get("s_flat")).toMatchObject({
      count: 0,
    });

    db.run("INSERT INTO sessions (sessionId, agent, task, status, startedAt) VALUES (?, ?, ?, ?, ?)", [
      "s_running",
      "dev",
      "task",
      "running",
      Date.now() - 1_000,
    ]);

    writer.handler({
      type: "session.end",
      sessionId: "s_running",
      agent: "dev",
      status: "error",
      source: "runtime",
      owner: "agent:dev",
    } as any);

    expect(db.prepare("SELECT status, endedAt FROM sessions WHERE sessionId = ?").get("s_running")).toMatchObject({
      status: "running",
      endedAt: null,
    });
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type IN ('session.start', 'session.end')").get(),
    ).toMatchObject({ count: 0 });
  });

  it("only journals canonical session lifecycle events, without projections or result artifacts", () => {
    const writer = new DbWriter(testDir);
    const db = getDb(testDir);
    for (const type of ["session.start", "session.idle", "session.end"]) {
      writer.handler({
        type,
        source: "runtime",
        owner: "agent:worker",
        data: { sessionId: "unowned", agent: "worker", task: "work", status: "done", summary: "Reported" },
      });
    }
    expect(db.prepare("SELECT COUNT(*) AS n FROM sessions").get()).toEqual({ n: 0 });
    expect(existsSync(join(testDir, "sessions/unowned/result.json"))).toBe(false);
    expect(db.prepare("SELECT event_type, source, owner FROM events ORDER BY id").all()).toEqual(
      ["session.start", "session.idle", "session.end"].map((event_type) => ({
        event_type,
        source: "runtime",
        owner: "agent:worker",
      })),
    );
  });
});
