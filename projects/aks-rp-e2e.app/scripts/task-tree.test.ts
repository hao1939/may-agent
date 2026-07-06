import { projectRuntimePaths, resolveTaskTreePath } from "@may-agent/sdk";
import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
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

  test("mark-done refuses to close an active started attempt", async () => {
    const fixture = await makeFixture();
    const treePath = resolveTaskTreePath(fixture.appDir);
    const tree = JSON.parse(await readFile(treePath, "utf-8")) as {
      tasks: Record<string, Record<string, unknown>>;
    };
    tree.tasks["active-task"].trace = {
      current_attempt_id: "attempt-active-1",
      worker_started_attempt_id: "attempt-active-1",
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`);

    const result = await runTaskTree(
      [
        "mark-done",
        "active-task",
        "--resolution",
        "replaced",
        "--summary",
        "owner cleanup should not close an active assignment",
      ],
      {
        ...process.env,
        APP_DIR: fixture.appDir,
        PROJECT_DIR: fixture.projectDir,
        WORKER: "aks-explorer",
      },
    );

    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "active with current started attempt attempt-active-1",
    );
  });

  test("add and update-text support structured blocker resume metadata", async () => {
    const fixture = await makeFixture();

    const add = await runTaskTree(
      [
        "add",
        "blocked-task",
        "--parent",
        "project",
        "--goal",
        "Wait for operator proof.",
        "--output",
        "tasks/tree.json",
        "--acceptance",
        "proof reviewed",
        "--state",
        "blocked",
        "--blocker",
        "Waiting for returned operator proof.",
        "--blocker-category",
        "external-wait",
        "--blocker-owner",
        "human",
        "--resume-condition",
        "Resume when proof lands.",
        "--resume-at",
        "2099-06-26T00:00:00.000Z",
      ],
      {
        ...process.env,
        APP_DIR: fixture.appDir,
        PROJECT_DIR: fixture.projectDir,
        WORKER: "aks-explorer",
      },
    );

    expect(add.exitCode).toBe(0);
    expect(JSON.parse(add.stdout).blocker).toMatchObject({
      condition: "Waiting for returned operator proof.",
      category: "external-wait",
      owner: "human",
      resume_condition: "Resume when proof lands.",
      resume_at: "2099-06-26T00:00:00.000Z",
    });

    const update = await runTaskTree(
      [
        "update-text",
        "blocked-task",
        "--resume-at",
        "2099-06-27T00:00:00.000Z",
      ],
      {
        ...process.env,
        APP_DIR: fixture.appDir,
        PROJECT_DIR: fixture.projectDir,
        WORKER: "aks-explorer",
      },
    );

    expect(update.exitCode).toBe(0);
    expect(JSON.parse(update.stdout).blocker).toMatchObject({
      condition: "Waiting for returned operator proof.",
      resume_at: "2099-06-27T00:00:00.000Z",
    });

    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(fixture.appDir), "utf8"),
    );
    expect(tree.tasks["blocked-task"].blocker).toMatchObject({
      condition: "Waiting for returned operator proof.",
      resume_at: "2099-06-27T00:00:00.000Z",
    });
  });

  test("repair-blocked-contracts backfills explicit wait and observer fields", async () => {
    const fixture = await makeFixture();

    const add = await runTaskTree(
      [
        "add",
        "github-wait",
        "--parent",
        "project",
        "--goal",
        "Wait for same-run evidence.",
        "--output",
        "tasks/tree.json",
        "--acceptance",
        "same-run evidence reviewed",
        "--state",
        "blocked",
        "--blocker",
        "Blocked until GitHub Actions run 28702280698 returns authoritative logs. Resume: Resume when run 28702280698 has reviewed same-run logs.",
      ],
      {
        ...process.env,
        APP_DIR: fixture.appDir,
        PROJECT_DIR: fixture.projectDir,
        WORKER: "aks-explorer",
      },
    );

    expect(add.exitCode).toBe(0);
    expect(typeof JSON.parse(add.stdout).blocker).toBe("string");

    const repaired = await runTaskTree(["repair-blocked-contracts"], {
      ...process.env,
      APP_DIR: fixture.appDir,
      PROJECT_DIR: fixture.projectDir,
      WORKER: "aks-explorer",
    });

    expect(repaired.exitCode).toBe(0);
    expect(JSON.parse(repaired.stdout)).toMatchObject({
      repairedCount: 1,
      repaired: ["github-wait"],
    });

    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(fixture.appDir), "utf8"),
    );
    expect(tree.tasks["github-wait"].blocker).toMatchObject({
      condition:
        "Blocked until GitHub Actions run 28702280698 returns authoritative logs.",
      owner: "aks-explorer",
      waiting_for: {
        type: "github.workflow_run.completed",
        runId: "28702280698",
      },
      observed_by: {
        workflow: "project-planner",
        schedule: "blocked-frontier-owner-review",
      },
      resume_condition:
        "Resume when run 28702280698 has reviewed same-run logs.",
    });
    expect(tree.tasks["github-wait"].blocker.next_check_at).toBeTruthy();
    expect(tree.tasks["github-wait"].blocker.fallback_at).toBeTruthy();
    expect(tree.tasks["github-wait"].blocker.fallback_action).toContain(
      "owner recovery",
    );
  });
});
