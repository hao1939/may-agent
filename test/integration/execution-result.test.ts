import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { closeDb, getDb } from "../../src/lib/db/connection.js";
import { getExecutionResultFromDb } from "../../src/lib/execution-result.js";

describe("ExecutionResult", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  function dbHarness() {
    const root = mkdtempSync(join(tmpdir(), "execution-result-"));
    roots.push(root);
    return getDb(root);
  }

  it("reads session rows from DB as execution results", () => {
    const db = dbHarness();
    db.run(
      `INSERT INTO sessions
       (sessionId, agent, task, status, kind, source, parentSessionId, workflowRunId, projectId, startedAt, endedAt, error, outcome, opCount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["s_db", "arc", "repair system", "error", "call", "workflow:test", "s_parent", "wr_parent", "p1", 100, 200, "boom", "failed", 3],
    );

    expect(getExecutionResultFromDb(db, "s_db")).toMatchObject({
      id: "s_db",
      kind: "session",
      status: "error",
      summary: "boom",
      traceId: "wr_parent",
      owner: "arc",
      parentId: "s_parent",
      projectId: "p1",
      startedAt: 100,
      endedAt: 200,
      facts: { agent: "arc", kind: "call", source: "workflow:test", workflowRunId: "wr_parent", opCount: 3 },
    });
  });

  it("reads workflow rows from DB as execution results", () => {
    const db = dbHarness();
    db.run(
      `INSERT INTO workflow_runs
       (runId, workflow, task, parentSessionId, parentWorkflowRunId, projectId, depth, status, startedAt, endedAt, result_summary, result_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["wr_db", "goal-driver", "project: x", "s_parent", null, "p1", 2, "escalated", 100, 300, null, "blocked by missing comment"],
    );

    expect(getExecutionResultFromDb(db, "wr_db")).toMatchObject({
      id: "wr_db",
      kind: "workflow",
      status: "blocked",
      summary: "blocked by missing comment",
      traceId: "wr_db",
      parentId: "s_parent",
      projectId: "p1",
      startedAt: 100,
      endedAt: 300,
      facts: { workflow: "goal-driver", task: "project: x", depth: 2, parentSessionId: "s_parent" },
    });
  });
});
