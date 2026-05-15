import { describe, expect, it, beforeEach } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DbWriter } from "../src/lib/db-writer.js";
import { closeDb, getDb } from "../src/lib/requests.js";

const TEST_DIR = join(tmpdir(), "may-agent-db-writer-test");

beforeEach(() => {
  try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
  mkdirSync(TEST_DIR, { recursive: true });
  closeDb(TEST_DIR);
});

describe("DbWriter", () => {
  it("does not erase session lineage when a duplicate start event lacks projectId", () => {
    const writer = new DbWriter(TEST_DIR);
    const db = getDb(TEST_DIR);

    writer.handler({
      type: "session.start",
      sessionId: "s_project",
      agent: "may",
      task: "project worker",
      kind: "call",
      source: "workflow:project",
      workflowRunId: "wr_project",
      projectId: "may/aks-rp-e2e",
    } as any);
    writer.handler({
      type: "session.start",
      sessionId: "s_project",
      agent: "may",
      task: "project worker resumed",
      kind: "call",
      source: "workflow:project",
      workflowRunId: "wr_project",
    } as any);

    const row = db.prepare("SELECT sessionId, projectId, workflowRunId FROM sessions WHERE sessionId = ?").get("s_project") as any;
    expect(row).toMatchObject({
      sessionId: "s_project",
      projectId: "may/aks-rp-e2e",
      workflowRunId: "wr_project",
    });
  });
});
