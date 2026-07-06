import { projectRuntimePaths, resolveTaskTreePath } from "@may-agent/sdk";
import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProjectHealth } from "./project-health.ts";

const nowIso = "2026-07-03T12:00:00.000Z";
const nowMs = Date.parse(nowIso);

async function makeFixture() {
  const root = await mkdtemp(join(tmpdir(), "aks-project-health-"));
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");
  await mkdir(join(appDir, "tasks"), { recursive: true });
  await mkdir(join(appDir, ".state"), { recursive: true });
  await mkdir(projectDir, { recursive: true });
  await writeFile(
    join(appDir, "project.json"),
    `${JSON.stringify({ id: "aks-rp-e2e.app" }, null, 2)}\n`,
  );
  return { appDir, projectDir };
}

async function writeTree(
  appDir: string,
  tasks: Record<string, Record<string, unknown>>,
  rootChildren: string[],
) {
  await writeFile(
    resolveTaskTreePath(appDir),
    `${JSON.stringify(
      {
        version: 1,
        project: "aks-rp-e2e",
        project_lifecycle: "active",
        root_task_id: "project",
        active_task_ids: rootChildren.filter(
          (id) => tasks[id]?.state === "active",
        ),
        tasks: {
          project: {
            id: "project",
            state: "active",
            status: "active",
            children: rootChildren,
            goal: "Drive the project.",
          },
          ...tasks,
        },
      },
      null,
      2,
    )}\n`,
  );
}

async function writeJsonl(
  appDir: string,
  name: string,
  rows: Record<string, unknown>[],
) {
  await writeFile(
    join(appDir, ".state", name),
    rows.map((row) => JSON.stringify(row)).join("\n") + "\n",
  );
}

describe("project health", () => {
  test("reports moving when active work has recent task movement", async () => {
    const fixture = await makeFixture();
    await writeTree(
      fixture.appDir,
      {
        "active-task": {
          id: "active-task",
          parent_id: "project",
          state: "active",
          status: "active",
          children: [],
          goal: "Do active work.",
          trace: {
            assigned_at: "2026-07-03T11:59:00.000Z",
            worker_started_at: "2026-07-03T11:59:10.000Z",
          },
        },
      },
      ["active-task"],
    );
    await writeJsonl(fixture.appDir, "journal.jsonl", [
      {
        ts: "2026-07-03T11:59:10.000Z",
        kind: "task_worker_started",
        task_id: "active-task",
      },
    ]);

    const report = buildProjectHealth({
      appDir: fixture.appDir,
      projectDir: fixture.projectDir,
      nowMs,
      lookbackMinutes: 30,
      staleActiveMinutes: 30,
    });

    expect(report.status).toBe("moving");
    expect(report.frontier.counts.active).toBe(1);
    expect(report.signals.map((signal) => signal.code)).toContain(
      "frontier.active",
    );
  });

  test("flags an incomplete durable loop with no executable frontier", async () => {
    const fixture = await makeFixture();
    await mkdir(join(fixture.appDir, ".state", "spec-loop"), {
      recursive: true,
    });
    await writeFile(
      join(fixture.appDir, ".state", "spec-loop", "state.json"),
      `${JSON.stringify(
        {
          specs: {
            "spec.example": { status: "error" },
          },
        },
        null,
        2,
      )}\n`,
    );
    await writeTree(
      fixture.appDir,
      {
        "aks-spec-verification-loop": {
          id: "aks-spec-verification-loop",
          parent_id: "project",
          state: "blocked",
          status: "blocked",
          workflow: "spec-loop-controller",
          children: [],
          goal: "Verify every spec.",
          context: {
            workflowProgress: {
              completionReady: false,
              reason: "spec-loop state still has non-terminal specs",
              pending: 0,
              running: 0,
              done: 0,
              error: 1,
              unrepresentedNonTerminalCount: 1,
              updatedAt: "2026-07-03T11:00:00.000Z",
            },
          },
        },
      },
      ["aks-spec-verification-loop"],
    );

    const report = buildProjectHealth({
      appDir: fixture.appDir,
      projectDir: fixture.projectDir,
      nowMs,
      lookbackMinutes: 30,
      staleActiveMinutes: 30,
    });

    expect(report.status).toBe("stalled");
    expect(report.signals.map((signal) => signal.code)).toContain(
      "loop.incomplete-without-frontier",
    );
    expect(report.loops[0].stateCounts).toMatchObject({ error: 1 });
  });

  test("surfaces assignment rows that have not been consumed", async () => {
    const fixture = await makeFixture();
    await writeTree(
      fixture.appDir,
      {
        "queued-task": {
          id: "queued-task",
          parent_id: "project",
          state: "backlog",
          status: "backlog",
          children: [],
          goal: "Queued work.",
          depends_on: [],
        },
      },
      ["queued-task"],
    );
    await writeJsonl(fixture.appDir, "task-assignments.jsonl", [
      {
        taskId: "queued-task",
        task_id: "queued-task",
        attemptId: "a_queued",
        attempt_id: "a_queued",
        sessionId: "s_queued",
        session_id: "s_queued",
        worker: "aks-explorer",
        assignedAt: "2026-07-03T11:59:00.000Z",
        assigned_at: "2026-07-03T11:59:00.000Z",
      },
    ]);

    const report = buildProjectHealth({
      appDir: fixture.appDir,
      projectDir: fixture.projectDir,
      nowMs,
      lookbackMinutes: 30,
      staleActiveMinutes: 30,
    });

    expect(report.status).toBe("attention");
    expect(report.assignments.queued).toBe(1);
    expect(report.signals.map((signal) => signal.code)).toContain(
      "assignment.queue-not-empty",
    );
  });
});
