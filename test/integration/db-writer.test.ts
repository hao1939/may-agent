import { describe, expect, it, beforeEach } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DbWriter } from "../../src/lib/db-writer.js";
import { closeDb, getDb } from "../../src/lib/requests.js";

const TEST_DIR = join(tmpdir(), "may-agent-db-writer-test");

beforeEach(() => {
  try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
  mkdirSync(TEST_DIR, { recursive: true });
  closeDb(TEST_DIR);
});

describe("DbWriter", () => {
  it("ignores flat session lifecycle events", () => {
    const writer = new DbWriter(TEST_DIR);
    const db = getDb(TEST_DIR);

    writer.handler({
      type: "session.start",
      sessionId: "s_flat",
      agent: "dev",
      task: "flat start",
      source: "runtime",
      owner: "agent:dev",
    } as any);

    expect(db.prepare("SELECT COUNT(*) AS count FROM sessions WHERE sessionId = ?").get("s_flat")).toMatchObject({ count: 0 });

    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, startedAt) VALUES (?, ?, ?, ?, ?)",
      ["s_running", "dev", "task", "running", Date.now() - 1_000],
    );

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
    expect(db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type IN ('session.start', 'session.end')").get()).toMatchObject({ count: 0 });
  });

  it("does not erase session lineage when a duplicate start event lacks projectId", () => {
    const writer = new DbWriter(TEST_DIR);
    const db = getDb(TEST_DIR);

    writer.handler({
      type: "session.start",
      source: "workflow:project",
      owner: "agent:may",
      data: {
        sessionId: "s_project",
        agent: "may",
        task: "project worker",
        kind: "call",
        trigger: "runtime",
        firedAt: Date.now(),
        workflowRunId: "wr_project",
        projectId: "may/aks-rp-e2e",
      },
    } as any);
    writer.handler({
      type: "session.start",
      source: "workflow:project",
      owner: "agent:may",
      data: {
        sessionId: "s_project",
        agent: "may",
        task: "project worker resumed",
        kind: "call",
        trigger: "runtime",
        firedAt: Date.now(),
        workflowRunId: "wr_project",
      },
    } as any);

    const row = db.prepare("SELECT sessionId, projectId, workflowRunId FROM sessions WHERE sessionId = ?").get("s_project") as any;
    expect(row).toMatchObject({
      sessionId: "s_project",
      projectId: "may/aks-rp-e2e",
      workflowRunId: "wr_project",
    });
  });

  it("preserves an existing terminal error when a later projection omits it", () => {
    const writer = new DbWriter(TEST_DIR);
    const db = getDb(TEST_DIR);
    const now = Date.now();
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, startedAt, error) VALUES (?, ?, ?, ?, ?, ?)",
      ["s_error", "dev", "task", "error", now - 10, "provider failed"],
    );

    writer.handler({
      type: "session.end",
      source: "runtime",
      owner: "agent:dev",
      data: { sessionId: "s_error", agent: "dev", status: "error" },
    } as any);

    expect(db.prepare("SELECT status, error FROM sessions WHERE sessionId = ?").get("s_error")).toEqual({
      status: "error",
      error: "provider failed",
    });
  });
});
