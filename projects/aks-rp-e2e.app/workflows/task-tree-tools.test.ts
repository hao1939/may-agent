import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  compactDoneLeaves,
  completeTask,
  createTask,
  markTaskDone,
  repairTaskTreeRollups,
  seedModelGapBacklog,
  taskTreeConfig,
} from "./lib/task-tree-tools.ts";

async function makeProject() {
  const dir = await mkdtemp(join(tmpdir(), "aks-task-tree-tools-"));
  await mkdir(join(dir, ".state"), { recursive: true });
  await mkdir(join(dir, "tasks"), { recursive: true });
  await writeFile(join(dir, ".state", "journal.jsonl"), "", "utf8");
  return dir;
}

function config(projectDir: string) {
  return taskTreeConfig({
    appDir: projectDir,
    projectDir,
    worker: "aks-explorer",
    maxConcurrent: 3,
  });
}

describe("task tree tools", () => {
  test("allows owner-decided ordinary task creation directly under root", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "tasks", "tree.json"),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: [],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const task = createTask(config(projectDir), {
      id: "dated-frontier-20260615",
      parentId: "project",
      goal: "owner-decided root work",
      outputs: ["evidence/archive/root-work.md"],
      acceptance: ["done"],
    });

    expect(task.parent_id).toBe("project");
    const tree = JSON.parse(
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
    );
    expect(tree.tasks.project.children).toEqual(["dated-frontier-20260615"]);
  });

  test("model gap seeding does not fall back to root when parents are missing", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "model", "knowledge-map"), {
      recursive: true,
    });
    await mkdir(join(projectDir, "specs"), { recursive: true });
    await mkdir(join(projectDir, "replays"), { recursive: true });
    await writeFile(
      join(projectDir, "model", "knowledge-map", "model.json"),
      `${JSON.stringify({
        featurePaths: [
          {
            id: "path.feature-a.create",
            featureId: "feature-a",
            status: "unknown",
          },
        ],
      })}\n`,
      "utf8",
    );
    await writeFile(
      join(projectDir, "tasks", "tree.json"),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: [],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = seedModelGapBacklog(config(projectDir), { limit: 1 });

    expect(result.created).toEqual([]);
    expect(result.skipped).toEqual([
      { pathId: "path.feature-a.create", reason: "no-parent-task" },
    ]);
    const tree = JSON.parse(
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
    );
    expect(tree.tasks.project.children).toEqual([]);
  });

  test("repairs parent rollups and lifecycle from active leaves", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "tasks", "tree.json"),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "closed",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "done",
              children: ["model-feedback"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "model-feedback": {
              id: "model-feedback",
              parent_id: "project",
              state: "done",
              children: ["feature-status-reconciliation"],
              goal: "update model",
              outputs: ["model/"],
              acceptance: ["views consistent"],
            },
            "feature-status-reconciliation": {
              id: "feature-status-reconciliation",
              parent_id: "model-feedback",
              state: "active",
              children: [],
              goal: "reconcile feature statuses",
              outputs: ["model/knowledge-map/feature-summary.json"],
              acceptance: ["feature status rolls up from paths"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = repairTaskTreeRollups(config(projectDir));

    expect(result).toMatchObject({
      changed: true,
      lifecycle: "active",
      active_task_ids: ["feature-status-reconciliation"],
      repaired: [
        { taskId: "model-feedback", from: "done", to: "active" },
        { taskId: "project", from: "done", to: "active" },
      ],
    });

    const tree = JSON.parse(
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
    );
    expect(tree.project_lifecycle).toBe("active");
    expect(tree.active_task_id).toBe("feature-status-reconciliation");
    expect(tree.active_task_ids).toEqual(["feature-status-reconciliation"]);
    expect(tree.tasks.project.state).toBe("active");
    expect(tree.tasks["model-feedback"].state).toBe("active");
    expect(tree.tasks["feature-status-reconciliation"].state).toBe("active");
    expect(tree.tasks.project.status).toBeUndefined();

    const kanban = JSON.parse(
      await readFile(join(projectDir, "tasks", "kanban.json"), "utf8"),
    );
    expect(kanban.kanban.column_counts["in-progress"]).toBe(1);
  });

  test("task saves automatically repair parent rollups and snapshot", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "tasks", "tree.json"),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: "leaf",
          active_task_ids: ["leaf"],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: ["lane"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            lane: {
              id: "lane",
              parent_id: "project",
              state: "active",
              children: ["leaf"],
              goal: "lane",
              outputs: ["model/"],
              acceptance: ["done"],
            },
            leaf: {
              id: "leaf",
              parent_id: "lane",
              state: "active",
              children: [],
              goal: "do work",
              outputs: ["model/output.json"],
              acceptance: ["work complete"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    completeTask(config(projectDir), {
      taskId: "leaf",
      claim: "done",
      summary: "worker says done",
    });

    const tree = JSON.parse(
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
    );
    expect(tree.project_lifecycle).toBe("active");
    expect(tree.active_task_id).toBeNull();
    expect(tree.active_task_ids).toEqual([]);
    expect(tree.tasks.leaf.state).toBe("review");
    expect(tree.tasks.lane.state).toBe("review");
    expect(tree.tasks.project.state).toBe("review");

    const kanban = JSON.parse(
      await readFile(join(projectDir, "tasks", "kanban.json"), "utf8"),
    );
    expect(kanban.tree_updated_at).toBe(tree.updated_at);
    expect(kanban.kanban.column_counts.review).toBe(1);
  });

  test("compacts done leaves from legacy array trees while preserving dependencies", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "tasks", "archive"), { recursive: true });
    await writeFile(
      join(projectDir, "tasks", "tree.json"),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: [
            {
              id: "project",
              state: "backlog",
              children: ["lane"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            {
              id: "lane",
              parent_id: "project",
              state: "backlog",
              children: ["done-free", "done-needed", "open"],
              goal: "lane",
              outputs: ["model/"],
              acceptance: ["done"],
            },
            {
              id: "done-free",
              parent_id: "lane",
              state: "done",
              children: [],
              goal: "historical completed work",
              outputs: ["evidence/archive/free.md"],
              acceptance: ["archivable"],
            },
            {
              id: "done-needed",
              parent_id: "lane",
              state: "done",
              children: [],
              goal: "completed dependency",
              outputs: ["evidence/archive/needed.md"],
              acceptance: ["must remain while referenced"],
            },
            {
              id: "open",
              parent_id: "lane",
              state: "backlog",
              children: [],
              depends_on: ["done-needed"],
              goal: "open work",
              outputs: ["evidence/archive/open.md"],
              acceptance: ["dependency remains satisfiable"],
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = compactDoneLeaves(config(projectDir), {
      limit: 10,
      reason: "test compaction",
    });

    expect(result).toMatchObject({
      changed: true,
      archived: 1,
      protected: 1,
      remainingTotal: 4,
    });
    expect(result.archivePath).toMatch(/^tasks\/archive\/done-leaves-/);

    const tree = JSON.parse(
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
    );
    expect(Array.isArray(tree.tasks)).toBe(false);
    expect(tree.tasks["done-free"]).toBeUndefined();
    expect(tree.tasks["done-needed"]).toBeDefined();
    expect(tree.tasks.open.depends_on).toEqual(["done-needed"]);
    expect(tree.tasks.lane.children).toEqual(["done-needed", "open"]);
    expect(tree.tasks.lane.context.archived_done_leaf_count).toBe(1);

    const archive = JSON.parse(
      await readFile(join(projectDir, result.archivePath!), "utf8"),
    );
    expect(archive.tasks.map((task: { id: string }) => task.id)).toEqual([
      "done-free",
    ]);
  });

  test("marks review work done and unlocks dependent backlog", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "tasks", "tree.json"),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "review",
              children: ["lane"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            lane: {
              id: "lane",
              parent_id: "project",
              state: "review",
              children: ["review-leaf", "dependent-leaf"],
              goal: "lane",
              outputs: ["model/"],
              acceptance: ["done"],
            },
            "review-leaf": {
              id: "review-leaf",
              parent_id: "lane",
              state: "review",
              children: [],
              goal: "review worker output",
              outputs: ["evidence/archive/review.md"],
              acceptance: ["review accepted"],
              trace: {
                last_worker_result: "done",
                last_worker_summary: "worker output is valid",
              },
            },
            "dependent-leaf": {
              id: "dependent-leaf",
              parent_id: "lane",
              state: "backlog",
              children: [],
              goal: "run after review",
              outputs: ["runs/executions/"],
              acceptance: ["done"],
              depends_on: ["review-leaf"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    markTaskDone(config(projectDir), {
      taskId: "review-leaf",
      summary: "accepted worker output",
    });

    const tree = JSON.parse(
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
    );
    expect(tree.tasks["review-leaf"].state).toBe("done");
    expect(tree.tasks["review-leaf"].context.acceptance_note).toBe(
      "accepted worker output",
    );
    expect(tree.tasks["dependent-leaf"].state).toBe("backlog");
    expect(tree.tasks.lane.state).toBe("backlog");
    expect(tree.tasks.project.state).toBe("backlog");

    const kanban = JSON.parse(
      await readFile(join(projectDir, "tasks", "kanban.json"), "utf8"),
    );
    expect(kanban.kanban.column_counts.backlog).toBe(1);
    expect(kanban.kanban.column_counts.done).toBe(1);
  });
});
