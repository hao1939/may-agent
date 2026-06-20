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
};

async function makeFixture() {
  const root = await mkdtemp(join(tmpdir(), "aks-project-metrics-"));
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");
  const dbPath = join(root, "may.db");

  await mkdir(join(appDir, "tasks"), { recursive: true });
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
        },
        "live-backlog": {
          id: "live-backlog",
          parent_id: "project",
          state: "backlog",
          children: [],
          goal: "Run live staging execution once gate opens.",
          kind: "domain_leaf",
          depends_on: ["blocked-auth"],
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
    ).toBe("2");
  });
});
