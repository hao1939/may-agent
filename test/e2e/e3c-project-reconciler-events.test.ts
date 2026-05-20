/**
 * E3c — Project reconciler events (lite, no LLM)
 *
 * Event-driven project reconciler contract:
 *   - project.nudge is a reconcile chance even without a comment payload
 *   - rapid project events are queued and processed one by one
 *   - project.task.finished can immediately produce the next reconcile pass
 *   - owner review is singleflight while an owner workflow is live
 *
 * Runs by default; does not require LLM access.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  openSandboxDb,
  pollUntil,
  queryEvents,
  socketEmit,
} from "./lib/live-daemon.js";
import { buildSandbox, type Sandbox } from "./lib/sandbox.js";

function eventPayload(row: { data: string | null }): Record<string, unknown> {
  return JSON.parse(row.data ?? "{}") as Record<string, unknown>;
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

describe("E3c: project reconciler events (lite)", () => {
  let sb: Sandbox;

  beforeAll(async () => {
    sb = await buildSandbox({
      fixtureAgents: ["may"],
      fixtureHandlers: { may: ["e2e-project-reconciler"] },
      fixtureWorkflows: { may: ["e2e-task-worker-stub", "e2e-owner-slow-stub"] },
      fixtureProjects: [
        "e2e-reconcile-nudge-a",
        "e2e-reconcile-nudge-b",
        "e2e-reconcile-chain",
        "e2e-reconcile-owner",
      ],
      cronJson: {
        may: [
          {
            name: "e2e-project-reconciler",
            handler: "e2e-project-reconciler",
            agent: "may",
            enabled: true,
            on: ["project.nudge", "project.task.finished"],
            timeoutMs: 10000,
            handlerConfig: { delayMs: 250 },
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
    "queues rapid generic nudges and reconciles each target",
    async () => {
      const t0 = Date.now();

      await socketEmit(sb.socketPath, "project.nudge", {
        source: "e2e-test",
        owner: "agent:may",
        data: { projectPath: "projects/e2e-reconcile-nudge-a" },
      });
      await socketEmit(sb.socketPath, "project.nudge", {
        source: "e2e-test",
        owner: "agent:may",
        data: { projectPath: "projects/e2e-reconcile-nudge-b" },
      });

      const db = openSandboxDb(sb.dbPath);
      try {
        const completed = await pollUntil(
          () => {
            const rows = queryEvents(db, { types: ["e2e.project_reconcile.completed"], since: t0, limit: 20 })
              .filter((row) => ["may/e2e-reconcile-nudge-a", "may/e2e-reconcile-nudge-b"].includes(String(eventPayload(row).projectId)));
            const projectIds = new Set(rows.map((row) => eventPayload(row).projectId));
            return projectIds.has("may/e2e-reconcile-nudge-a") && projectIds.has("may/e2e-reconcile-nudge-b") ? rows : null;
          },
          { timeoutMs: 15_000, intervalMs: 200, description: "queued nudge reconciles" },
        );

        const payloads = completed.map(eventPayload);
        expect(payloads).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ projectId: "may/e2e-reconcile-nudge-a", action: "owner-dispatched" }),
            expect.objectContaining({ projectId: "may/e2e-reconcile-nudge-b", action: "owner-dispatched" }),
          ]),
        );

        const starts = queryEvents(db, { types: ["e2e.project_reconcile.started"], since: t0, limit: 20 })
          .filter((row) => ["may/e2e-reconcile-nudge-a", "may/e2e-reconcile-nudge-b"].includes(String(eventPayload(row).projectId)));
        expect(starts.length).toBeGreaterThanOrEqual(2);
      } finally {
        db.close();
      }
    },
    30_000,
  );

  test(
    "task-finished events unblock ready work and trigger final owner review",
    async () => {
      const t0 = Date.now();

      await socketEmit(sb.socketPath, "project.task.finished", {
        source: "e2e-test",
        owner: "agent:may",
        data: {
          projectId: "may/e2e-reconcile-chain",
          projectPath: "projects/e2e-reconcile-chain",
          taskId: "seed",
        },
      });

      const db = openSandboxDb(sb.dbPath);
      try {
        await pollUntil(
          () => {
            const finished = queryEvents(db, { types: ["project.task.finished"], since: t0, limit: 20 })
              .filter((row) => {
                const data = eventPayload(row);
                return data.projectId === "may/e2e-reconcile-chain" && data.taskId === "followup";
              });
            return finished.length ? finished[0] : null;
          },
          { timeoutMs: 15_000, intervalMs: 200, description: "followup task completion" },
        );

        await pollUntil(
          () => {
            const ownerDispatches = queryEvents(db, { types: ["e2e.owner_judgment.dispatch"], since: t0, limit: 20 })
              .filter((row) => eventPayload(row).projectId === "may/e2e-reconcile-chain");
            return ownerDispatches.length ? ownerDispatches[0] : null;
          },
          { timeoutMs: 15_000, intervalMs: 200, description: "final owner judgment dispatch" },
        );

        const projectFile = join(sb.projectsRoot, "e2e-reconcile-chain", "project.md");
        const content = readFileSync(projectFile, "utf-8");
        expect(taskBlock(content, "followup")).toContain("status: done");
        expect(taskBlock(content, "followup")).toContain("result: succeeded");
      } finally {
        db.close();
      }
    },
    35_000,
  );

  test(
    "owner loop remains singleflight while duplicate events are reconciled",
    async () => {
      const t0 = Date.now();

      await socketEmit(sb.socketPath, "project.nudge", {
        source: "e2e-test",
        owner: "agent:may",
        data: { projectPath: "projects/e2e-reconcile-owner" },
      });
      await socketEmit(sb.socketPath, "project.nudge", {
        source: "e2e-test",
        owner: "agent:may",
        data: { projectPath: "projects/e2e-reconcile-owner" },
      });

      const db = openSandboxDb(sb.dbPath);
      try {
        await pollUntil(
          () => {
            const rows = queryEvents(db, { types: ["e2e.project_reconcile.completed"], since: t0, limit: 20 })
              .filter((row) => eventPayload(row).projectId === "may/e2e-reconcile-owner");
            const actions = rows.map((row) => eventPayload(row).action);
            return actions.includes("owner-dispatched") && actions.includes("owner-already-running") ? rows : null;
          },
          { timeoutMs: 15_000, intervalMs: 200, description: "duplicate owner reconciles" },
        );

        const ownerDispatches = queryEvents(db, { types: ["e2e.owner_judgment.dispatch"], since: t0, limit: 20 })
          .filter((row) => eventPayload(row).projectId === "may/e2e-reconcile-owner");
        expect(ownerDispatches).toHaveLength(1);
      } finally {
        db.close();
      }
    },
    30_000,
  );
});
