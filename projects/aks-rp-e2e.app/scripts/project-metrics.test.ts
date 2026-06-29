import { describe, expect, test } from "bun:test";
import { $ } from "bun";
import { Database } from "bun:sqlite";
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
};

async function makeFixture() {
  const root = await mkdtemp(join(tmpdir(), "aks-project-metrics-"));
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");
  const dbPath = join(root, "may.db");

  await mkdir(join(appDir, "tasks"), { recursive: true });
  await mkdir(join(appDir, ".state", "spec-loop"), { recursive: true });
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

async function writeTree(
  appDir: string,
  activeTask: Record<string, unknown>,
  extraTasks: Record<string, TreeTask> = {},
) {
  await writeFile(
    join(appDir, "tasks", "tree.json"),
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
    source?: string | null;
    task?: string | null;
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
      lastActivityAt integer,
      source text,
      task text
    )
  `);
  db.query("insert into sessions values (?, ?, ?, ?, ?, ?, ?, ?)").run(
    row.sessionId,
    row.status,
    row.outcome ?? null,
    row.opCount ?? 0,
    row.startedAt ?? Date.now(),
    row.lastActivityAt ?? null,
    row.source ?? null,
    row.task ?? null,
  );
  db.close();
}

async function metricValue(
  fixture: Awaited<ReturnType<typeof makeFixture>>,
  metricId: string,
): Promise<string> {
  return (
    await $`bun ${scriptPath} ${metricId}`
      .env({
        ...process.env,
        AKS_RP_E2E_APP_DIR: fixture.appDir,
        PROJECT_DIR: fixture.projectDir,
        MAY_DB_PATH: fixture.dbPath,
        AKS_RP_E2E_STALE_ACTIVE_MS: "1000",
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
      lastActivityAt: Date.now(),
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
        source text,
        task text
      )
    `);
    db.query("insert into sessions values (?, ?, ?, ?, ?, ?, ?, ?)").run(
      "s_real_worker",
      "running",
      null,
      1,
      Date.now() - 10_000,
      Date.now(),
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

  test("treats completed task-worker task as stale after session ends", async () => {
    const fixture = await makeFixture();
    await writeTree(fixture.appDir, {
      session_id: "s_task_active-task",
      trace: {
        assigned_at: new Date(Date.now() - 120_000).toISOString(),
        worker_started_at: new Date(Date.now() - 110_000).toISOString(),
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
        source text,
        task text
      )
    `);
    db.query("insert into sessions values (?, ?, ?, ?, ?, ?, ?, ?)").run(
      "s_task_active-task",
      "done",
      null,
      5,
      Date.now() - 120_000,
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
    await writeFile(
      join(fixture.projectDir, "specs", "index.json"),
      `${JSON.stringify(
        {
          specs: [{ id: "spec.live", status: "ready", specState: "ready" }],
        },
        null,
        2,
      )}\n`,
    );
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
    await writeFile(
      join(fixture.projectDir, "specs", "index.json"),
      `${JSON.stringify(
        {
          specs: [{ id: "spec.live", status: "ready", specState: "ready" }],
        },
        null,
        2,
      )}\n`,
    );
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
    await writeFile(
      join(fixture.projectDir, "specs", "index.json"),
      `${JSON.stringify(
        {
          specs: [{ id: "spec.live", status: "ready", specState: "ready" }],
        },
        null,
        2,
      )}\n`,
    );
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

  test("suppresses no-work alert when project lifecycle is explicitly blocked", async () => {
    const fixture = await makeFixture();
    await writeTree(fixture.appDir, { session_id: "s_done" });
    const treePath = join(fixture.appDir, "tasks", "tree.json");
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
    ).toBe("0");
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
    const treePath = join(fixture.appDir, "tasks", "tree.json");
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
          durationMs: 241000,
          result: 'Agent step "aks-explorer" timed out after 240000ms',
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
