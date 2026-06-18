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
  updateAcceptedReviewMetadata,
  updateTaskOutputs,
  updateTaskText,
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

  test("model gap seeding skips execution-variant metadata paths", async () => {
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
            id: "path.feature-a.execution-variant",
            featureId: "feature-a",
            status: "unknown",
            variantOfSpecId: "spec.feature-a",
            executionVariantId: "variant.feature-a.exec",
            specCoverage: {
              type: "execution-variant",
              specId: "spec.feature-a",
              variantId: "variant.feature-a.exec",
            },
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
              children: ["spec-runner-and-replays"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "spec-runner-and-replays": {
              id: "spec-runner-and-replays",
              parent_id: "project",
              state: "backlog",
              children: [],
              goal: "runner lane",
              outputs: ["runs/executions/"],
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
      {
        pathId: "path.feature-a.execution-variant",
        reason: "execution-variant-metadata",
      },
    ]);
    const tree = JSON.parse(
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
    );
    expect(tree.tasks["spec-runner-and-replays"].children).toEqual([]);
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

  test("replaces outputs on an existing task and preserves other metadata", async () => {
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
              children: ["promotion-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "promotion-task": {
              id: "promotion-task",
              parent_id: "project",
              state: "done",
              kind: "domain_leaf",
              priority: "P2",
              owner: "aks-explorer",
              children: [],
              goal: "repair malformed outputs metadata",
              outputs: [
                "evidence/archive/old.md,features/wrong.yaml,specs/extra.json",
              ],
              acceptance: ["outputs repaired"],
              conflict_scope: ["feature:managedsystem"],
              trace: {
                created_at: "2026-06-17T00:00:00.000Z",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const updated = updateTaskOutputs(config(projectDir), {
      taskId: "promotion-task",
      outputs: [
        "evidence/archive/managedsystem-create-time-initial-pool-feature-packet-promotion-20260617.md",
        "features/managedsystem-pool/create-time-initial-pool.yaml",
      ],
    });

    expect(updated.outputs).toEqual([
      "evidence/archive/managedsystem-create-time-initial-pool-feature-packet-promotion-20260617.md",
      "features/managedsystem-pool/create-time-initial-pool.yaml",
    ]);
    expect(updated.goal).toBe("repair malformed outputs metadata");
    expect(updated.acceptance).toEqual(["outputs repaired"]);
    expect(updated.conflict_scope).toEqual(["feature:managedsystem"]);

    const tree = JSON.parse(
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
    );
    expect(tree.tasks["promotion-task"].outputs).toEqual([
      "evidence/archive/managedsystem-create-time-initial-pool-feature-packet-promotion-20260617.md",
      "features/managedsystem-pool/create-time-initial-pool.yaml",
    ]);
    expect(tree.tasks["promotion-task"].goal).toBe(
      "repair malformed outputs metadata",
    );
    expect(tree.tasks["promotion-task"].acceptance).toEqual([
      "outputs repaired",
    ]);

    const journal = await readFile(
      join(projectDir, ".state", "journal.jsonl"),
      "utf8",
    );
    expect(journal).toContain('"kind":"task_outputs_updated"');
    expect(journal).toContain('"task_id":"promotion-task"');
  });

  test("updates existing task text fields and preserves outputs/conflict scope", async () => {
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
              children: ["blocked-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "blocked-task": {
              id: "blocked-task",
              parent_id: "project",
              state: "blocked",
              kind: "domain_leaf",
              priority: "P2",
              owner: "aks-explorer",
              children: [],
              goal: "old goal",
              outputs: ["evidence/archive/blocked.md"],
              acceptance: ["old acceptance"],
              blocker: "old blocker",
              conflict_scope: ["feature:test"],
              trace: {
                created_at: "2026-06-18T00:00:00.000Z",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const updated = updateTaskText(config(projectDir), {
      taskId: "blocked-task",
      goal: "new goal",
      acceptance: ["new acceptance"],
      blocker: "new blocker",
    });

    expect(updated.goal).toBe("new goal");
    expect(updated.acceptance).toEqual(["new acceptance"]);
    expect(updated.blocker).toBe("new blocker");
    expect(updated.outputs).toEqual(["evidence/archive/blocked.md"]);
    expect(updated.conflict_scope).toEqual(["feature:test"]);

    const tree = JSON.parse(
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
    );
    expect(tree.tasks["blocked-task"].goal).toBe("new goal");
    expect(tree.tasks["blocked-task"].acceptance).toEqual(["new acceptance"]);
    expect(tree.tasks["blocked-task"].blocker).toBe("new blocker");
    expect(tree.tasks["blocked-task"].outputs).toEqual(["evidence/archive/blocked.md"]);

    const journal = await readFile(
      join(projectDir, ".state", "journal.jsonl"),
      "utf8",
    );
    expect(journal).toContain('"kind":"task_text_updated"');
    expect(journal).toContain('"task_id":"blocked-task"');
  });

  test("updates only accepted-review metadata fields on an existing task", async () => {
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
              children: ["accepted-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "accepted-task": {
              id: "accepted-task",
              parent_id: "project",
              state: "done",
              kind: "domain_leaf",
              priority: "P2",
              owner: "aks-explorer",
              children: [],
              goal: "keep all non-review fields untouched",
              outputs: ["evidence/archive/original.md"],
              acceptance: ["accepted wording is synced"],
              conflict_scope: ["tooling:task-tree-review-metadata"],
              trace: {
                created_at: "2026-06-18T00:00:00.000Z",
                reviewed_by: "task-tree-tool",
                review_summary: "old accepted summary",
              },
              context: {
                acceptance_note: "old accepted note",
                keep: "preserve-me",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const updated = updateAcceptedReviewMetadata(config(projectDir), {
      taskId: "accepted-task",
      reviewSummary: "fresh review summary",
      acceptanceNote: "fresh acceptance note",
    });

    expect(updated.state).toBe("done");
    expect(updated.goal).toBe("keep all non-review fields untouched");
    expect(updated.outputs).toEqual(["evidence/archive/original.md"]);
    expect(updated.acceptance).toEqual(["accepted wording is synced"]);
    expect(updated.trace?.review_summary).toBe("fresh review summary");
    expect(
      (updated.context as { acceptance_note?: string; keep?: string }).acceptance_note,
    ).toBe("fresh acceptance note");
    expect((updated.context as { keep?: string }).keep).toBe("preserve-me");

    const tree = JSON.parse(
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
    );
    expect(tree.tasks["accepted-task"].state).toBe("done");
    expect(tree.tasks["accepted-task"].goal).toBe(
      "keep all non-review fields untouched",
    );
    expect(tree.tasks["accepted-task"].outputs).toEqual([
      "evidence/archive/original.md",
    ]);
    expect(tree.tasks["accepted-task"].acceptance).toEqual([
      "accepted wording is synced",
    ]);
    expect(tree.tasks["accepted-task"].trace.review_summary).toBe(
      "fresh review summary",
    );
    expect(tree.tasks["accepted-task"].context.acceptance_note).toBe(
      "fresh acceptance note",
    );
    expect(tree.tasks["accepted-task"].context.keep).toBe("preserve-me");

    const journal = await readFile(
      join(projectDir, ".state", "journal.jsonl"),
      "utf8",
    );
    expect(journal).toContain('"kind":"task_accepted_review_metadata_updated"');
    expect(journal).toContain('"task_id":"accepted-task"');
  });
});
