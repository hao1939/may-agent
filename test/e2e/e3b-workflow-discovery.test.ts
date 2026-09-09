/**
 * E3b — Workflow discovery and scheduled execution
 *
 * Validates that the agent-scoped workflow resolver finds a workflow file in
 * agents/<name>/workflows/ and dispatches it end-to-end, exercising:
 *   - workflow file discovery (agent-scoped path)
 *   - configured workflow → workflow execution → result
 *   - workflow_runs table persistence
 *
 * Validates documented behavior of:
 *   - workflow-authoring.md § Workflow Location
 *
 * File handlers cannot launch workflows. An App schedule admits the Task;
 * the isolated workflow attempt supplies its proposed result.
 *
 * Runs by default; does not require LLM access.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { openSandboxDb, pollUntil, queryEvents, queryWorkflowRuns } from "./lib/live-daemon.js";
import { buildSandbox, type Sandbox } from "./lib/sandbox.js";

describe("E3b: workflow discovery and scheduled execution", () => {
  let sb: Sandbox;
  const t0 = Date.now();

  beforeAll(async () => {
    sb = await buildSandbox({
      fixtureAgents: ["may"],
      fixtureWorkflows: { may: ["e2e-noop-workflow"] },
      fixtureProjects: ["scheduled-workflow.app"],
    });
    await sb.daemonReady;
  }, 60_000);

  afterAll(async () => {
    if (sb) await sb.close();
  });

  test("a configured workflow is discovered, completes, and persists in workflow_runs", async () => {
    const db = openSandboxDb(sb.dbPath);
    try {
      // Wait for the App-authored workflow to run.
      const result = await pollUntil(
        () => {
          const ran = queryEvents(db, { types: ["e2e.workflow_ran"], since: t0, limit: 5 });
          return ran.length >= 1 ? { ran } : null;
        },
        { timeoutMs: 45_000, intervalMs: 500, description: "scheduled workflow execution event" },
      );

      expect(result.ran.length).toBeGreaterThanOrEqual(1);

      // The domain event is emitted inside the workflow, before its terminal
      // row is finalized. Wait for the terminal projection instead of racing
      // that valid ordering.
      const runs = await pollUntil(
        () => {
          const observed = queryWorkflowRuns(db, { workflow: "e2e-noop-workflow", since: t0 });
          return observed[0]?.status === "done" ? observed : null;
        },
        { timeoutMs: 10_000, intervalMs: 100, description: "terminal workflow run" },
      );
      expect(runs[0].status).toBe("done");
      expect(runs[0].endedAt).not.toBeNull();
      const task = await pollUntil(
        () => {
          const row = db
            .prepare(
              "SELECT receipt_json FROM app_task_receipts WHERE app_id = 'scheduled-workflow' AND receipt_id = 'work/main'",
            )
            .get() as { receipt_json: string } | null;
          return row ? JSON.parse(row.receipt_json) : null;
        },
        { timeoutMs: 10000, intervalMs: 100, description: "Task accepts scheduled workflow result" },
      );
      expect(task).toMatchObject({
        metadata: { id: "work/main", generation: 1 },
        summary: "Scheduled workflow verified",
      });
    } catch (error) {
      console.error(sb.getLogs().slice(-8000));
      console.error(db.prepare("SELECT task_id, phase, resource_json FROM app_tasks").all());
      throw error;
    } finally {
      db.close();
    }
  }, 90_000);
});
