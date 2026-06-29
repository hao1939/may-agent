import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "task-tree.ts",
);

async function runTaskTree(
  args: string[],
  env: Record<string, string | undefined>,
) {
  const proc = Bun.spawn(["bun", scriptPath, ...args], {
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

async function makeFixture(options?: {
  projectJson?: Record<string, unknown>;
}) {
  const root = await mkdtemp(join(tmpdir(), "aks-task-tree-"));
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");

  await mkdir(join(appDir, "tasks"), { recursive: true });
  await mkdir(projectDir, { recursive: true });

  await writeFile(
    join(appDir, "project.json"),
    `${JSON.stringify(
      options?.projectJson ?? {
        id: "aks-rp-e2e.app",
        policy: { maxConcurrent: 5 },
      },
      null,
      2,
    )}\n`,
  );

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
            children: ["active-task", "backlog-task"],
            goal: "project",
            outputs: ["tasks/tree.json"],
            acceptance: ["done"],
          },
          "active-task": {
            id: "active-task",
            parent_id: "project",
            state: "active",
            kind: "domain_leaf",
            priority: "P2",
            owner: "aks-explorer",
            children: [],
            goal: "Existing active task.",
            outputs: ["evidence/archive/active-task.md"],
            acceptance: ["reviewed"],
            forbidden: [],
            conflict_scope: ["feature:active"],
            depends_on: [],
          },
          "backlog-task": {
            id: "backlog-task",
            parent_id: "project",
            state: "backlog",
            kind: "domain_leaf",
            priority: "P2",
            owner: "aks-explorer",
            children: [],
            goal: "Runnable backlog task.",
            outputs: ["evidence/archive/backlog-task.md"],
            acceptance: ["reviewed"],
            forbidden: [],
            conflict_scope: ["feature:backlog"],
            depends_on: [],
          },
        },
      },
      null,
      2,
    )}\n`,
  );

  return { root, appDir, projectDir };
}

describe("task-tree CLI", () => {
  test("assign honors project policy maxConcurrent by default when --max and env are absent", async () => {
    const fixture = await makeFixture();

    const result = await runTaskTree(["assign", "backlog-task"], {
      ...process.env,
      APP_DIR: fixture.appDir,
      PROJECT_DIR: fixture.projectDir,
      WORKER: "aks-explorer",
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      taskId?: string;
      worker?: string;
    };
    expect(parsed.taskId).toBe("backlog-task");
    expect(parsed.worker).toBe("aks-explorer");
  });

  test("falls back to 1 without hidden policy assumptions when project.json has no policy.maxConcurrent", async () => {
    const fixture = await makeFixture({
      projectJson: {
        id: "aks-rp-e2e.app",
      },
    });

    const result = await runTaskTree(["assign", "backlog-task"], {
      ...process.env,
      APP_DIR: fixture.appDir,
      PROJECT_DIR: fixture.projectDir,
      WORKER: "aks-explorer",
    });

    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "Worker capacity is full (1)",
    );
  });

  test("MAX_CONCURRENT env still overrides project policy when --max is omitted", async () => {
    const fixture = await makeFixture();

    const result = await runTaskTree(["assign", "backlog-task"], {
      ...process.env,
      APP_DIR: fixture.appDir,
      PROJECT_DIR: fixture.projectDir,
      WORKER: "aks-explorer",
      MAX_CONCURRENT: "1",
    });

    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "Worker capacity is full (1)",
    );
  });
});
