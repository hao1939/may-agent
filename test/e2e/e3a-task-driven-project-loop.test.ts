/**
 * E3a — Task-driven project loop (lite, no LLM)
 *
 * This is the live-stack behavior contract for the task-driven project design.
 * It exercises the daemon, cron handler loading, SDK project-task helpers,
 * workflow dispatch, events table persistence, workflow_runs persistence, and
 * project.md task projection updates without provider access.
 *
 * Validates:
 *   - ready task dispatch emits project.task.dispatched / project.task.finished
 *   - downstream tasks unblock only after dependency result: succeeded
 *   - task worker workflows persist in workflow_runs with projectId
 *   - repeated direct attempts route to owner judgment instead of another task dispatch
 *
 * Gated behind E2E_LIVE=1; does not require LLM access.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

function taskBlock(content: string, taskId: string): string {
  const marker = `- id: ${taskId}`;
  const start = content.indexOf(marker);
  if (start < 0) throw new Error(`task block not found: ${taskId}`);
  const next = content.indexOf("\n- id:", start + marker.length);
  const nextSection = content.indexOf("\n## ", start + marker.length);
  const endCandidates = [next, nextSection].filter((n) => n >= 0);
  const end = endCandidates.length ? Math.min(...endCandidates) : content.length;
  return content.slice(start, end);
}

describe.skipIf(!E2E_LIVE)("E3a: task-driven project loop (lite)", () => {
  let sb: Sandbox;
  const t0 = Date.now();

  beforeAll(async () => {
    sb = await buildSandbox({
      fixtureAgents: ["may"],
      fixtureHandlers: { may: ["e2e-project-tasks"] },
      fixtureWorkflows: { may: ["e2e-task-worker-stub", "e2e-owner-judgment-stub"] },
      fixtureProjects: ["e2e-task-chain", "e2e-task-judgment"],
      cronJson: {
        may: [
          {
            name: "e2e-project-tasks",
            handler: "e2e-project-tasks",
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
    "dispatches ready tasks, unblocks dependencies, and persists task runs",
    async () => {
      const db = openSandboxDb(sb.dbPath);
      try {
        const result = await pollUntil(
          () => {
            const finished = queryEvents(db, { types: ["project.task.finished"], since: t0, limit: 20 })
              .map(eventPayload)
              .filter((data) => data.projectId === "may/e2e-task-chain");
            const taskIds = new Set(finished.map((data) => data.taskId));
            return taskIds.has("score-a") && taskIds.has("analyze") ? finished : null;
          },
          { timeoutMs: 45_000, intervalMs: 500, description: "task chain completion" },
        );

        expect(result.some((data) => data.taskId === "score-a" && data.finishStatus === "success")).toBe(true);
        expect(result.some((data) => data.taskId === "analyze" && data.finishStatus === "success")).toBe(true);

        const projectFile = join(sb.projectsRoot, "e2e-task-chain", "project.md");
        const content = readFileSync(projectFile, "utf-8");
        expect(taskBlock(content, "score-a")).toContain("status: done");
        expect(taskBlock(content, "score-a")).toContain("result: succeeded");
        expect(taskBlock(content, "analyze")).toContain("status: done");
        expect(taskBlock(content, "analyze")).toContain("result: succeeded");

        const runs = queryWorkflowRuns(db, {
          projectId: "may/e2e-task-chain",
          workflow: "e2e-task-worker-stub",
          since: t0,
        });
        expect(runs.length).toBeGreaterThanOrEqual(2);
        expect(runs.every((run) => run.status === "done")).toBe(true);
      } finally {
        db.close();
      }
    },
    70_000,
  );

  test(
    "routes repeated task attempts to owner judgment",
    async () => {
      const db = openSandboxDb(sb.dbPath);
      try {
        const judgment = await pollUntil(
          () => {
            const events = queryEvents(db, { types: ["e2e.owner_judgment.ran"], since: t0, limit: 10 })
              .map(eventPayload)
              .filter((data) => data.projectId === "may/e2e-task-judgment" && data.taskId === "stuck-task");
            return events.length ? events[0] : null;
          },
          { timeoutMs: 45_000, intervalMs: 500, description: "owner judgment for repeated task" },
        );

        expect(judgment).toMatchObject({ projectId: "may/e2e-task-judgment", taskId: "stuck-task" });

        const directDispatches = queryEvents(db, { types: ["project.task.dispatched"], since: t0, limit: 20 })
          .map(eventPayload)
          .filter((data) => data.projectId === "may/e2e-task-judgment" && data.taskId === "stuck-task");
        expect(directDispatches).toEqual([]);

        const ownerRuns = queryWorkflowRuns(db, {
          projectId: "may/e2e-task-judgment",
          workflow: "e2e-owner-judgment-stub",
          since: t0,
        });
        expect(ownerRuns.length).toBeGreaterThanOrEqual(1);
        expect(ownerRuns[0].status).toBe("done");
      } finally {
        db.close();
      }
    },
    70_000,
  );
});
