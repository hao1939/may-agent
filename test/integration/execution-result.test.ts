import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { closeDb, getDb } from "../../src/lib/requests.js";
import {
  getExecutionResultFromDb,
  resumeDiagnosticToExecutionResult,
  taskResultToExecutionResult,
  workflowToolResultToExecutionResult,
} from "../../src/lib/execution-result.js";
import type { TaskResult } from "../../src/lib/types.js";
import type { WorkflowToolResult } from "../../src/lib/workflow.js";

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

  it("maps TaskResult into a shared session result", () => {
    const taskResult: TaskResult = {
      sessionId: "s1",
      status: "done",
      lastAssistantText: "implemented the change",
      messages: [],
      duration: "1.2s",
      outputDir: "/tmp/out",
      turnsUsed: 2,
    };

    expect(taskResultToExecutionResult(taskResult, { agent: "dev", task: "fix bug", projectId: "p1" })).toMatchObject({
      id: "s1",
      kind: "session",
      status: "done",
      summary: "implemented the change",
      traceId: "s1",
      owner: "dev",
      projectId: "p1",
      evidence: { agent: "dev", task: "fix bug", duration: "1.2s", turnsUsed: 2 },
    });
  });

  it("maps workflow tool results into the same shape", () => {
    const result: WorkflowToolResult = {
      type: "blocked",
      workflow: "goal-driver",
      workflowRunId: "wr1",
      reason: "missing evidence",
      completedSteps: [],
    };

    expect(workflowToolResultToExecutionResult(result)).toMatchObject({
      id: "wr1",
      kind: "workflow",
      status: "blocked",
      summary: "missing evidence",
      traceId: "wr1",
      evidence: { workflow: "goal-driver", completedSteps: 0 },
    });
  });

  it("maps session resume diagnostics into the same shape", () => {
    expect(resumeDiagnosticToExecutionResult({
      kind: "session",
      id: "s_missing",
      reason: "Agent missing-agent is not registered",
      category: "agent_not_registered",
      recoverable: false,
      owner: "missing-agent",
      agent: "missing-agent",
      projectId: "p1",
    })).toMatchObject({
      id: "s_missing",
      kind: "session",
      status: "error",
      summary: "Agent missing-agent is not registered",
      traceId: "s_missing",
      owner: "missing-agent",
      projectId: "p1",
      evidence: {
        owner: "missing-agent",
        agent: "missing-agent",
        category: "agent_not_registered",
        recoverable: false,
      },
    });
  });

  it("maps workflow resume diagnostics into the same shape", () => {
    expect(resumeDiagnosticToExecutionResult({
      kind: "workflow",
      id: "wr_missing",
      reason: "Workflow definition missing",
      category: "workflow_definition_missing",
      recoverable: true,
      nextAction: "recover",
      owner: "may",
      workflow: "goal-driver",
      status: "interrupted",
    })).toMatchObject({
      id: "wr_missing",
      kind: "workflow",
      status: "interrupted",
      summary: "Workflow definition missing",
      traceId: "wr_missing",
      evidence: {
        owner: "may",
        workflow: "goal-driver",
        category: "workflow_definition_missing",
        recoverable: true,
        nextAction: "recover",
      },
    });
  });

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
      evidence: { agent: "arc", kind: "call", source: "workflow:test", workflowRunId: "wr_parent", opCount: 3 },
    });
  });

  it("reads workflow rows from DB as execution results", () => {
    const db = dbHarness();
    db.run(
      `INSERT INTO workflow_runs
       (runId, workflow, task, parentSessionId, parentWorkflowRunId, projectId, depth, status, startedAt, endedAt, result_summary, result_reason, resumedFromRunId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["wr_db", "goal-driver", "project: x", "s_parent", null, "p1", 2, "escalated", 100, 300, null, "blocked by missing comment", "wr_old"],
    );

    expect(getExecutionResultFromDb(db, "wr_db")).toMatchObject({
      id: "wr_db",
      kind: "workflow",
      status: "escalated",
      summary: "blocked by missing comment",
      traceId: "wr_db",
      parentId: "s_parent",
      projectId: "p1",
      startedAt: 100,
      endedAt: 300,
      evidence: { workflow: "goal-driver", task: "project: x", depth: 2, parentSessionId: "s_parent", resumedFromRunId: "wr_old" },
    });
  });
});
