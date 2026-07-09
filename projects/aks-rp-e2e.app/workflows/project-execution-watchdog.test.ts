import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute } from "./project-execution-watchdog.ts";
import { setPipelineBackendForTests } from "./lib/ado-pipelines.ts";

async function makeProject() {
  const dir = await mkdtemp(join(tmpdir(), "aks-watchdog-"));
  await mkdir(join(dir, ".state", "tasks"), { recursive: true });
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
    join(projectDir, ".state", "tasks", "tree.json"),
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

async function writeFeatureCompactLoopState(
  projectDir: string,
  input: {
    featureKey: string;
    taskId: string;
    status?: string;
    activeAttemptId?: string | null;
    activeTaskSessionId?: string | null;
    activeWorkflowRunId?: string | null;
    heartbeatAt?: string | null;
  },
) {
  await mkdir(join(projectDir, ".state", "feature-compact-loop"), {
    recursive: true,
  });
  await writeFile(
    join(projectDir, ".state", "feature-compact-loop", "state.json"),
    `${JSON.stringify(
      {
        loopTaskId: "aks-feature-compact-loop",
        windowSize: 1,
        cursor: 0,
        features: {
          [input.featureKey]: {
            featureKey: input.featureKey,
            capabilityId: input.featureKey,
            packetPath: `features/${input.featureKey}.yaml`,
            specsDir: `features/${input.featureKey}/specs`,
            specCount: 1,
            status: input.status ?? "running",
            retryable: true,
            retryReason: null,
            taskId: input.taskId,
            attempts: 1,
            lastPlanPath: null,
            lastSummaryPath: null,
            lastDiagnosticsPath: null,
            lastResultPath: null,
            lastWorkflowRunId: null,
            lastWorkflowRunUrl: null,
            lastWorkflowLoopKey: null,
            lastDispatchMetadataPath: null,
            lastLiveProofVersion: null,
            activeAttemptId: input.activeAttemptId ?? "a_test",
            activeTaskSessionId: input.activeTaskSessionId ?? null,
            activeWorkflowRunId: input.activeWorkflowRunId ?? null,
            heartbeatAt: input.heartbeatAt ?? null,
            lastSummary: null,
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

  test("syncs project.json live readout before routine watchdog decisions", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "project.json"),
      `${JSON.stringify(
        {
          id: "test-project",
          owner: "aks-explorer",
          status: "active",
          currentState: {
            summary: "stale summary",
            activeTaskId: "old-active",
            metrics: {
              activeLeafCount: 9,
              blockedLeafCount: 0,
              reviewLeafCount: 7,
              waitingLeafCount: 6,
              runnableLeafCount: 5,
            },
          },
          currentFocus: {
            summary: "stale focus",
            activeTaskIds: ["old-active"],
            proposedTaskIds: ["old-active", "done-focus"],
            focusPlanId: "done-focus",
            focusPlanStatus: "done",
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeTree(projectDir, {
      "blocked-task": task("blocked-task", "blocked", {
        blocker: {
          condition: "Needs external answer.",
          resume_at: "2099-06-26T00:00:00.000Z",
        },
      }),
      "done-focus": task("done-focus", "done", {
        kind: "focus_plan",
      }),
    });

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(context({ projectDir, dispatched }));

    expect(result.status).toBe("done");
    const projectJson = JSON.parse(
      await readFile(join(projectDir, ".state", "project-state.json"), "utf8"),
    );
    expect(projectJson.currentState.activeTaskId).toBeNull();
    expect(projectJson.currentState.metrics.activeLeafCount).toBe(0);
    expect(projectJson.currentState.metrics.blockedLeafCount).toBe(1);
    expect(projectJson.currentFocus.activeTaskIds).toEqual(["blocked-task"]);
    expect(projectJson.currentFocus.proposedTaskIds).toEqual(["blocked-task"]);
    expect(projectJson.currentFocus.focusPlanId).toBeUndefined();
    expect(projectJson.currentFocus.focusPlanStatus).toBeUndefined();
    expect(String(projectJson.currentState.summary)).toContain(
      "blocked-only exact wait stewardship",
    );
  });

  test("current focus nextAction names only active leaves even when review leaves also exist", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "project.json"),
      `${JSON.stringify(
        {
          id: "test-project",
          owner: "aks-explorer",
          status: "active",
          currentState: {
            summary: "stale summary",
            activeTaskId: "old-active",
            metrics: {
              activeLeafCount: 9,
              blockedLeafCount: 0,
              reviewLeafCount: 7,
              waitingLeafCount: 6,
              runnableLeafCount: 5,
            },
          },
          currentFocus: {
            summary: "stale focus",
            nextAction: "stale next action",
            activeTaskIds: ["old-active"],
            proposedTaskIds: ["old-active", "done-focus"],
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeTree(projectDir, {
      "active-task": task("active-task", "active"),
      "review-task": task("review-task", "review"),
    });

    const result = await execute(context({ projectDir }));

    expect(result.status).toBe("done");
    const projectJson = JSON.parse(
      await readFile(join(projectDir, ".state", "project-state.json"), "utf8"),
    );
    expect(projectJson.currentFocus.activeTaskIds).toEqual([
      "active-task",
      "review-task",
    ]);
    expect(String(projectJson.currentFocus.nextAction)).toContain(
      "Finish the current active live-frontier leaf/leaves first: active-task.",
    );
    expect(String(projectJson.currentFocus.nextAction)).not.toContain(
      "review-task",
    );
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
      "Watchdog emitted project.planning.requested: watchdog-runnable-backlog.",
    );
    expect(dispatched).toEqual([
      {
        type: "project.planning.requested",
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
      await readFile(join(projectDir, ".state", "tasks", "tree.json"), "utf8"),
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
      "Watchdog emitted project.planning.requested: watchdog-blocked-frontier-review.",
    );
    expect(dispatched).toMatchObject([
      {
        type: "project.planning.requested",
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

  test("requests stall review when durable loop state has unfinished work but no normal frontier", async () => {
    const projectDir = await makeProject();
    await writeTree(projectDir, {
      "aks-spec-verification-loop": task("aks-spec-verification-loop", "done", {
        workflow: "spec-loop-controller",
        context: {
          workflowProgress: {
            completionReady: false,
            reason: "spec-loop still has non-pass results",
          },
        },
      }),
    });
    await writeSpecLoopState(projectDir, {
      specId: "spec.virtualmachines.example",
      taskId: "verify-spec-virtualmachines-example",
      status: "error",
    });

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(context({ projectDir, dispatched }));

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "Watchdog emitted project.stall.review.requested: watchdog-durable-loop-stall.",
    );
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.stall.review.requested",
      payload: {
        project: "aks-rp-e2e",
        target: { project: "aks-rp-e2e" },
        reason: "watchdog-durable-loop-stall",
        mode: "fallback",
        requested_by: "project-execution-watchdog",
        durableLoopLiveness: [
          expect.objectContaining({
            taskId: "aks-spec-verification-loop",
            action: "spec-loop",
            nonTerminalCount: 1,
            needsAttention: true,
          }),
        ],
      },
    });
  });

  test("requests stall review when spec-loop residue is not represented by exact waits", async () => {
    const projectDir = await makeProject();
    await writeTree(projectDir, {
      "aks-spec-verification-loop": task(
        "aks-spec-verification-loop",
        "blocked",
        {
          workflow: "spec-loop-controller",
          blocker: "exact wait stewardship",
          context: {
            workflowProgress: {
              completionReady: false,
              noRefillNow: true,
              reason:
                "spec-loop execution residue is drained and the remaining frontier is exact wait stewardship",
              pending: 123,
              error: 203,
              openChildren: 0,
              activeChildren: 0,
              reviewChildren: 0,
              waitingChildren: 0,
              backlogChildren: 0,
              openSpecVerifierChildren: 0,
              openFollowups: 0,
              blockedWaitChildren: 5,
            },
          },
        },
      ),
    });
    await writeSpecLoopState(projectDir, {
      specId: "spec.virtualmachines.example",
      taskId: "verify-spec-virtualmachines-example",
      status: "error",
    });

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(context({ projectDir, dispatched }));

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "Watchdog emitted project.stall.review.requested: watchdog-durable-loop-stall.",
    );
    expect(dispatched).toEqual([
      {
        type: "project.stall.review.requested",
        payload: expect.objectContaining({
          reason: "watchdog-durable-loop-stall",
          mode: "fallback",
        }),
      },
    ]);
  });

  test("requests stall review when feature-compact residue is not represented by exact waits", async () => {
    const projectDir = await makeProject();
    await writeTree(projectDir, {
      "aks-feature-compact-loop": task("aks-feature-compact-loop", "blocked", {
        workflow: "feature-compact-loop-controller",
        blocker: {
          condition:
            "feature-compact loop live dispatch held because 1 workflow is already in progress",
        },
        context: {
          workflowProgress: {
            completionReady: false,
            dispatchHeld: true,
            reason:
              "feature-compact loop live dispatch held because 1 GitHub workflow run(s) are already in progress on dev; limit=1",
            pending: 5,
            running: 0,
            done: 10,
            error: 69,
            openChildren: 0,
            openSupportChildren: 0,
            blockedWaitChildren: 11,
          },
        },
      }),
    });
    await mkdir(join(projectDir, ".state", "feature-compact-loop"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, ".state", "feature-compact-loop", "state.json"),
      `${JSON.stringify(
        {
          loopTaskId: "aks-feature-compact-loop",
          windowSize: 1,
          cursor: 0,
          features: {
            "bootstrap-profile": {
              featureKey: "bootstrap-profile",
              status: "error",
              taskId: "compact-feature-bootstrap-profile",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(context({ projectDir, dispatched }));

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "Watchdog emitted project.stall.review.requested: watchdog-durable-loop-stall.",
    );
    expect(dispatched).toEqual([
      {
        type: "project.stall.review.requested",
        payload: expect.objectContaining({
          reason: "watchdog-durable-loop-stall",
          mode: "fallback",
        }),
      },
    ]);
  });

  test("pulses an incomplete backlogged durable loop before owner review", async () => {
    const projectDir = await makeProject();
    await writeTree(projectDir, {
      "aks-feature-compact-loop": task("aks-feature-compact-loop", "backlog", {
        workflow: "feature-compact-loop-controller",
        context: {
          workflowProgress: {
            completionReady: false,
            reason: "feature compact loop has stale nonterminal work",
            unrepresentedNonTerminalCount: 1,
          },
        },
      }),
    });
    await mkdir(join(projectDir, ".state", "feature-compact-loop"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, ".state", "feature-compact-loop", "state.json"),
      `${JSON.stringify(
        {
          loopTaskId: "aks-feature-compact-loop",
          windowSize: 1,
          cursor: 0,
          features: {
            windows: {
              featureKey: "windows",
              capabilityId: "windows",
              status: "error",
              attempts: 1,
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(context({ projectDir, dispatched }));

    expect(result.status).toBe("done");
    expect(dispatched[0]).toEqual({
      type: "project.task.tick",
      payload: expect.objectContaining({
        action: "feature-compact-loop",
        taskId: "aks-feature-compact-loop",
        reason: "watchdog-durable-loop-needs-attention",
        target: { project: "aks-rp-e2e", taskId: "aks-feature-compact-loop" },
      }),
    });
    expect(dispatched[1]).toEqual({
      type: "project.planning.requested",
      payload: expect.objectContaining({
        reason: "watchdog-runnable-backlog",
        runnableBacklogTaskIds: ["aks-feature-compact-loop"],
        loopTickCount: 1,
      }),
    });
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
        "Watchdog emitted project.planning.requested: watchdog-blocked-frontier-review.",
    });
    expect(dispatched).toMatchObject([
      {
        type: "project.planning.requested",
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
      "Watchdog emitted project.planning.requested: watchdog-stale-active-review.",
    );
    expect(dispatched).toEqual([
      {
        type: "project.planning.requested",
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
      await readFile(join(projectDir, ".state", "tasks", "tree.json"), "utf8"),
    );
    expect(updated.tasks["active-task"].state).toBe("active");
    expect(updated.tasks["active-task"].trace?.stale_active_restart_count).toBe(
      undefined,
    );
  });

  test("recovers an active task when the worker session finished but workflow bookkeeping was interrupted", async () => {
    const projectDir = await makeProject();
    const stateDbPath = join(projectDir, "may.db");
    writeRuntimeSession(stateDbPath, {
      sessionId: "s_done",
      status: "done",
      outcome: "done",
      opCount: 12,
      startedAt: Date.now() - 120_000,
      lastActivityAt: Date.now() - 60_000,
    });
    await writeTree(
      projectDir,
      {
        "active-task": task("active-task", "active", {
          session_id: "s_done",
          trace: {
            current_attempt_id: "attempt-1",
            worker_started_attempt_id: "attempt-1",
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
      "Watchdog recovered completed active task(s): active-task.",
    );
    expect(dispatched.map((event) => event.type)).toEqual([
      "project.task.completed",
    ]);
    expect(dispatched[0].payload).toMatchObject({
      taskId: "active-task",
      attemptId: "attempt-1",
      result: "done",
      review: {
        required: true,
        reason: "watchdog-recovered-terminal-worker-session",
      },
    });

    const updated = JSON.parse(
      await readFile(join(projectDir, ".state", "tasks", "tree.json"), "utf8"),
    );
    expect(updated.tasks["active-task"].state).toBe("review");
    expect(updated.tasks["active-task"].trace.last_worker_result).toBe("done");
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
      type: "project.planning.requested",
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
      type: "project.planning.requested",
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
      type: "project.planning.requested",
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
      "Watchdog emitted project.planning.requested: watchdog-stale-active-review.",
    );
    expect(dispatched).toEqual([
      {
        type: "project.planning.requested",
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
      await readFile(join(projectDir, ".state", "tasks", "tree.json"), "utf8"),
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
      "Watchdog emitted project.planning.requested: watchdog-capacity-underfilled.",
    );
    expect(dispatched).toEqual([
      {
        type: "project.planning.requested",
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
      "Watchdog emitted project.planning.requested: watchdog-capacity-underfilled.",
    );
    expect(dispatched[0]).toMatchObject({
      type: "project.planning.requested",
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
      type: "project.planning.requested",
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
      type: "project.planning.requested",
      payload: {
        reason: "watchdog-stale-active-review",
        staleActiveTasks: [
          { taskId: "verify-spec-example", reason: "verifier-no-heartbeat" },
        ],
      },
    });
  });

  test("treats single-spec verifier with fresh heartbeat as active after task-session handoff", async () => {
    const projectDir = await makeProject();
    await writeTree(
      projectDir,
      {
        "verify-spec-example": task("verify-spec-example", "active", {
          workflow: "single-spec-verifier",
          session_id: "s_task_verify-spec-example_retry_2",
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
      activeTaskSessionId: null,
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
        "staleNoActivityMs: 1000",
      ].join("\n"),
    } as any);

    expect(result.status).toBe("done");
    expect(dispatched[0]).toMatchObject({
      type: "project.planning.requested",
      payload: { reason: "watchdog-capacity-underfilled" },
    });
  });

  test("treats feature-compact planner with fresh compact-loop heartbeat as active even without runtime session row", async () => {
    const projectDir = await makeProject();
    await writeTree(
      projectDir,
      {
        "compact-feature-example": task("compact-feature-example", "active", {
          workflow: "feature-compact-planner",
          session_id: "s_task_compact-feature-example_retry_1",
          trace: {
            current_attempt_id: "a_test",
            worker_started_at: new Date().toISOString(),
          },
        }),
      },
      {
        active_task_id: "compact-feature-example",
        active_task_ids: ["compact-feature-example"],
      },
    );
    await writeFeatureCompactLoopState(projectDir, {
      featureKey: "example",
      taskId: "compact-feature-example",
      activeAttemptId: "a_test",
      activeTaskSessionId: "s_task_compact-feature-example_retry_1",
      activeWorkflowRunId: "654321",
      heartbeatAt: new Date().toISOString(),
    });

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(context({ projectDir, dispatched }));

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "Watchdog emitted project.planning.requested: watchdog-capacity-underfilled.",
    );
    expect(dispatched[0]).toMatchObject({
      type: "project.planning.requested",
      payload: { reason: "watchdog-capacity-underfilled" },
    });
  });

  test("flags feature-compact planner when compact-loop heartbeat is stale", async () => {
    const projectDir = await makeProject();
    await writeTree(
      projectDir,
      {
        "compact-feature-example": task("compact-feature-example", "active", {
          workflow: "feature-compact-planner",
          session_id: "s_task_compact-feature-example_retry_1",
          trace: {
            current_attempt_id: "a_test",
            worker_started_at: new Date(Date.now() - 60_000).toISOString(),
          },
        }),
      },
      {
        active_task_id: "compact-feature-example",
        active_task_ids: ["compact-feature-example"],
      },
    );
    await writeFeatureCompactLoopState(projectDir, {
      featureKey: "example",
      taskId: "compact-feature-example",
      activeAttemptId: "a_test",
      activeTaskSessionId: "s_task_compact-feature-example_retry_1",
      activeWorkflowRunId: "654321",
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
      type: "project.planning.requested",
      payload: {
        reason: "watchdog-stale-active-review",
        staleActiveTasks: [
          { taskId: "compact-feature-example", reason: "compact-no-heartbeat" },
        ],
      },
    });
  });

  test("ignores active focus-plan leaves when checking stale active work", async () => {
    const projectDir = await makeProject();
    await writeTree(
      projectDir,
      {
        "focus-branch": task("focus-branch", "active", {
          kind: "focus_plan",
        }),
      },
      {
        active_task_id: "focus-branch",
        active_task_ids: ["focus-branch"],
      },
    );

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(context({ projectDir, dispatched }));

    expect(result.status).toBe("done");
    expect(dispatched[0]).toMatchObject({
      type: "project.planning.requested",
      payload: { reason: "watchdog-open-work-reconcile" },
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
      "Watchdog emitted project.planning.requested: watchdog-blocked-frontier-review.",
    );
    expect(dispatched).toMatchObject([
      {
        type: "project.planning.requested",
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

  test("copies structured blocker resume metadata into blocked frontier packets", async () => {
    const projectDir = await makeProject();
    await writeTree(projectDir, {
      "blocked-task": task("blocked-task", "blocked", {
        blocker: {
          condition: "Waiting for returned operator proof.",
          category: "external-wait",
          owner: "human",
          resume_condition:
            "Resume when proof lands or the follow-up window opens.",
          resume_at: "2099-06-26T00:00:00.000Z",
          fallback_at: "2099-06-27T00:00:00.000Z",
          fallback_action: "Recheck the operator ask.",
        },
      }),
    });

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(context({ projectDir, dispatched }));

    expect(result.status).toBe("done");
    expect(dispatched[0]).toMatchObject({
      type: "project.planning.requested",
      payload: {
        reason: "watchdog-blocked-frontier-review",
        blockedTasks: [
          {
            taskId: "blocked-task",
            resumeAt: "2099-06-26T00:00:00.000Z",
            resumeCondition:
              "Resume when proof lands or the follow-up window opens.",
            fallbackAt: "2099-06-27T00:00:00.000Z",
            fallbackAction: "Recheck the operator ask.",
          },
        ],
      },
    });
  });

  test("samples overdue blocked waits before future waits", async () => {
    const projectDir = await makeProject();
    await writeTree(projectDir, {
      "aaa-future-wait": task("aaa-future-wait", "blocked", {
        blocker: {
          condition: "Waiting for a future operator response.",
          waiting_for: { type: "evidence.available" },
          resume_condition: "Resume when the future proof lands.",
          fallback_at: "2099-06-27T00:00:00.000Z",
          fallback_action: "Recheck the future proof.",
        },
      }),
      "zzz-overdue-wait": task("zzz-overdue-wait", "blocked", {
        blocker: {
          condition: "Expired wait needs owner action.",
          waiting_for: { type: "blocker.resolved" },
          resume_condition:
            "Resume when expired wait is rechecked or replaced.",
          fallback_at: "2001-01-01T00:00:00.000Z",
          fallback_action: "Recheck the expired wait now.",
        },
      }),
    });

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(context({ projectDir, dispatched }));

    expect(result.status).toBe("done");
    expect(dispatched[0]).toMatchObject({
      type: "project.planning.requested",
      payload: {
        reason: "watchdog-blocked-frontier-review",
        blockedCount: 2,
        blockedOverdueCount: 1,
        blockedFutureWatchCount: 1,
        blockedMissingWatchCount: 0,
        blockedTasks: [
          {
            taskId: "zzz-overdue-wait",
            fallbackAt: "2001-01-01T00:00:00.000Z",
          },
          {
            taskId: "aaa-future-wait",
            fallbackAt: "2099-06-27T00:00:00.000Z",
          },
        ],
        blockedFrontierSummary: {
          totalCount: 2,
          overdueCount: 1,
          futureWatchCount: 1,
          missingWatchCount: 0,
          sampledTaskIds: ["zzz-overdue-wait", "aaa-future-wait"],
          sampledOverdueTaskIds: ["zzz-overdue-wait"],
        },
        instruction: expect.stringContaining(
          "passed its resume/fallback window",
        ),
      },
    });
  });

  test("includes overdue owner waits that have no active recovery work", async () => {
    const projectDir = await makeProject();
    await writeTree(projectDir, {
      "blocked-owner-wait": task("blocked-owner-wait", "blocked", {
        blocker: {
          condition: "Waiting for pipeline result.",
          waiting_for: { type: "pipeline.completed" },
          owner: "aks-explorer",
          resume_condition: "Resume when the pipeline result is known.",
          resume_at: "2001-01-01T00:00:00.000Z",
          fallback_at: "2001-01-02T00:00:00.000Z",
          fallback_action: "Check the pipeline and create a recovery task.",
        },
      }),
    });

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(context({ projectDir, dispatched }));

    expect(result.status).toBe("done");
    expect(dispatched[0]).toMatchObject({
      type: "project.planning.requested",
      payload: {
        reason: "watchdog-blocked-frontier-review",
        overdueOwnerActionCount: 1,
        overdueOwnerActions: [
          {
            taskId: "blocked-owner-wait",
            owner: "aks-explorer",
            watchAt: "2001-01-01T00:00:00.000Z",
            resumeAt: "2001-01-01T00:00:00.000Z",
            fallbackAt: "2001-01-02T00:00:00.000Z",
            fallbackAction: "Check the pipeline and create a recovery task.",
            recoveryRequired:
              "Resume window passed without active/review recovery work.",
          },
        ],
        instruction: expect.stringContaining(
          "passed its resume/fallback window",
        ),
      },
    });
  });

  test("includes overdue human owner waits when no handoff work is active", async () => {
    const projectDir = await makeProject();
    await writeTree(projectDir, {
      "blocked-human-wait": task("blocked-human-wait", "blocked", {
        blocker: {
          condition: "Waiting for a human decision.",
          waiting_for: { type: "owner.decision" },
          owner: "human",
          resume_condition: "Resume when the owner decision returns.",
          fallback_at: "2001-01-02T00:00:00.000Z",
          fallback_action:
            "Verify the human handoff exists or create escalation work.",
        },
      }),
    });

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(context({ projectDir, dispatched }));

    expect(result.status).toBe("done");
    expect(dispatched[0]).toMatchObject({
      type: "project.planning.requested",
      payload: {
        reason: "watchdog-blocked-frontier-review",
        overdueOwnerActionCount: 1,
        overdueOwnerActions: [
          {
            taskId: "blocked-human-wait",
            owner: "human",
            watchAt: "2001-01-02T00:00:00.000Z",
            fallbackAt: "2001-01-02T00:00:00.000Z",
            fallbackAction:
              "Verify the human handoff exists or create escalation work.",
            recoveryRequired:
              "Fallback window passed without active/review recovery work.",
          },
        ],
      },
    });
  });

  test("does not report overdue owner action when scoped recovery work is active", async () => {
    const projectDir = await makeProject();
    const stateDbPath = join(projectDir, "may.db");
    writeSession(stateDbPath, "s_scoped_overdue_audit", "running");
    await writeTree(projectDir, {
      "scoped-overdue-audit": task("scoped-overdue-audit", "active", {
        goal: "Audit overdue blocked waits under the spec loop.",
        session_id: "s_scoped_overdue_audit",
        conflict_scope: ["ops:blocked-overdue:spec-loop:20260708"],
      }),
      "aks-spec-verification-loop": task(
        "aks-spec-verification-loop",
        "active",
        {
          children: ["blocked-spec-wait"],
        },
      ),
      "blocked-spec-wait": task("blocked-spec-wait", "blocked", {
        parent_id: "aks-spec-verification-loop",
        blocker: {
          condition: "Waiting for pipeline result.",
          waiting_for: { type: "pipeline.completed" },
          owner: "aks-explorer",
          resume_condition: "Resume when the pipeline result is known.",
          resume_at: "2001-01-01T00:00:00.000Z",
          fallback_at: "2001-01-02T00:00:00.000Z",
          fallback_action: "Check the pipeline and create a recovery task.",
        },
      }),
    });

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(
      context({ projectDir, stateDbPath, dispatched }),
    );

    expect(result.status).toBe("done");
    expect(dispatched[0]).toMatchObject({
      type: "project.planning.requested",
      payload: {
        reason: "watchdog-blocked-frontier-review",
        overdueOwnerActionCount: 0,
        overdueOwnerActions: [],
      },
    });
  });

  test("does not treat a broad parent loop as overdue recovery work", async () => {
    const projectDir = await makeProject();
    const stateDbPath = join(projectDir, "may.db");
    writeSession(stateDbPath, "s_spec_loop", "running");
    await writeTree(projectDir, {
      "aks-spec-verification-loop": task(
        "aks-spec-verification-loop",
        "active",
        {
          children: ["blocked-spec-wait"],
          goal: "Spec loop rollup mentions blocked-spec-wait but is not a recovery owner.",
          session_id: "s_spec_loop",
        },
      ),
      "blocked-spec-wait": task("blocked-spec-wait", "blocked", {
        parent_id: "aks-spec-verification-loop",
        blocker: {
          condition: "Waiting for pipeline result.",
          waiting_for: { type: "pipeline.completed" },
          owner: "aks-explorer",
          resume_condition: "Resume when the pipeline result is known.",
          resume_at: "2001-01-01T00:00:00.000Z",
          fallback_at: "2001-01-02T00:00:00.000Z",
          fallback_action: "Check the pipeline and create a recovery task.",
        },
      }),
    });

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(
      context({ projectDir, stateDbPath, dispatched }),
    );

    expect(result.status).toBe("done");
    expect(dispatched[0]).toMatchObject({
      type: "project.planning.requested",
      payload: {
        reason: "watchdog-blocked-frontier-review",
        overdueOwnerActionCount: 1,
        overdueOwnerActions: [{ taskId: "blocked-spec-wait" }],
      },
    });
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
        "Watchdog emitted project.planning.requested: watchdog-review-pending.",
    });
    expect(dispatched).toEqual([
      {
        type: "project.planning.requested",
        payload: {
          project: "aks-rp-e2e",
          target: { project: "aks-rp-e2e" },
          reason: "watchdog-review-pending",
          maxConcurrent: 1,
          requested_by: "project-execution-watchdog",
          reviewTasks: [
            {
              taskId: "review-task",
              parentId: "project",
              reviewKind: "worker-completion",
              lastWorkerResult: "done",
              updatedAt: "2026-06-20T00:00:00.000Z",
            },
          ],
          reviewCount: 1,
        },
      },
    ]);
  });

  test("wakes overdue blocked recovery before ordinary review work", async () => {
    const projectDir = await makeProject();
    await writeTree(projectDir, {
      "review-task": task("review-task", "review", {
        trace: {
          last_worker_result: "done",
          last_worker_completed_at: "2026-06-20T00:00:00.000Z",
        },
      }),
      "blocked-human-wait": task("blocked-human-wait", "blocked", {
        blocker: {
          condition: "Waiting for a human decision.",
          waiting_for: { type: "owner.decision" },
          owner: "human",
          resume_condition: "Resume when the owner decision returns.",
          fallback_at: "2001-01-02T00:00:00.000Z",
          fallback_action:
            "Verify the human handoff exists or create escalation work.",
        },
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
        "Watchdog emitted project.planning.requested: watchdog-blocked-frontier-review.",
    });
    expect(dispatched[0]).toMatchObject({
      type: "project.planning.requested",
      payload: {
        reason: "watchdog-blocked-frontier-review",
        reviewCount: 1,
        overdueOwnerActionCount: 1,
        overdueOwnerActions: [
          {
            taskId: "blocked-human-wait",
            owner: "human",
          },
        ],
      },
    });
  });

  test("backfills terminal pipeline wait review context for planner action", async () => {
    const projectDir = await makeProject();
    await writeTree(projectDir, {
      "terminal-run-review": task("terminal-run-review", "review", {
        parent_id: "aks-spec-verification-loop",
        result:
          "Azure DevOps pipeline run 123456789 is terminal; inspect returned artifacts.",
        context: {
          terminalPipelineWaitReview: {
            runId: "123456789",
            runStatus: "completed",
            runConclusion: "failure",
            runUrl:
              "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123456789",
            namedSpecIds: ["spec.example"],
          },
        },
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
        "Watchdog emitted project.planning.requested: watchdog-review-pending.",
    });
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.planning.requested",
      payload: {
        reason: "watchdog-review-pending",
        reviewTasks: [
          {
            taskId: "terminal-run-review",
            parentId: "aks-spec-verification-loop",
            reviewKind: "terminal-pipeline-wait",
            resultSummary:
              "Azure DevOps pipeline run 123456789 is terminal; inspect returned artifacts.",
            terminalPipelineWaitReview: {
              runId: "123456789",
              runStatus: "completed",
              runConclusion: "failure",
              runUrl:
                "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123456789",
              namedSpecIds: ["spec.example"],
            },
          },
        ],
        reviewCount: 1,
      },
    });
  });

  test("moves blocked Azure DevOps wait to review when the run is terminal", async () => {
    const projectDir = await makeProject();
    await writeTree(projectDir, {
      "wait-dev-infra-core-ado-run-123456789-result": task(
        "wait-dev-infra-core-ado-run-123456789-result",
        "blocked",
        {
          parent_id: "focus-dev-infra-core-live-pass",
          goal: "Wait for Azure DevOps run 123456789 to prove dev-infra-core.",
          context: {
            adoRunId: "123456789",
            adoRunUrl:
              "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123456789",
          },
        },
      ),
    });
    setPipelineBackendForTests({
      resolve: () => ({ ok: true }),
      getRun: () => ({
        status: "completed",
        conclusion: "failure",
        url: "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123456789",
        displayTitle: "aks-e2e_staging_feature-set_123456789 dev-infra-core",
      }),
    });
    try {
      const result = await execute(context({ projectDir }));
      expect(result).toEqual({
        status: "done",
        message:
          "Watchdog moved terminal Azure DevOps wait(s) to review: wait-dev-infra-core-ado-run-123456789-result.",
      });
      const tree = JSON.parse(
        await readFile(
          join(projectDir, ".state", "tasks", "tree.json"),
          "utf8",
        ),
      );
      const task =
        tree.tasks["wait-dev-infra-core-ado-run-123456789-result"];
      expect(task.state).toBe("review");
      expect(task.context.terminalPipelineWaitReview).toMatchObject({
        runId: "123456789",
        runStatus: "completed",
        runConclusion: "failure",
      });
      expect(task.result).toContain(
        "Azure DevOps pipeline run 123456789 is terminal",
      );
    } finally {
      setPipelineBackendForTests(null);
    }
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
        "Watchdog emitted project.planning.requested: watchdog-blocked-frontier-review.",
    });
    expect(dispatched[0]).toMatchObject({
      type: "project.planning.requested",
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
        "Watchdog emitted project.planning.requested: watchdog-capacity-underfilled.",
    });
    expect(dispatched).toEqual([
      {
        type: "project.planning.requested",
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
