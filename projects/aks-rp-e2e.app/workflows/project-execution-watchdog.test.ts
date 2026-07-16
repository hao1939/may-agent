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
  supervisorV2?: "off" | "review-handoff-revisioned";
  supervisorAttemptV2?: "off" | "shadow";
  conditionV2?: "off" | "exact-ado-revisioned";
  conditionAdoptionV2?: "off" | "exact-task";
  conditionAdoptionV2TaskId?: string;
  conditionAdoptionV2RunId?: string;
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
      `supervisorV2: ${input.supervisorV2 ?? "review-handoff-revisioned"}`,
      ...(input.supervisorAttemptV2
        ? [`supervisorAttemptV2: ${input.supervisorAttemptV2}`]
        : []),
      ...(input.conditionV2 ? [`conditionV2: ${input.conditionV2}`] : []),
      ...(input.conditionAdoptionV2
        ? [`conditionAdoptionV2: ${input.conditionAdoptionV2}`]
        : []),
      ...(input.conditionAdoptionV2TaskId
        ? [`conditionAdoptionV2TaskId: ${input.conditionAdoptionV2TaskId}`]
        : []),
      ...(input.conditionAdoptionV2RunId
        ? [`conditionAdoptionV2RunId: ${input.conditionAdoptionV2RunId}`]
        : []),
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
      "Watchdog emitted project.owner.requested: watchdog-blocked-frontier-review.",
    );
    expect(dispatched).toMatchObject([
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
      type: "project.owner.requested",
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
        "Watchdog emitted project.owner.requested: watchdog-blocked-frontier-review.",
    });
    expect(dispatched).toMatchObject([
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
      await readFile(join(projectDir, ".state", "tasks", "tree.json"), "utf8"),
    );
    expect(updated.tasks["active-task"].state).toBe("active");
    expect(updated.tasks["active-task"].trace?.stale_active_restart_count).toBe(
      undefined,
    );
  });

  test("recovers an active task when the worker session finished but workflow bookkeeping was interrupted", async () => {
    const projectDir = await makeProject();
    for (const [directory, collection] of [
      ["spec-loop", "specs"],
      ["feature-reference-loop", "features"],
      ["feature-compact-loop", "features"],
    ] as const) {
      await mkdir(join(projectDir, ".state", directory), { recursive: true });
      await writeFile(
        join(projectDir, ".state", directory, "state.json"),
        `${JSON.stringify({ [collection]: {} })}\n`,
        "utf8",
      );
    }
    const stateDbPath = join(projectDir, "may.db");
    const db = new Database(stateDbPath);
    db.exec(`
      create table sessions (
        sessionId text primary key,
        status text not null,
        outcome text,
        opCount integer default 0,
        startedAt integer not null,
        lastActivityAt integer
      );
      create table events (
        id integer primary key autoincrement,
        event_type text not null,
        data text,
        timestamp integer not null
      );
    `);
    db.query("insert into sessions values (?, ?, ?, ?, ?, ?)").run(
      "s_done",
      "done",
      "done",
      12,
      Date.now() - 120_000,
      Date.now() - 60_000,
    );
    db.query(
      "insert into events (event_type, data, timestamp) values (?, ?, ?)",
    ).run(
      "session.end",
      JSON.stringify({
        sessionId: "s_done",
        status: "done",
        outcome: "done",
        summary: "Recovered useful worker output.",
        finishParams: {
          status: "success",
          summary: "Recovered useful worker output.",
          deliverables: [{ path: "evidence/archive/active-task.md" }],
          verification_evidence: ["Step 1: proof"],
        },
      }),
      Date.now() - 30_000,
    );
    db.close();
    await writeTree(
      projectDir,
      {
        "active-task": task("active-task", "active", {
          revision: 2,
          session_id: "s_done",
          context: { controlPlaneVersion: 2 },
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
      context({
        projectDir,
        stateDbPath,
        supervisorAttemptV2: "shadow",
        dispatched,
      }),
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
      summary: "Recovered useful worker output.",
      evidenceRefs: ["Step 1: proof", "evidence/archive/active-task.md"],
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
    const journal = await readFile(
      join(projectDir, ".state", "journal.jsonl"),
      "utf8",
    );
    expect(journal).toContain(
      '"kind":"project_supervisor_terminal_attempt_shadow_v2"',
    );
    expect(journal).toContain('"candidate_task_ids":["active-task"]');
    expect(journal).toContain(
      '"legacy_revisioned_actionable_task_ids":["active-task"]',
    );
    expect(journal).toContain('"matches":true');
  });

  test("does not recover a done session whose only recovered output is the generic placeholder", async () => {
    const projectDir = await makeProject();
    const stateDbPath = join(projectDir, "may.db");
    const db = new Database(stateDbPath);
    db.exec(`
      create table sessions (
        sessionId text primary key,
        status text not null,
        outcome text,
        opCount integer default 0,
        startedAt integer not null,
        lastActivityAt integer
      );
      create table events (
        id integer primary key autoincrement,
        event_type text not null,
        data text,
        timestamp integer not null
      );
    `);
    db.query("insert into sessions values (?, ?, ?, ?, ?, ?)").run(
      "s_done_placeholder",
      "done",
      "done",
      44,
      Date.now() - 120_000,
      Date.now() - 60_000,
    );
    db.query(
      "insert into events (event_type, data, timestamp) values (?, ?, ?)",
    ).run(
      "session.end",
      JSON.stringify({
        sessionId: "s_done_placeholder",
        status: "done",
        outcome: "done",
        summary: "Recovered completed worker session s_done_placeholder.",
      }),
      Date.now() - 30_000,
    );
    db.close();
    await writeTree(
      projectDir,
      {
        "active-task": task("active-task", "active", {
          revision: 2,
          session_id: "s_done_placeholder",
          context: { controlPlaneVersion: 2 },
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
      context({
        projectDir,
        stateDbPath,
        supervisorAttemptV2: "shadow",
        dispatched,
      }),
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
      await readFile(join(projectDir, ".state", "tasks", "tree.json"), "utf8"),
    );
    expect(updated.tasks["active-task"].state).toBe("active");
    const journal = await readFile(
      join(projectDir, ".state", "journal.jsonl"),
      "utf8",
    );
    expect(journal).toContain(
      '"outcome_class":"terminal-success-nonactionable"',
    );
  });

  test("records a revisioned terminal provider error in shadow evidence", async () => {
    const projectDir = await makeProject();
    const stateDbPath = join(projectDir, "may.db");
    writeRuntimeSession(stateDbPath, {
      sessionId: "s_terminal_error",
      status: "failed",
      outcome: "error",
      opCount: 7,
      startedAt: Date.now() - 120_000,
      lastActivityAt: Date.now() - 60_000,
    });
    await writeTree(
      projectDir,
      {
        "active-task": task("active-task", "active", {
          revision: 2,
          session_id: "s_terminal_error",
          context: { controlPlaneVersion: 2 },
          trace: {
            current_attempt_id: "attempt-error",
            worker_started_attempt_id: "attempt-error",
          },
        }),
      },
      {
        active_task_id: "active-task",
        active_task_ids: ["active-task"],
      },
    );

    const result = await execute(
      context({
        projectDir,
        stateDbPath,
        supervisorAttemptV2: "shadow",
        dispatched: [],
      }),
    );
    expect(result.message).toContain("watchdog-stale-active-review");
    const journal = await readFile(
      join(projectDir, ".state", "journal.jsonl"),
      "utf8",
    );
    expect(journal).toContain('"outcome_class":"terminal-provider-error"');
    expect(journal).toContain('"candidate_task_ids":[]');
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
      type: "project.owner.requested",
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
      "Watchdog emitted project.owner.requested: watchdog-capacity-underfilled.",
    );
    expect(dispatched[0]).toMatchObject({
      type: "project.owner.requested",
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
      type: "project.owner.requested",
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
      type: "project.owner.requested",
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
      "Watchdog emitted project.owner.requested: watchdog-blocked-frontier-review.",
    );
    expect(dispatched).toMatchObject([
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

  test("skips early blocked-frontier wake when all blocked waits are future-dated exact waits", async () => {
    const projectDir = await makeProject();
    await writeTree(projectDir, {
      "blocked-task": task("blocked-task", "blocked", {
        blocker: {
          condition: "Waiting for returned operator proof.",
          category: "external-wait",
          owner: "human",
          resume_condition:
            "Resume when proof lands or the follow-up window opens.",
          resume_at: "2099-06-26T00:40:00.000Z",
          next_check_at: "2099-06-26T00:40:00.000Z",
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
    expect(result.message).toContain(
      "Watchdog skipped: blocked frontier is entirely future-dated exact waits until 2099-06-26T00:40:00.000Z.",
    );
    expect(dispatched).toHaveLength(0);
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
      "waiting-task": task("waiting-task", "backlog", {
        depends_on: ["blocked-task"],
      }),
    });

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(context({ projectDir, dispatched }));

    expect(result.status).toBe("done");
    expect(dispatched[0]).toMatchObject({
      type: "project.owner.requested",
      payload: {
        reason: "watchdog-blocked-frontier-review",
        waitingBacklogCount: 1,
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
      type: "project.owner.requested",
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
          "passed its next-check/resume/fallback window",
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
      type: "project.owner.requested",
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
          "passed its next-check/resume/fallback window",
        ),
      },
    });
  });

  test("includes overdue next-check waits before fallback expires", async () => {
    const projectDir = await makeProject();
    await writeTree(projectDir, {
      "blocked-next-check-wait": task("blocked-next-check-wait", "blocked", {
        blocker: {
          condition: "Waiting for a pipeline result recheck.",
          waiting_for: { type: "ado.pipeline_run.completed", runId: "123" },
          owner: "aks-explorer",
          observed_by: { workflow: "project-execution-watchdog" },
          observation_method: "Poll Azure DevOps run 123.",
          next_check_at: "2001-01-01T00:00:00.000Z",
          fallback_at: "2999-01-02T00:00:00.000Z",
          fallback_action:
            "Create pipeline diagnosis if the run still has no artifact.",
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
      type: "project.owner.requested",
      payload: {
        reason: "watchdog-blocked-frontier-review",
        blockedOverdueCount: 1,
        blockedFutureWatchCount: 0,
        overdueOwnerActionCount: 1,
        overdueOwnerActions: [
          {
            taskId: "blocked-next-check-wait",
            owner: "aks-explorer",
            watchAt: "2001-01-01T00:00:00.000Z",
            nextCheckAt: "2001-01-01T00:00:00.000Z",
            fallbackAt: "2999-01-02T00:00:00.000Z",
            fallbackAction:
              "Create pipeline diagnosis if the run still has no artifact.",
            recoveryRequired:
              "Next-check window passed without active/review recovery work.",
          },
        ],
        instruction: expect.stringContaining(
          "passed its next-check/resume/fallback window",
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
      type: "project.owner.requested",
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
      type: "project.owner.requested",
      payload: {
        reason: "watchdog-blocked-frontier-review",
        overdueOwnerActionCount: 0,
        overdueOwnerActions: [],
      },
    });
  });

  test("does not report spec-loop overdue owner action when legacy scoped recovery work is active", async () => {
    const projectDir = await makeProject();
    const stateDbPath = join(projectDir, "may.db");
    writeSession(stateDbPath, "s_legacy_scoped_overdue_audit", "running");
    await writeTree(projectDir, {
      "legacy-scoped-overdue-audit": task(
        "legacy-scoped-overdue-audit",
        "active",
        {
          goal: "Audit overdue blocked waits under the spec loop.",
          session_id: "s_legacy_scoped_overdue_audit",
          conflict_scope: ["ops:spec-loop-overdue-blocked-frontier-batch"],
        },
      ),
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
      type: "project.owner.requested",
      payload: {
        reason: "watchdog-blocked-frontier-review",
        overdueOwnerActionCount: 0,
        overdueOwnerActions: [],
      },
    });
  });

  test("does not report compact-loop overdue owner action when legacy scoped recovery work is active", async () => {
    const projectDir = await makeProject();
    const stateDbPath = join(projectDir, "may.db");
    writeSession(stateDbPath, "s_legacy_compact_overdue_audit", "running");
    await writeTree(projectDir, {
      "legacy-compact-overdue-audit": task(
        "legacy-compact-overdue-audit",
        "active",
        {
          goal: "Audit overdue blocked waits under the compact loop.",
          session_id: "s_legacy_compact_overdue_audit",
          conflict_scope: ["ops:compact-overdue-blocked-frontier-batch"],
        },
      ),
      "aks-feature-compact-loop": task("aks-feature-compact-loop", "active", {
        children: ["blocked-compact-wait"],
      }),
      "blocked-compact-wait": task("blocked-compact-wait", "blocked", {
        parent_id: "aks-feature-compact-loop",
        blocker: {
          condition: "Waiting for compact proof.",
          waiting_for: { type: "pipeline.completed" },
          owner: "aks-explorer",
          resume_condition: "Resume when the compact result is known.",
          resume_at: "2001-01-01T00:00:00.000Z",
          fallback_at: "2001-01-02T00:00:00.000Z",
          fallback_action: "Check the compact proof and create recovery work.",
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
      type: "project.owner.requested",
      payload: {
        reason: "watchdog-blocked-frontier-review",
        overdueOwnerActionCount: 0,
        overdueOwnerActions: [],
      },
    });
  });

  test("treats matching wait lineage pathId conflict scope as active recovery work", async () => {
    const projectDir = await makeProject();
    const stateDbPath = join(projectDir, "may.db");
    writeSession(stateDbPath, "s_shared_auth_repair", "running");
    await writeTree(projectDir, {
      "shared-auth-repair": task("shared-auth-repair", "active", {
        goal: "Repair the shared auth family.",
        session_id: "s_shared_auth_repair",
        conflict_scope: [
          "shared-authenticated-artifact-result-recovery-family-20260712",
        ],
      }),
      "shared-auth-wait": task("shared-auth-wait", "blocked", {
        blocker: {
          condition: "Waiting for shared auth recovery.",
          waiting_for: {
            type: "project.approval.submitted",
            pathId:
              "shared-authenticated-artifact-result-recovery-family-20260712",
          },
          owner: "aks-explorer",
          resume_condition: "Resume when the shared auth owner return arrives.",
          resume_at: "2001-01-01T00:00:00.000Z",
          fallback_at: "2001-01-02T00:00:00.000Z",
          fallback_action: "Refresh the shared auth family.",
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
      type: "project.owner.requested",
      payload: {
        reason: "watchdog-blocked-frontier-review",
        overdueOwnerActionCount: 0,
        overdueOwnerActions: [],
      },
    });
  });

  test("treats child-blocked parent waits as covered when recovery work references the surviving child lineage", async () => {
    const projectDir = await makeProject();
    const stateDbPath = join(projectDir, "may.db");
    writeSession(stateDbPath, "s_child_blocked_recovery", "running");
    await writeTree(projectDir, {
      "review-normalize-scenario-child": task(
        "review-normalize-scenario-child",
        "active",
        {
          session_id: "s_child_blocked_recovery",
          context: {
            auditedBlockedTaskIds: [
              "domain/wait-rp-nodepool-agentpool-operations-ado-run-172338359-result",
            ],
          },
        },
      ),
      "domain/audit-normalize-scenario-tests": task(
        "domain/audit-normalize-scenario-tests",
        "blocked",
        {
          children: [
            "domain/wait-rp-nodepool-agentpool-operations-ado-run-172338359-result",
          ],
          blocker: {
            condition:
              "Child blocked: domain/wait-rp-nodepool-agentpool-operations-ado-run-172338359-result.",
            category: "child-blocked",
            owner: "aks-explorer",
            waiting_for: {
              type: "child.task.blocked",
              taskId: "domain/audit-normalize-scenario-tests",
              childTaskIds: [
                "domain/wait-rp-nodepool-agentpool-operations-ado-run-172338359-result",
              ],
            },
            resume_condition:
              "Resume when the blocked child task is resolved or replaced.",
            next_check_at: "2001-01-01T00:00:00.000Z",
            fallback_at: "2001-01-02T00:00:00.000Z",
            fallback_action:
              "Refresh the child-blocked stewardship or reopen a concrete follow-up.",
          },
        },
      ),
      "domain/wait-rp-nodepool-agentpool-operations-ado-run-172338359-result":
        task(
          "domain/wait-rp-nodepool-agentpool-operations-ado-run-172338359-result",
          "blocked",
          {
            parent_id: "domain/audit-normalize-scenario-tests",
            blocker: {
              condition: "Waiting for exact ADO evidence.",
              waiting_for: { type: "ado.pipeline_run.completed" },
              owner: "aks-explorer",
              resume_condition: "Resume when the exact ADO run is terminal.",
              next_check_at: "2001-01-01T00:00:00.000Z",
              fallback_at: "2001-01-02T00:00:00.000Z",
              fallback_action: "Refresh the exact child wait.",
            },
          },
        ),
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
      type: "project.owner.requested",
      payload: {
        reason: "watchdog-blocked-frontier-review",
        overdueOwnerActionCount: 0,
        overdueOwnerActions: [],
        blockedTasks: [
          {
            taskId:
              "domain/wait-rp-nodepool-agentpool-operations-ado-run-172338359-result",
          },
        ],
      },
    });
    expect(
      dispatched[0]?.payload?.blockedTasks?.some(
        (task: { taskId?: string }) =>
          task.taskId === "domain/audit-normalize-scenario-tests",
      ),
    ).toBe(false);
  });

  test("does not treat prose-only blocked wait mention as active recovery work", async () => {
    const projectDir = await makeProject();
    const stateDbPath = join(projectDir, "may.db");
    writeSession(stateDbPath, "s_prose_overdue_audit", "running");
    await writeTree(projectDir, {
      "prose-overdue-audit": task("prose-overdue-audit", "active", {
        goal: "Recover blocked-spec-wait by checking the pipeline result.",
        session_id: "s_prose_overdue_audit",
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
      type: "project.owner.requested",
      payload: {
        reason: "watchdog-blocked-frontier-review",
        overdueOwnerActionCount: 1,
        overdueOwnerActions: [{ taskId: "blocked-spec-wait" }],
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
      type: "project.owner.requested",
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
            current_attempt_id: "a_review-task_1",
            last_worker_result: "done",
            last_worker_summary: "Worker completed useful review output.",
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
        "Watchdog re-emitted completion for review task(s): review-task.",
    });
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.completed",
      payload: {
        taskId: "review-task",
        attemptId: "a_review-task_1",
        result: "done",
        summary: "Worker completed useful review output.",
        review: {
          required: true,
          reason: "watchdog-recovered-review-completion-trigger",
        },
      },
    });
  });

  test("Project Supervisor V2 re-emits one correlated completion and does not duplicate it", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, ".state", "task-reviewer-runs.jsonl"),
      "",
      "utf8",
    );
    await writeTree(projectDir, {
      "review-task": task("review-task", "review", {
        revision: 2,
        context: { controlPlaneVersion: 2 },
        trace: {
          current_attempt_id: "attempt-2",
          worker_started_attempt_id: "attempt-2",
          last_worker_result: "done",
          last_worker_summary: "Current completion claim.",
          last_worker_completed_at: "2026-06-20T00:00:00.000Z",
          workflowResult: {
            resultVersion: "workflow-result-v1",
            workflow: "fixture-worker",
            status: "done",
            summary: "Current completion claim.",
            artifacts: ["evidence/review.md"],
            details: { exact: true },
          },
        },
      }),
    });

    const firstDispatches: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const first = await execute(
      context({ projectDir, dispatched: firstDispatches }),
    );
    expect(first.message).toContain(
      "Project Supervisor V2 review handoff action dispatched and recorded for review-task",
    );
    expect(firstDispatches).toHaveLength(1);
    expect(firstDispatches[0]).toMatchObject({
      type: "project.task.completed",
      payload: {
        taskId: "review-task",
        taskRevision: 2,
        attemptId: "attempt-2",
        result: "done",
        review: {
          required: true,
          reason: "project-supervisor-v2-recovered-review-completion",
        },
        workflowResult: {
          workflow: "fixture-worker",
          details: { exact: true },
        },
      },
    });

    const secondDispatches: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    await execute(context({ projectDir, dispatched: secondDispatches }));
    expect(
      secondDispatches.filter(
        (event) => event.type === "project.task.completed",
      ),
    ).toHaveLength(0);

    const tree = JSON.parse(
      await readFile(join(projectDir, ".state", "tasks", "tree.json"), "utf8"),
    );
    expect(
      tree.supervisorRecoveries[
        "review-delivery-missing:review-task:2:attempt-2"
      ],
    ).toMatchObject({
      status: "actioned",
      actionKind: "reemit-completion",
      actionCount: 1,
    });
    const journal = await readFile(
      join(projectDir, ".state", "journal.jsonl"),
      "utf8",
    );
    expect(journal).toContain(
      '"kind":"project_supervisor_review_handoff_action_v2"',
    );
    expect(journal).not.toContain(
      '"kind":"watchdog_review_completion_reemitted"',
    );
  });

  test("keeps compatibility revision zero on legacy review recovery even when the review source is available", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, ".state", "task-reviewer-runs.jsonl"),
      "",
      "utf8",
    );
    await writeTree(projectDir, {
      "legacy-review": task("legacy-review", "review", {
        revision: 0,
        trace: {
          current_attempt_id: "legacy-attempt",
          last_worker_result: "done",
          last_worker_summary: "Legacy completion claim.",
          last_worker_completed_at: "2026-06-20T00:00:00.000Z",
        },
      }),
    });

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(context({ projectDir, dispatched }));
    expect(result.message).toBe(
      "Watchdog re-emitted completion for review task(s): legacy-review.",
    );
    expect(dispatched[0]).toMatchObject({
      type: "project.task.completed",
      payload: {
        taskId: "legacy-review",
        attemptId: "legacy-attempt",
        review: {
          reason: "watchdog-recovered-review-completion-trigger",
        },
      },
    });
    const tree = JSON.parse(
      await readFile(join(projectDir, ".state", "tasks", "tree.json"), "utf8"),
    );
    expect(tree.supervisorRecoveries).toBeUndefined();
  });

  test("keeps revisioned review recovery on the legacy path when supervisor V2 is off", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, ".state", "task-reviewer-runs.jsonl"),
      "",
      "utf8",
    );
    await writeTree(projectDir, {
      "revisioned-review": task("revisioned-review", "review", {
        revision: 3,
        trace: {
          current_attempt_id: "attempt-3",
          last_worker_result: "done",
          last_worker_completed_at: "2026-06-20T00:00:00.000Z",
        },
      }),
    });

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(
      context({ projectDir, supervisorV2: "off", dispatched }),
    );
    expect(result.message).toBe(
      "Watchdog re-emitted completion for review task(s): revisioned-review.",
    );
    expect(dispatched[0]).toMatchObject({
      type: "project.task.completed",
      payload: { taskId: "revisioned-review", attemptId: "attempt-3" },
    });
  });

  test("Project Supervisor V2 re-emits the exact stored reviewer decision", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, ".state", "task-reviewer-runs.jsonl"),
      `${JSON.stringify({
        ts: "2026-07-16T04:01:00.000Z",
        workflow: "task-reviewer",
        result: "project.task.reviewed",
        task_id: "review-task",
        task_revision: 2,
        attempt_id: "attempt-2",
        decision: "accept",
        confidence: "high",
        summary: "The exact claim is accepted.",
        findings: ["Stored finding."],
        feedback: [],
        suggestedFollowups: ["Continue the parent."],
        artifacts: ["evidence/review.md"],
        verification: ["bun test"],
        events: [],
      })}\n`,
      "utf8",
    );
    await writeTree(projectDir, {
      "review-task": task("review-task", "review", {
        revision: 2,
        context: { controlPlaneVersion: 2 },
        trace: {
          current_attempt_id: "attempt-2",
          last_worker_result: "done",
          last_worker_completed_at: "2026-06-20T00:00:00.000Z",
        },
      }),
    });

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute(context({ projectDir, dispatched }));
    expect(result.message).toContain(
      "Project Supervisor V2 review handoff action dispatched and recorded for review-task",
    );
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.reviewed",
      payload: {
        taskId: "review-task",
        taskRevision: 2,
        attemptId: "attempt-2",
        decision: "accept",
        confidence: "high",
        summary: "The exact claim is accepted.",
        findings: ["Stored finding."],
        reason: "project-supervisor-v2-reemit-reviewed",
      },
    });
  });

  test("Project Supervisor V2 does not treat a provider dispatch failure as a review decision", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, ".state", "task-reviewer-runs.jsonl"),
      `${JSON.stringify({
        ts: "2026-07-16T04:01:00.000Z",
        result: "dispatch-failed",
        task_id: "review-task",
        task_revision: 2,
        attempt_id: "attempt-2",
        review: { decision: "accept", summary: "Not delivered." },
      })}\n`,
      "utf8",
    );
    await writeTree(projectDir, {
      "review-task": task("review-task", "review", {
        revision: 2,
        context: { controlPlaneVersion: 2 },
        trace: {
          current_attempt_id: "attempt-2",
          last_worker_result: "done",
          last_worker_completed_at: "2026-06-20T00:00:00.000Z",
        },
      }),
    });

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    await execute(context({ projectDir, dispatched }));
    expect(dispatched.map((event) => event.type)).toEqual([
      "project.task.completed",
    ]);
  });

  test("Project Supervisor V2 ignores a reviewer decision for a stale revision and attempt", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, ".state", "task-reviewer-runs.jsonl"),
      `${JSON.stringify({
        ts: "2026-07-16T04:01:00.000Z",
        result: "project.task.reviewed",
        task_id: "review-task",
        task_revision: 1,
        attempt_id: "attempt-1",
        decision: "accept",
        summary: "This belongs to the previous revision.",
      })}\n`,
      "utf8",
    );
    await writeTree(projectDir, {
      "review-task": task("review-task", "review", {
        revision: 2,
        context: { controlPlaneVersion: 2 },
        trace: {
          current_attempt_id: "attempt-2",
          last_worker_result: "done",
          last_worker_completed_at: "2026-06-20T00:00:00.000Z",
        },
      }),
    });

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    await execute(context({ projectDir, dispatched }));
    expect(dispatched.map((event) => event.type)).toEqual([
      "project.task.completed",
    ]);
    expect(dispatched[0]?.payload).toMatchObject({
      taskRevision: 2,
      attemptId: "attempt-2",
    });
  });

  test("Project Supervisor V2 emits one owner request after its action budget and grace are exhausted", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, ".state", "task-reviewer-runs.jsonl"),
      "",
      "utf8",
    );
    const recoveryKey = "review-delivery-missing:review-task:2:attempt-2";
    await writeTree(
      projectDir,
      {
        "review-task": task("review-task", "review", {
          revision: 2,
          context: { controlPlaneVersion: 2 },
          trace: {
            current_attempt_id: "attempt-2",
            last_worker_result: "done",
            last_worker_completed_at: "2026-06-20T00:00:00.000Z",
          },
        }),
      },
      {
        supervisorRecoveries: {
          [recoveryKey]: {
            version: "project-supervisor-recovery-v2",
            recoveryKey,
            invariantType: "review-delivery-missing",
            subject: { kind: "task", id: "review-task", revision: 2 },
            attemptId: "attempt-2",
            decisionId: null,
            status: "actioned",
            actionKind: "reemit-completion",
            actionCount: 1,
            maxActions: 1,
            firstObservedAt: "2026-07-16T03:00:00.000Z",
            lastObservedAt: "2026-07-16T03:00:00.000Z",
            lastActionAt: "2026-07-16T03:00:00.000Z",
          },
        },
      },
    );

    const firstDispatches: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    await execute(context({ projectDir, dispatched: firstDispatches }));
    expect(firstDispatches).toHaveLength(1);
    expect(firstDispatches[0]).toMatchObject({
      type: "project.owner.requested",
      payload: {
        reason: "project-supervisor-v2-review-handoff-exhausted",
        taskId: "review-task",
        taskRevision: 2,
        attemptId: "attempt-2",
        recoveryKey,
      },
    });

    const secondDispatches: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    await execute(context({ projectDir, dispatched: secondDispatches }));
    expect(secondDispatches).toHaveLength(0);
    const tree = JSON.parse(
      await readFile(join(projectDir, ".state", "tasks", "tree.json"), "utf8"),
    );
    expect(tree.supervisorRecoveries[recoveryKey]).toMatchObject({
      status: "exhausted",
      actionCount: 1,
    });
  });

  test("does not duplicate a fresh completion while its reviewer can still be running", async () => {
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
            current_attempt_id: "a_review-task_1",
            last_worker_result: "done",
            last_worker_summary: "Worker completed useful review output.",
            last_worker_completed_at: new Date().toISOString(),
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
        "Watchdog skipped: 1 active task(s) still have running attempts.",
    });
    expect(
      dispatched.some((event) => event.type === "project.task.completed"),
    ).toBe(false);
    expect(dispatched).toHaveLength(0);
  });

  test("does not let retained terminal-review context bypass grace for a fresh redo attempt", async () => {
    const projectDir = await makeProject();
    await writeTree(projectDir, {
      "terminal-redo": task("terminal-redo", "review", {
        context: {
          terminalPipelineWaitReview: {
            runId: "172475799",
            runStatus: "completed",
            runConclusion: "failed",
          },
        },
        trace: {
          current_attempt_id: "a_terminal-redo_20260716070402",
          previous_attempt_id: "a_terminal-redo_172475799_terminal_wait_review",
          last_worker_result: "done",
          last_worker_completed_at: new Date().toISOString(),
        },
      }),
    });

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    await execute(context({ projectDir, dispatched }));
    expect(
      dispatched.filter((event) => event.type === "project.task.completed"),
    ).toHaveLength(0);
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
        "Watchdog emitted project.owner.requested: watchdog-blocked-frontier-review.",
    });
    expect(dispatched[0]).toMatchObject({
      type: "project.owner.requested",
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

  test("re-emits terminal pipeline wait review through task reviewer", async () => {
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
        "Watchdog re-emitted completion for review task(s): terminal-run-review.",
    });
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.completed",
      payload: {
        taskId: "terminal-run-review",
        attemptId: "a_terminal-run-review_123456789_terminal_wait_review",
        result: "blocked",
        summary:
          "Azure DevOps pipeline run 123456789 is terminal; inspect returned artifacts.",
        review: {
          required: true,
          reason: "watchdog-recovered-terminal-pipeline-wait-review",
        },
      },
    });
    const tree = JSON.parse(
      await readFile(join(projectDir, ".state", "tasks", "tree.json"), "utf8"),
    );
    expect(tree.tasks["terminal-run-review"].trace.current_attempt_id).toBe(
      "a_terminal-run-review_123456789_terminal_wait_review",
    );
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
      const dispatched: Array<{
        type: string;
        payload: Record<string, unknown>;
      }> = [];
      const result = await execute(context({ projectDir, dispatched }));
      expect(result).toEqual({
        status: "done",
        message:
          "Watchdog moved terminal Azure DevOps wait(s) to review: wait-dev-infra-core-ado-run-123456789-result. Re-emitted completion for reviewer handoff: wait-dev-infra-core-ado-run-123456789-result.",
      });
      expect(dispatched).toHaveLength(1);
      expect(dispatched[0]).toMatchObject({
        type: "project.task.completed",
        payload: {
          taskId: "wait-dev-infra-core-ado-run-123456789-result",
          attemptId:
            "a_wait-dev-infra-core-ado-run-123456789-result_123456789_terminal_wait_review",
          result: "blocked",
          review: {
            required: true,
            reason: "watchdog-recovered-review-completion-trigger",
          },
        },
      });
      const tree = JSON.parse(
        await readFile(
          join(projectDir, ".state", "tasks", "tree.json"),
          "utf8",
        ),
      );
      const task = tree.tasks["wait-dev-infra-core-ado-run-123456789-result"];
      expect(task.state).toBe("review");
      expect(task.context.terminalPipelineWaitReview).toMatchObject({
        runId: "123456789",
        runStatus: "completed",
        runConclusion: "failure",
      });
      expect(task.trace.current_attempt_id).toBe(
        "a_wait-dev-infra-core-ado-run-123456789-result_123456789_terminal_wait_review",
      );
      expect(task.trace.terminal_wait_review_attempt_created_by).toBe(
        "project-execution-watchdog",
      );
      expect(task.result).toContain(
        "Azure DevOps pipeline run 123456789 is terminal",
      );
    } finally {
      setPipelineBackendForTests(null);
    }
  });

  test("resolves and dispatches a revision-bound pipeline Condition continuation", async () => {
    const projectDir = await makeProject();
    const conditionId = "condition:pipeline:ado:172459471:terminal";
    const now = new Date().toISOString();
    await writeTree(
      projectDir,
      {
        "fix-spec-one-v2": task("fix-spec-one-v2", "blocked", {
          revision: 3,
          goal: "Inspect terminal run 172459471 artifacts.",
          context: {
            controlPlaneVersion: 2,
            workflow: "spec-result-review",
            conditionId,
            phaseContract: {
              revision: 3,
              resultSchema: "SPEC_RESULT_REVIEW",
            },
          },
          blocker: {
            condition:
              "Compatibility projection intentionally lacks run correlation.",
          },
        }),
      },
      {
        conditions: {
          [conditionId]: {
            version: "project-condition-v2",
            id: conditionId,
            causeKey: "pipeline:ado:172459471:terminal",
            class: "external",
            type: "pipeline.run.terminal",
            status: "open",
            backend: "ado",
            runId: "172459471",
            runUrl: "https://dev.azure.com/example/172459471",
            subject: { kind: "task", id: "fix-spec-one-v2", revision: 3 },
            owner: "ado",
            observer: "project-execution-watchdog",
            observationMethod: "exact run",
            resumeCondition: "run is terminal",
            nextCheckAt: now,
            fallbackAt: new Date(Date.now() + 60_000).toISOString(),
            fallbackAction: "escalate",
            createdAt: now,
            updatedAt: now,
          },
        },
      },
    );
    let resolveCalls = 0;
    let getRunCalls = 0;
    setPipelineBackendForTests({
      resolve: () => {
        resolveCalls += 1;
        return { ok: true };
      },
      getRun: () => {
        getRunCalls += 1;
        return {
          status: "completed",
          conclusion: "failure",
          url: "https://dev.azure.com/example/172459471",
          displayTitle: "spec.one",
        };
      },
    });
    try {
      const dispatched: Array<{
        type: string;
        payload: Record<string, unknown>;
      }> = [];
      await execute(context({ projectDir, dispatched }));
      const gatedTree = JSON.parse(
        await readFile(
          join(projectDir, ".state", "tasks", "tree.json"),
          "utf8",
        ),
      );
      expect(gatedTree.conditions[conditionId].status).toBe("open");
      expect(gatedTree.tasks["fix-spec-one-v2"].state).toBe("blocked");
      expect(resolveCalls).toBe(0);
      expect(getRunCalls).toBe(0);

      const result = await execute(
        context({
          projectDir,
          dispatched,
          conditionV2: "exact-ado-revisioned",
        }),
      );
      expect(result.status).toBe("done");
      expect(result.message).toContain(
        "Watchdog resolved exact pipeline Condition(s): fix-spec-one-v2.",
      );
      expect(resolveCalls).toBe(1);
      expect(getRunCalls).toBe(1);
      const tree = JSON.parse(
        await readFile(
          join(projectDir, ".state", "tasks", "tree.json"),
          "utf8",
        ),
      );
      expect(tree.conditions[conditionId].status).toBe("resolved");
      expect(tree.conditions[conditionId].continuation).toMatchObject({
        status: "assigned",
        recoveryKey: `condition-continuation:${conditionId}:3`,
        assignment: {
          taskId: "fix-spec-one-v2",
          taskRevision: 3,
        },
      });
      expect(tree.tasks["fix-spec-one-v2"]).toMatchObject({
        revision: 3,
        state: "active",
        context: {
          terminalPipelineWaitReview: {
            conditionId,
            runId: "172459471",
            subjectRevision: 3,
          },
        },
      });
      expect(
        dispatched.some(
          (event) =>
            event.type === "project.task.assigned" &&
            event.payload.taskId === "fix-spec-one-v2",
        ),
      ).toBe(true);
    } finally {
      setPipelineBackendForTests(null);
    }
  });

  test("adopts one selected compatibility ADO wait before observing it", async () => {
    const projectDir = await makeProject();
    const taskId = "wait-egress-lockdown-windows-baseline";
    const runId = "172480751";
    const due = new Date(Date.now() - 60_000).toISOString();
    const fallback = new Date(Date.now() + 60 * 60_000).toISOString();
    await writeTree(projectDir, {
      [taskId]: task(taskId, "blocked", {
        revision: 0,
        blocker: {
          condition: `Wait for Azure DevOps run ${runId}.`,
          category: "external-wait",
          owner: "ado",
          waiting_for: {
            type: "ado.pipeline_run.completed",
            runId,
            runUrl: `https://dev.azure.com/example/${runId}`,
            specIds: ["spec.egress-lockdown.windows-baseline"],
          },
          next_check_at: due,
          resume_at: due,
          resume_condition: `Run ${runId} is terminal.`,
          fallback_at: fallback,
          fallback_action: "Escalate the exact run wait.",
        },
      }),
    });
    let getRunCalls = 0;
    setPipelineBackendForTests({
      resolve: () => ({ ok: true }),
      getRun: () => {
        getRunCalls += 1;
        return {
          status: "inProgress",
          url: `https://dev.azure.com/example/${runId}`,
        };
      },
    });
    try {
      const dispatched: Array<{
        type: string;
        payload: Record<string, unknown>;
      }> = [];
      const result = await execute(
        context({
          projectDir,
          conditionV2: "exact-ado-revisioned",
          conditionAdoptionV2: "exact-task",
          conditionAdoptionV2TaskId: taskId,
          conditionAdoptionV2RunId: runId,
          dispatched,
        }),
      );
      expect(result.message).toContain(
        "Watchdog refreshed nonterminal Azure DevOps wait check",
      );
      const tree = JSON.parse(
        await readFile(
          join(projectDir, ".state", "tasks", "tree.json"),
          "utf8",
        ),
      );
      expect(tree.tasks[taskId]).toMatchObject({
        revision: 1,
        state: "blocked",
        context: {
          controlPlaneVersion: 2,
          conditionId: `condition:pipeline:ado:${runId}:terminal`,
        },
        blocker: {
          condition_id: `condition:pipeline:ado:${runId}:terminal`,
          last_observed_status: "inProgress",
          waiting_for: { subjectRevision: 1 },
        },
      });
      expect(tree.tasks[taskId].blocker.resume_at).toBeUndefined();
      expect(
        tree.conditions[`condition:pipeline:ado:${runId}:terminal`],
      ).toMatchObject({
        status: "open",
        lastObservation: { status: "inProgress" },
        subject: { id: taskId, revision: 1 },
      });
      const journal = await readFile(
        join(projectDir, ".state", "journal.jsonl"),
        "utf8",
      );
      expect(journal).toContain('"kind":"exact_pipeline_wait_adopted_v2"');
      expect(getRunCalls).toBe(1);

      dispatched.length = 0;
      const steadyState = await execute(
        context({
          projectDir,
          conditionV2: "exact-ado-revisioned",
          conditionAdoptionV2: "exact-task",
          conditionAdoptionV2TaskId: taskId,
          conditionAdoptionV2RunId: runId,
          dispatched,
        }),
      );
      expect(steadyState).toEqual({
        status: "done",
        message:
          "Watchdog skipped: 1 blocked task(s) are owned by open exact Conditions.",
      });
      expect(dispatched).toHaveLength(0);
      expect(getRunCalls).toBe(1);
    } finally {
      setPipelineBackendForTests(null);
    }
  });

  test("fallback probe refreshes a due nonterminal Condition without revising work", async () => {
    const projectDir = await makeProject();
    const conditionId = "condition:pipeline:ado:172459471:terminal";
    const due = new Date(Date.now() - 60_000).toISOString();
    const fallback = new Date(Date.now() + 60 * 60_000).toISOString();
    await writeTree(
      projectDir,
      {
        "fix-spec-one-v2": task("fix-spec-one-v2", "blocked", {
          revision: 3,
          context: {
            controlPlaneVersion: 2,
            workflow: "spec-result-review",
            conditionId,
          },
          blocker: {
            condition_id: conditionId,
            condition: "Wait for Azure DevOps run 172459471.",
            waiting_for: {
              type: "ado.pipeline_run.completed",
              runId: "172459471",
            },
            next_check_at: due,
            fallback_at: fallback,
          },
        }),
      },
      {
        conditions: {
          [conditionId]: {
            version: "project-condition-v2",
            id: conditionId,
            causeKey: "pipeline:ado:172459471:terminal",
            class: "external",
            type: "pipeline.run.terminal",
            status: "open",
            backend: "ado",
            runId: "172459471",
            runUrl: "https://dev.azure.com/example/172459471",
            subject: { kind: "task", id: "fix-spec-one-v2", revision: 3 },
            owner: "ado",
            observer: "project-execution-watchdog",
            observationMethod: "exact run",
            resumeCondition: "run is terminal",
            nextCheckAt: due,
            fallbackAt: fallback,
            fallbackAction: "escalate",
            createdAt: due,
            updatedAt: due,
          },
        },
      },
    );
    setPipelineBackendForTests({
      resolve: () => ({ ok: true }),
      getRun: () => ({
        status: "inProgress",
        conclusion: null,
        url: "https://dev.azure.com/example/172459471",
      }),
    });
    try {
      await execute(
        context({
          projectDir,
          conditionV2: "exact-ado-revisioned",
        }),
      );
      const tree = JSON.parse(
        await readFile(
          join(projectDir, ".state", "tasks", "tree.json"),
          "utf8",
        ),
      );
      expect(tree.tasks["fix-spec-one-v2"].revision).toBe(3);
      expect(tree.tasks["fix-spec-one-v2"].state).toBe("blocked");
      expect(tree.conditions[conditionId]).toMatchObject({
        status: "open",
        lastObservation: { status: "inProgress" },
      });
      expect(
        Date.parse(tree.conditions[conditionId].nextCheckAt),
      ).toBeGreaterThan(Date.now());
      expect(tree.tasks["fix-spec-one-v2"].blocker.next_check_at).toBe(
        tree.conditions[conditionId].nextCheckAt,
      );
    } finally {
      setPipelineBackendForTests(null);
    }
  });

  test("dispatches one stable fallback for an overdue nonterminal Condition", async () => {
    const projectDir = await makeProject();
    const taskId = "fix-spec-fallback-v2";
    const runId = "172459499";
    const conditionId = `condition:pipeline:ado:${runId}:terminal`;
    const due = new Date(Date.now() - 120_000).toISOString();
    await writeTree(
      projectDir,
      {
        [taskId]: task(taskId, "blocked", {
          revision: 3,
          context: {
            controlPlaneVersion: 2,
            workflow: "spec-result-review",
            conditionId,
          },
          blocker: {
            condition_id: conditionId,
            condition: `Wait for Azure DevOps run ${runId}.`,
            waiting_for: {
              type: "ado.pipeline_run.completed",
              runId,
            },
            next_check_at: due,
            resume_at: due,
            fallback_at: due,
            fallback_action: "Escalate the exact queue or artifact issue.",
          },
        }),
      },
      {
        conditions: {
          [conditionId]: {
            version: "project-condition-v2",
            id: conditionId,
            causeKey: `pipeline:ado:${runId}:terminal`,
            class: "external",
            type: "pipeline.run.terminal",
            status: "open",
            backend: "ado",
            runId,
            runUrl: `https://dev.azure.com/example/${runId}`,
            subject: { kind: "task", id: taskId, revision: 3 },
            owner: "ado",
            observer: "project-execution-watchdog",
            observationMethod: "exact run",
            resumeCondition: "run is terminal",
            nextCheckAt: due,
            fallbackAt: due,
            fallbackAction: "Escalate the exact queue or artifact issue.",
            createdAt: due,
            updatedAt: due,
          },
        },
      },
    );
    let getRunCalls = 0;
    setPipelineBackendForTests({
      resolve: () => ({ ok: true }),
      getRun: () => {
        getRunCalls += 1;
        return {
          status: "inProgress",
          conclusion: null,
          url: `https://dev.azure.com/example/${runId}`,
        };
      },
    });
    try {
      const dispatched: Array<{
        type: string;
        payload: Record<string, unknown>;
      }> = [];
      const first = await execute(
        context({
          projectDir,
          conditionV2: "exact-ado-revisioned",
          dispatched,
        }),
      );
      expect(first).toEqual({
        status: "done",
        message: `Watchdog dispatched exact Condition fallback(s): ${taskId}.`,
      });
      expect(dispatched).toHaveLength(1);
      expect(dispatched[0]).toMatchObject({
        type: "project.owner.requested",
        payload: {
          reason: "condition-overdue-fallback",
          recoveryKey: `condition-fallback:${conditionId}:3`,
          conditionId,
          taskId,
          taskRevision: 3,
        },
      });
      let tree = JSON.parse(
        await readFile(
          join(projectDir, ".state", "tasks", "tree.json"),
          "utf8",
        ),
      );
      expect(tree.conditions[conditionId].fallbackExecution).toMatchObject({
        recoveryKey: `condition-fallback:${conditionId}:3`,
        status: "dispatched",
        attempts: 1,
      });
      const firstObservedAt = tree.conditions[conditionId].lastObservedAt;
      const firstNextCheckAt = tree.conditions[conditionId].nextCheckAt;
      expect(
        Date.parse(tree.conditions[conditionId].nextCheckAt),
      ).toBeGreaterThan(Date.now());
      expect(tree.tasks[taskId].blocker.next_check_at).toBe(
        tree.conditions[conditionId].nextCheckAt,
      );
      expect(tree.tasks[taskId].blocker.resume_at).toBeUndefined();
      expect(getRunCalls).toBe(1);

      const second = await execute(
        context({
          projectDir,
          conditionV2: "exact-ado-revisioned",
          dispatched,
        }),
      );
      expect(second).toEqual({
        status: "done",
        message:
          "Watchdog skipped: 1 blocked task(s) are owned by open exact Conditions.",
      });
      expect(dispatched).toHaveLength(1);
      expect(getRunCalls).toBe(1);
      tree = JSON.parse(
        await readFile(
          join(projectDir, ".state", "tasks", "tree.json"),
          "utf8",
        ),
      );
      expect(tree.conditions[conditionId].fallbackExecution.attempts).toBe(1);
      expect(tree.conditions[conditionId].lastObservedAt).toBe(firstObservedAt);
      expect(tree.conditions[conditionId].nextCheckAt).toBe(firstNextCheckAt);

      tree.conditions[conditionId].nextCheckAt = due;
      tree.tasks[taskId].blocker.next_check_at = "2099-01-01T00:00:00.000Z";
      await writeFile(
        join(projectDir, ".state", "tasks", "tree.json"),
        `${JSON.stringify(tree, null, 2)}\n`,
        "utf8",
      );
      const postFallbackDue = await execute(
        context({
          projectDir,
          conditionV2: "exact-ado-revisioned",
          dispatched,
        }),
      );
      expect(postFallbackDue).toEqual({
        status: "done",
        message:
          "Watchdog skipped: 1 blocked task(s) are owned by open exact Conditions.",
      });
      expect(dispatched).toHaveLength(1);
      expect(getRunCalls).toBe(2);
      tree = JSON.parse(
        await readFile(
          join(projectDir, ".state", "tasks", "tree.json"),
          "utf8",
        ),
      );
      expect(tree.conditions[conditionId].fallbackExecution.attempts).toBe(1);
      expect(tree.tasks[taskId].blocker.next_check_at).toBe(
        tree.conditions[conditionId].nextCheckAt,
      );
      expect(tree.tasks[taskId].blocker.fallback_at).toBe(
        tree.conditions[conditionId].fallbackAt,
      );
      expect(tree.tasks[taskId].blocker.fallback_action).toBe(
        tree.conditions[conditionId].fallbackAction,
      );
      expect(tree.tasks[taskId].blocker.resume_condition).toBe(
        tree.conditions[conditionId].resumeCondition,
      );
      expect(tree.tasks[taskId].blocker.next_check_at).not.toBe(
        "2099-01-01T00:00:00.000Z",
      );
    } finally {
      setPipelineBackendForTests(null);
    }
  });

  test("dispatches a due Condition fallback when pipeline observation is unavailable", async () => {
    const projectDir = await makeProject();
    const taskId = "fix-spec-fallback-unavailable-v2";
    const runId = "172459500";
    const conditionId = `condition:pipeline:ado:${runId}:terminal`;
    const due = new Date(Date.now() - 120_000).toISOString();
    await writeTree(
      projectDir,
      {
        [taskId]: task(taskId, "blocked", {
          revision: 3,
          context: {
            controlPlaneVersion: 2,
            workflow: "spec-result-review",
            conditionId,
          },
          blocker: { condition: `Wait for Azure DevOps run ${runId}.` },
        }),
      },
      {
        conditions: {
          [conditionId]: {
            version: "project-condition-v2",
            id: conditionId,
            causeKey: `pipeline:ado:${runId}:terminal`,
            class: "external",
            type: "pipeline.run.terminal",
            status: "open",
            backend: "ado",
            runId,
            runUrl: `https://dev.azure.com/example/${runId}`,
            subject: { kind: "task", id: taskId, revision: 3 },
            owner: "ado",
            observer: "project-execution-watchdog",
            observationMethod: "exact run",
            resumeCondition: "run is terminal",
            nextCheckAt: due,
            fallbackAt: due,
            fallbackAction: "Escalate the unavailable exact run observation.",
            createdAt: due,
            updatedAt: due,
          },
        },
      },
    );
    setPipelineBackendForTests({
      resolve: () => ({ ok: false, reason: "ADO authentication unavailable" }),
      getRun: () => {
        throw new Error("getRun must not run without a resolved client");
      },
    });
    try {
      const dispatched: Array<{
        type: string;
        payload: Record<string, unknown>;
      }> = [];
      const result = await execute(
        context({
          projectDir,
          conditionV2: "exact-ado-revisioned",
          dispatched,
        }),
      );
      expect(result.message).toBe(
        `Watchdog dispatched exact Condition fallback(s): ${taskId}.`,
      );
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: "project.owner.requested",
          payload: expect.objectContaining({
            recoveryKey: `condition-fallback:${conditionId}:3`,
            observation: expect.objectContaining({
              status: "unavailable",
              observationError: "ADO authentication unavailable",
            }),
          }),
        }),
      );
    } finally {
      setPipelineBackendForTests(null);
    }
  });

  test("refreshes an overdue exact pipeline check in code while the run is nonterminal", async () => {
    const projectDir = await makeProject();
    await writeTree(projectDir, {
      "wait-running-ado-run-123456789-result": task(
        "wait-running-ado-run-123456789-result",
        "blocked",
        {
          parent_id: "aks-feature-compact-loop",
          blocker: {
            condition: "Waiting for Azure DevOps run 123456789.",
            category: "external-wait",
            owner: "ado",
            waiting_for: {
              type: "ado.pipeline_run.completed",
              runId: "123456789",
            },
            next_check_at: "2001-01-01T00:00:00.000Z",
            fallback_at: "2099-01-01T00:00:00.000Z",
            fallback_action:
              "Inspect the queue if the run is still nonterminal at fallback.",
          },
        },
      ),
    });
    setPipelineBackendForTests({
      resolve: () => ({ ok: true }),
      getRun: () => ({
        status: "notStarted",
        url: "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123456789",
      }),
    });
    try {
      const dispatched: Array<{
        type: string;
        payload: Record<string, unknown>;
      }> = [];
      const before = Date.now();
      const result = await execute(context({ projectDir, dispatched }));
      expect(result).toEqual({
        status: "done",
        message:
          "Watchdog refreshed nonterminal Azure DevOps wait check(s): wait-running-ado-run-123456789-result.",
      });
      expect(dispatched).toHaveLength(0);

      const tree = JSON.parse(
        await readFile(
          join(projectDir, ".state", "tasks", "tree.json"),
          "utf8",
        ),
      );
      const task = tree.tasks["wait-running-ado-run-123456789-result"];
      expect(task.state).toBe("blocked");
      expect(Date.parse(task.blocker.next_check_at)).toBeGreaterThan(before);
      expect(task.blocker.last_observed_status).toBe("notStarted");
      expect(task.trace.pipeline_wait_last_run_id).toBe("123456789");
      expect(task.context?.terminalPipelineWaitReview).toBeUndefined();
    } finally {
      setPipelineBackendForTests(null);
    }
  });

  test("watchdog refresh advances fallback when the preserved wait would otherwise end before the next check", async () => {
    const projectDir = await makeProject();
    const initialFallbackAt = new Date(Date.now() + 2 * 60_000).toISOString();
    await writeTree(projectDir, {
      "wait-running-ado-run-123456789-result": task(
        "wait-running-ado-run-123456789-result",
        "blocked",
        {
          parent_id: "aks-feature-compact-loop",
          blocker: {
            condition: "Waiting for Azure DevOps run 123456789.",
            category: "external-wait",
            owner: "ado",
            waiting_for: {
              type: "ado.pipeline_run.completed",
              runId: "123456789",
            },
            next_check_at: "2001-01-01T00:00:00.000Z",
            fallback_at: initialFallbackAt,
            resume_at: "2001-01-01T00:00:00.000Z",
            fallback_action:
              "Inspect the queue if the run is still nonterminal at fallback.",
          },
        },
      ),
    });
    setPipelineBackendForTests({
      resolve: () => ({ ok: true }),
      getRun: () => ({
        status: "notStarted",
        url: "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123456789",
      }),
    });
    try {
      const dispatched: Array<{
        type: string;
        payload: Record<string, unknown>;
      }> = [];
      const result = await execute(context({ projectDir, dispatched }));
      expect(result).toEqual({
        status: "done",
        message:
          "Watchdog refreshed nonterminal Azure DevOps wait check(s): wait-running-ado-run-123456789-result.",
      });

      const tree = JSON.parse(
        await readFile(
          join(projectDir, ".state", "tasks", "tree.json"),
          "utf8",
        ),
      );
      const task = tree.tasks["wait-running-ado-run-123456789-result"];
      expect(Date.parse(task.blocker.next_check_at)).toBeLessThan(
        Date.parse(task.blocker.fallback_at),
      );
      expect(task.blocker.resume_at).toBe(task.blocker.next_check_at);
      expect(Date.parse(task.blocker.fallback_at)).toBeGreaterThan(
        Date.parse(initialFallbackAt),
      );
    } finally {
      setPipelineBackendForTests(null);
    }
  });

  test("escalates a nonterminal exact pipeline wait after its fallback expires", async () => {
    const projectDir = await makeProject();
    await writeTree(projectDir, {
      "wait-stalled-ado-run-123456789-result": task(
        "wait-stalled-ado-run-123456789-result",
        "blocked",
        {
          parent_id: "aks-feature-compact-loop",
          blocker: {
            condition: "Waiting for Azure DevOps run 123456789.",
            category: "external-wait",
            owner: "ado",
            waiting_for: {
              type: "ado.pipeline_run.completed",
              runId: "123456789",
            },
            next_check_at: "2001-01-01T00:00:00.000Z",
            fallback_at: "2001-01-02T00:00:00.000Z",
            fallback_action:
              "Inspect the queue because the run exceeded its fallback.",
          },
        },
      ),
    });
    setPipelineBackendForTests({
      resolve: () => ({ ok: true }),
      getRun: () => ({ status: "notStarted" }),
    });
    try {
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
      expect(dispatched[0]).toMatchObject({
        type: "project.owner.requested",
        payload: {
          reason: "watchdog-blocked-frontier-review",
          overdueOwnerActions: [
            { taskId: "wait-stalled-ado-run-123456789-result" },
          ],
        },
      });
    } finally {
      setPipelineBackendForTests(null);
    }
  });

  test("does not infer terminal Azure DevOps waits from prose-only run ids", async () => {
    const projectDir = await makeProject();
    await writeTree(projectDir, {
      "wait-prose-only-run": task("wait-prose-only-run", "blocked", {
        parent_id: "project",
        goal: "Wait for Azure DevOps run 123456789 to prove dev-infra-core.",
        blocker: {
          condition: "Azure DevOps run 123456789 is still running.",
          category: "external-wait",
        },
      }),
    });
    let pipelineReadCount = 0;
    setPipelineBackendForTests({
      resolve: () => ({ ok: true }),
      getRun: () => {
        pipelineReadCount += 1;
        return {
          status: "completed",
          conclusion: "failure",
          url: "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123456789",
        };
      },
    });
    try {
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
      expect(pipelineReadCount).toBe(0);
      const tree = JSON.parse(
        await readFile(
          join(projectDir, ".state", "tasks", "tree.json"),
          "utf8",
        ),
      );
      expect(tree.tasks["wait-prose-only-run"].state).toBe("blocked");
      expect(dispatched[0]).toMatchObject({
        type: "project.owner.requested",
        payload: {
          reason: "watchdog-blocked-frontier-review",
        },
      });
    } finally {
      setPipelineBackendForTests(null);
    }
  });

  test("does not re-harvest artifact-recovery waits as terminal pipeline waits", async () => {
    const projectDir = await makeProject();
    await writeTree(projectDir, {
      "wait-artifact-recovery": task("wait-artifact-recovery", "blocked", {
        parent_id: "feature-frontier",
        goal: "Preserve run 123456789 until authenticated Azure DevOps artifact recovery can classify the spec from returned files.",
        blocker: {
          condition:
            "Blocked on exact artifact recovery for ADO run 123456789: no downloaded artifact bundle is available.",
          category: "external-wait",
          owner: "ado",
          resume_condition:
            "Resume only when an auth-capable runtime can recover run 123456789 artifacts.",
          waiting_for: {
            type: "ado.pipeline_run.completed",
            runId: "123456789",
          },
        },
      }),
    });
    setPipelineBackendForTests({
      resolve: () => ({ ok: true }),
      getRun: () => ({
        status: "completed",
        conclusion: "success",
        url: "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123456789",
        displayTitle: "aks-e2e_staging_specs_123456789",
      }),
    });
    try {
      const result = await execute(context({ projectDir }));
      expect(result.status).toBe("done");
      expect(result.message).not.toContain(
        "Watchdog moved terminal Azure DevOps wait",
      );
      const tree = JSON.parse(
        await readFile(
          join(projectDir, ".state", "tasks", "tree.json"),
          "utf8",
        ),
      );
      const task = tree.tasks["wait-artifact-recovery"];
      expect(task.state).toBe("blocked");
      expect(task.context?.terminalPipelineWaitReview).toBeUndefined();
      expect(task.blocker).toMatchObject({
        owner: "ado",
      });
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

  test("skips capacity-underfilled wake when active work is the only non-blocked frontier and all blocked waits are future-dated exact waits", async () => {
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
          blocker: {
            condition: "Waiting for returned operator proof.",
            category: "external-wait",
            owner: "human",
            resume_condition:
              "Resume when proof lands or the follow-up window opens.",
            resume_at: "2099-06-26T00:40:00.000Z",
            next_check_at: "2099-06-26T00:40:00.000Z",
            fallback_at: "2099-06-27T00:00:00.000Z",
            fallback_action: "Recheck the operator ask.",
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
      context({ projectDir, stateDbPath, maxConcurrent: 3, dispatched }),
    );

    expect(result).toEqual({
      status: "done",
      message:
        "Watchdog skipped: 1 active task(s) still have running attempts, and the remaining frontier is entirely future-dated exact waits until 2099-06-26T00:40:00.000Z.",
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
          target: { project: "aks-rp-e2e" },
          reason: "watchdog-capacity-underfilled",
          maxConcurrent: 3,
          requested_by: "project-execution-watchdog",
        },
      },
    ]);
  });
});
