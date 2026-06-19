import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute } from "./project-execution-watchdog.ts";

async function makeProject() {
  const dir = await mkdtemp(join(tmpdir(), "aks-watchdog-"));
  await mkdir(join(dir, ".state"), { recursive: true });
  await mkdir(join(dir, "tasks"), { recursive: true });
  await writeFile(
    join(dir, "project.json"),
    `${JSON.stringify(
      {
        id: "test-project",
        owner: "aks-explorer",
        status: "active",
        goal: "Test Project",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(join(dir, ".state", "journal.jsonl"), "", "utf8");
  return dir;
}

function task(id: string, state: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    parent_id: id === "project" ? null : "project",
    state,
    children: [],
    goal: `${id} goal.`,
    inputs: [],
    outputs: [`evidence/archive/${id}.md`],
    acceptance: ["Done."],
    forbidden: [],
    ...extra,
  };
}

async function writeTree(
  projectDir: string,
  tasks: Record<string, Record<string, unknown>>,
  extra: Record<string, unknown> = {},
) {
  const tree = {
    version: 1,
    project: "aks-rp-e2e",
    project_lifecycle: "active",
    root_task_id: "project",
    updated_at: new Date().toISOString(),
    active_task_id: null,
    active_task_ids: [],
    tasks: {
      project: {
        ...task("project", "backlog", { outputs: ["tasks/tree.json"] }),
        children: Object.keys(tasks),
      },
      ...tasks,
    },
    ...extra,
  };
  await writeFile(
    join(projectDir, "tasks", "tree.json"),
    `${JSON.stringify(tree, null, 2)}\n`,
    "utf8",
  );
}

async function writeModelWithGap(projectDir: string) {
  await mkdir(join(projectDir, "model", "knowledge-map"), { recursive: true });
  await writeFile(
    join(projectDir, "model", "knowledge-map", "model.json"),
    `${JSON.stringify(
      {
        featurePaths: [{ id: "path.feature-a.create", status: "unknown" }],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function writeSession(dbPath: string, sessionId: string, status: string) {
  const db = new Database(dbPath);
  db.exec("create table sessions (sessionId text primary key, status text)");
  db.query("insert into sessions values (?, ?)").run(sessionId, status);
  db.close();
}

function writeRuntimeSession(
  dbPath: string,
  row: {
    sessionId: string;
    status: string;
    outcome?: string | null;
    opCount?: number;
    startedAt?: number;
    lastActivityAt?: number | null;
  },
) {
  const db = new Database(dbPath);
  db.exec(`
    create table sessions (
      sessionId text primary key,
      status text not null,
      outcome text,
      opCount integer default 0,
      startedAt integer not null,
      lastActivityAt integer
    )
  `);
  db.query("insert into sessions values (?, ?, ?, ?, ?, ?)").run(
    row.sessionId,
    row.status,
    row.outcome ?? null,
    row.opCount ?? 0,
    row.startedAt ?? Date.now(),
    row.lastActivityAt ?? null,
  );
  db.close();
}

function context(input: {
  projectDir: string;
  stateDbPath?: string;
  maxConcurrent?: number;
  sessionStartGraceMs?: number;
  dispatched?: Array<{ type: string; payload: Record<string, unknown> }>;
}) {
  return {
    task: [
      `app: ${input.projectDir}`,
      `project: ${input.projectDir}`,
      `stateDb: ${input.stateDbPath ?? join(input.projectDir, "missing.db")}`,
      "maxAttempts: 2",
      `maxConcurrent: ${input.maxConcurrent ?? 3}`,
      `sessionStartGraceMs: ${input.sessionStartGraceMs ?? 60000}`,
    ].join("\n"),
    agent: "aks-explorer",
    done: (message: string) => ({ status: "done", message }),
    escalate: (message: string) => ({ status: "escalated", message }),
    emit() {},
    dispatchEvent(type: string, payload: Record<string, unknown>) {
      input.dispatched?.push({ type, payload });
    },
    runAgent: async () => ({ status: "error", lastAssistantText: "" }),
    summarize: (result: { lastAssistantText?: string }) =>
      result.lastAssistantText ?? "",
  } as any;
}

describe("project execution watchdog", () => {
  test("skips when the task tree does not exist", async () => {
    const projectDir = await makeProject();
    const result = await execute(context({ projectDir }));

    expect(result).toEqual({
      status: "done",
      message: "Watchdog skipped: task tree does not exist yet.",
    });
  });

  test("wakes owner when backlog leaves exist", async () => {
    const projectDir = await makeProject();
    await writeTree(projectDir, {
      "backlog-task": task("backlog-task", "backlog"),
    });

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(context({ projectDir, dispatched }));

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "Watchdog emitted project.owner.requested: watchdog-runnable-backlog.",
    );
    expect(dispatched).toEqual([
      {
        type: "project.owner.requested",
        payload: {
          project: "aks-rp-e2e",
          reason: "watchdog-runnable-backlog",
          maxConcurrent: 3,
          requested_by: "project-execution-watchdog",
          runnableBacklogTaskIds: ["backlog-task"],
          runnableBacklogTreeUpdatedAt: expect.any(String),
          runnableBacklogSnapshotAt: expect.any(String),
        },
      },
    ]);

    const updated = JSON.parse(
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
    );
    expect(updated.tasks["backlog-task"].state).toBe("backlog");
  });

  test("wakes owner for an active leaf whose runtime session is no longer running", async () => {
    const projectDir = await makeProject();
    const stateDbPath = join(projectDir, "may.db");
    writeSession(stateDbPath, "s_done", "done");
    await writeTree(
      projectDir,
      {
        "active-task": task("active-task", "active", {
          session_id: "s_done",
        }),
      },
      {
        active_task_id: "active-task",
        active_task_ids: ["active-task"],
      },
    );

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(
      context({ projectDir, stateDbPath, dispatched }),
    );

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "Watchdog emitted project.owner.requested: watchdog-stale-active-review.",
    );
    expect(dispatched).toEqual([
      {
        type: "project.owner.requested",
        payload: {
          project: "aks-rp-e2e",
          reason: "watchdog-stale-active-review",
          maxConcurrent: 3,
          requested_by: "project-execution-watchdog",
          staleActiveTasks: [
            {
              taskId: "active-task",
              reason: "session-not-running",
            },
          ],
        },
      },
    ]);

    const updated = JSON.parse(
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
    );
    expect(updated.tasks["active-task"].state).toBe("active");
    expect(updated.tasks["active-task"].trace?.stale_active_restart_count).toBe(
      undefined,
    );
  });

  test("wakes owner for an active leaf whose runtime session has error outcome", async () => {
    const projectDir = await makeProject();
    const stateDbPath = join(projectDir, "may.db");
    writeRuntimeSession(stateDbPath, {
      sessionId: "s_error",
      status: "running",
      outcome: "error",
      opCount: 4,
      startedAt: Date.now(),
    });
    await writeTree(
      projectDir,
      {
        "active-task": task("active-task", "active", {
          session_id: "s_error",
        }),
      },
      {
        active_task_id: "active-task",
        active_task_ids: ["active-task"],
      },
    );

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(
      context({ projectDir, stateDbPath, dispatched }),
    );

    expect(result.status).toBe("done");
    expect(dispatched[0]).toMatchObject({
      type: "project.owner.requested",
      payload: {
        reason: "watchdog-stale-active-review",
        staleActiveTasks: [{ taskId: "active-task", reason: "session-error" }],
      },
    });
  });

  test("wakes owner for an active leaf with no session activity past grace", async () => {
    const projectDir = await makeProject();
    const stateDbPath = join(projectDir, "may.db");
    writeRuntimeSession(stateDbPath, {
      sessionId: "s_idle",
      status: "running",
      opCount: 0,
      startedAt: Date.now() - 60_000,
      lastActivityAt: Date.now() - 60_000,
    });
    await writeTree(
      projectDir,
      {
        "active-task": task("active-task", "active", {
          session_id: "s_idle",
        }),
      },
      {
        active_task_id: "active-task",
        active_task_ids: ["active-task"],
      },
    );

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      ...context({ projectDir, stateDbPath, dispatched }),
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        `stateDb: ${stateDbPath}`,
        "maxAttempts: 2",
        "maxConcurrent: 3",
        "staleNoActivityMs: 1000",
      ].join("\n"),
    } as any);

    expect(result.status).toBe("done");
    expect(dispatched[0]).toMatchObject({
      type: "project.owner.requested",
      payload: {
        reason: "watchdog-stale-active-review",
        staleActiveTasks: [
          { taskId: "active-task", reason: "session-no-activity" },
        ],
      },
    });
  });

  test("does not mutate repeatedly stale active leaves", async () => {
    const projectDir = await makeProject();
    const stateDbPath = join(projectDir, "may.db");
    writeSession(stateDbPath, "s_done", "done");
    await writeTree(
      projectDir,
      {
        "active-task": task("active-task", "active", {
          session_id: "s_done",
          trace: {
            stale_active_restart_count: 2,
          },
        }),
      },
      {
        active_task_id: "active-task",
        active_task_ids: ["active-task"],
      },
    );

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(
      context({ projectDir, stateDbPath, dispatched }),
    );

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "Watchdog emitted project.owner.requested: watchdog-stale-active-review.",
    );
    expect(dispatched).toEqual([
      {
        type: "project.owner.requested",
        payload: {
          project: "aks-rp-e2e",
          reason: "watchdog-stale-active-review",
          maxConcurrent: 3,
          requested_by: "project-execution-watchdog",
          staleActiveTasks: [
            {
              taskId: "active-task",
              reason: "session-not-running",
            },
          ],
        },
      },
    ]);

    const updated = JSON.parse(
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
    );
    expect(updated.tasks["active-task"].state).toBe("active");
    expect(updated.tasks["active-task"].blocker).toBeUndefined();
  });

  test("does not call a newly assigned active leaf stale before the worker session starts", async () => {
    const projectDir = await makeProject();
    const assignedAt = new Date().toISOString();
    await writeTree(
      projectDir,
      {
        "active-task": task("active-task", "active", {
          session_id: "s_missing",
          trace: {
            assigned_at: assignedAt,
          },
        }),
      },
      {
        active_task_id: "active-task",
        active_task_ids: ["active-task"],
      },
    );

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(
      context({
        projectDir,
        sessionStartGraceMs: 60_000,
        dispatched,
      }),
    );

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "Watchdog emitted project.owner.requested: watchdog-capacity-underfilled.",
    );
    expect(dispatched).toEqual([
      {
        type: "project.owner.requested",
        payload: {
          project: "aks-rp-e2e",
          reason: "watchdog-capacity-underfilled",
          maxConcurrent: 3,
          requested_by: "project-execution-watchdog",
        },
      },
    ]);
  });

  test("wakes owner when open work has no runnable backlog leaves", async () => {
    const projectDir = await makeProject();
    await writeTree(projectDir, {
      "blocked-task": task("blocked-task", "blocked", {
        blocker: "Needs investigation.",
      }),
    });

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(context({ projectDir, dispatched }));

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "Watchdog emitted project.owner.requested: watchdog-open-work-reconcile.",
    );
    expect(dispatched).toEqual([
      {
        type: "project.owner.requested",
        payload: {
          project: "aks-rp-e2e",
          reason: "watchdog-open-work-reconcile",
          maxConcurrent: 3,
          requested_by: "project-execution-watchdog",
        },
      },
    ]);
  });

  test("leaves running active leaves alone when capacity is full", async () => {
    const projectDir = await makeProject();
    const stateDbPath = join(projectDir, "may.db");
    writeSession(stateDbPath, "s_running", "running");
    await writeTree(
      projectDir,
      {
        "active-task": task("active-task", "active", {
          session_id: "s_running",
        }),
      },
      {
        active_task_id: "active-task",
        active_task_ids: ["active-task"],
      },
    );

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(
      context({ projectDir, stateDbPath, maxConcurrent: 1, dispatched }),
    );

    expect(result).toEqual({
      status: "done",
      message:
        "Watchdog skipped: 1 active task(s) still have running attempts.",
    });
    expect(dispatched).toHaveLength(0);
  });

  test("wakes owner when active work underfills capacity", async () => {
    const projectDir = await makeProject();
    const stateDbPath = join(projectDir, "may.db");
    writeSession(stateDbPath, "s_running", "running");
    await writeTree(
      projectDir,
      {
        "active-task": task("active-task", "active", {
          session_id: "s_running",
        }),
      },
      {
        active_task_id: "active-task",
        active_task_ids: ["active-task"],
      },
    );

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(
      context({ projectDir, stateDbPath, maxConcurrent: 3, dispatched }),
    );

    expect(result).toEqual({
      status: "done",
      message:
        "Watchdog emitted project.owner.requested: watchdog-capacity-underfilled.",
    });
    expect(dispatched).toEqual([
      {
        type: "project.owner.requested",
        payload: {
          project: "aks-rp-e2e",
          reason: "watchdog-capacity-underfilled",
          maxConcurrent: 3,
          requested_by: "project-execution-watchdog",
        },
      },
    ]);
  });
});
