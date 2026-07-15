import { projectRuntimePaths, resolveTaskTreePath } from "@may-agent/sdk";
import { describe, expect, test } from "bun:test";
import { $ } from "bun";
import { Database } from "bun:sqlite";
import { createTestRuntime } from "@may-agent/sdk/testing";
import { rmSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "project-metrics.ts",
);

type TreeTask = {
  id?: string;
  parent_id?: string;
  state?: string;
  goal?: string;
  children?: string[];
  kind?: string;
  depends_on?: string[];
  outputs?: string[];
  acceptance?: string[];
  conflict_scope?: string[];
  workflow?: string;
  context?: Record<string, unknown>;
  trace?: Record<string, unknown>;
  blocker?: unknown;
};

async function makeFixture() {
  const root = await mkdtemp(join(tmpdir(), "aks-project-metrics-"));
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");
  const dbPath = join(root, "may.db");

  await mkdir(join(appDir, "tasks"), { recursive: true });
  await mkdir(join(appDir, ".state", "spec-loop"), { recursive: true });
  await mkdir(join(appDir, ".state", "tasks", "archive"), {
    recursive: true,
  });
  await mkdir(join(projectDir, "model", "knowledge-map"), { recursive: true });
  await mkdir(join(projectDir, "specs"), { recursive: true });
  await mkdir(join(projectDir, "replays"), { recursive: true });
  await mkdir(join(projectDir, "runs", "executions"), { recursive: true });

  await writeFile(
    join(projectDir, "model", "knowledge-map", "model.json"),
    `${JSON.stringify(
      {
        featurePaths: [
          { id: "path.feature-a.create", status: "unknown", terminal: false },
        ],
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    join(projectDir, "specs", "index.json"),
    `${JSON.stringify({ specs: [] }, null, 2)}\n`,
  );
  await writeFile(
    join(appDir, ".state", "spec-loop", "state.json"),
    `${JSON.stringify(
      {
        loopTaskId: "aks-spec-verification-loop",
        windowSize: 1,
        cursor: 0,
        prioritySpecIds: [],
        specs: {},
      },
      null,
      2,
    )}\n`,
  );

  return { root, appDir, projectDir, dbPath };
}

async function writeFeatureOwnedSpec(
  projectDir: string,
  spec: Record<string, unknown>,
) {
  const dir = join(projectDir, "features", "fixture", "specs");
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(
      dir,
      `${String(spec.id ?? "fixture").replace(/[^a-z0-9.-]+/gi, "-")}.json`,
    ),
    `${JSON.stringify(spec, null, 2)}\n`,
  );
}

async function writeTree(
  appDir: string,
  activeTask: Record<string, unknown>,
  extraTasks: Record<string, TreeTask> = {},
) {
  await writeFile(
    resolveTaskTreePath(appDir),
    `${JSON.stringify(
      {
        version: 1,
        project: "aks-rp-e2e",
        project_lifecycle: "active",
        root_task_id: "project",
        active_task_id: "active-task",
        active_task_ids: ["active-task"],
        tasks: {
          project: {
            id: "project",
            state: "active",
            children: ["active-task", ...Object.keys(extraTasks)],
          },
          "active-task": {
            id: "active-task",
            parent_id: "project",
            state: "active",
            children: [],
            goal: "Run a feature verification task.",
            outputs: ["evidence/archive/active-task.md"],
            acceptance: ["Complete the active task."],
            ...activeTask,
          },
          ...extraTasks,
        },
      },
      null,
      2,
    )}\n`,
  );
}

function writeSession(
  dbPath: string,
  row: {
    sessionId: string;
    status: string;
    outcome?: string | null;
    opCount?: number;
    startedAt?: number;
    lastActivityAt?: number | null;
    endedAt?: number | null;
    source?: string | null;
    task?: string | null;
  },
) {
  const db = new Database(dbPath);
  db.exec(`
    create table if not exists sessions (
      sessionId text primary key,
      status text not null,
      outcome text,
      opCount integer default 0,
      startedAt integer not null,
      lastActivityAt integer,
      endedAt integer,
      source text,
      task text
    )
  `);
  db.query("insert into sessions values (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    row.sessionId,
    row.status,
    row.outcome ?? null,
    row.opCount ?? 0,
    row.startedAt ?? Date.now(),
    row.lastActivityAt ?? null,
    row.endedAt ?? null,
    row.source ?? null,
    row.task ?? null,
  );
  db.close();
}

function writeProjectTaskPair(
  dbPath: string,
  input: {
    taskId: string;
    attemptId: string;
    status: "open" | "orphan" | "closed";
  },
) {
  const db = new Database(dbPath);
  db.exec(`
    create table if not exists event_pair_runs (
      id integer primary key autoincrement,
      pair_name text not null,
      correlation_key text not null,
      open_event_id integer not null,
      close_event_id integer,
      owner text,
      status text default 'open',
      opened_at integer not null,
      expected_close_at integer not null,
      closed_at integer,
      note text
    )
  `);
  db.query(
    `insert into event_pair_runs
     (pair_name, correlation_key, open_event_id, owner, status, opened_at, expected_close_at, note)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "project.task",
    `${input.taskId}:${input.attemptId}`,
    1,
    "project:aks-rp-e2e",
    input.status,
    Date.now() - 60_000,
    Date.now() + 60_000,
    "test pair",
  );
  db.close();
}

async function writeArchivedDoneTask(
  appDir: string,
  input: {
    taskId: string;
    attemptId: string;
    sessionId: string;
    resolution?: string;
  },
) {
  await writeFile(
    join(appDir, ".state", "tasks", "archive", "done-leaves-fixture.json"),
    `${JSON.stringify(
      {
        version: 1,
        generated_at: new Date().toISOString(),
        tasks: [
          {
            id: input.taskId,
            state: "done",
            status: "done",
            resolution: input.resolution ?? "completed",
            session_id: input.sessionId,
            trace: {
              current_attempt_id: input.attemptId,
              worker_started_attempt_id: input.attemptId,
              last_worker_result: "done",
              last_worker_claim: "done",
            },
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
}

function writeWorkflowRun(
  dbPath: string,
  input: {
    runId: string;
    workflow: string;
    status: "running" | "done" | "error";
    startedAt: number;
    task?: string;
    projectId?: string;
  },
) {
  const db = new Database(dbPath);
  db.exec(`
    create table if not exists workflow_runs (
      runId text primary key,
      workflow text not null,
      task text,
      status text not null,
      startedAt integer not null,
      endedAt integer,
      projectId text
    )
  `);
  db.query(
    "insert into workflow_runs (runId, workflow, task, status, startedAt, projectId) values (?, ?, ?, ?, ?, ?)",
  ).run(
    input.runId,
    input.workflow,
    input.task ?? null,
    input.status,
    input.startedAt,
    input.projectId ?? "aks-rp-e2e",
  );
  db.close();
}

async function metricValue(
  fixture: Awaited<ReturnType<typeof makeFixture>>,
  metricId: string,
  ...extraArgs: string[]
): Promise<string> {
  return (
    await $`bun ${scriptPath} ${metricId} ${extraArgs}`
      .env({
        ...process.env,
        AKS_RP_E2E_APP_DIR: fixture.appDir,
        PROJECT_DIR: fixture.projectDir,
        MAY_DB_PATH: fixture.dbPath,
        AKS_RP_E2E_STALE_ACTIVE_MS: "1000",
        AKS_RP_E2E_REVIEW_APPLY_GRACE_MS: "1000",
      })
      .quiet()
      .text()
  ).trim();
}

async function writeSpecLoopState(
  fixture: Awaited<ReturnType<typeof makeFixture>>,
  specs: Record<string, Record<string, unknown>>,
) {
  await writeFile(
    join(fixture.appDir, ".state", "spec-loop", "state.json"),
    `${JSON.stringify(
      {
        loopTaskId: "aks-spec-verification-loop",
        windowSize: 1,
        cursor: 0,
        prioritySpecIds: [],
        specs,
      },
      null,
      2,
    )}\n`,
  );
}

async function writeFeatureCompactLoopState(
  fixture: Awaited<ReturnType<typeof makeFixture>>,
  features: Record<string, Record<string, unknown>>,
) {
  await mkdir(join(fixture.appDir, ".state", "feature-compact-loop"), {
    recursive: true,
  });
  await writeFile(
    join(fixture.appDir, ".state", "feature-compact-loop", "state.json"),
    `${JSON.stringify(
      {
        features,
      },
      null,
      2,
    )}\n`,
  );
}

describe("project metrics", () => {
  test("detects active task whose session is no longer running", async () => {
    const fixture = await makeFixture();
    await writeTree(fixture.appDir, { session_id: "s_done" });
    writeSession(fixture.dbPath, {
      sessionId: "s_done",
      status: "done",
      startedAt: Date.now() - 10_000,
    });

    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-count"),
    ).toBe("1");
    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-with-gaps"),
    ).toBe("1");
    expect(
      await metricValue(fixture, "aks-rp-e2e.task.no-work-with-gaps"),
    ).toBe("1");
  });

  test("does not flag a newly assigned active task before the worker session starts", async () => {
    const fixture = await makeFixture();
    await writeTree(fixture.appDir, {
      session_id: "s_missing",
      trace: {
        assigned_at: new Date().toISOString(),
      },
    });

    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-count"),
    ).toBe("0");
    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-with-gaps"),
    ).toBe("0");
    expect(
      await metricValue(fixture, "aks-rp-e2e.task.no-work-with-gaps"),
    ).toBe("0");
  });

  test("treats running active task as healthy work", async () => {
    const fixture = await makeFixture();
    await writeTree(fixture.appDir, { session_id: "s_running" });
    writeSession(fixture.dbPath, {
      sessionId: "s_running",
      status: "running",
      opCount: 1,
      startedAt: Date.now() - 10_000,
      // This test invokes three metric subprocesses; keep the unrelated active
      // fixture out of the 1s stale-session threshold while they run.
      lastActivityAt: Date.now() + 60_000,
    });

    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-count"),
    ).toBe("0");
    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-with-gaps"),
    ).toBe("0");
    expect(
      await metricValue(fixture, "aks-rp-e2e.task.no-work-with-gaps"),
    ).toBe("0");
  });

  test("does not count a newly orphaned workflow run while it is still within the session-start grace window", async () => {
    const fixture = await makeFixture();
    const assignedAt = new Date(Date.now() - 120_000).toISOString();
    await writeTree(fixture.appDir, {
      session_id: "s_not_started_yet",
      trace: {
        assigned_at: assignedAt,
      },
    });
    writeWorkflowRun(fixture.dbPath, {
      runId: "wr_recent_orphan",
      workflow: "task-worker",
      status: "running",
      startedAt: Date.now() - 120_000,
    });

    const raw = await metricValue(
      fixture,
      "aks-rp-e2e.process.unowned-work-count",
      "--json",
    );
    const sample = JSON.parse(raw);
    const note = JSON.parse(sample.note);

    expect(sample.value).toBe(0);
    expect(note.staleWorkflowRuns).toEqual([]);
  });

  test("counts a running workflow row that never started a session after the session-start grace window expires", async () => {
    const fixture = await makeFixture();
    const assignedAt = new Date(Date.now() - 360_000).toISOString();
    await writeTree(fixture.appDir, {
      session_id: "s_not_started_yet",
      trace: {
        assigned_at: assignedAt,
      },
    });
    writeWorkflowRun(fixture.dbPath, {
      runId: "wr_orphan",
      workflow: "task-worker",
      status: "running",
      startedAt: Date.now() - 360_000,
    });

    const raw = await metricValue(
      fixture,
      "aks-rp-e2e.process.unowned-work-count",
      "--json",
    );
    const sample = JSON.parse(raw);
    const note = JSON.parse(sample.note);

    expect(sample.value).toBe(2);
    expect(note.staleWorkflowRuns).toEqual([
      {
        runId: "wr_orphan",
        workflow: "task-worker",
        restartReason: "workflow-no-session",
      },
    ]);
  });

  test("does not count task-worker workflow rows without sessions when the assigned feature-compact planner still has healthy loop ownership", async () => {
    const fixture = await makeFixture();
    const attemptId = "a_compact-feature-example_20260710151520";
    const assignedAt = new Date(Date.now() - 120_000).toISOString();
    await writeTree(fixture.appDir, {
      session_id: "s_task_compact-feature-example",
      workflow: "feature-compact-planner",
      context: {
        featureKey: "example",
      },
      trace: {
        current_attempt_id: attemptId,
        assigned_at: assignedAt,
      },
    });
    await writeFeatureCompactLoopState(fixture, {
      example: {
        status: "running",
        taskId: "active-task",
        activeAttemptId: attemptId,
        activeTaskSessionId: "s_task_compact-feature-example",
        activeWorkflowRunId: "28804755656",
        heartbeatAt: new Date().toISOString(),
      },
    });
    writeWorkflowRun(fixture.dbPath, {
      runId: "wr_compact",
      workflow: "task-worker",
      status: "running",
      startedAt: Date.now() - 120_000,
      task: [
        "app: /app/projects/aks-rp-e2e.app",
        "project: /app/projects/aks-rp-e2e",
        "source: /app/sources/aks-rp",
        "maxAttempts: 1",
        "maxConcurrent: 80",
        "",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "project.task.assigned",
          source: "agent:aks-explorer",
          owner: "project:aks-rp-e2e",
          target: { project: "aks-rp-e2e", taskId: "active-task" },
          data: {
            project: "aks-rp-e2e",
            taskId: "active-task",
            attemptId,
            sessionId: "s_task_compact-feature-example",
            worker: "aks-explorer",
            assignedAt,
          },
        }),
        "```",
      ].join("\n"),
    });

    const raw = await metricValue(
      fixture,
      "aks-rp-e2e.process.unowned-work-count",
      "--json",
    );
    const sample = JSON.parse(raw);
    const note = JSON.parse(sample.note);

    expect(sample.value).toBe(0);
    expect(note.staleWorkflowRuns).toEqual([]);
  });

  test("counts overdue blocked waits only when no active recovery references them", async () => {
    const overdueBlocker = {
      waiting_for: { type: "workflow.completed" },
      resume_condition: "Resume when the named workflow completes.",
      owner: "aks-explorer",
      resume_at: "2001-01-01T00:00:00.000Z",
      fallback_at: "2001-01-02T00:00:00.000Z",
      fallback_action: "Recheck the workflow and create recovery work.",
    };
    const futureFallbackPastResumeBlocker = {
      waiting_for: { type: "workflow.completed" },
      resume_condition: "Resume when the named workflow completes.",
      owner: "aks-explorer",
      resume_at: "2001-01-01T00:00:00.000Z",
      fallback_at: "2999-01-02T00:00:00.000Z",
      fallback_action: "Recheck the workflow and create recovery work.",
    };

    const unworked = await makeFixture();
    await writeTree(
      unworked.appDir,
      { goal: "Unrelated active work." },
      {
        "blocked-agent-wait": {
          id: "blocked-agent-wait",
          parent_id: "project",
          state: "blocked",
          children: [],
          goal: "Wait for workflow result.",
          blocker: overdueBlocker,
        },
      },
    );
    expect(
      await metricValue(
        unworked,
        "aks-rp-e2e.process.blocked.overdue-unworked-count",
      ),
    ).toBe("1");
    expect(
      await metricValue(
        unworked,
        "aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count",
      ),
    ).toBe("1");

    const proseOnlyRecovery = await makeFixture();
    await writeTree(
      proseOnlyRecovery.appDir,
      { goal: "Recover blocked-agent-wait by checking the workflow result." },
      {
        "blocked-agent-wait": {
          id: "blocked-agent-wait",
          parent_id: "project",
          state: "blocked",
          children: [],
          goal: "Wait for workflow result.",
          blocker: overdueBlocker,
        },
      },
    );
    expect(
      await metricValue(
        proseOnlyRecovery,
        "aks-rp-e2e.process.blocked.overdue-unworked-count",
      ),
    ).toBe("1");

    const humanOwned = await makeFixture();
    await writeTree(
      humanOwned.appDir,
      { goal: "Unrelated active work." },
      {
        "blocked-human-wait": {
          id: "blocked-human-wait",
          parent_id: "project",
          state: "blocked",
          children: [],
          goal: "Wait for human answer.",
          blocker: { ...overdueBlocker, owner: "human" },
        },
      },
    );
    expect(
      await metricValue(
        humanOwned,
        "aks-rp-e2e.process.blocked.overdue-unworked-count",
      ),
    ).toBe("1");
    expect(
      await metricValue(
        humanOwned,
        "aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count",
      ),
    ).toBe("1");

    const represented = await makeFixture();
    await writeTree(
      represented.appDir,
      {
        goal: "Recover blocked-agent-wait by checking the workflow result.",
        context: { blockedTaskIds: ["blocked-agent-wait"] },
      },
      {
        "blocked-agent-wait": {
          id: "blocked-agent-wait",
          parent_id: "project",
          state: "blocked",
          children: [],
          goal: "Wait for workflow result.",
          blocker: overdueBlocker,
        },
      },
    );
    expect(
      await metricValue(
        represented,
        "aks-rp-e2e.process.blocked.overdue-unworked-count",
      ),
    ).toBe("0");
    expect(
      await metricValue(
        represented,
        "aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count",
      ),
    ).toBe("0");

    const broadParentOnly = await makeFixture();
    await writeTree(
      broadParentOnly.appDir,
      {},
      {
        "aks-spec-verification-loop": {
          id: "aks-spec-verification-loop",
          parent_id: "project",
          state: "active",
          children: ["blocked-spec-wait"],
          goal: "Spec loop rollup mentions blocked-spec-wait but is not a recovery owner.",
        },
        "blocked-spec-wait": {
          id: "blocked-spec-wait",
          parent_id: "aks-spec-verification-loop",
          state: "blocked",
          children: [],
          goal: "Wait for stale external proof.",
          blocker: overdueBlocker,
        },
      },
    );
    expect(
      await metricValue(
        broadParentOnly,
        "aks-rp-e2e.process.blocked.overdue-unworked-count",
      ),
    ).toBe("1");
    expect(
      await metricValue(
        broadParentOnly,
        "aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count",
      ),
    ).toBe("1");

    const scopedAudit = await makeFixture();
    await writeTree(
      scopedAudit.appDir,
      {
        goal: "Audit overdue blocked waits under the spec loop.",
        conflict_scope: ["ops:blocked-overdue:spec-loop:20260708"],
      },
      {
        "aks-spec-verification-loop": {
          id: "aks-spec-verification-loop",
          parent_id: "project",
          state: "active",
          children: ["blocked-spec-wait"],
          goal: "Spec loop.",
        },
        "blocked-spec-wait": {
          id: "blocked-spec-wait",
          parent_id: "aks-spec-verification-loop",
          state: "blocked",
          children: [],
          goal: "Wait for stale external proof.",
          blocker: overdueBlocker,
        },
      },
    );
    expect(
      await metricValue(
        scopedAudit,
        "aks-rp-e2e.process.blocked.overdue-unworked-count",
      ),
    ).toBe("0");
    expect(
      await metricValue(
        scopedAudit,
        "aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count",
      ),
    ).toBe("0");

    const legacyScopedAudit = await makeFixture();
    await writeTree(
      legacyScopedAudit.appDir,
      {
        goal: "Audit overdue blocked waits under the spec loop.",
        conflict_scope: ["ops:spec-loop-overdue-blocked-frontier-batch"],
      },
      {
        "aks-spec-verification-loop": {
          id: "aks-spec-verification-loop",
          parent_id: "project",
          state: "active",
          children: ["blocked-spec-wait"],
          goal: "Spec loop.",
        },
        "blocked-spec-wait": {
          id: "blocked-spec-wait",
          parent_id: "aks-spec-verification-loop",
          state: "blocked",
          children: [],
          goal: "Wait for stale external proof.",
          blocker: overdueBlocker,
        },
        "aks-feature-compact-loop": {
          id: "aks-feature-compact-loop",
          parent_id: "project",
          state: "active",
          children: ["blocked-compact-wait"],
          goal: "Compact loop.",
        },
        "blocked-compact-wait": {
          id: "blocked-compact-wait",
          parent_id: "aks-feature-compact-loop",
          state: "blocked",
          children: [],
          goal: "Wait for stale compact proof.",
          blocker: overdueBlocker,
        },
      },
    );
    expect(
      await metricValue(
        legacyScopedAudit,
        "aks-rp-e2e.process.blocked.overdue-unworked-count",
        "--json",
      ).then((raw) => JSON.parse(raw)),
    ).toMatchObject({
      value: 1,
      sampleSize: 1,
    });

    const legacySpecVerificationAudit = await makeFixture();
    await writeTree(
      legacySpecVerificationAudit.appDir,
      {
        goal: "Audit overdue blocked waits under the spec loop.",
        conflict_scope: ["ops:spec-verification-overdue-frontier-batch"],
      },
      {
        "aks-spec-verification-loop": {
          id: "aks-spec-verification-loop",
          parent_id: "project",
          state: "active",
          children: ["blocked-spec-wait"],
          goal: "Spec loop.",
        },
        "blocked-spec-wait": {
          id: "blocked-spec-wait",
          parent_id: "aks-spec-verification-loop",
          state: "blocked",
          children: [],
          goal: "Wait for stale external proof.",
          blocker: overdueBlocker,
        },
      },
    );
    expect(
      await metricValue(
        legacySpecVerificationAudit,
        "aks-rp-e2e.process.blocked.overdue-unworked-count",
      ),
    ).toBe("0");

    const legacyCompactScopedAudit = await makeFixture();
    await writeTree(
      legacyCompactScopedAudit.appDir,
      {
        goal: "Audit overdue blocked waits under the compact loop.",
        conflict_scope: ["ops:compact-overdue-blocked-frontier-batch"],
      },
      {
        "aks-feature-compact-loop": {
          id: "aks-feature-compact-loop",
          parent_id: "project",
          state: "active",
          children: ["blocked-compact-wait"],
          goal: "Compact loop.",
        },
        "blocked-compact-wait": {
          id: "blocked-compact-wait",
          parent_id: "aks-feature-compact-loop",
          state: "blocked",
          children: [],
          goal: "Wait for stale compact proof.",
          blocker: overdueBlocker,
        },
      },
    );
    expect(
      await metricValue(
        legacyCompactScopedAudit,
        "aks-rp-e2e.process.blocked.overdue-unworked-count",
      ),
    ).toBe("0");

    const lineageScopedRecovery = await makeFixture();
    await writeTree(
      lineageScopedRecovery.appDir,
      {
        goal: "Repair the shared auth family.",
        conflict_scope: ["shared-authenticated-artifact-result-recovery-family-20260712"],
      },
      {
        "shared-auth-wait": {
          id: "shared-auth-wait",
          parent_id: "project",
          state: "blocked",
          children: [],
          goal: "Wait for shared auth recovery.",
          blocker: {
            ...overdueBlocker,
            waiting_for: {
              type: "project.approval.submitted",
              pathId: "shared-authenticated-artifact-result-recovery-family-20260712",
            },
          },
        },
      },
    );
    expect(
      await metricValue(
        lineageScopedRecovery,
        "aks-rp-e2e.process.blocked.overdue-unworked-count",
      ),
    ).toBe("0");

    const dueResumeWithFutureFallback = await makeFixture();
    await writeTree(
      dueResumeWithFutureFallback.appDir,
      { goal: "Unrelated active work." },
      {
        "blocked-agent-wait": {
          id: "blocked-agent-wait",
          parent_id: "project",
          state: "blocked",
          children: [],
          goal: "Wait for workflow result.",
          blocker: futureFallbackPastResumeBlocker,
        },
      },
    );
    expect(
      await metricValue(
        dueResumeWithFutureFallback,
        "aks-rp-e2e.process.blocked.overdue-unworked-count",
      ),
    ).toBe("1");
    expect(
      await metricValue(
        dueResumeWithFutureFallback,
        "aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count",
      ),
    ).toBe("1");
  });

  test("counts review decisions that were emitted but not applied to the live review task", async () => {
    const fixture = await makeFixture();
    const reviewedAt = new Date(Date.now() - 10_000).toISOString();
    await writeTree(fixture.appDir, {
      state: "review",
      trace: {
        current_attempt_id: "a_review_task_1",
      },
    });
    await writeFile(
      join(fixture.appDir, ".state", "task-reviewer-runs.jsonl"),
      `${JSON.stringify({
        ts: reviewedAt,
        workflow: "task-reviewer",
        result: "project.task.reviewed",
        task_id: "active-task",
        attempt_id: "a_review_task_1",
        decision: "redo",
      })}\n`,
    );

    const raw = await metricValue(
      fixture,
      "aks-rp-e2e.process.task.review-not-applied-count",
      "--json",
    );
    const sample = JSON.parse(raw);
    const note = JSON.parse(sample.note);

    expect(sample.value).toBe(1);
    expect(note.reviews).toEqual([
      {
        taskId: "active-task",
        attemptId: "a_review_task_1",
        decision: "redo",
        reviewedAt,
      },
    ]);
  });

  test("does not count stale review residue once a non-metric manual apply path explicitly references the reviewed task", async () => {
    const fixture = await makeFixture();
    const reviewedAt = new Date(Date.now() - 10_000).toISOString();
    await writeTree(fixture.appDir, {
      state: "review",
      trace: {
        current_attempt_id: "a_review_task_1",
      },
    });
    await writeFile(
      join(fixture.appDir, ".state", "task-reviewer-runs.jsonl"),
      `${JSON.stringify({
        ts: reviewedAt,
        workflow: "task-reviewer",
        result: "project.task.reviewed",
        task_id: "active-task",
        attempt_id: "a_review_task_1",
        decision: "accept",
      })}\n`,
    );
    await mkdir(join(fixture.appDir, ".state", "tasks", "archive"), {
      recursive: true,
    });
    await writeFile(
      join(
        fixture.appDir,
        ".state",
        "tasks",
        "archive",
        "done-leaves-fixture.json",
      ),
      `${JSON.stringify(
        {
          tasks: [
            {
              id: "ops-apply-reviewed-followup",
              state: "done",
              goal: "After active-task lands, reconcile the holder against the published reviewed slice so the apply path is exact.",
            },
            {
              id: "ops/repair-review-not-applied-fixture",
              state: "active",
              goal: "Ignore this metric-audit task; it should not suppress the contributor by itself.",
              conflict_scope: ["ops:review-not-applied-metric"],
            },
          ],
        },
        null,
        2,
      )}\n`,
    );

    const raw = await metricValue(
      fixture,
      "aks-rp-e2e.process.task.review-not-applied-count",
      "--json",
    );
    const sample = JSON.parse(raw);
    const note = JSON.parse(sample.note);

    expect(sample.value).toBe(0);
    expect(note.reviews).toEqual([]);
  });

  test("flags running active task with stale activity even after prior ops", async () => {
    const fixture = await makeFixture();
    await writeTree(fixture.appDir, { session_id: "s_stalled_after_ops" });
    writeSession(fixture.dbPath, {
      sessionId: "s_stalled_after_ops",
      status: "running",
      opCount: 40,
      startedAt: Date.now() - 10_000,
      lastActivityAt: Date.now() - 10_000,
    });

    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-count"),
    ).toBe("1");
    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-with-gaps"),
    ).toBe("1");
    expect(
      await metricValue(fixture, "aks-rp-e2e.task.no-work-with-gaps"),
    ).toBe("1");
  });

  test("treats synthetic s_task session ids as healthy when a matching worker session is running", async () => {
    const fixture = await makeFixture();
    await writeTree(fixture.appDir, { session_id: "s_task_active-task" });
    const db = new Database(fixture.dbPath);
    db.exec(`
      create table sessions (
        sessionId text primary key,
        status text not null,
        outcome text,
        opCount integer default 0,
        startedAt integer not null,
        lastActivityAt integer,
        endedAt integer,
        source text,
        task text
      )
    `);
    db.query("insert into sessions values (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      "s_real_worker",
      "running",
      null,
      1,
      Date.now() - 10_000,
      Date.now(),
      null,
      "workflow:task-worker",
      '{"data":{"taskId":"active-task"}}',
    );
    db.close();

    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-count"),
    ).toBe("0");
    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-with-gaps"),
    ).toBe("0");
  });

  test("ignores superseded retry worker session rows from the same task lineage when current task session and attempt moved on", async () => {
    const fixture = await makeFixture();
    const currentAttemptId =
      "a_domain_prepare-rp-operation-status-polling-same-lineage-proof-recipe-20260713_20260713013312";
    await writeTree(fixture.appDir, {
      session_id:
        "s_task_domain_prepare-rp-operation-status-polling-same-lineage-proof-recipe-20260713_retry_20260713013312",
      trace: {
        current_attempt_id: currentAttemptId,
        previous_attempt_id:
          "a_domain_prepare-rp-operation-status-polling-same-lineage-proof-recipe-20260713_20260713011607",
        stale_active_fresh_session: true,
        stale_active_requeued_at: "2026-07-13T01:32:22.616Z",
      },
    });
    const db = new Database(fixture.dbPath);
    db.exec(`
      create table sessions (
        sessionId text primary key,
        status text not null,
        outcome text,
        opCount integer default 0,
        startedAt integer not null,
        lastActivityAt integer,
        endedAt integer,
        source text,
        task text
      )
    `);
    db.query("insert into sessions values (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      "s_task_domain_prepare-rp-operation-status-polling-same-lineage-proof-recipe-20260713_retry_20260713011607",
      "running",
      null,
      1,
      Date.now() - 20_000,
      Date.now() - 20_000,
      null,
      "workflow:task-worker",
      [
        "Task Worker Mode",
        "taskId: active-task",
        "attemptId: a_domain_prepare-rp-operation-status-polling-same-lineage-proof-recipe-20260713_20260713011607",
        "sessionId: s_task_domain_prepare-rp-operation-status-polling-same-lineage-proof-recipe-20260713_retry_20260713011607",
      ].join("\n"),
    );
    db.query("insert into sessions values (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      "s_task_domain_prepare-rp-operation-status-polling-same-lineage-proof-recipe-20260713_retry_20260713013312",
      "done",
      "done",
      2,
      Date.now() - 10_000,
      Date.now() - 5_000,
      Date.now() - 5_000,
      "workflow:task-worker",
      [
        "Task Worker Mode",
        "taskId: active-task",
        `attemptId: ${currentAttemptId}`,
        "sessionId: s_task_domain_prepare-rp-operation-status-polling-same-lineage-proof-recipe-20260713_retry_20260713013312",
      ].join("\n"),
    );
    db.close();

    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-count"),
    ).toBe("1");
    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-with-gaps"),
    ).toBe("1");
  });

  test("treats synthetic s_task session ids as healthy when a matching feature-reference collector session is running", async () => {
    const fixture = await makeFixture();
    await writeTree(fixture.appDir, {
      session_id: "s_task_collect-feature-reference-aad-rbac",
      context: { featureKey: "aad-rbac" },
    });
    const db = new Database(fixture.dbPath);
    db.exec(`
      create table sessions (
        sessionId text primary key,
        status text not null,
        outcome text,
        opCount integer default 0,
        startedAt integer not null,
        lastActivityAt integer,
        source text,
        task text
      )
    `);
    db.query("insert into sessions values (?, ?, ?, ?, ?, ?, ?, ?)").run(
      "s_real_feature_reference",
      "running",
      null,
      1,
      Date.now() - 10_000,
      Date.now(),
      "workflow:feature-reference-collector",
      "Collect official references for feature aad-rbac.",
    );
    db.close();

    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-count"),
    ).toBe("0");
    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-with-gaps"),
    ).toBe("0");
  });

  test("treats active task with fresh GitHub run status as healthy when task session row is absent", async () => {
    const fixture = await makeFixture();
    await writeTree(fixture.appDir, { session_id: "s_task_active-task" });
    await mkdir(join(fixture.projectDir, "workspace", "active-task", "raw"), {
      recursive: true,
    });
    await writeFile(
      join(
        fixture.projectDir,
        "workspace",
        "active-task",
        "raw",
        "run-status-001.json",
      ),
      `${JSON.stringify(
        {
          json: {
            status: "in_progress",
            updated_at: new Date(Date.now() + 60_000).toISOString(),
            run_started_at: new Date(Date.now() + 60_000).toISOString(),
          },
        },
        null,
        2,
      )}\n`,
    );

    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-count"),
    ).toBe("0");
    expect(
      await metricValue(fixture, "aks-rp-e2e.task.no-work-with-gaps"),
    ).toBe("0");
  });

  test("still flags active task when the freshest GitHub run is terminal", async () => {
    const fixture = await makeFixture();
    await writeTree(fixture.appDir, { session_id: "s_task_active-task" });
    await mkdir(join(fixture.projectDir, "workspace", "active-task", "raw"), {
      recursive: true,
    });
    await writeFile(
      join(
        fixture.projectDir,
        "workspace",
        "active-task",
        "raw",
        "run-status-001.json",
      ),
      `${JSON.stringify(
        {
          json: {
            status: "completed",
            updated_at: new Date().toISOString(),
            run_started_at: new Date().toISOString(),
          },
        },
        null,
        2,
      )}\n`,
    );

    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-count"),
    ).toBe("1");
    expect(
      await metricValue(fixture, "aks-rp-e2e.task.no-work-with-gaps"),
    ).toBe("1");
  });

  test("still flags active task when GitHub run status is too old", async () => {
    const fixture = await makeFixture();
    await writeTree(fixture.appDir, { session_id: "s_task_active-task" });
    await mkdir(join(fixture.projectDir, "workspace", "active-task", "raw"), {
      recursive: true,
    });
    await writeFile(
      join(
        fixture.projectDir,
        "workspace",
        "active-task",
        "raw",
        "run-status-001.json",
      ),
      `${JSON.stringify(
        {
          json: {
            status: "in_progress",
            updated_at: new Date(Date.now() - 10_000).toISOString(),
            run_started_at: new Date(Date.now() - 10_000).toISOString(),
          },
        },
        null,
        2,
      )}\n`,
    );

    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-count"),
    ).toBe("1");
    expect(
      await metricValue(fixture, "aks-rp-e2e.task.no-work-with-gaps"),
    ).toBe("1");
  });

  test("treats single-spec verifier task as healthy when spec-loop heartbeat is fresh", async () => {
    const fixture = await makeFixture();
    const attemptId = "a_verify-spec-example_20260628164011";
    await writeTree(fixture.appDir, {
      session_id: "s_task_verify-spec-example",
      workflow: "single-spec-verifier",
      trace: {
        current_attempt_id: attemptId,
      },
    });
    await writeSpecLoopState(fixture, {
      "spec.example": {
        status: "running",
        taskId: "active-task",
        attempts: 1,
        lastRunId: null,
        lastResultPath: null,
        lastPrUrl: null,
        updatedAt: new Date().toISOString(),
        activeAttemptId: attemptId,
        activeTaskSessionId: "s_task_verify-spec-example",
        heartbeatAt: new Date().toISOString(),
      },
    });

    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-count"),
    ).toBe("0");
    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-with-gaps"),
    ).toBe("0");
  });

  test("flags single-spec verifier task when spec-loop heartbeat is stale", async () => {
    const fixture = await makeFixture();
    const attemptId = "a_verify-spec-example_20260628164011";
    await writeTree(fixture.appDir, {
      session_id: "s_task_verify-spec-example",
      workflow: "single-spec-verifier",
      trace: {
        current_attempt_id: attemptId,
      },
    });
    await writeSpecLoopState(fixture, {
      "spec.example": {
        status: "running",
        taskId: "active-task",
        attempts: 1,
        lastRunId: null,
        lastResultPath: null,
        lastPrUrl: null,
        updatedAt: new Date().toISOString(),
        activeAttemptId: attemptId,
        activeTaskSessionId: "s_task_verify-spec-example",
        heartbeatAt: new Date(Date.now() - 10_000).toISOString(),
      },
    });

    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-count"),
    ).toBe("1");
    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-with-gaps"),
    ).toBe("1");
  });

  test("treats single-spec verifier task as healthy when heartbeat is fresh even after task session handoff", async () => {
    const fixture = await makeFixture();
    const attemptId = "a_verify-spec-example_20260628164011";
    await writeTree(fixture.appDir, {
      session_id: "s_task_verify-spec-example-new",
      workflow: "single-spec-verifier",
      trace: {
        current_attempt_id: attemptId,
      },
    });
    await writeSpecLoopState(fixture, {
      "spec.example": {
        status: "running",
        taskId: "active-task",
        attempts: 1,
        lastRunId: null,
        lastResultPath: null,
        lastPrUrl: null,
        updatedAt: new Date().toISOString(),
        activeAttemptId: attemptId,
        activeTaskSessionId: null,
        activeWorkflowRunId: "123456",
        heartbeatAt: new Date().toISOString(),
      },
    });

    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-count"),
    ).toBe("0");
    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-with-gaps"),
    ).toBe("0");
  });

  test("treats feature-compact planner task as healthy when compact-loop heartbeat is fresh even after task session handoff", async () => {
    const fixture = await makeFixture();
    const attemptId = "a_compact-feature-example_20260706160014";
    await writeTree(fixture.appDir, {
      session_id: "s_task_compact-feature-example",
      workflow: "feature-compact-planner",
      context: {
        featureKey: "example",
      },
      trace: {
        current_attempt_id: attemptId,
      },
    });
    await writeFeatureCompactLoopState(fixture, {
      example: {
        status: "running",
        taskId: "active-task",
        activeAttemptId: attemptId,
        activeTaskSessionId: "s_task_compact-feature-example",
        activeWorkflowRunId: "28804755656",
        heartbeatAt: new Date().toISOString(),
      },
    });

    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-count"),
    ).toBe("0");
    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-with-gaps"),
    ).toBe("0");
  });

  test("treats feature-compact planner task as healthy when compact-loop run is active even if heartbeat is slightly stale", async () => {
    const fixture = await makeFixture();
    const attemptId = "a_compact-feature-example_20260706160014";
    await writeTree(fixture.appDir, {
      session_id: "s_task_compact-feature-example",
      workflow: "feature-compact-planner",
      context: {
        featureKey: "example",
      },
      trace: {
        current_attempt_id: attemptId,
      },
    });
    await writeFeatureCompactLoopState(fixture, {
      example: {
        status: "running",
        taskId: "active-task",
        activeAttemptId: attemptId,
        activeTaskSessionId: "s_task_compact-feature-example",
        activeWorkflowRunId: "28804755656",
        heartbeatAt: new Date(Date.now() - 2_000).toISOString(),
      },
    });

    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-count"),
    ).toBe("0");
    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-with-gaps"),
    ).toBe("0");
  });

  test("counts feature-compact planner task as stale when compact-loop has no heartbeat or active run", async () => {
    const fixture = await makeFixture();
    const attemptId = "a_compact-feature-example_20260706160014";
    await writeTree(fixture.appDir, {
      session_id: "s_task_compact-feature-example",
      workflow: "feature-compact-planner",
      context: {
        featureKey: "example",
      },
      trace: {
        current_attempt_id: attemptId,
      },
    });
    await writeFeatureCompactLoopState(fixture, {
      example: {
        status: "running",
        taskId: "active-task",
        activeAttemptId: attemptId,
        activeTaskSessionId: "s_task_compact-feature-example",
        activeWorkflowRunId: null,
        heartbeatAt: new Date(Date.now() - 2_000).toISOString(),
      },
    });

    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-count"),
    ).toBe("1");
    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-with-gaps"),
    ).toBe("1");
  });

  test("counts unfinished loop records that have no active recovery owner", async () => {
    const fixture = await makeFixture();
    await writeTree(
      fixture.appDir,
      { session_id: "s_running" },
      {
        "aks-spec-verification-loop": {
          id: "aks-spec-verification-loop",
          parent_id: "project",
          state: "backlog",
          workflow: "spec-loop-controller",
          children: [],
          goal: "Keep spec verification moving.",
          context: { maxDirectAttemptsPerSpec: 3 },
        },
      },
    );
    writeSession(fixture.dbPath, {
      sessionId: "s_running",
      status: "running",
      opCount: 1,
      startedAt: Date.now() - 10_000,
      lastActivityAt: Date.now(),
    });
    await writeSpecLoopState(fixture, {
      "spec.network-acns.retina-basic": {
        status: "pending",
        attempts: 3,
        lastRunUrl: "https://example.test/runs/123",
        taskId: null,
        updatedAt: new Date().toISOString(),
      },
    });

    expect(
      await metricValue(fixture, "aks-rp-e2e.spec.retry-exhausted-count"),
    ).toBe("1");
    expect(
      await metricValue(fixture, "aks-rp-e2e.spec.recovery-unowned-count"),
    ).toBe("1");
    expect(
      await metricValue(fixture, "aks-rp-e2e.process.unowned-work-count"),
    ).toBe("1");
  });

  test("does not count retry-drained loop records when an open recovery task owns the group", async () => {
    const fixture = await makeFixture();
    await writeTree(
      fixture.appDir,
      { session_id: "s_running" },
      {
        "aks-spec-verification-loop": {
          id: "aks-spec-verification-loop",
          parent_id: "project",
          state: "backlog",
          workflow: "spec-loop-controller",
          children: ["reconcile-spec-loop-pending-network-acns"],
          goal: "Keep spec verification moving.",
          context: { maxDirectAttemptsPerSpec: 3 },
        },
        "reconcile-spec-loop-pending-network-acns": {
          id: "reconcile-spec-loop-pending-network-acns",
          parent_id: "aks-spec-verification-loop",
          state: "backlog",
          children: [],
          goal: "Recover retry-drained network-acns specs.",
          conflict_scope: ["spec-loop-followup:pending:network-acns"],
          context: {
            specLoopFollowup: true,
            status: "pending",
            featureFamily: "network-acns",
          },
        },
      },
    );
    writeSession(fixture.dbPath, {
      sessionId: "s_running",
      status: "running",
      opCount: 1,
      startedAt: Date.now() - 10_000,
      lastActivityAt: Date.now(),
    });
    await writeSpecLoopState(fixture, {
      "spec.network-acns.retina-basic": {
        status: "pending",
        attempts: 3,
        lastRunUrl: "https://example.test/runs/123",
        taskId: null,
        updatedAt: new Date().toISOString(),
      },
    });

    expect(
      await metricValue(fixture, "aks-rp-e2e.spec.retry-exhausted-count"),
    ).toBe("1");
    expect(
      await metricValue(fixture, "aks-rp-e2e.spec.recovery-unowned-count"),
    ).toBe("0");
    expect(
      await metricValue(fixture, "aks-rp-e2e.process.unowned-work-count"),
    ).toBe("0");
  });

  test("does not count retry-drained loop records when an exact holder owns the spec", async () => {
    const fixture = await makeFixture();
    await writeTree(
      fixture.appDir,
      { session_id: "s_running" },
      {
        "aks-spec-verification-loop": {
          id: "aks-spec-verification-loop",
          parent_id: "project",
          state: "backlog",
          workflow: "spec-loop-controller",
          children: ["wait-network-acns-retina-basic"],
          goal: "Keep spec verification moving.",
          context: { maxDirectAttemptsPerSpec: 3 },
        },
        "wait-network-acns-retina-basic": {
          id: "wait-network-acns-retina-basic",
          parent_id: "aks-spec-verification-loop",
          state: "blocked",
          children: [],
          goal: "Wait for the exact network-acns resume signal.",
          conflict_scope: ["feature:network-acns"],
          blocker: {
            category: "external-wait",
            condition: "same-run artifacts are not available yet",
          },
        },
      },
    );
    writeSession(fixture.dbPath, {
      sessionId: "s_running",
      status: "running",
      opCount: 1,
      startedAt: Date.now() - 10_000,
      // This test invokes three metric subprocesses; keep the unrelated active
      // fixture out of the 1s stale-session threshold while they run.
      lastActivityAt: Date.now() + 60_000,
    });
    await writeSpecLoopState(fixture, {
      "spec.network-acns.retina-basic": {
        status: "pending",
        attempts: 3,
        lastRunUrl: "https://example.test/runs/123",
        taskId: "wait-network-acns-retina-basic",
        successorDisposition: "same-run-review-wait",
        resumeCondition: "resume when exact same-run artifacts are available",
        review: {
          classification: "same_run_review_wait",
          reviewedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      },
    });

    expect(
      await metricValue(fixture, "aks-rp-e2e.spec.retry-exhausted-count"),
    ).toBe("1");
    expect(
      await metricValue(fixture, "aks-rp-e2e.spec.recovery-unowned-count"),
    ).toBe("0");
    expect(
      await metricValue(fixture, "aks-rp-e2e.process.unowned-work-count"),
    ).toBe("0");
  });

  test("does not count retry-drained loop records when an active repair task names the exact spec", async () => {
    const fixture = await makeFixture();
    await writeTree(
      fixture.appDir,
      { session_id: "s_running" },
      {
        "aks-spec-verification-loop": {
          id: "aks-spec-verification-loop",
          parent_id: "project",
          state: "backlog",
          workflow: "spec-loop-controller",
          children: ["retry-node-ephemeral-no-mounted-source"],
          goal: "Keep spec verification moving.",
          context: { maxDirectAttemptsPerSpec: 3 },
        },
        "retry-node-ephemeral-no-mounted-source": {
          id: "retry-node-ephemeral-no-mounted-source",
          parent_id: "aks-spec-verification-loop",
          state: "active",
          session_id: "s_running",
          children: [],
          goal: "Repair spec.node-ephemeral-disk.auto-resource-placement so it no longer depends on mounted private source.",
          conflict_scope: ["spec-loop-policy:node-ephemeral-disk"],
        },
      },
    );
    writeSession(fixture.dbPath, {
      sessionId: "s_running",
      status: "running",
      opCount: 1,
      startedAt: Date.now() - 10_000,
      lastActivityAt: Date.now(),
    });
    await writeSpecLoopState(fixture, {
      "spec.node-ephemeral-disk.auto-resource-placement": {
        status: "error",
        attempts: 3,
        lastRunUrl: null,
        taskId: null,
        updatedAt: new Date().toISOString(),
      },
    });

    expect(
      await metricValue(fixture, "aks-rp-e2e.spec.retry-exhausted-count"),
    ).toBe("1");
    expect(
      await metricValue(fixture, "aks-rp-e2e.spec.recovery-unowned-count"),
    ).toBe("0");
    expect(
      await metricValue(fixture, "aks-rp-e2e.process.unowned-work-count"),
    ).toBe("0");
  });

  test("remaps stale spec-loop holder task ids to the surviving exact blocked owner for the same family", async () => {
    const fixture = await makeFixture();
    await writeTree(
      fixture.appDir,
      { session_id: "s_running" },
      {
        "aks-spec-verification-loop": {
          id: "aks-spec-verification-loop",
          parent_id: "project",
          state: "backlog",
          workflow: "spec-loop-controller",
          children: [
            "hold-spec-loop-pending-bootstrap-profile-byo-acr-contradiction-20260704",
          ],
          goal: "Keep spec verification moving.",
          context: { maxDirectAttemptsPerSpec: 3 },
        },
        "hold-spec-loop-pending-bootstrap-profile-byo-acr-contradiction-20260704":
          {
            id: "hold-spec-loop-pending-bootstrap-profile-byo-acr-contradiction-20260704",
            parent_id: "aks-spec-verification-loop",
            state: "blocked",
            children: [],
            goal: "Hold the bootstrap-profile-byo-acr family on the surviving contradiction-to-timeout frontier.",
            conflict_scope: [
              "spec-loop-followup:pending:bootstrap-profile-byo-acr",
              "feature:bootstrap-profile-byo-acr",
            ],
            blocker: {
              category: "external-wait",
              condition:
                "Blocked on the contradiction-to-timeout family for spec.bootstrap-profile-byo-acr.cache-direct-cache-switch.",
              waiting_for: {
                type: "github.workflow_run.completed",
                runId: "28666029233",
                taskId:
                  "hold-spec-loop-pending-bootstrap-profile-byo-acr-contradiction-20260704",
              },
              resume_condition:
                "Resume only when same-family evidence changes the contradiction-to-timeout frontier.",
            },
          },
      },
    );
    writeSession(fixture.dbPath, {
      sessionId: "s_running",
      status: "running",
      opCount: 1,
      startedAt: Date.now() - 10_000,
      lastActivityAt: Date.now(),
    });
    await writeSpecLoopState(fixture, {
      "spec.bootstrap-profile-byo-acr.cache-direct-cache-switch": {
        status: "pending",
        attempts: 3,
        lastRunId: "28654790934",
        lastRunUrl: "https://example.test/runs/28654790934",
        lastResultPath:
          "/tmp/feature-compact-bootstrap-profile/tests/bootstrap-profile-byo-acr-cache-direct-cache-switch.json",
        taskId:
          "hold-spec-bootstrap-profile-byo-acr-contradiction-timeout-frontier-20260707g",
        successorDisposition:
          "reviewed-exception-contradiction-to-timeout-family",
        successorRunId: "28666029233",
        successorRunUrl: "https://example.test/runs/28666029233",
        successorResultPath:
          "/tmp/feature-compact-bootstrap-profile/tests/bootstrap-profile-byo-acr-cache-direct-cache-switch.json",
        resumeCondition:
          "Resume only when same-family evidence changes the contradiction-to-timeout frontier.",
        review: {
          classification:
            "authoritative_source_vs_live_behavior_contradiction_then_timeout_family",
          pendingReviewTaskId:
            "hold-spec-bootstrap-profile-byo-acr-contradiction-timeout-frontier-20260707g",
          reviewedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      },
    });

    expect(
      await metricValue(fixture, "aks-rp-e2e.spec.retry-exhausted-count"),
    ).toBe("1");
    expect(
      await metricValue(fixture, "aks-rp-e2e.spec.recovery-unowned-count"),
    ).toBe("0");
    const unowned = JSON.parse(
      await metricValue(
        fixture,
        "aks-rp-e2e.process.unowned-work-count",
        "--json",
      ),
    ) as { value: number; note?: string };
    expect(unowned.value).toBe(0);
    const note = JSON.parse(unowned.note ?? "{}") as {
      recoveryUnownedSpecIds?: string[];
    };
    expect(note.recoveryUnownedSpecIds ?? []).not.toContain(
      "spec.bootstrap-profile-byo-acr.cache-direct-cache-switch",
    );
  });

  test("counts only blocked model paths that still lack a terminal or exact-wait disposition", async () => {
    const fixture = await makeFixture();
    await writeFile(
      join(fixture.projectDir, "model", "knowledge-map", "model.json"),
      `${JSON.stringify(
        {
          featurePaths: [
            { id: "path.actionable", status: "blocked" },
            {
              id: "path.resume-wait",
              status: "blocked",
              resumeCondition: "resume when exact source returns",
            },
            {
              id: "path.retest-wait",
              status: "blocked",
              retestCondition: "retry only after staging image changes",
            },
            { id: "path.terminal-flag", status: "blocked", terminal: true },
            {
              id: "path.terminal-remediation",
              status: "blocked",
              remediationStatus: "terminal",
            },
            {
              id: "path.awaiting-external",
              status: "blocked",
              remediationStatus: "awaiting-external",
            },
            { id: "path.blocked-infra", status: "blocked-infra" },
            { id: "path.pass", status: "pass" },
          ],
        },
        null,
        2,
      )}\n`,
    );

    expect(
      await metricValue(fixture, "aks-rp-e2e.model.blocked-path-count"),
    ).toBe("1");
  });

  test("counts project repo changes that have not been committed and pushed", async () => {
    const fixture = await makeFixture();
    await $`git init`.cwd(fixture.projectDir).quiet();

    expect(
      Number(
        await metricValue(
          fixture,
          "aks-rp-e2e.process.unpublished-change-count",
        ),
      ),
    ).toBeGreaterThan(0);
  });

  test("counts task tree root integrity problems", async () => {
    const fixture = await makeFixture();
    await writeFile(
      resolveTaskTreePath(fixture.appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: [],
            },
            "extra-root": {
              id: "extra-root",
              parent_id: "project",
              state: "done",
              children: [],
              goal: "legacy detached root",
            },
          },
        },
        null,
        2,
      )}\n`,
    );

    expect(
      await metricValue(
        fixture,
        "aks-rp-e2e.process.integrity.task-tree-problem-count",
      ),
    ).toBe("1");
  });

  test("counts open assignment pairs when the task is no longer active", async () => {
    const fixture = await makeFixture();
    await writeTree(
      fixture.appDir,
      { session_id: "s_running" },
      {
        "already-done": {
          id: "already-done",
          parent_id: "project",
          state: "done",
          children: [],
          goal: "Task was closed by owner cleanup before assignment pair closed.",
          outputs: [],
          acceptance: [],
          trace: {
            current_attempt_id: "attempt-1",
            worker_started_attempt_id: "attempt-1",
          },
        },
      },
    );
    writeSession(fixture.dbPath, {
      sessionId: "s_running",
      status: "running",
      opCount: 1,
      startedAt: Date.now() - 10_000,
      lastActivityAt: Date.now(),
    });
    writeProjectTaskPair(fixture.dbPath, {
      taskId: "already-done",
      attemptId: "attempt-1",
      status: "orphan",
    });

    expect(
      await metricValue(
        fixture,
        "aks-rp-e2e.process.assignment-state-mismatch-count",
      ),
    ).toBe("1");
    expect(
      await metricValue(fixture, "aks-rp-e2e.process.unowned-work-count"),
    ).toBe("1");
    expect(
      await metricValue(
        fixture,
        "aks-rp-e2e.process.integrity.task-tree-problem-count",
      ),
    ).toBe("1");
  });

  test("emits exact mismatch contributor and task-worker session linkage in json mode", async () => {
    const fixture = await makeFixture();
    await writeTree(fixture.appDir, { session_id: "s_running" });
    writeSession(fixture.dbPath, {
      sessionId: "s_done",
      status: "done",
      outcome: "done",
      source: "workflow:task-worker",
      startedAt: Date.now() - 20_000,
      lastActivityAt: Date.now() - 15_000,
      endedAt: Date.now() - 15_000,
      task: '{"taskId":"missing-task"}\nAttempt: attempt-1',
    });
    writeProjectTaskPair(fixture.dbPath, {
      taskId: "missing-task",
      attemptId: "attempt-1",
      status: "orphan",
    });

    const parsed = JSON.parse(
      await metricValue(
        fixture,
        "aks-rp-e2e.process.assignment-state-mismatch-count",
        "--json",
      ),
    ) as {
      value: number;
      sampleSize?: number;
      measuredAt?: number;
      note?: string;
    };
    expect(parsed.value).toBe(1);
    expect(parsed.sampleSize).toBe(1);
    expect(typeof parsed.measuredAt).toBe("number");
    const note = JSON.parse(parsed.note ?? "{}") as {
      mismatches?: Array<{
        correlationKey: string;
        taskId: string;
        attemptId: string | null;
        taskState: string | null;
        reason: string;
        sessionId: string | null;
        sessionStatus: string | null;
        sessionOutcome: string | null;
      }>;
    };
    expect(note.mismatches).toEqual([
      expect.objectContaining({
        correlationKey: "missing-task:attempt-1",
        taskId: "missing-task",
        attemptId: "attempt-1",
        taskState: null,
        reason: "task-missing",
        sessionId: "s_done",
        sessionStatus: "done",
        sessionOutcome: "done",
      }),
    ]);
  });

  test("does not count archived done assignment pairs with a completed task-worker session as unowned mismatch work", async () => {
    const fixture = await makeFixture();
    await writeTree(fixture.appDir, { session_id: "s_running" });
    writeSession(fixture.dbPath, {
      sessionId: "s_running",
      status: "running",
      outcome: null,
      source: "workflow:task-worker",
      startedAt: Date.now() - 500,
      lastActivityAt: Date.now(),
      endedAt: null,
      task: '{"taskId":"active-task"}\nAttempt: active-attempt',
    });
    await writeArchivedDoneTask(fixture.appDir, {
      taskId: "archived-followup",
      attemptId: "attempt-1",
      sessionId: "s_done",
    });
    writeSession(fixture.dbPath, {
      sessionId: "s_done",
      status: "done",
      outcome: "done",
      source: "workflow:task-worker",
      startedAt: Date.now() - 20_000,
      lastActivityAt: Date.now() - 15_000,
      endedAt: Date.now() - 15_000,
      task: '{"taskId":"archived-followup"}\nAttempt: attempt-1',
    });
    writeProjectTaskPair(fixture.dbPath, {
      taskId: "archived-followup",
      attemptId: "attempt-1",
      status: "open",
    });

    const mismatch = JSON.parse(
      await metricValue(
        fixture,
        "aks-rp-e2e.process.assignment-state-mismatch-count",
        "--json",
      ),
    ) as {
      value: number;
      sampleSize?: number;
      note?: string;
    };
    expect(mismatch.value).toBe(0);
    expect(mismatch.sampleSize).toBe(0);
    expect(JSON.parse(mismatch.note ?? "{}")).toEqual({ mismatches: [] });

    const unowned = JSON.parse(
      await metricValue(
        fixture,
        "aks-rp-e2e.process.unowned-work-count",
        "--json",
      ),
    ) as {
      value: number;
      sampleSize?: number;
      note?: string;
    };
    expect(unowned.value).toBe(0);
    expect(unowned.sampleSize).toBe(0);
    expect(JSON.parse(unowned.note ?? "{}")).toEqual(
      expect.objectContaining({
        assignmentMismatchKeys: [],
        assignmentMismatchTasks: [],
      }),
    );
  });

  test("does not count focus observation prose as a task-tree integrity problem", async () => {
    const fixture = await makeFixture();
    await writeTree(
      fixture.appDir,
      { session_id: "s_running" },
      {
        "focus-owner-return-test": {
          id: "focus-owner-return-test",
          parent_id: "project",
          kind: "focus_plan",
          state: "blocked",
          children: [],
          goal: "Keep the owner-return lineage visible.",
          outputs: ["evidence/archive/focus-owner-return-test.md"],
          acceptance: ["Live holder set is current."],
          context: {
            progress_review: {
              evidence: [
                "2026-07-13T17:14:11.012Z the current live owner-return blocked-holder set is focus-owner-return-test, wait-rp-nodepool-multi-agentpool-runner-ado-run-172009175.",
              ],
            },
            observations: {
              linked_blocked_task_ids: [
                "focus-owner-return-test",
                "wait-rp-nodepool-multi-agentpool-runner-ado-run-172009175",
              ],
            },
          },
          blocker: {
            condition: "Waiting for exact owner-return decision.",
            category: "human-approval",
            owner: "human",
            blocked_at: "2026-07-13T17:14:11.012Z",
            waiting_for: {
              type: "project.approval.submitted",
              taskId: "focus-owner-return-test",
            },
            observed_by: {
              workflow: "project-planner",
              trigger: "project.approval.submitted",
            },
            observation_method: "Planner reconciles the returned approval.",
            next_check_at: "2026-07-14T01:14:11.012Z",
            resume_condition: "Resume when the owner responds.",
            fallback_at: "2026-07-14T13:14:11.012Z",
            fallback_action: "Refresh the same wait.",
          },
        },
      },
    );

    const tree = JSON.parse(
      await Bun.file(resolveTaskTreePath(fixture.appDir)).text(),
    );
    tree.tasks.project.context = {
      current_focus_proposal: {
        id: "focus-owner-return-test",
        reason:
          "The live owner-return holder set is now focus-owner-return-test, wait-rp-nodepool-multi-agentpool-runner-ado-run-172009175; the consumed wait should have been removed.",
      },
    };
    await writeFile(
      resolveTaskTreePath(fixture.appDir),
      `${JSON.stringify(tree, null, 2)}\n`,
    );

    expect(
      await metricValue(
        fixture,
        "aks-rp-e2e.process.integrity.task-tree-problem-count",
      ),
    ).toBe("0");
  });

  test("does not count freshly queued active assignments as unowned stale-active work", async () => {
    const fixture = await makeFixture();
    const assignedAt = new Date().toISOString();
    await writeTree(fixture.appDir, {
      session_id: "s_task_active-task",
      trace: {
        current_attempt_id: "a_active-task_1",
        assigned_at: assignedAt,
      },
    });
    await writeFile(
      join(fixture.appDir, ".state", "task-assignments.jsonl"),
      `${JSON.stringify({
        taskId: "active-task",
        task_id: "active-task",
        attemptId: "a_active-task_1",
        attempt_id: "a_active-task_1",
        sessionId: "s_task_active-task",
        session_id: "s_task_active-task",
        worker: "app-ops",
        assignedAt,
        assigned_at: assignedAt,
      })}\n`,
    );

    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-count"),
    ).toBe("0");
    expect(
      await metricValue(fixture, "aks-rp-e2e.process.unowned-work-count"),
    ).toBe("0");
    expect(
      await metricValue(
        fixture,
        "aks-rp-e2e.process.assignment.not-consumed-count",
      ),
    ).toBe("0");
  });

  test("does not count queued assignments that already have a running worker session", async () => {
    const fixture = await makeFixture();
    await writeTree(fixture.appDir, {
      session_id: "s_task_active-task",
      trace: {
        current_attempt_id: "a_active-task_1",
        assigned_at: "2026-07-03T12:05:00.000Z",
      },
    });
    await writeFile(
      join(fixture.appDir, ".state", "task-assignments.jsonl"),
      `${JSON.stringify({
        taskId: "active-task",
        task_id: "active-task",
        attemptId: "a_active-task_1",
        attempt_id: "a_active-task_1",
        sessionId: "s_task_active-task",
        session_id: "s_task_active-task",
        worker: "app-ops",
        assignedAt: "2026-07-03T12:05:00.000Z",
        assigned_at: "2026-07-03T12:05:00.000Z",
      })}\n`,
    );
    writeSession(fixture.dbPath, {
      sessionId: "s_task_active-task",
      status: "running",
      source: "workflow:task-worker",
      startedAt: Date.now() - 1_000,
      lastActivityAt: Date.now(),
    });

    expect(
      await metricValue(
        fixture,
        "aks-rp-e2e.process.assignment.not-consumed-count",
      ),
    ).toBe("0");
  });

  test("counts queued assignments that were not consumed after start grace", async () => {
    const fixture = await makeFixture();
    await writeTree(fixture.appDir, {
      session_id: "s_task_active-task",
      trace: {
        current_attempt_id: "a_active-task_1",
        assigned_at: "2026-07-03T12:05:00.000Z",
      },
    });
    await writeFile(
      join(fixture.appDir, ".state", "task-assignments.jsonl"),
      `${JSON.stringify({
        taskId: "active-task",
        task_id: "active-task",
        attemptId: "a_active-task_1",
        attempt_id: "a_active-task_1",
        sessionId: "s_task_active-task",
        session_id: "s_task_active-task",
        worker: "app-ops",
        assignedAt: "2026-07-03T12:05:00.000Z",
        assigned_at: "2026-07-03T12:05:00.000Z",
      })}\n`,
    );

    expect(
      await metricValue(
        fixture,
        "aks-rp-e2e.process.assignment.not-consumed-count",
      ),
    ).toBe("1");

    const parsed = JSON.parse(
      await metricValue(
        fixture,
        "aks-rp-e2e.process.assignment.not-consumed-count",
        "--json",
      ),
    );
    const note = JSON.parse(parsed.note);
    expect(note.assignments).toContainEqual(
      expect.objectContaining({
        taskId: "active-task",
        attemptId: "a_active-task_1",
        taskState: "active",
      }),
    );
  });

  test("emits contributor details for unowned-work-count in json mode and metrics-snapshot records them", async () => {
    const fixture = await makeFixture();
    await writeTree(
      fixture.appDir,
      { session_id: "s_done" },
      {
        "already-done": {
          id: "already-done",
          parent_id: "project",
          state: "done",
          children: [],
          goal: "Closed task with stale assignment pair.",
          outputs: [],
          acceptance: [],
          trace: {
            current_attempt_id: "attempt-1",
            worker_started_attempt_id: "attempt-1",
          },
        },
      },
    );
    writeSession(fixture.dbPath, {
      sessionId: "s_done",
      status: "done",
      startedAt: Date.now() - 10_000,
    });
    writeProjectTaskPair(fixture.dbPath, {
      taskId: "already-done",
      attemptId: "attempt-1",
      status: "orphan",
    });

    const parsed = JSON.parse(
      await metricValue(
        fixture,
        "aks-rp-e2e.process.unowned-work-count",
        "--json",
      ),
    ) as {
      value: number;
      sampleSize?: number;
      measuredAt?: number;
      note?: string;
    };
    expect(parsed.value).toBe(2);
    expect(parsed.sampleSize).toBe(2);
    expect(typeof parsed.measuredAt).toBe("number");
    const note = JSON.parse(parsed.note ?? "{}") as {
      staleActiveTaskIds?: string[];
      assignmentMismatchKeys?: string[];
      staleActiveTaskSessions?: Array<{
        taskId: string;
        restartReason: string;
      }>;
    };
    expect(note.staleActiveTaskIds).toContain("active-task");
    expect(note.assignmentMismatchKeys).toContain("already-done:attempt-1");
    expect(note.staleActiveTaskSessions?.[0]).toMatchObject({
      taskId: "active-task",
      restartReason: "session-not-running",
    });

    const root = await mkdtemp(join(tmpdir(), "metrics-snapshot-unowned-"));
    await mkdir(join(root, "agents"), { recursive: true });
    await mkdir(join(root, "shared"), { recursive: true });
    await mkdir(join(root, "projects"), { recursive: true });
    const runtime = createTestRuntime({
      root,
      persist: root,
      agents: join(root, "agents"),
      shared: join(root, "shared"),
      projects: join(root, "projects"),
      measuredBy: "metrics-snapshot",
    });
    const metricsDb = runtime.db;
    metricsDb.run(`CREATE TABLE IF NOT EXISTS metrics (
      id TEXT PRIMARY KEY,
      name TEXT,
      owner TEXT,
      type TEXT,
      current REAL,
      target REAL,
      threshold REAL,
      unit TEXT,
      priority TEXT,
      status TEXT,
      blocker TEXT,
      project TEXT,
      source TEXT,
      source_query TEXT,
      source_command TEXT,
      sensitivity REAL,
      measure_interval INTEGER,
      alert_op TEXT,
      speed TEXT,
      description TEXT,
      direction TEXT,
      config TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      closed_at INTEGER
    )`);
    metricsDb.run(`CREATE TABLE IF NOT EXISTS metric_snapshots (
      metric_id TEXT,
      value REAL,
      sample_size INTEGER,
      measured_at INTEGER,
      measured_by TEXT,
      note TEXT
    )`);
    metricsDb.run(`CREATE TABLE IF NOT EXISTS metric_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric_id TEXT,
      alert_type TEXT,
      message TEXT,
      resolved_at INTEGER,
      created_at INTEGER
    )`);
    metricsDb.run(`CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT,
      data TEXT,
      source TEXT,
      owner TEXT,
      timestamp INTEGER,
      status TEXT,
      handled_by TEXT,
      reason TEXT,
      sessionId TEXT
    )`);
    metricsDb.run(`CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      path TEXT,
      name TEXT,
      owner TEXT
    )`);
    metricsDb.run(
      `INSERT INTO metrics (
        id, name, owner, type, target, threshold, unit, priority, status, project,
        source, source_command, created_at, updated_at, alert_op, speed, description, config
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "aks-rp-e2e.process.unowned-work-count",
        "AKS RP E2E unfinished work without active owner",
        "aks-explorer",
        "gauge",
        0,
        0,
        "count",
        "P0",
        "active",
        "aks-rp-e2e",
        "source_command",
        `bun ${scriptPath} aks-rp-e2e.process.unowned-work-count --json`,
        Date.now(),
        Date.now(),
        ">",
        "fast",
        "test metric",
        JSON.stringify({ alert: { mode: "consecutive_failures", count: 1 } }),
      ],
    );

    const originalRoot = process.cwd();
    const previousEnv = {
      AKS_RP_E2E_APP_DIR: process.env.AKS_RP_E2E_APP_DIR,
      PROJECT_DIR: process.env.PROJECT_DIR,
      MAY_DB_PATH: process.env.MAY_DB_PATH,
      AKS_RP_E2E_STALE_ACTIVE_MS: process.env.AKS_RP_E2E_STALE_ACTIVE_MS,
    };
    process.chdir("/app");
    process.env.AKS_RP_E2E_APP_DIR = fixture.appDir;
    process.env.PROJECT_DIR = fixture.projectDir;
    process.env.MAY_DB_PATH = fixture.dbPath;
    process.env.AKS_RP_E2E_STALE_ACTIVE_MS = "1000";
    try {
      const { create } =
        await import("../../../agents/may/handlers/metrics-snapshot.ts");
      const handler = create({ sdk: runtime.sdk } as any, {} as any);
      await handler({ type: "trigger.metrics-snapshot" } as any);

      const snapshot = metricsDb
        .prepare(
          "SELECT value, sample_size, note FROM metric_snapshots WHERE metric_id = ? ORDER BY measured_at DESC LIMIT 1",
        )
        .get("aks-rp-e2e.process.unowned-work-count") as {
        value: number;
        sample_size: number | null;
        note: string | null;
      };
      expect(snapshot.value).toBe(2);
      expect(snapshot.sample_size).toBe(2);
      const snapshotNote = JSON.parse(snapshot.note ?? "{}") as {
        staleActiveTaskIds?: string[];
        assignmentMismatchKeys?: string[];
      };
      expect(snapshotNote.staleActiveTaskIds).toContain("active-task");
      expect(snapshotNote.assignmentMismatchKeys).toContain(
        "already-done:attempt-1",
      );
    } finally {
      process.chdir(originalRoot);
      for (const [key, value] of Object.entries(previousEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      runtime.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("ignores active focus-plan leaves in stale active metrics", async () => {
    const fixture = await makeFixture();
    await writeTree(
      fixture.appDir,
      {
        id: "focus-task",
        kind: "focus_plan",
        session_id: null,
      },
      {
        sibling: {
          id: "sibling",
          parent_id: "project",
          state: "blocked",
          children: [],
          goal: "blocked sibling",
          outputs: [],
          acceptance: [],
        },
      },
    );

    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-count"),
    ).toBe("0");
    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-with-gaps"),
    ).toBe("0");
  });

  test("treats completed task-worker task as stale after session ends", async () => {
    const fixture = await makeFixture();
    await writeTree(fixture.appDir, {
      session_id: "s_task_active-task",
      trace: {
        assigned_at: new Date(Date.now() - 360_000).toISOString(),
        worker_started_at: new Date(Date.now() - 350_000).toISOString(),
      },
    });
    const db = new Database(fixture.dbPath);
    db.exec(`
      create table sessions (
        sessionId text primary key,
        status text not null,
        outcome text,
        opCount integer default 0,
        startedAt integer not null,
        lastActivityAt integer,
        endedAt integer,
        source text,
        task text
      )
    `);
    db.query("insert into sessions values (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      "s_task_active-task",
      "done",
      null,
      5,
      Date.now() - 120_000,
      Date.now() - 90_000,
      Date.now() - 90_000,
      "workflow:task-worker",
      'Task Worker Mode\n\nAssigned task:\n```json\n{\n  "id": "active-task"\n}\n```',
    );
    db.close();

    expect(
      await metricValue(fixture, "aks-rp-e2e.task.stale-active-count"),
    ).toBe("1");
  });

  test("does not count blocked-dependent live backlog as runnable work", async () => {
    const fixture = await makeFixture();
    await writeFeatureOwnedSpec(fixture.projectDir, {
      id: "spec.live",
      status: "ready",
      specState: "ready",
    });
    await writeFile(
      join(fixture.projectDir, "replays", "probe-live.ts"),
      "export {};\n",
    );
    await writeTree(
      fixture.appDir,
      { session_id: "s_running" },
      {
        "blocked-auth": {
          id: "blocked-auth",
          parent_id: "project",
          state: "blocked",
          children: [],
          goal: "Wait for auth gate.",
          kind: "domain_leaf",
          outputs: ["evidence/archive/blocked-auth.md"],
          acceptance: ["Record the auth blocker."],
        },
        "live-backlog": {
          id: "live-backlog",
          parent_id: "project",
          state: "backlog",
          children: [],
          goal: "Run live staging execution once gate opens.",
          kind: "domain_leaf",
          depends_on: ["blocked-auth"],
          outputs: ["evidence/archive/live-backlog.md"],
          acceptance: ["Execute the live staging run once unblocked."],
        },
      },
    );
    writeSession(fixture.dbPath, {
      sessionId: "s_running",
      status: "running",
      opCount: 1,
      startedAt: Date.now() - 10_000,
      lastActivityAt: Date.now(),
    });

    expect(
      await metricValue(fixture, "aks-rp-e2e.run.live-idle-with-runnable-work"),
    ).toBe("0");
  });

  test("does not count conflict-waiting live backlog as runnable work", async () => {
    const fixture = await makeFixture();
    await writeFeatureOwnedSpec(fixture.projectDir, {
      id: "spec.live",
      status: "ready",
      specState: "ready",
    });
    await writeFile(
      join(fixture.projectDir, "replays", "probe-live.ts"),
      "export {};\n",
    );
    await writeTree(
      fixture.appDir,
      {
        session_id: "s_running",
        goal: "Active live carrier authoring task.",
        outputs: ["evidence/archive/active-live.md"],
        acceptance: ["Finish the active live carrier task."],
        conflict_scope: ["bundle:live"],
      },
      {
        "live-waiting": {
          id: "live-waiting",
          parent_id: "project",
          state: "backlog",
          children: [],
          goal: "Author the live execute-ready follow-on carrier.",
          kind: "domain_leaf",
          outputs: ["evidence/archive/live-waiting.md"],
          acceptance: ["Produce the live carrier authoring artifact."],
          conflict_scope: ["bundle:live"],
        },
      },
    );
    writeSession(fixture.dbPath, {
      sessionId: "s_running",
      status: "running",
      opCount: 1,
      startedAt: Date.now() - 10_000,
      lastActivityAt: Date.now(),
    });

    expect(
      await metricValue(fixture, "aks-rp-e2e.run.live-idle-with-runnable-work"),
    ).toBe("0");
  });

  test("counts truly runnable live backlog when task-tree semantics say it is runnable", async () => {
    const fixture = await makeFixture();
    await writeFeatureOwnedSpec(fixture.projectDir, {
      id: "spec.live",
      status: "ready",
      specState: "ready",
    });
    await writeFile(
      join(fixture.projectDir, "replays", "probe-live.ts"),
      "export {};\n",
    );
    await writeTree(
      fixture.appDir,
      { session_id: "s_running" },
      {
        "live-runnable": {
          id: "live-runnable",
          parent_id: "project",
          state: "backlog",
          children: [],
          goal: "Run live staging execution for the next ready branch.",
          kind: "domain_leaf",
          outputs: ["evidence/archive/live-runnable.md"],
          acceptance: ["Execute or author the next live branch artifact."],
        },
      },
    );
    writeSession(fixture.dbPath, {
      sessionId: "s_running",
      status: "running",
      opCount: 1,
      startedAt: Date.now() - 10_000,
      lastActivityAt: Date.now(),
    });

    expect(
      await metricValue(fixture, "aks-rp-e2e.run.live-idle-with-runnable-work"),
    ).toBe("1");
  });

  test("blocked task metric counts all blocked leaves, not the capped frontier display", async () => {
    const fixture = await makeFixture();
    const blockedTasks: Record<string, TreeTask> = {};
    for (let i = 0; i < 25; i++) {
      blockedTasks[`blocked-${i}`] = {
        id: `blocked-${i}`,
        parent_id: "project",
        state: "blocked",
        children: [],
        goal: `Blocked leaf ${i}.`,
        kind: "domain_leaf",
      };
    }
    await writeTree(fixture.appDir, { session_id: "s_running" }, blockedTasks);
    writeSession(fixture.dbPath, {
      sessionId: "s_running",
      status: "running",
      opCount: 1,
      startedAt: Date.now() - 10_000,
      lastActivityAt: Date.now(),
    });

    expect(await metricValue(fixture, "aks-rp-e2e.task.blocked-count")).toBe(
      "25",
    );
  });

  test("blocked actionable metric suppresses represented holders and reports planner warning families", async () => {
    const fixture = await makeFixture();
    await writeTree(
      fixture.appDir,
      { session_id: "s_running" },
      {
        "represented-frontier": {
          id: "represented-frontier",
          parent_id: "project",
          state: "blocked",
          children: [],
          goal: "Preserve one split-frontier holder represented by exact downstream carriers until one represented blocker materially changes.",
          kind: "domain_leaf",
          blocker:
            "This holder is represented by exact carriers and remains blocked only while the represented frontier is unchanged.",
        },
        "response-await-no-send": {
          id: "response-await-no-send",
          parent_id: "project",
          state: "blocked",
          children: [],
          goal: "Wait for owner/operator reply on the exact source-holder response while no durable proof-of-send exists yet.",
          kind: "domain_leaf",
          blocker:
            "Blocked pending owner/operator reply with no durable proof-of-send/handoff yet.",
        },
      },
    );
    writeSession(fixture.dbPath, {
      sessionId: "s_running",
      status: "running",
      opCount: 1,
      startedAt: Date.now() - 10_000,
      lastActivityAt: Date.now(),
    });

    const sample = JSON.parse(
      await metricValue(
        fixture,
        "aks-rp-e2e.task.blocked-actionable-count",
        "--json",
      ),
    ) as {
      value: number;
      sampleSize?: number;
      note?: string;
    };

    expect(sample.value).toBe(1);
    expect(sample.sampleSize).toBe(1);
    expect(JSON.parse(sample.note ?? "{}")).toMatchObject({
      blockedLeafCount: 2,
      durableExactHolderCount: 1,
      actionableWarningTaskIds: ["response-await-no-send"],
      repeatedBlockerGroupKeys: [],
      motionStarved: false,
      parentGroups: [
        {
          parentId: "project",
          blockedLeafCount: 2,
          sampleBlockedLeafIds: [
            "represented-frontier",
            "response-await-no-send",
          ],
        },
      ],
    });
  });

  test("blocked contract metrics flag parked blocked leaves without owner, resume, or fallback", async () => {
    const fixture = await makeFixture();
    const runtimePaths = projectRuntimePaths(fixture.appDir);
    await writeTree(
      fixture.appDir,
      { session_id: "s_running" },
      {
        "blocked-good": {
          id: "blocked-good",
          parent_id: "project",
          state: "blocked",
          children: [],
          goal: "Wait with a complete blocked contract.",
          kind: "domain_leaf",
          blocker: {
            condition: "Waiting for capacity.",
            owner: "operator",
            blocked_at: new Date().toISOString(),
            waiting_for: {
              type: "azure.capacity.available",
              target: "staging",
              resource: "managedClusters",
            },
            observed_by: {
              workflow: "feature-compact-loop-controller",
              trigger: "project.task.tick",
            },
            observation_method:
              "Recheck staging managed-cluster capacity on the next loop tick.",
            next_check_at: new Date(Date.now() + 60_000).toISOString(),
            resume_condition: "Resume when capacity returns.",
            fallback_at: new Date(Date.now() + 60_000).toISOString(),
            fallback_action: "Recheck capacity and escalate if still full.",
          },
        },
        "blocked-bad": {
          id: "blocked-bad",
          parent_id: "project",
          state: "blocked",
          children: [],
          goal: "Wait without enough structure.",
          kind: "domain_leaf",
          blocker: {
            condition: "Blocked.",
          },
        },
      },
    );
    writeSession(fixture.dbPath, {
      sessionId: "s_running",
      status: "running",
      opCount: 1,
      startedAt: Date.now() - 10_000,
      lastActivityAt: Date.now(),
    });

    expect(
      await metricValue(
        fixture,
        "aks-rp-e2e.process.blocked.missing-waiting-for-count",
      ),
    ).toBe("1");
    expect(
      await metricValue(
        fixture,
        "aks-rp-e2e.process.blocked.missing-observer-count",
      ),
    ).toBe("1");
    expect(
      await metricValue(
        fixture,
        "aks-rp-e2e.process.blocked.missing-resume-condition",
      ),
    ).toBe("1");
    expect(
      await metricValue(
        fixture,
        "aks-rp-e2e.process.blocked.missing-owner-count",
      ),
    ).toBe("1");
    expect(
      await metricValue(
        fixture,
        "aks-rp-e2e.process.blocked.missing-fallback-count",
      ),
    ).toBe("1");

    const waitingFor = JSON.parse(
      await metricValue(
        fixture,
        "aks-rp-e2e.process.blocked.missing-waiting-for-count",
        "--json",
      ),
    ) as { value: number; sampleSize?: number; note?: string };
    expect(waitingFor.value).toBe(1);
    expect(waitingFor.sampleSize).toBe(1);
    expect(JSON.parse(waitingFor.note ?? "{}")).toMatchObject({
      offenderTaskIds: ["blocked-bad"],
    });

    const observer = JSON.parse(
      await metricValue(
        fixture,
        "aks-rp-e2e.process.blocked.missing-observer-count",
        "--json",
      ),
    ) as {
      value: number;
      sampleSize?: number;
      note?: string;
      treePath?: string;
    };
    expect(observer.value).toBe(1);
    expect(observer.sampleSize).toBe(1);
    expect(observer.treePath).toBe(runtimePaths.taskTreePath);
    expect(observer.treePath?.endsWith(".state/tasks/tree.json")).toBe(true);
    expect(JSON.parse(observer.note ?? "{}")).toMatchObject({
      offenderTaskIds: ["blocked-bad"],
    });

    const fallback = JSON.parse(
      await metricValue(
        fixture,
        "aks-rp-e2e.process.blocked.missing-fallback-count",
        "--json",
      ),
    ) as { value: number; sampleSize?: number; note?: string };
    expect(fallback.value).toBe(1);
    expect(fallback.sampleSize).toBe(1);
    expect(JSON.parse(fallback.note ?? "{}")).toMatchObject({
      offenderTaskIds: ["blocked-bad"],
    });
  });

  test("blocked contract metrics ignore disconnected container-like records outside the runtime tree", async () => {
    const fixture = await makeFixture();
    await writeTree(
      fixture.appDir,
      { session_id: "s_running" },
      {
        "blocked-good": {
          id: "blocked-good",
          parent_id: "project",
          state: "blocked",
          children: [],
          goal: "Wait with a complete blocked contract.",
          kind: "domain_leaf",
          blocker: {
            condition: "Waiting for capacity.",
            owner: "operator",
            waiting_for: {
              type: "azure.capacity.available",
              target: "staging",
            },
            observed_by: {
              workflow: "feature-compact-loop-controller",
            },
            observation_method:
              "Recheck staging managed-cluster capacity on the next loop tick.",
            next_check_at: new Date(Date.now() + 60_000).toISOString(),
            resume_condition: "Resume when capacity returns.",
            fallback_at: new Date(Date.now() + 60_000).toISOString(),
            fallback_action: "Recheck capacity and escalate if still full.",
          },
        },
      },
    );
    const treePath = resolveTaskTreePath(fixture.appDir);
    const tree = JSON.parse(await Bun.file(treePath).text()) as {
      tasks: Record<string, TreeTask>;
    };
    tree.tasks["tasks/archive"] = {
      id: "tasks/archive",
      state: "blocked",
      children: [],
      blocker: {
        condition: "Generated archive container metadata, not a task blocker.",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`);

    const owner = JSON.parse(
      await metricValue(
        fixture,
        "aks-rp-e2e.process.blocked.missing-owner-count",
        "--json",
      ),
    ) as { value: number; sampleSize?: number; note?: string };
    expect(owner.value).toBe(0);
    expect(owner.sampleSize).toBe(0);
    expect(JSON.parse(owner.note ?? "{}")).toMatchObject({
      offenderTaskIds: [],
    });

    const observer = JSON.parse(
      await metricValue(
        fixture,
        "aks-rp-e2e.process.blocked.missing-observer-count",
        "--json",
      ),
    ) as { value: number; sampleSize?: number; note?: string };
    expect(observer.value).toBe(0);
    expect(observer.sampleSize).toBe(0);
    expect(JSON.parse(observer.note ?? "{}")).toMatchObject({
      offenderTaskIds: [],
    });

    const fallback = JSON.parse(
      await metricValue(
        fixture,
        "aks-rp-e2e.process.blocked.missing-fallback-count",
        "--json",
      ),
    ) as { value: number; sampleSize?: number; note?: string };
    expect(fallback.value).toBe(0);
    expect(fallback.sampleSize).toBe(0);
    expect(JSON.parse(fallback.note ?? "{}")).toMatchObject({
      offenderTaskIds: [],
    });
  });

  test("blocked missing-waiting-for metric stays at zero for exact run-return wait targets", async () => {
    const fixture = await makeFixture();
    await writeTree(
      fixture.appDir,
      { session_id: "s_running" },
      {
        "planner-ado-wait": {
          id: "planner-ado-wait",
          parent_id: "project",
          state: "blocked",
          children: [],
          goal: "Preserve the exact compact bootstrap-profile same-path wait until ADO run 171477458 returns artifacts.",
          kind: "domain_leaf",
          blocker: {
            condition:
              "Preserve the exact compact bootstrap-profile same-path wait until ADO run 171477458 returns artifacts for spec.bootstrap-profile-byo-acr.cache-direct-cache-switch.",
            category: "external-wait",
            owner: "aks-explorer",
            blocked_at: "2026-07-09T00:35:52.527Z",
            waiting_for: {
              type: "environment.available",
              taskId: "planner-ado-wait",
              sourceRunId: "171477458",
            },
            observed_by: {
              workflow: "project-planner",
              schedule: "blocked-frontier-app-ops-review",
              trigger: "project.owner.requested",
            },
            observation_method:
              "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
            next_check_at: "2026-07-09T00:45:52.527Z",
            resume_condition:
              "Resume only when run 171477458 returns accessible artifacts or proves an exact artifact-recovery blocker that changes the next action.",
            fallback_at: "2026-07-10T00:35:52.527Z",
            fallback_action:
              "If the wait is still true at fallback time, create or reuse an owner recovery/escalation task, or update the blocked wait with fresh evidence.",
          },
          trace: {
            created_at: "2026-07-09T00:35:52.527Z",
            created_by: "task-tree-tool",
            blocked_contract_seeded_at: "2026-07-09T00:35:52.527Z",
            blocked_contract_seeded_by: "project-planner",
          },
        },
      },
    );
    writeSession(fixture.dbPath, {
      sessionId: "s_running",
      status: "running",
      opCount: 1,
      startedAt: Date.now() - 10_000,
      lastActivityAt: Date.now(),
    });

    expect(
      await metricValue(
        fixture,
        "aks-rp-e2e.process.blocked.missing-waiting-for-count",
      ),
    ).toBe("0");

    const waitingFor = JSON.parse(
      await metricValue(
        fixture,
        "aks-rp-e2e.process.blocked.missing-waiting-for-count",
        "--json",
      ),
    ) as { value: number; sampleSize?: number; note?: string };
    expect(waitingFor.value).toBe(0);
    expect(waitingFor.sampleSize).toBe(0);
    expect(JSON.parse(waitingFor.note ?? "{}")).toMatchObject({
      offenderTaskIds: [],
    });
  });

  test("metrics-snapshot persists blocked metric offender ids from json sampler output", async () => {
    const fixture = await makeFixture();
    await writeTree(
      fixture.appDir,
      { session_id: "s_running" },
      {
        "blocked-bad": {
          id: "blocked-bad",
          parent_id: "project",
          state: "blocked",
          children: [],
          goal: "Wait without fallback.",
          kind: "domain_leaf",
          blocker: {
            condition: "Blocked.",
          },
        },
      },
    );
    writeSession(fixture.dbPath, {
      sessionId: "s_running",
      status: "running",
      opCount: 1,
      startedAt: Date.now() - 10_000,
      lastActivityAt: Date.now(),
    });

    const root = await mkdtemp(join(tmpdir(), "metrics-snapshot-blocked-"));
    await mkdir(join(root, "agents"), { recursive: true });
    await mkdir(join(root, "shared"), { recursive: true });
    await mkdir(join(root, "projects"), { recursive: true });
    const runtime = createTestRuntime({
      root,
      persist: root,
      agents: join(root, "agents"),
      shared: join(root, "shared"),
      projects: join(root, "projects"),
      measuredBy: "metrics-snapshot",
    });
    const metricsDb = runtime.db;
    metricsDb.run(`CREATE TABLE IF NOT EXISTS metrics (
      id TEXT PRIMARY KEY,
      name TEXT,
      owner TEXT,
      type TEXT,
      current REAL,
      target REAL,
      threshold REAL,
      unit TEXT,
      priority TEXT,
      status TEXT,
      blocker TEXT,
      project TEXT,
      source TEXT,
      source_query TEXT,
      source_command TEXT,
      sensitivity REAL,
      measure_interval INTEGER,
      alert_op TEXT,
      speed TEXT,
      description TEXT,
      direction TEXT,
      config TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      closed_at INTEGER
    )`);
    metricsDb.run(`CREATE TABLE IF NOT EXISTS metric_snapshots (
      metric_id TEXT,
      value REAL,
      sample_size INTEGER,
      measured_at INTEGER,
      measured_by TEXT,
      note TEXT
    )`);
    metricsDb.run(`CREATE TABLE IF NOT EXISTS metric_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric_id TEXT,
      alert_type TEXT,
      message TEXT,
      resolved_at INTEGER,
      created_at INTEGER
    )`);
    metricsDb.run(`CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT,
      data TEXT,
      source TEXT,
      owner TEXT,
      timestamp INTEGER,
      status TEXT,
      handled_by TEXT,
      reason TEXT,
      sessionId TEXT
    )`);
    metricsDb.run(`CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      path TEXT,
      name TEXT,
      owner TEXT
    )`);
    metricsDb.run(
      `INSERT INTO metrics (
        id, name, owner, type, target, threshold, unit, priority, status, project,
        source, source_command, created_at, updated_at, alert_op, speed, description, config
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "aks-rp-e2e.process.blocked.missing-fallback-count",
        "AKS RP E2E blocked tasks missing fallback",
        "aks-explorer",
        "gauge",
        0,
        0,
        "count",
        "P0",
        "active",
        "aks-rp-e2e",
        "source_command",
        `bun ${scriptPath} aks-rp-e2e.process.blocked.missing-fallback-count --json`,
        Date.now(),
        Date.now(),
        ">",
        "fast",
        "test metric",
        JSON.stringify({ alert: { mode: "consecutive_failures", count: 1 } }),
      ],
    );

    const originalRoot = process.cwd();
    const previousEnv = {
      AKS_RP_E2E_APP_DIR: process.env.AKS_RP_E2E_APP_DIR,
      PROJECT_DIR: process.env.PROJECT_DIR,
      MAY_DB_PATH: process.env.MAY_DB_PATH,
      AKS_RP_E2E_STALE_ACTIVE_MS: process.env.AKS_RP_E2E_STALE_ACTIVE_MS,
    };
    process.chdir("/app");
    process.env.AKS_RP_E2E_APP_DIR = fixture.appDir;
    process.env.PROJECT_DIR = fixture.projectDir;
    process.env.MAY_DB_PATH = fixture.dbPath;
    process.env.AKS_RP_E2E_STALE_ACTIVE_MS = "1000";
    try {
      const { create } =
        await import("../../../agents/may/handlers/metrics-snapshot.ts");
      const handler = create({ sdk: runtime.sdk } as any, {} as any);
      await handler({ type: "trigger.metrics-snapshot" } as any);

      const snapshot = metricsDb
        .prepare(
          "SELECT value, sample_size, note FROM metric_snapshots WHERE metric_id = ? ORDER BY measured_at DESC LIMIT 1",
        )
        .get("aks-rp-e2e.process.blocked.missing-fallback-count") as {
        value: number;
        sample_size: number | null;
        note: string | null;
      };
      expect(snapshot.value).toBe(1);
      expect(snapshot.sample_size).toBe(1);
      expect(JSON.parse(snapshot.note ?? "{}")).toMatchObject({
        offenderTaskIds: ["blocked-bad"],
      });
    } finally {
      process.chdir(originalRoot);
      for (const [key, value] of Object.entries(previousEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      runtime.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("does not suppress no-work alert for a blocked lifecycle value", async () => {
    const fixture = await makeFixture();
    await writeTree(fixture.appDir, { session_id: "s_done" });
    const treePath = resolveTaskTreePath(fixture.appDir);
    const tree = JSON.parse(await Bun.file(treePath).text());
    tree.project_lifecycle = "blocked";
    tree.active_task_id = null;
    tree.active_task_ids = [];
    tree.tasks.project.state = "blocked";
    tree.tasks["active-task"].state = "done";
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`);

    writeSession(fixture.dbPath, {
      sessionId: "s_done",
      status: "done",
      startedAt: Date.now() - 10_000,
    });

    expect(
      await metricValue(fixture, "aks-rp-e2e.task.no-work-with-gaps"),
    ).toBe("1");
  });

  test("does not treat an active project's rolled-up blocked root as closed", async () => {
    const fixture = await makeFixture();
    await writeTree(fixture.appDir, { session_id: "s_done" });
    const treePath = resolveTaskTreePath(fixture.appDir);
    const tree = JSON.parse(await Bun.file(treePath).text());
    tree.project_lifecycle = "active";
    tree.active_task_id = null;
    tree.active_task_ids = [];
    tree.tasks.project.state = "blocked";
    tree.tasks["active-task"].state = "done";
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`);

    writeSession(fixture.dbPath, {
      sessionId: "s_done",
      status: "done",
      startedAt: Date.now() - 10_000,
    });

    expect(
      await metricValue(fixture, "aks-rp-e2e.task.ready-starvation-with-gaps"),
    ).toBe("1");
  });

  test("suppresses no-work and ready-starvation for an approval-gated blocked-only disposition", async () => {
    const fixture = await makeFixture();
    await writeTree(
      fixture.appDir,
      { session_id: "s_done" },
      {
        "ops/wait-project-approval-owner-return-primary-blocker-20260713": {
          id: "ops/wait-project-approval-owner-return-primary-blocker-20260713",
          parent_id: "project",
          state: "blocked",
          children: [],
          goal: "Carry the governing owner approval wait.",
          kind: "domain_leaf",
          blocker: {
            category: "external-wait",
            owner: "human",
            waiting_for: {
              type: "project.approval.submitted",
            },
          },
        },
        "focus-terminal-frontier-finality-reconciliation-20260714": {
          id: "focus-terminal-frontier-finality-reconciliation-20260714",
          parent_id: "project",
          state: "blocked",
          children: [],
          goal: "Keep the no-live focus represented behind one governing wait.",
          kind: "focus_plan",
          context: {
            needs_approval: true,
            progress_review: {
              status: "needs_approval",
            },
            observations: {
              frontier_active_leaf_count: 0,
              frontier_review_leaf_count: 0,
              frontier_waiting_leaf_count: 0,
              frontier_runnable_leaf_count: 0,
            },
          },
          blocker: {
            category: "external-wait",
            owner: "human",
            waiting_for: {
              type: "owner.decision",
              taskId: "ops/wait-project-approval-owner-return-primary-blocker-20260713",
              governingWaitTaskId:
                "ops/wait-project-approval-owner-return-primary-blocker-20260713",
            },
          },
        },
      },
    );
    const treePath = resolveTaskTreePath(fixture.appDir);
    const tree = JSON.parse(await Bun.file(treePath).text());
    tree.active_task_id = null;
    tree.active_task_ids = [];
    tree.tasks.project.state = "active";
    tree.tasks["active-task"].state = "done";
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`);

    writeSession(fixture.dbPath, {
      sessionId: "s_done",
      status: "done",
      startedAt: Date.now() - 10_000,
    });

    const noWork = JSON.parse(
      await metricValue(
        fixture,
        "aks-rp-e2e.task.no-work-with-gaps",
        "--json",
      ),
    );
    expect(noWork).toMatchObject({
      value: 0,
      sampleSize: 2,
    });
    expect(JSON.parse(noWork.note)).toMatchObject({
      disposition: "approval-gated-blocked-only",
      focusTaskIds: ["focus-terminal-frontier-finality-reconciliation-20260714"],
      governingWaitTaskIds: [
        "ops/wait-project-approval-owner-return-primary-blocker-20260713",
      ],
    });

    const readyStarvation = JSON.parse(
      await metricValue(
        fixture,
        "aks-rp-e2e.task.ready-starvation-with-gaps",
        "--json",
      ),
    );
    expect(readyStarvation).toMatchObject({
      value: 0,
      sampleSize: 2,
    });
    expect(JSON.parse(readyStarvation.note)).toMatchObject({
      disposition: "approval-gated-blocked-only",
    });
  });

  test("still raises no-work when a blocked-only focus lacks the governing approval wait metadata", async () => {
    const fixture = await makeFixture();
    await writeTree(
      fixture.appDir,
      { session_id: "s_done" },
      {
        "focus-terminal-frontier-finality-reconciliation-20260714": {
          id: "focus-terminal-frontier-finality-reconciliation-20260714",
          parent_id: "project",
          state: "blocked",
          children: [],
          goal: "Blocked focus without a governing wait contract.",
          kind: "focus_plan",
          context: {
            needs_approval: true,
            observations: {
              frontier_active_leaf_count: 0,
              frontier_review_leaf_count: 0,
              frontier_waiting_leaf_count: 0,
              frontier_runnable_leaf_count: 0,
            },
          },
          blocker: {
            category: "external-wait",
            owner: "human",
            waiting_for: {
              type: "owner.decision",
            },
          },
        },
      },
    );
    const treePath = resolveTaskTreePath(fixture.appDir);
    const tree = JSON.parse(await Bun.file(treePath).text());
    tree.active_task_id = null;
    tree.active_task_ids = [];
    tree.tasks.project.state = "active";
    tree.tasks["active-task"].state = "done";
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`);

    writeSession(fixture.dbPath, {
      sessionId: "s_done",
      status: "done",
      startedAt: Date.now() - 10_000,
    });

    expect(
      await metricValue(fixture, "aks-rp-e2e.task.no-work-with-gaps"),
    ).toBe("1");
  });

  test("annotates no-work suppression when only active app-ops repair covers a blocked frontier", async () => {
    const fixture = await makeFixture();
    await writeTree(
      fixture.appDir,
      {
        session_id: "s_running",
        id: "active-task",
        owner: "app-ops",
        goal: "Repair blocked-frontier recovery accounting.",
      },
      {
        "blocked-task": {
          id: "blocked-task",
          parent_id: "project",
          state: "blocked",
          children: [],
          goal: "Wait for external proof.",
          kind: "domain_leaf",
          blocker: {
            category: "external-wait",
            owner: "human",
            waiting_for: { type: "owner.decision" },
          },
        },
      },
    );
    writeSession(fixture.dbPath, {
      sessionId: "s_running",
      status: "running",
      opCount: 1,
      startedAt: Date.now() - 10_000,
      lastActivityAt: Date.now(),
    });

    const noWork = JSON.parse(
      await metricValue(
        fixture,
        "aks-rp-e2e.task.no-work-with-gaps",
        "--json",
      ),
    );
    expect(noWork).toMatchObject({
      value: 0,
      sampleSize: 1,
    });
    expect(JSON.parse(noWork.note)).toMatchObject({
      disposition: "fragile-active-only-recovery",
      activeTaskIds: ["active-task"],
      activeOpsTaskIds: ["active-task"],
      activeDomainTaskIds: [],
      blockedLeafCount: 1,
    });
  });

  test("reads feature-owned specs and spec-loop verification state without a legacy index", async () => {
    const fixture = await makeFixture();
    await rmSync(join(fixture.projectDir, "specs"), {
      recursive: true,
      force: true,
    });
    const specsDir = join(fixture.projectDir, "features", "example", "specs");
    await mkdir(specsDir, { recursive: true });
    await writeFile(
      join(specsDir, "passed.json"),
      `${JSON.stringify({ id: "spec.example.passed", status: "ready", specState: "ready" })}\n`,
    );
    await writeFile(
      join(specsDir, "pending.json"),
      `${JSON.stringify({ id: "spec.example.pending", status: "ready", specState: "source-grounded" })}\n`,
    );
    await writeFile(
      join(specsDir, "exception.json"),
      `${JSON.stringify({ id: "spec.example.exception", status: "product_gap", specState: "reviewed-exception" })}\n`,
    );
    await writeFile(
      join(fixture.appDir, ".state", "spec-loop", "state.json"),
      `${JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 1,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.example.passed": { status: "pass", attempts: 1 },
            "spec.example.pending": { status: "pending", attempts: 0 },
            "spec.example.exception": { status: "pending", attempts: 0 },
          },
        },
        null,
        2,
      )}\n`,
    );

    expect(await metricValue(fixture, "aks-rp-e2e.spec.total-count")).toBe("3");
    expect(await metricValue(fixture, "aks-rp-e2e.spec.verified-count")).toBe(
      "1",
    );
    expect(
      await metricValue(fixture, "aks-rp-e2e.spec.reviewed-exception-count"),
    ).toBe("1");
    expect(await metricValue(fixture, "aks-rp-e2e.spec.unverified-count")).toBe(
      "1",
    );
  });

  test("suppresses ready-starvation while active or review work is already in flight", async () => {
    const fixture = await makeFixture();
    await writeTree(
      fixture.appDir,
      { session_id: "s_running" },
      {
        "review-task": {
          id: "review-task",
          parent_id: "project",
          state: "review",
          children: [],
          goal: "Review accepted row-local evidence.",
          kind: "domain_leaf",
        },
      },
    );
    writeSession(fixture.dbPath, {
      sessionId: "s_running",
      status: "running",
      opCount: 1,
      startedAt: Date.now() - 10_000,
      lastActivityAt: Date.now(),
    });

    expect(
      await metricValue(fixture, "aks-rp-e2e.task.ready-starvation-with-gaps"),
    ).toBe("0");
  });

  test("still raises ready-starvation when no runnable, active, or review work exists", async () => {
    const fixture = await makeFixture();
    await writeTree(fixture.appDir, { session_id: "s_done" });
    const treePath = resolveTaskTreePath(fixture.appDir);
    const tree = JSON.parse(await Bun.file(treePath).text());
    tree.active_task_id = null;
    tree.active_task_ids = [];
    tree.tasks.project.state = "backlog";
    tree.tasks["active-task"].state = "done";
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`);

    writeSession(fixture.dbPath, {
      sessionId: "s_done",
      status: "done",
      startedAt: Date.now() - 10_000,
    });

    expect(
      await metricValue(fixture, "aks-rp-e2e.task.ready-starvation-with-gaps"),
    ).toBe("1");
  });

  test("counts execute-mode result files as live runs even when dryRun is absent", async () => {
    const fixture = await makeFixture();
    await writeTree(fixture.appDir, { session_id: "s_running" });
    writeSession(fixture.dbPath, {
      sessionId: "s_running",
      status: "running",
      opCount: 1,
      startedAt: Date.now() - 10_000,
      lastActivityAt: Date.now(),
    });
    await mkdir(join(fixture.projectDir, "runs", "executions", "execute-run"), {
      recursive: true,
    });
    await writeFile(
      join(
        fixture.projectDir,
        "runs",
        "executions",
        "execute-run",
        "result.json",
      ),
      `${JSON.stringify(
        {
          mode: "execute",
          status: "passed",
          completedAt: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
    );

    expect(await metricValue(fixture, "aks-rp-e2e.run.live-started-24h")).toBe(
      "1",
    );
  });

  test("counts cloud-execution probe evidence as live runs", async () => {
    const fixture = await makeFixture();
    await writeTree(fixture.appDir, { session_id: "s_running" });
    writeSession(fixture.dbPath, {
      sessionId: "s_running",
      status: "running",
      opCount: 1,
      startedAt: Date.now() - 10_000,
      lastActivityAt: Date.now(),
    });
    await mkdir(join(fixture.projectDir, "runs", "executions", "cloud-run"), {
      recursive: true,
    });
    await writeFile(
      join(
        fixture.projectDir,
        "runs",
        "executions",
        "cloud-run",
        "result.json",
      ),
      `${JSON.stringify(
        {
          status: "passed",
          completedAt: new Date().toISOString(),
          probeEvidence: { mode: "cloud-execution", status: "pass" },
        },
        null,
        2,
      )}\n`,
    );

    expect(await metricValue(fixture, "aks-rp-e2e.run.live-started-24h")).toBe(
      "1",
    );
  });

  test("counts planner timeout and slow planner runs from planner-runs history", async () => {
    const fixture = await makeFixture();
    await writeTree(fixture.appDir, { session_id: "s_running" });
    writeSession(fixture.dbPath, {
      sessionId: "s_running",
      status: "running",
      opCount: 1,
      startedAt: Date.now() - 10_000,
      lastActivityAt: Date.now(),
    });
    await mkdir(join(fixture.appDir, ".state"), { recursive: true });
    await writeFile(
      join(fixture.appDir, ".state", "planner-runs.jsonl"),
      [
        JSON.stringify({
          ts: new Date().toISOString(),
          kind: "planner_wake",
          status: "settled",
          ran_agent: true,
          steps: ["event-review", "planning-update"],
          durationMs: 361000,
          result: 'Agent step "aks-explorer" timed out after 360000ms',
        }),
        JSON.stringify({
          ts: new Date().toISOString(),
          kind: "planner_wake",
          status: "assigned",
          ran_agent: false,
          steps: ["deterministic-refill"],
          durationMs: 181000,
          result:
            "Routine watchdog refill seeded model-gap work without owner-agent planning.",
        }),
        JSON.stringify({
          ts: new Date().toISOString(),
          kind: "planner_wake",
          status: "settled",
          ran_agent: true,
          steps: ["event-review", "planning-update"],
          result:
            "Reviewed a worker packet mentioning an interrupted downstream run without planner slowness.",
        }),
        JSON.stringify({
          ts: new Date(Date.now() - 5_000).toISOString(),
          kind: "planner_wake",
          status: "interrupted",
          ran_agent: true,
          steps: ["event-review", "planning-update"],
          result: "Planner session interrupted by runtime restart.",
        }),
        JSON.stringify({
          ts: new Date(Date.now() + 10_000).toISOString(),
          kind: "planner_wake",
          status: "settled",
          ran_agent: true,
          steps: ["event-review", "planning-update"],
          result: 'Agent step "aks-explorer" timed out after 180000ms',
        }),
        JSON.stringify({
          ts: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
          kind: "planner_wake",
          status: "assigned",
          ran_agent: true,
          steps: ["event-review", "planning-update"],
          durationMs: 500000,
          result: 'Agent step "aks-explorer" timed out after 240000ms',
        }),
      ].join("\n") + "\n",
    );

    expect(await metricValue(fixture, "aks-rp-e2e.planner.timeout-24h")).toBe(
      "1",
    );
    expect(
      await metricValue(fixture, "aks-rp-e2e.planner.slow-count-24h"),
    ).toBe("4");
  });
});
