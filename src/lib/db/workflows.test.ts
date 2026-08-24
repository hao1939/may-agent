import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "./connection.js";
import { getWorkflowRun, insertWorkflowRun, updateWorkflowRun } from "./workflows.js";

describe("workflow run storage", () => {
  it("keeps the full task in run.json and a bounded SQL projection", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "may-workflow-db-"));
    const task = "workflow input ".repeat(2_000);
    try {
      insertWorkflowRun(persistDir, {
        runId: "wr_test",
        workflow: "verify",
        task,
        parentSessionId: null,
        parentWorkflowRunId: null,
        depth: 1,
        status: "running",
        startedAt: 1,
        endedAt: null,
        result_summary: null,
        result_reason: null,
        resumedFromRunId: null,
        taskBinding: {
          appId: "evaluation",
          taskId: "task-1",
          generation: 3,
          attemptId: "attempt-4",
        },
      });

      const row = getDb(persistDir).prepare("SELECT * FROM workflow_runs WHERE runId = ?").get("wr_test") as any;
      expect(row.task.length).toBeLessThan(task.length);
      expect(row.task_ref).toBe("workflow-runs/wr_test/run.json");
      expect(row.task_sha256).toHaveLength(64);
      expect(row.artifact_sha256).toHaveLength(64);
      expect(row).toMatchObject({
        app_id: "evaluation",
        task_id: "task-1",
        task_generation: 3,
        attempt_id: "attempt-4",
      });
      expect(existsSync(join(persistDir, row.artifact_ref))).toBe(true);

      updateWorkflowRun(persistDir, "wr_test", {
        status: "done",
        endedAt: 2,
        result_summary: "verified",
      });
      const run = getWorkflowRun(persistDir, "wr_test");
      expect(run?.task).toBe(task);
      expect(run?.taskBinding).toEqual({
        appId: "evaluation",
        taskId: "task-1",
        generation: 3,
        attemptId: "attempt-4",
      });
      expect(run).toMatchObject({ status: "done", endedAt: 2, result_summary: "verified" });
      const artifact = JSON.parse(readFileSync(join(persistDir, row.artifact_ref), "utf8"));
      expect(artifact.task).toBe(task);
    } finally {
      closeDb(persistDir);
    }
  });

});
