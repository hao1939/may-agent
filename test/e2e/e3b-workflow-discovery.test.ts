/**
 * E3b — Workflow discovery and dispatch
 *
 * Validates that the agent-scoped workflow resolver finds a workflow file in
 * agents/<name>/workflows/ and dispatches it end-to-end, exercising:
 *   - workflow file discovery (agent-scoped path)
 *   - handler → sdk.runWorkflow → workflow execution → result
 *   - workflow_runs table persistence
 *   - missing-workflow negative path
 *
 * Validates documented behavior of:
 *   - workflow-authoring.md § Workflow Location
 *   - handler-authoring.md § Example: Event-To-Workflow Bridge
 *   - sdk-quickstart.md § Run an Agent / Choose the Right Primitive
 *
 * Gated behind E2E_LIVE=1; does not require LLM access.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  E2E_LIVE,
  openSandboxDb,
  pollUntil,
  queryEvents,
  queryWorkflowRuns,
} from "./lib/live-daemon.js";
import { buildSandbox, type Sandbox } from "./lib/sandbox.js";

function eventPayload(row: { data: string | null }): Record<string, unknown> {
  const parsed = JSON.parse(row.data ?? "{}");
  return (parsed.data ?? parsed) as Record<string, unknown>;
}

describe.skipIf(!E2E_LIVE)("E3b: workflow discovery and dispatch", () => {
  let sb: Sandbox;
  const t0 = Date.now();

  beforeAll(async () => {
    sb = await buildSandbox({
      fixtureAgents: ["may"],
      fixtureHandlers: { may: ["e2e-dispatch-workflow"] },
      fixtureWorkflows: { may: ["e2e-noop-workflow"] },
      cronJson: {
        may: [
          {
            name: "e2e-dispatch",
            handler: "e2e-dispatch-workflow",
            intervalMs: 10000,
            agent: "may",
            enabled: true,
          },
        ],
      },
    });
    await sb.daemonReady;
  }, 60_000);

  afterAll(async () => {
    if (sb) await sb.close();
  });

  test(
    "workflow is discovered, dispatched, completes, and persists in workflow_runs",
    async () => {
      const db = openSandboxDb(sb.dbPath);
      try {
        // Wait for the dispatch attempt + result.
        const result = await pollUntil(
          () => {
            const attempts = queryEvents(db, { types: ["e2e.dispatch.attempt"], since: t0, limit: 5 });
            const results = queryEvents(db, { types: ["e2e.dispatch.result"], since: t0, limit: 5 });
            const ran = queryEvents(db, { types: ["e2e.workflow_ran"], since: t0, limit: 5 });
            if (attempts.length >= 1 && results.length >= 1 && ran.length >= 1) {
              return { attempts, results, ran };
            }
            return null;
          },
          { timeoutMs: 45_000, intervalMs: 500, description: "workflow dispatch + execution events" },
        );

        // Workflow ran end-to-end.
        expect(result.ran.length).toBeGreaterThanOrEqual(1);

        const dispatchResultData = JSON.parse(result.results[0].data ?? "{}");
        const inner = dispatchResultData.data ?? dispatchResultData;
        expect(inner.workflow).toBe("e2e-noop-workflow");
        expect(inner.status).toBe("done");
        expect(inner.summary).toContain("e2e-noop-workflow completed");

        // workflow_runs row materialized.
        const runs = queryWorkflowRuns(db, { workflow: "e2e-noop-workflow", since: t0 });
        expect(runs.length).toBeGreaterThanOrEqual(1);
        expect(runs[0].status).toBe("done");
        expect(runs[0].endedAt).not.toBeNull();
      } finally {
        db.close();
      }
    },
    90_000,
  );

  test(
    "missing workflow: dispatch returns error, no workflow_runs row, no exception bubbles",
    async () => {
      let missingSb: Sandbox | undefined;
      const missingWorkflow = "e2e-missing-workflow";
      const missingT0 = Date.now();

      missingSb = await buildSandbox({
        fixtureAgents: ["may"],
        fixtureHandlers: { may: ["e2e-dispatch-workflow"] },
        cronJson: {
          may: [
            {
              name: "e2e-dispatch-missing",
              handler: "e2e-dispatch-workflow",
              handlerConfig: { workflow: missingWorkflow },
              intervalMs: 10000,
              agent: "may",
              enabled: true,
            },
          ],
        },
      });
      await missingSb.daemonReady;

      const db = openSandboxDb(missingSb.dbPath);
      try {
        const result = await pollUntil(
          () => {
            const results = queryEvents(db, { types: ["e2e.dispatch.result"], since: missingT0, limit: 5 })
              .map(eventPayload)
              .filter((data) => data.workflow === missingWorkflow);
            const error = results.find((data) => data.status === "error");
            return error ?? null;
          },
          { timeoutMs: 45_000, intervalMs: 500, description: "missing workflow dispatch error" },
        );

        expect(result.error).toContain(`Workflow "${missingWorkflow}" not found`);

        const runs = queryWorkflowRuns(db, { workflow: missingWorkflow, since: missingT0 });
        expect(runs).toEqual([]);

        const handlerFailures = queryEvents(db, { types: ["handler.failed"], since: missingT0, limit: 5 });
        expect(handlerFailures).toEqual([]);
      } finally {
        db.close();
        await missingSb.close();
      }
    },
    70_000,
  );
});
