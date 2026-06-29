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

async function writeSpecLoopState(
  projectDir: string,
  input: {
    specId: string;
    taskId: string;
    status?: string;
    activeAttemptId?: string | null;
    activeTaskSessionId?: string | null;
    activeWorkflowRunId?: string | null;
    heartbeatAt?: string | null;
  },
) {
  await mkdir(join(projectDir, ".state", "spec-loop"), { recursive: true });
  await writeFile(
    join(projectDir, ".state", "spec-loop", "state.json"),
    `${JSON.stringify(
      {
        loopTaskId: "aks-spec-verification-loop",
        windowSize: 5,
        cursor: 0,
        prioritySpecIds: [],
        specs: {
          [input.specId]: {
            status: input.status ?? "running",
            taskId: input.taskId,
            attempts: 1,
            lastRunId: null,
            lastRunUrl: null,
            lastResultPath: null,
            lastPrUrl: null,
            activeAttemptId: input.activeAttemptId ?? "a_test",
            activeTaskSessionId: input.activeTaskSessionId ?? null,
            activeWorkflowRunId: input.activeWorkflowRunId ?? null,
            heartbeatAt: input.heartbeatAt ?? null,
            updatedAt: new Date().toISOString(),
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
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
          target: { project: "aks-rp-e2e" },
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

  test("does not treat dependency-waiting backlog leaves as runnable", async () => {
    const projectDir = await makeProject();
    await writeTree(projectDir, {
      "external-wait": task("external-wait", "blocked", {
        blocker: "External owner response required.",
      }),
      "waiting-task": task("waiting-task", "backlog", {
        depends_on: ["external-wait"],
      }),
    });

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(context({ projectDir, dispatched }));

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "Watchdog emitted project.owner.requested: watchdog-blocked-frontier-review.",
    );
    expect(dispatched).toEqual([
      {
        type: "project.owner.requested",
        payload: {
          project: "aks-rp-e2e",
          target: { project: "aks-rp-e2e" },
          reason: "watchdog-blocked-frontier-review",
          maxConcurrent: 3,
          requested_by: "project-execution-watchdog",
          blockedTasks: [
            {
              taskId: "external-wait",
              blocker: "External owner response required.",
            },
          ],
          blockedCount: 1,
          waitingBacklogTasks: [
            {
              taskId: "waiting-task",
              reasons: ["depends_on 'external-wait' is blocked, not done"],
            },
          ],
          waitingBacklogCount: 1,
          instruction: expect.stringContaining(
            "Review blocked and dependency-waiting tasks",
          ),
        },
      },
    ]);
  });

  test("wakes owner for dependency-waiting backlog even without blocked leaves", async () => {
    const projectDir = await makeProject();
    await writeTree(projectDir, {
      "missing-dependency-task": task("missing-dependency-task", "backlog", {
        depends_on: ["missing-source-task"],
      }),
    });

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(context({ projectDir, dispatched }));

    expect(result).toEqual({
      status: "done",
      message:
        "Watchdog emitted project.owner.requested: watchdog-blocked-frontier-review.",
    });
    expect(dispatched).toEqual([
      {
        type: "project.owner.requested",
        payload: {
          project: "aks-rp-e2e",
          target: { project: "aks-rp-e2e" },
          reason: "watchdog-blocked-frontier-review",
          maxConcurrent: 3,
          requested_by: "project-execution-watchdog",
          blockedTasks: [],
          blockedCount: 0,
          waitingBacklogTasks: [
            {
              taskId: "missing-dependency-task",
              reasons: ["depends_on 'missing-source-task' is missing"],
            },
          ],
          waitingBacklogCount: 1,
          instruction: expect.stringContaining(
            "Review blocked and dependency-waiting tasks",
          ),
        },
      },
    ]);
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
          target: { project: "aks-rp-e2e" },
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

  test("wakes owner for a running active leaf whose session stopped making progress", async () => {
    const projectDir = await makeProject();
    const stateDbPath = join(projectDir, "may.db");
    writeRuntimeSession(stateDbPath, {
      sessionId: "s_stalled_after_ops",
      status: "running",
      opCount: 40,
      startedAt: Date.now() - 60_000,
      lastActivityAt: Date.now() - 60_000,
    });
    await writeTree(
      projectDir,
      {
        "active-task": task("active-task", "active", {
          session_id: "s_stalled_after_ops",
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
          target: { project: "aks-rp-e2e" },
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
          target: { project: "aks-rp-e2e" },
          reason: "watchdog-capacity-underfilled",
          maxConcurrent: 3,
          requested_by: "project-execution-watchdog",
        },
      },
    ]);
  });

  test("treats single-spec verifier with live spec-loop heartbeat as active even without runtime session row", async () => {
    const projectDir = await makeProject();
    await writeTree(
      projectDir,
      {
        "verify-spec-example": task("verify-spec-example", "active", {
          workflow: "single-spec-verifier",
          session_id: "s_task_verify-spec-example_retry_1",
          trace: {
            current_attempt_id: "a_test",
            worker_started_at: new Date().toISOString(),
          },
        }),
      },
      {
        active_task_id: "verify-spec-example",
        active_task_ids: ["verify-spec-example"],
      },
    );
    await writeSpecLoopState(projectDir, {
      specId: "spec.example",
      taskId: "verify-spec-example",
      activeAttemptId: "a_test",
      activeTaskSessionId: "s_task_verify-spec-example_retry_1",
      activeWorkflowRunId: "123456",
      heartbeatAt: new Date().toISOString(),
    });

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(context({ projectDir, dispatched }));

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "Watchdog emitted project.owner.requested: watchdog-capacity-underfilled.",
    );
    expect(dispatched[0]).toMatchObject({
      type: "project.owner.requested",
      payload: { reason: "watchdog-capacity-underfilled" },
    });
  });

  test("does not trust single-spec verifier heartbeat from an obsolete attempt", async () => {
    const projectDir = await makeProject();
    await writeTree(
      projectDir,
      {
        "verify-spec-example": task("verify-spec-example", "active", {
          workflow: "single-spec-verifier",
          session_id: "s_task_verify-spec-example_retry_2",
          trace: {
            current_attempt_id: "a_live",
            worker_started_at: new Date(Date.now() - 60_000).toISOString(),
          },
        }),
      },
      {
        active_task_id: "verify-spec-example",
        active_task_ids: ["verify-spec-example"],
      },
    );
    await writeSpecLoopState(projectDir, {
      specId: "spec.example",
      taskId: "verify-spec-example",
      activeAttemptId: "a_old",
      activeTaskSessionId: "s_task_verify-spec-example_retry_2",
      activeWorkflowRunId: "123456",
      heartbeatAt: new Date().toISOString(),
    });

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      ...context({ projectDir, dispatched }),
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        `stateDb: ${join(projectDir, "missing.db")}`,
        "maxAttempts: 2",
        "maxConcurrent: 3",
        "sessionStartGraceMs: 1000",
      ].join("\n"),
    } as any);

    expect(result.status).toBe("done");
    expect(dispatched[0]).toMatchObject({
      type: "project.owner.requested",
      payload: {
        reason: "watchdog-stale-active-review",
        staleActiveTasks: [
          { taskId: "verify-spec-example", reason: "session-not-running" },
        ],
      },
    });
  });

  test("flags single-spec verifier when spec-loop heartbeat is stale", async () => {
    const projectDir = await makeProject();
    await writeTree(
      projectDir,
      {
        "verify-spec-example": task("verify-spec-example", "active", {
          workflow: "single-spec-verifier",
          session_id: "s_task_verify-spec-example_retry_1",
          trace: {
            current_attempt_id: "a_test",
            worker_started_at: new Date(Date.now() - 60_000).toISOString(),
          },
        }),
      },
      {
        active_task_id: "verify-spec-example",
        active_task_ids: ["verify-spec-example"],
      },
    );
    await writeSpecLoopState(projectDir, {
      specId: "spec.example",
      taskId: "verify-spec-example",
      activeAttemptId: "a_test",
      activeTaskSessionId: "s_task_verify-spec-example_retry_1",
      activeWorkflowRunId: "123456",
      heartbeatAt: new Date(Date.now() - 60_000).toISOString(),
    });

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      ...context({ projectDir, dispatched }),
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        `stateDb: ${join(projectDir, "missing.db")}`,
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
          { taskId: "verify-spec-example", reason: "verifier-no-heartbeat" },
        ],
      },
    });
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
      "Watchdog emitted project.owner.requested: watchdog-blocked-frontier-review.",
    );
    expect(dispatched).toEqual([
      {
        type: "project.owner.requested",
        payload: {
          project: "aks-rp-e2e",
          target: { project: "aks-rp-e2e" },
          reason: "watchdog-blocked-frontier-review",
          maxConcurrent: 3,
          requested_by: "project-execution-watchdog",
          blockedTasks: [
            {
              taskId: "blocked-task",
              blocker: "Needs investigation.",
            },
          ],
          blockedCount: 1,
          instruction: expect.stringContaining(
            "Review blocked and dependency-waiting tasks",
          ),
        },
      },
    ]);
  });

  test("wakes owner for review work even when active capacity is full", async () => {
    const projectDir = await makeProject();
    const stateDbPath = join(projectDir, "may.db");
    writeSession(stateDbPath, "s_running", "running");
    await writeTree(
      projectDir,
      {
        "active-task": task("active-task", "active", {
          session_id: "s_running",
        }),
        "review-task": task("review-task", "review", {
          trace: {
            last_worker_result: "done",
            last_worker_completed_at: "2026-06-20T00:00:00.000Z",
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
      context({ projectDir, stateDbPath, maxConcurrent: 1, dispatched }),
    );

    expect(result).toEqual({
      status: "done",
      message:
        "Watchdog emitted project.owner.requested: watchdog-review-pending.",
    });
    expect(dispatched).toEqual([
      {
        type: "project.owner.requested",
        payload: {
          project: "aks-rp-e2e",
          target: { project: "aks-rp-e2e" },
          reason: "watchdog-review-pending",
          maxConcurrent: 1,
          requested_by: "project-execution-watchdog",
          reviewTasks: [
            {
              taskId: "review-task",
              updatedAt: "2026-06-20T00:00:00.000Z",
            },
          ],
          reviewCount: 1,
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

  test("wakes blocked frontier review before generic capacity underfill", async () => {
    const projectDir = await makeProject();
    const stateDbPath = join(projectDir, "may.db");
    writeSession(stateDbPath, "s_running", "running");
    await writeTree(
      projectDir,
      {
        "active-task": task("active-task", "active", {
          session_id: "s_running",
        }),
        "blocked-task": task("blocked-task", "blocked", {
          blocker: "External answer required before retry.",
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
        "Watchdog emitted project.owner.requested: watchdog-blocked-frontier-review.",
    });
    expect(dispatched[0]).toMatchObject({
      type: "project.owner.requested",
      payload: {
        reason: "watchdog-blocked-frontier-review",
        blockedCount: 1,
        blockedTasks: [
          {
            taskId: "blocked-task",
            blocker: "External answer required before retry.",
          },
        ],
      },
    });
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
          target: { project: "aks-rp-e2e" },
          reason: "watchdog-capacity-underfilled",
          maxConcurrent: 3,
          requested_by: "project-execution-watchdog",
        },
      },
    ]);
  });
});
