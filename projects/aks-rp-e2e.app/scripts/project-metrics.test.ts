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
});
