import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assignTask,
  completeTask,
  confirmRunnableBacklogLeaves,
  createTask,
  dependenciesSatisfied,
  markTaskDone,
  peekTaskAssignments,
  planningPacket,
  readTaskTree,
  rejectTaskReview,
  repairTaskTreeRollups,
  taskTreeConfig,
  updateTaskText,
} from "./index.js";

async function makeApp() {
  const dir = await mkdtemp(join(tmpdir(), "may-sdk-task-tree-"));
  await mkdir(join(dir, ".state"), { recursive: true });
  await mkdir(join(dir, "tasks"), { recursive: true });
  await writeFile(join(dir, ".state", "journal.jsonl"), "", "utf8");
  return dir;
}

function config(appDir: string, projectDir?: string) {
  return taskTreeConfig({
    appDir,
    projectDir: projectDir ?? appDir,
    worker: "owner-agent",
    maxConcurrent: 2,
  });
}

async function writeTree(appDir: string, tree: unknown) {
  await writeFile(join(appDir, "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");
}

describe("project task tree SDK", () => {
  test("normalizes legacy states and writes canonical state only", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      tasks: {
        project: {
          id: "project",
          status: "ready",
          children: ["done-leaf", "blocked-by-done"],
          goal: "project",
          outputs: ["tasks/tree.json"],
          acceptance: ["complete"],
        },
        "done-leaf": {
          id: "done-leaf",
          parent_id: "project",
          status: "accepted",
          children: [],
          goal: "done",
          outputs: ["artifact"],
          acceptance: ["accepted"],
        },
        "blocked-by-done": {
          id: "blocked-by-done",
          parent_id: "project",
          status: "ready",
          children: [],
          depends_on: ["done-leaf"],
          goal: "dependent",
          outputs: ["artifact-2"],
          acceptance: ["dependency satisfied"],
        },
      },
    });

    const tree = readTaskTree(config(appDir));

    expect(tree.tasks.project.status).toBe("backlog");
    expect(tree.tasks["done-leaf"].status).toBe("done");
    expect(dependenciesSatisfied(tree, tree.tasks["blocked-by-done"])).toBe(true);

    repairTaskTreeRollups(config(appDir));
    const persisted = JSON.parse(await readFile(join(appDir, "tasks", "tree.json"), "utf8"));
    expect(persisted.tasks["done-leaf"].state).toBe("done");
    expect(persisted.tasks["done-leaf"].status).toBeUndefined();
  });

  test("creates, assigns, completes, and accepts generic task leaves", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
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
          acceptance: ["complete"],
        },
      },
    });

    createTask(config(appDir), {
      id: "leaf",
      parentId: "project",
      goal: "do one generic task",
      outputs: ["artifact"],
      acceptance: ["artifact exists"],
    });

    const assignment = assignTask(config(appDir), { taskId: "leaf" });
    expect(assignment.sessionId).toBe("s_task_leaf");
    expect(peekTaskAssignments(config(appDir))).toHaveLength(1);

    completeTask(config(appDir), {
      taskId: "leaf",
      claim: "done",
      summary: "worker completed the artifact",
    });
    markTaskDone(config(appDir), {
      taskId: "leaf",
      summary: "owner accepted the artifact",
    });

    const tree = readTaskTree(config(appDir));
    expect(tree.tasks.leaf.status).toBe("done");
    expect(tree.tasks.project.status).toBe("done");
    expect(tree.active_task_ids).toEqual([]);
  });

  test("rejects a review leaf back to backlog with review context", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
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
          acceptance: ["complete"],
        },
      },
    });

    createTask(config(appDir), {
      id: "leaf",
      parentId: "project",
      goal: "produce reviewed artifact",
      outputs: ["artifact"],
      acceptance: ["artifact has evidence"],
    });
    assignTask(config(appDir), {
      taskId: "leaf",
      attemptId: "attempt-1",
    });
    completeTask(config(appDir), {
      taskId: "leaf",
      claim: "blocked",
      summary: "worker returned without evidence",
    });

    rejectTaskReview(config(appDir), {
      taskId: "leaf",
      reason: "acceptance not met: no evidence",
      freshSession: true,
    });

    const tree = readTaskTree(config(appDir));
    expect(tree.tasks.leaf.status).toBe("backlog");
    expect(tree.tasks.leaf.session_id).toBeUndefined();
    expect(tree.tasks.leaf.session_history).toEqual(["s_task_leaf"]);
    expect(tree.tasks.leaf.trace?.review_reject_reason).toBe("acceptance not met: no evidence");
    expect(tree.tasks.leaf.trace?.review_reject_fresh_session).toBe(true);
    expect(tree.tasks.leaf.trace?.previous_attempt_id).toBe("attempt-1");
    expect(tree.tasks.leaf.trace?.current_attempt_id).toBeUndefined();
    expect(tree.active_task_ids).toEqual([]);

    const retry = assignTask(config(appDir), {
      taskId: "leaf",
      attemptId: "attempt-2",
    });
    expect(retry.sessionId).not.toBe("s_task_leaf");
    expect(retry.sessionId.startsWith("s_task_leaf_retry_")).toBe(true);

    const retryTree = readTaskTree(config(appDir));
    expect(retryTree.tasks.leaf.session_history).toEqual(["s_task_leaf", retry.sessionId]);
    expect(retryTree.tasks.leaf.trace?.current_attempt_id).toBe("attempt-2");
  });

  test("planningPacket includes model_status_summary when model.json exists", async () => {
    const appDir = await makeApp();
    const projectDir = await mkdtemp(join(tmpdir(), "may-sdk-model-"));
    await mkdir(join(projectDir, "model", "knowledge-map"), { recursive: true });

    // Write a minimal task tree
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          state: "backlog",
          children: ["leaf-a"],
          goal: "project root",
          outputs: ["tasks/tree.json"],
          acceptance: ["complete"],
        },
        "leaf-a": {
          id: "leaf-a",
          parent_id: "project",
          state: "backlog",
          children: [],
          goal: "do leaf work",
          outputs: ["artifact-a"],
          acceptance: ["done"],
        },
      },
    });

    // Write a mock model.json with paths
    const modelData = {
      version: 1,
      paths: [
        { id: "path.feature-a", status: "pass", label: "Feature A" },
        { id: "path.feature-b", status: "pass", label: "Feature B" },
        { id: "path.feature-c", status: "pass", label: "Feature C" },
        {
          id: "path.feature-blocked",
          status: "blocked",
          label: "Blocked Feature",
          rootCauseClass: "environment",
          verdictFinal: true,
          retestCondition: "Environment access granted",
        },
        {
          id: "path.feature-gap",
          status: "product-gap",
          label: "Product Gap Feature",
          rootCauseClass: "product",
          verdictFinal: true,
          retestCondition: "Product fix deployed",
        },
      ],
    };
    await writeFile(
      join(projectDir, "model", "knowledge-map", "model.json"),
      JSON.stringify(modelData, null, 2),
      "utf8",
    );

    const packet = planningPacket(config(appDir, projectDir));

    // Verify model_status_summary is populated
    expect(packet.model_status_summary).toBeDefined();
    const summary = packet.model_status_summary!;
    expect(summary.total).toBe(5);
    expect(summary.passing).toBe(3);
    expect(summary.non_passing).toBe(2);
    expect(summary.non_passing_paths).toHaveLength(2);

    // Verify non-passing path details
    const blockedPath = summary.non_passing_paths.find((p) => p.id === "path.feature-blocked");
    expect(blockedPath).toBeDefined();
    expect(blockedPath!.status).toBe("blocked");
    expect(blockedPath!.rootCauseClass).toBe("environment");
    expect(blockedPath!.verdictFinal).toBe(true);
    expect(blockedPath!.retestCondition).toBe("Environment access granted");

    const gapPath = summary.non_passing_paths.find((p) => p.id === "path.feature-gap");
    expect(gapPath).toBeDefined();
    expect(gapPath!.status).toBe("product-gap");
    expect(gapPath!.rootCauseClass).toBe("product");
  });

  test("planningPacket omits model_status_summary when model.json is absent", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          state: "backlog",
          children: [],
          goal: "project root",
          outputs: ["tasks/tree.json"],
          acceptance: ["complete"],
        },
      },
    });

    const packet = planningPacket(config(appDir));
    // No model dir exists, so field should be undefined
    expect(packet.model_status_summary).toBeUndefined();
  });

  test("planning summary counts executable leaf tasks separately from rollup parents", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: "active-leaf",
      active_task_ids: ["active-leaf"],
      tasks: {
        project: {
          id: "project",
          state: "active",
          children: ["branch"],
          goal: "project root",
          outputs: ["tasks/tree.json"],
          acceptance: ["complete"],
        },
        branch: {
          id: "branch",
          parent_id: "project",
          state: "active",
          children: ["active-leaf", "done-leaf"],
          goal: "rollup branch",
          outputs: ["branch"],
          acceptance: ["children complete"],
        },
        "active-leaf": {
          id: "active-leaf",
          parent_id: "branch",
          state: "active",
          children: [],
          goal: "do active work",
          outputs: ["artifact-a"],
          acceptance: ["done"],
        },
        "done-leaf": {
          id: "done-leaf",
          parent_id: "branch",
          state: "done",
          children: [],
          goal: "done work",
          outputs: ["artifact-b"],
          acceptance: ["done"],
        },
      },
    });

    const packet = planningPacket(config(appDir));

    expect(packet.total).toBe(4);
    expect(packet.leaf_total).toBe(2);
    expect(packet.counts).toEqual({ active: 1, done: 1 });
    expect(packet.tree_counts).toEqual({ active: 3, done: 1 });
    expect(packet.frontier.active).toEqual(["active-leaf"]);
  });

  test("confirmRunnableBacklogLeaves honors active conflict_scope overlap like assignTask", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: "active-leaf",
      active_task_ids: ["active-leaf"],
      tasks: {
        project: {
          id: "project",
          state: "active",
          children: ["active-leaf", "blocked-backlog-leaf", "runnable-backlog-leaf"],
          goal: "project",
          outputs: ["tasks/tree.json"],
          acceptance: ["complete"],
        },
        "active-leaf": {
          id: "active-leaf",
          parent_id: "project",
          state: "active",
          kind: "domain_leaf",
          priority: "P2",
          owner: "owner-agent",
          children: [],
          goal: "hold shared conflict token",
          outputs: ["evidence/archive/active.md"],
          acceptance: ["done"],
          conflict_scope: ["artifact:domain-checkpoint"],
        },
        "blocked-backlog-leaf": {
          id: "blocked-backlog-leaf",
          parent_id: "project",
          state: "backlog",
          kind: "domain_leaf",
          priority: "P2",
          owner: "owner-agent",
          children: [],
          goal: "looks clear but conflicts with active work",
          outputs: ["evidence/archive/blocked-backlog.md"],
          acceptance: ["done"],
          conflict_scope: ["artifact:domain-checkpoint", "feature:test"],
        },
        "runnable-backlog-leaf": {
          id: "runnable-backlog-leaf",
          parent_id: "project",
          state: "backlog",
          kind: "domain_leaf",
          priority: "P2",
          owner: "owner-agent",
          children: [],
          goal: "clear and non-conflicting backlog work",
          outputs: ["evidence/archive/runnable-backlog.md"],
          acceptance: ["done"],
          conflict_scope: ["feature:other"],
        },
      },
    });

    const confirmed = confirmRunnableBacklogLeaves(config(appDir), 10);
    expect(confirmed).toEqual(["runnable-backlog-leaf"]);

    expect(() => assignTask(config(appDir), { taskId: "blocked-backlog-leaf" })).toThrow(
      /conflicts with active work/,
    );

    const tree = readTaskTree(config(appDir));
    expect(tree.tasks["blocked-backlog-leaf"].status).toBe("backlog");
    expect(tree.tasks["blocked-backlog-leaf"].trace?.promoted_at).toBeUndefined();
    expect(tree.tasks["runnable-backlog-leaf"].status).toBe("backlog");
    expect(tree.tasks["runnable-backlog-leaf"].trace?.promoted_at).toBeDefined();
  });

  test("updates existing task text fields without disturbing other metadata", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          state: "backlog",
          children: ["blocked-leaf"],
          goal: "project",
          outputs: ["tasks/tree.json"],
          acceptance: ["complete"],
        },
        "blocked-leaf": {
          id: "blocked-leaf",
          parent_id: "project",
          state: "blocked",
          kind: "domain_leaf",
          priority: "P2",
          owner: "owner-agent",
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
    });

    const updated = updateTaskText(config(appDir), {
      taskId: "blocked-leaf",
      goal: "new goal",
      acceptance: ["new acceptance a", "new acceptance b"],
      blocker: "new blocker",
    });

    expect(updated.goal).toBe("new goal");
    expect(updated.acceptance).toEqual(["new acceptance a", "new acceptance b"]);
    expect(updated.blocker).toBe("new blocker");
    expect(updated.outputs).toEqual(["evidence/archive/blocked.md"]);
    expect(updated.conflict_scope).toEqual(["feature:test"]);

    const tree = JSON.parse(await readFile(join(appDir, "tasks", "tree.json"), "utf8"));
    expect(tree.tasks["blocked-leaf"].goal).toBe("new goal");
    expect(tree.tasks["blocked-leaf"].acceptance).toEqual(["new acceptance a", "new acceptance b"]);
    expect(tree.tasks["blocked-leaf"].blocker).toBe("new blocker");
    expect(tree.tasks["blocked-leaf"].outputs).toEqual(["evidence/archive/blocked.md"]);

    const journal = await readFile(join(appDir, ".state", "journal.jsonl"), "utf8");
    expect(journal).toContain('"kind":"task_text_updated"');
    expect(journal).toContain('"task_id":"blocked-leaf"');
  });
});
