import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assignTask,
  compactDoneLeaves,
  completeTask,
  confirmRunnableBacklogLeaves,
  createTask,
  dependenciesSatisfied,
  listRunnableBacklogTaskIds,
  markTaskDone,
  summarizeTaskTree,
  peekTaskAssignments,
  planningPacket,
  pruneMissingChildren,
  readTaskTree,
  rejectTaskReview,
  repairTaskTreeRollups,
  rollupParent,
  taskTreeConfig,
  unblockTask,
  updateTaskText,
} from "./index.js";

async function makeApp() {
  const dir = await mkdtemp(join(tmpdir(), "may-sdk-task-tree-"));
  await mkdir(join(dir, ".state", "tasks"), { recursive: true });
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
  await writeFile(join(appDir, ".state", "tasks", "tree.json"), `${JSON.stringify(tree, null, 2)}\n`, "utf8");
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
    const persisted = JSON.parse(await readFile(join(appDir, ".state", "tasks", "tree.json"), "utf8"));
    expect(persisted.tasks["done-leaf"].state).toBe("done");
    expect(persisted.tasks["done-leaf"].status).toBeUndefined();
  });

  test("prunes missing child references from a named parent", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          state: "review",
          children: ["live-child", "missing-child"],
          goal: "project",
          outputs: ["tasks/tree.json"],
          acceptance: ["complete"],
        },
        "live-child": {
          id: "live-child",
          parent_id: "project",
          state: "done",
          children: [],
          goal: "still present",
          outputs: ["artifact"],
          acceptance: ["done"],
        },
      },
    });

    const result = pruneMissingChildren(config(appDir), { parentId: "project" });

    expect(result).toMatchObject({
      changed: true,
      parentId: "project",
      removedChildIds: ["missing-child"],
      remainingChildIds: ["live-child"],
      active_task_ids: [],
    });

    const persisted = JSON.parse(await readFile(join(appDir, ".state", "tasks", "tree.json"), "utf8"));
    expect(persisted.tasks.project.children).toEqual(["live-child"]);
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
      evidence: ["artifact"],
    });

    let tree = readTaskTree(config(appDir));
    expect(tree.tasks.leaf.status).toBe("review");
    expect(tree.tasks.leaf.result).toBe("worker completed the artifact");
    expect(tree.tasks.leaf.evidence).toEqual(["artifact"]);
    expect(tree.tasks.project.status).toBe("review");
    expect(tree.tasks.project.result).toBe("Child review pending: leaf.");

    markTaskDone(config(appDir), {
      taskId: "leaf",
      summary: "owner accepted the artifact",
    });

    tree = readTaskTree(config(appDir));
    expect(tree.tasks.leaf.status).toBe("done");
    expect(tree.tasks.project.status).toBe("done");
    expect(tree.active_task_ids).toEqual([]);
  });

  test("rolls blocked parents with a structured blocker condition", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          state: "active",
          children: ["lane"],
          goal: "project",
          outputs: ["tasks/tree.json"],
          acceptance: ["complete"],
        },
        lane: {
          id: "lane",
          parent_id: "project",
          state: "active",
          children: ["blocked-leaf"],
          goal: "lane",
          outputs: ["artifact"],
          acceptance: ["complete"],
        },
        "blocked-leaf": {
          id: "blocked-leaf",
          parent_id: "lane",
          state: "blocked",
          children: [],
          goal: "blocked work",
          outputs: ["artifact"],
          acceptance: ["complete"],
          blocker: {
            condition: "external dependency",
          },
        },
      },
    });

    repairTaskTreeRollups(config(appDir));

    const tree = readTaskTree(config(appDir));
    expect(tree.tasks.lane.status).toBe("blocked");
    expect(tree.tasks.lane.blocker).toMatchObject({
      condition: "Child blocked: blocked-leaf.",
      category: "child-blocked",
      waiting_for: {
        type: "child.task.blocked",
        taskId: "lane",
        childTaskIds: ["blocked-leaf"],
      },
      observed_by: {
        trigger: "task_tree_rollup_repaired",
      },
    });
    expect((tree.tasks.lane.blocker as Record<string, unknown>).next_check_at).toBeTruthy();
    expect((tree.tasks.lane.blocker as Record<string, unknown>).fallback_at).toBeTruthy();
  });

  test("unblocks a blocked leaf back to backlog", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          state: "blocked",
          children: ["blocked-leaf"],
          goal: "project",
          outputs: ["tasks/tree.json"],
          acceptance: ["complete"],
        },
        "blocked-leaf": {
          id: "blocked-leaf",
          parent_id: "project",
          state: "blocked",
          children: [],
          blocker: "waiting on previous wave",
          goal: "rerun after previous wave settles",
          outputs: ["artifact"],
          acceptance: ["rerun completed"],
        },
      },
    });

    const task = unblockTask(config(appDir), {
      taskId: "blocked-leaf",
      reason: "previous wave is done",
    });

    expect(task.state).toBe("backlog");
    expect(task.status).toBe("backlog");
    expect(task.blocker).toBeUndefined();
    expect(task.trace?.unblock_reason).toBe("previous wave is done");

    const tree = readTaskTree(config(appDir));
    expect(tree.tasks["blocked-leaf"].state).toBe("backlog");
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

  test("uses a fresh retry session after an error review even when caller did not request one", async () => {
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
      summary: "error",
    });

    rejectTaskReview(config(appDir), {
      taskId: "leaf",
      reason: "worker errored before producing evidence",
    });

    const retry = assignTask(config(appDir), {
      taskId: "leaf",
      attemptId: "attempt-2",
    });

    expect(retry.sessionId).not.toBe("s_task_leaf");
    expect(retry.sessionId.startsWith("s_task_leaf_retry_")).toBe(true);

    const retryTree = readTaskTree(config(appDir));
    expect(retryTree.tasks.leaf.session_history).toEqual(["s_task_leaf", retry.sessionId]);
    expect(retryTree.tasks.leaf.trace?.review_reject_fresh_session).toBe(false);
    expect(retryTree.tasks.leaf.trace?.last_session).toBe(retry.sessionId);
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

  test("planningPacket prefers featurePaths over stale mirror paths for model_status_summary", async () => {
    const appDir = await makeApp();
    const projectDir = await mkdtemp(join(tmpdir(), "may-sdk-model-"));
    await mkdir(join(projectDir, "model", "knowledge-map"), { recursive: true });

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

    const modelData = {
      version: 1,
      featurePaths: [
        {
          id: "path.serverless-virtual-nodes.multi-pod-burst",
          status: "blocked",
          rootCauseClass: "runtime",
          retestCondition: "Retry only after virtual-node readiness changes.",
        },
        {
          id: "path.private-cluster-none-dns-zone-v3",
          status: "unknown",
          rootCauseClass: "none",
        },
      ],
      paths: [
        {
          id: "path.serverless-virtual-nodes.multi-pod-burst",
          status: "unknown",
          rootCauseClass: "source-grounded-check-replay-execute-capable",
        },
        {
          id: "path.private-cluster-none-dns-zone-v3",
          status: "unknown",
          rootCauseClass: "none",
        },
      ],
    };
    await writeFile(
      join(projectDir, "model", "knowledge-map", "model.json"),
      JSON.stringify(modelData, null, 2),
      "utf8",
    );

    const packet = planningPacket(config(appDir, projectDir));
    const summary = packet.model_status_summary!;
    expect(summary).toBeDefined();
    expect(summary.total).toBe(2);
    expect(summary.non_passing).toBe(2);

    const burstPath = summary.non_passing_paths.find((p) => p.id === "path.serverless-virtual-nodes.multi-pod-burst");
    expect(burstPath).toBeDefined();
    expect(burstPath!.status).toBe("blocked");
    expect(burstPath!.rootCauseClass).toBe("runtime");

    const privateClusterPath = summary.non_passing_paths.find((p) => p.id === "path.private-cluster-none-dns-zone-v3");
    expect(privateClusterPath).toBeDefined();
    expect(privateClusterPath!.status).toBe("unknown");
    expect(privateClusterPath!.rootCauseClass).toBe("none");
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

  test("planningPacket exposes structural compaction candidates for owner judgment", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          state: "active",
          children: ["lane"],
          goal: "project root",
          outputs: ["tasks/tree.json"],
          acceptance: ["complete"],
        },
        lane: {
          id: "lane",
          parent_id: "project",
          state: "active",
          children: ["done-a", "done-b", "protected-done", "open-leaf"],
          goal: "durable lane",
          outputs: ["lane"],
          acceptance: ["children complete"],
          context: {
            archived_done_leaf_count: 3,
            rollup_summary: "Already summarized historical work.",
          },
        },
        "done-a": {
          id: "done-a",
          parent_id: "lane",
          state: "done",
          children: [],
          goal: "mechanical completed detail A",
          outputs: ["a"],
          acceptance: ["done"],
        },
        "done-b": {
          id: "done-b",
          parent_id: "lane",
          state: "done",
          children: [],
          goal: "mechanical completed detail B",
          outputs: ["b"],
          acceptance: ["done"],
        },
        "protected-done": {
          id: "protected-done",
          parent_id: "lane",
          state: "done",
          children: [],
          goal: "dependency still needed",
          outputs: ["needed"],
          acceptance: ["done"],
        },
        "open-leaf": {
          id: "open-leaf",
          parent_id: "lane",
          state: "backlog",
          children: [],
          goal: "open work depending on protected done",
          outputs: ["open"],
          acceptance: ["done"],
          depends_on: ["protected-done"],
        },
      },
    });

    const packet = planningPacket(config(appDir));

    expect(packet.task_tree_hygiene).toMatchObject({
      safe_done_leaf_count: 2,
      protected_done_leaf_count: 1,
      compaction_candidates: [
        {
          parent_id: "lane",
          child_count: 4,
          open_child_count: 1,
          done_child_count: 3,
          safe_done_leaf_count: 2,
          archived_done_leaf_count: 3,
          rollup_summary: "Already summarized historical work.",
          sample_done_leaf_ids: ["done-a", "done-b"],
        },
      ],
    });
  });

  test("planningPacket exposes blocked frontier groups beyond capped samples", async () => {
    const appDir = await makeApp();
    const blockedTasks = Object.fromEntries(
      Array.from({ length: 12 }, (_, index) => {
        const id = `blocked-${index + 1}`;
        const parentId = index < 9 ? "large-blocked-family" : "small-blocked-family";
        return [
          id,
          {
            id,
            parent_id: parentId,
            state: "blocked",
            children: [],
            goal: `blocked leaf ${index + 1}`,
            outputs: [`evidence/${id}.md`],
            acceptance: ["resume when external proof returns"],
            blocker:
              index < 6
                ? "External source-holder proof required before bounded retry."
                : `Specific blocker ${index + 1}`,
          },
        ];
      }),
    );
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          state: "active",
          children: ["large-blocked-family", "small-blocked-family"],
          goal: "project root",
          outputs: ["tasks/tree.json"],
          acceptance: ["complete"],
        },
        "large-blocked-family": {
          id: "large-blocked-family",
          parent_id: "project",
          state: "blocked",
          children: Array.from({ length: 9 }, (_, index) => `blocked-${index + 1}`),
          goal: "large blocked family",
          outputs: ["large"],
          acceptance: ["unblocked"],
        },
        "small-blocked-family": {
          id: "small-blocked-family",
          parent_id: "project",
          state: "blocked",
          children: ["blocked-10", "blocked-11", "blocked-12"],
          goal: "small blocked family",
          outputs: ["small"],
          acceptance: ["unblocked"],
        },
        ...blockedTasks,
      },
    });

    const packet = planningPacket(config(appDir));

    expect(packet.frontier_details.blocked).toHaveLength(8);
    expect(packet.blocked_frontier_summary).toMatchObject({
      blocked_leaf_count: 12,
      parent_groups: [
        {
          parent_id: "large-blocked-family",
          blocked_leaf_count: 9,
          total_child_count: 9,
          open_child_count: 9,
        },
        {
          parent_id: "small-blocked-family",
          blocked_leaf_count: 3,
          total_child_count: 3,
          open_child_count: 3,
        },
      ],
      repeated_blocker_groups: [
        {
          blocked_leaf_count: 6,
          parent_ids: ["large-blocked-family"],
        },
      ],
    });
    expect(packet.blocked_frontier_summary?.parent_groups[0].sample_blocked_leaf_ids).toContain("blocked-1");
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

    expect(() => assignTask(config(appDir), { taskId: "blocked-backlog-leaf" })).toThrow(/conflicts with active work/);

    const tree = readTaskTree(config(appDir));
    expect(tree.tasks["blocked-backlog-leaf"].status).toBe("backlog");
    expect(tree.tasks["blocked-backlog-leaf"].trace?.promoted_at).toBeUndefined();
    expect(tree.tasks["runnable-backlog-leaf"].status).toBe("backlog");
    expect(tree.tasks["runnable-backlog-leaf"].trace?.promoted_at).toBeDefined();
  });

  test("listRunnableBacklogTaskIds is pure and honors dependencies", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          state: "active",
          children: ["wait-node", "waiting-leaf", "runnable-leaf"],
          goal: "project",
          outputs: ["tasks/tree.json"],
          acceptance: ["complete"],
        },
        "wait-node": {
          id: "wait-node",
          parent_id: "project",
          state: "blocked",
          kind: "domain_leaf",
          priority: "P2",
          owner: "owner-agent",
          children: [],
          goal: "external wait",
          blocker: "external input required",
          outputs: ["evidence/archive/wait.md"],
          acceptance: ["done"],
        },
        "waiting-leaf": {
          id: "waiting-leaf",
          parent_id: "project",
          state: "backlog",
          kind: "domain_leaf",
          priority: "P2",
          owner: "owner-agent",
          children: [],
          goal: "depends on external wait",
          depends_on: ["wait-node"],
          outputs: ["evidence/archive/waiting.md"],
          acceptance: ["done"],
        },
        "runnable-leaf": {
          id: "runnable-leaf",
          parent_id: "project",
          state: "backlog",
          kind: "domain_leaf",
          priority: "P2",
          owner: "owner-agent",
          children: [],
          goal: "clear runnable work",
          outputs: ["evidence/archive/runnable.md"],
          acceptance: ["done"],
        },
      },
    });

    expect(listRunnableBacklogTaskIds(config(appDir), 10)).toEqual(["runnable-leaf"]);

    const packet = planningPacket(config(appDir));
    expect(packet.frontier.runnable).toEqual(["runnable-leaf"]);
    expect(packet.frontier.waiting).toEqual(["waiting-leaf"]);
    expect(packet.frontier_details.waiting).toMatchObject([
      {
        id: "waiting-leaf",
        readiness_reasons: ["depends_on 'wait-node' is blocked, not done"],
      },
    ]);

    const tree = readTaskTree(config(appDir));
    expect(tree.tasks["runnable-leaf"].trace?.promoted_at).toBeUndefined();
    expect(tree.tasks["waiting-leaf"].trace?.promoted_at).toBeUndefined();
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

    const tree = JSON.parse(await readFile(join(appDir, ".state", "tasks", "tree.json"), "utf8"));
    expect(tree.tasks["blocked-leaf"].goal).toBe("new goal");
    expect(tree.tasks["blocked-leaf"].acceptance).toEqual(["new acceptance a", "new acceptance b"]);
    expect(tree.tasks["blocked-leaf"].blocker).toBe("new blocker");
    expect(tree.tasks["blocked-leaf"].outputs).toEqual(["evidence/archive/blocked.md"]);

    const journal = await readFile(join(appDir, ".state", "journal.jsonl"), "utf8");
    expect(journal).toContain('"kind":"task_text_updated"');
    expect(journal).toContain('"task_id":"blocked-leaf"');
  });

  test("creates and updates structured blockers with resume metadata", async () => {
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

    const created = createTask(config(appDir), {
      id: "blocked-leaf",
      parentId: "project",
      state: "blocked",
      goal: "wait for operator proof",
      outputs: ["tasks/tree.json"],
      acceptance: ["proof reviewed"],
      blocker: "Waiting for returned operator proof.",
      blockerCategory: "external-wait",
      blockerOwner: "human",
      resumeCondition: "Resume when proof lands or the follow-up window opens.",
      resumeAt: "2099-06-26T00:00:00.000Z",
      nextCheckAt: "2099-06-26T12:00:00.000Z",
      fallbackAt: "2099-06-27T00:00:00.000Z",
      fallbackAction: "Escalate if proof has not landed.",
    });

    expect(created.blocker).toMatchObject({
      condition: "Waiting for returned operator proof.",
      category: "external-wait",
      owner: "human",
      resume_condition: "Resume when proof lands or the follow-up window opens.",
      resume_at: "2099-06-26T00:00:00.000Z",
      next_check_at: "2099-06-26T12:00:00.000Z",
      fallback_at: "2099-06-27T00:00:00.000Z",
      fallback_action: "Escalate if proof has not landed.",
    });

    const updated = updateTaskText(config(appDir), {
      taskId: "blocked-leaf",
      resumeAt: "2099-06-27T00:00:00.000Z",
      nextCheckAt: "2099-06-27T12:00:00.000Z",
      fallbackAt: "2099-06-28T00:00:00.000Z",
      fallbackAction: "Escalate again if proof has not landed.",
    });

    expect(updated.blocker).toMatchObject({
      condition: "Waiting for returned operator proof.",
      category: "external-wait",
      owner: "human",
      resume_condition: "Resume when proof lands or the follow-up window opens.",
      resume_at: "2099-06-27T00:00:00.000Z",
      next_check_at: "2099-06-27T12:00:00.000Z",
      fallback_at: "2099-06-28T00:00:00.000Z",
      fallback_action: "Escalate again if proof has not landed.",
    });

    const packet = planningPacket(config(appDir));
    expect(packet.frontier_details.blocked[0].blocker).toContain("Waiting for returned operator proof.");
    expect(packet.frontier_details.blocked[0].blocker).toContain("2099-06-27T00:00:00.000Z");
    expect(packet.frontier_details.blocked[0].blocker).toContain("2099-06-28T00:00:00.000Z");
  });

  test("rolls up parent summary and archives selected done child leaves", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          state: "done",
          children: ["lane"],
          goal: "project",
          outputs: ["tasks/tree.json"],
          acceptance: ["complete"],
        },
        lane: {
          id: "lane",
          parent_id: "project",
          state: "done",
          children: ["archive-me", "keep-me"],
          goal: "lane",
          outputs: ["model"],
          acceptance: ["complete"],
        },
        "archive-me": {
          id: "archive-me",
          parent_id: "lane",
          state: "done",
          children: [],
          goal: "mechanical child",
          outputs: ["evidence/archive/archive-me.md"],
          acceptance: ["done"],
        },
        "keep-me": {
          id: "keep-me",
          parent_id: "lane",
          state: "done",
          children: [],
          goal: "milestone child",
          outputs: ["evidence/archive/keep-me.md"],
          acceptance: ["done"],
        },
      },
    });

    const result = rollupParent(config(appDir), {
      parentId: "lane",
      summary: "Lane proved the useful result; archive only the mechanical child.",
      taskIds: ["archive-me"],
      reason: "test branch rollup",
    });

    expect(result.archived).toBe(1);
    expect(result.parentId).toBe("lane");
    expect(result.archivedTaskIds).toEqual(["archive-me"]);
    expect(result.archivePath).toMatch(/^\.state\/tasks\/archive\/done-leaves-/);

    const tree = JSON.parse(await readFile(join(appDir, ".state", "tasks", "tree.json"), "utf8"));
    expect(tree.tasks["archive-me"]).toBeUndefined();
    expect(tree.tasks["keep-me"]).toBeDefined();
    expect(tree.tasks.lane.children).toEqual(["keep-me"]);
    expect(tree.tasks.lane.context.rollup_summary).toBe(
      "Lane proved the useful result; archive only the mechanical child.",
    );
    expect(tree.tasks.lane.context.archived_done_leaf_count).toBe(1);
    expect(tree.tasks.lane.context.rollup_archives[0].task_ids).toEqual(["archive-me"]);

    const archive = JSON.parse(await readFile(join(appDir, result.archivePath!), "utf8"));
    expect(archive.parent_id).toBe("lane");
    expect(archive.summary).toBe("Lane proved the useful result; archive only the mechanical child.");
    expect(archive.tasks.map((task: { id: string }) => task.id)).toEqual(["archive-me"]);
  });

  test("rollup parent writes unique archives for fast consecutive rollups", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          state: "done",
          children: ["lane-a", "lane-b"],
          goal: "project",
          outputs: ["tasks/tree.json"],
          acceptance: ["complete"],
        },
        "lane-a": {
          id: "lane-a",
          parent_id: "project",
          state: "done",
          children: ["archive-a"],
          goal: "lane a",
          outputs: ["a"],
          acceptance: ["done"],
        },
        "archive-a": {
          id: "archive-a",
          parent_id: "lane-a",
          state: "done",
          children: [],
          goal: "archive a",
          outputs: ["a"],
          acceptance: ["done"],
        },
        "lane-b": {
          id: "lane-b",
          parent_id: "project",
          state: "done",
          children: ["archive-b"],
          goal: "lane b",
          outputs: ["b"],
          acceptance: ["done"],
        },
        "archive-b": {
          id: "archive-b",
          parent_id: "lane-b",
          state: "done",
          children: [],
          goal: "archive b",
          outputs: ["b"],
          acceptance: ["done"],
        },
      },
    });

    const first = rollupParent(config(appDir), {
      parentId: "lane-a",
      summary: "Lane A result is preserved on the parent.",
      taskIds: ["archive-a"],
      reason: "first fast rollup",
    });
    const second = rollupParent(config(appDir), {
      parentId: "lane-b",
      summary: "Lane B result is preserved on the parent.",
      taskIds: ["archive-b"],
      reason: "second fast rollup",
    });

    expect(first.archivePath).toBeDefined();
    expect(second.archivePath).toBeDefined();
    expect(first.archivePath).not.toBe(second.archivePath);

    const firstArchive = JSON.parse(await readFile(join(appDir, first.archivePath!), "utf8"));
    const secondArchive = JSON.parse(await readFile(join(appDir, second.archivePath!), "utf8"));
    expect(firstArchive.tasks.map((task: { id: string }) => task.id)).toEqual(["archive-a"]);
    expect(secondArchive.tasks.map((task: { id: string }) => task.id)).toEqual(["archive-b"]);
  });

  test("batch compaction works bottom-up from deepest leaves", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          state: "done",
          children: ["lane"],
          goal: "project",
          outputs: ["tasks/tree.json"],
          acceptance: ["complete"],
        },
        lane: {
          id: "lane",
          parent_id: "project",
          state: "done",
          children: ["branch"],
          goal: "lane",
          outputs: ["lane"],
          acceptance: ["done"],
        },
        branch: {
          id: "branch",
          parent_id: "lane",
          state: "done",
          children: ["deep-leaf"],
          goal: "branch",
          outputs: ["branch"],
          acceptance: ["done"],
        },
        "deep-leaf": {
          id: "deep-leaf",
          parent_id: "branch",
          state: "done",
          children: [],
          goal: "deep completed detail",
          outputs: ["evidence/archive/deep.md"],
          acceptance: ["done"],
        },
      },
    });

    const result = compactDoneLeaves(config(appDir), {
      limit: 3,
      reason: "bottom-up recovery test",
    });

    expect(result.archivedTaskIds).toEqual(["deep-leaf", "branch", "lane"]);
    expect(result.archivePaths).toHaveLength(3);
    expect(new Set(result.archivePaths).size).toBe(3);

    const firstArchive = JSON.parse(await readFile(join(appDir, result.archivePaths![0]), "utf8"));
    const secondArchive = JSON.parse(await readFile(join(appDir, result.archivePaths![1]), "utf8"));
    const thirdArchive = JSON.parse(await readFile(join(appDir, result.archivePaths![2]), "utf8"));
    expect(firstArchive.parent_id).toBe("branch");
    expect(secondArchive.parent_id).toBe("lane");
    expect(thirdArchive.parent_id).toBe("project");
    expect(firstArchive.tasks.map((task: { id: string }) => task.id)).toEqual(["deep-leaf"]);
    expect(secondArchive.tasks.map((task: { id: string }) => task.id)).toEqual(["branch"]);
    expect(thirdArchive.tasks.map((task: { id: string }) => task.id)).toEqual(["lane"]);

    const tree = JSON.parse(await readFile(join(appDir, ".state", "tasks", "tree.json"), "utf8"));
    expect(tree.tasks["deep-leaf"]).toBeUndefined();
    expect(tree.tasks.branch).toBeUndefined();
    expect(tree.tasks.lane).toBeUndefined();
    expect(tree.tasks.project.children).toEqual([]);
    expect(tree.tasks.project.context.archived_done_leaf_count).toBe(1);
  });

  test("batch compaction follows one branch upward before jumping sideways", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          state: "done",
          children: ["lane-a", "lane-b"],
          goal: "project",
          outputs: ["tasks/tree.json"],
          acceptance: ["complete"],
        },
        "lane-a": {
          id: "lane-a",
          parent_id: "project",
          state: "done",
          children: ["leaf-a"],
          goal: "lane a",
          outputs: ["a"],
          acceptance: ["done"],
        },
        "leaf-a": {
          id: "leaf-a",
          parent_id: "lane-a",
          state: "done",
          children: [],
          goal: "leaf a",
          outputs: ["a"],
          acceptance: ["done"],
        },
        "lane-b": {
          id: "lane-b",
          parent_id: "project",
          state: "done",
          children: ["leaf-b"],
          goal: "lane b",
          outputs: ["b"],
          acceptance: ["done"],
        },
        "leaf-b": {
          id: "leaf-b",
          parent_id: "lane-b",
          state: "done",
          children: [],
          goal: "leaf b",
          outputs: ["b"],
          acceptance: ["done"],
        },
      },
    });

    const result = compactDoneLeaves(config(appDir), {
      limit: 2,
      reason: "branch-first recovery test",
    });

    expect(result.archivedTaskIds).toEqual(["leaf-a", "lane-a"]);
    const tree = JSON.parse(await readFile(join(appDir, ".state", "tasks", "tree.json"), "utf8"));
    expect(tree.tasks["leaf-a"]).toBeUndefined();
    expect(tree.tasks["lane-a"]).toBeUndefined();
    expect(tree.tasks["leaf-b"]).toBeDefined();
    expect(tree.tasks["lane-b"]).toBeDefined();
  });

  test("suppresses paused feature-compact durable controllers from runnable backlog", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          state: "backlog",
          children: ["aks-feature-compact-loop"],
          goal: "project",
          outputs: ["tasks/tree.json"],
          acceptance: ["done"],
        },
        "aks-feature-compact-loop": {
          id: "aks-feature-compact-loop",
          parent_id: "project",
          state: "backlog",
          status: "backlog",
          workflow: "feature-compact-loop-controller",
          priority: "P1",
          children: ["wait-compact-signal"],
          goal: "Keep feature compact planning current.",
          outputs: [".state/feature-compact-loop/state.json"],
          acceptance: ["Loop remains present until explicitly retired."],
          context: {
            workflowProgress: {
              completionReady: false,
              reason:
                "feature-compact loop has no runnable planner or support children; the remaining frontier is exact blocked wait stewardship until a stated resume signal lands",
              pending: 0,
              running: 0,
              error: 84,
              retryBudgetExhausted: 84,
              noRefillNow: true,
            },
          },
        },
        "wait-compact-signal": {
          id: "wait-compact-signal",
          parent_id: "aks-feature-compact-loop",
          state: "blocked",
          status: "blocked",
          goal: "Wait for exact compact resume signal.",
          outputs: ["evidence/archive/wait-compact.md"],
          acceptance: ["Signal returned"],
          blocker: {
            condition: "external signal required",
            category: "external-wait"
          }
        },
      },
    });

    expect(listRunnableBacklogTaskIds(config(appDir), 10)).toEqual([]);
    expect(confirmRunnableBacklogLeaves(config(appDir), 10)).toEqual([]);
  });

  test("suppresses backend-blocked spec-loop durable controllers from runnable backlog", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          state: "backlog",
          children: ["aks-spec-verification-loop"],
          goal: "project",
          outputs: ["tasks/tree.json"],
          acceptance: ["done"],
        },
        "aks-spec-verification-loop": {
          id: "aks-spec-verification-loop",
          parent_id: "project",
          state: "backlog",
          status: "backlog",
          workflow: "spec-loop-controller",
          priority: "P1",
          children: ["wait-spec-auth"],
          goal: "Keep spec verification moving.",
          outputs: [".state/spec-loop/state.json"],
          acceptance: ["Loop remains present until explicitly retired."],
          context: {
            workflowProgress: {
              completionReady: false,
              executionDrained: false,
              backendBlocked: true,
              backendBlocker: "gh auth login required",
              reason: "spec-loop live backend is unavailable",
              pending: 242,
              running: 0,
              error: 121,
              openChildren: 0,
              openFollowups: 0,
            },
          },
        },
        "wait-spec-auth": {
          id: "wait-spec-auth",
          parent_id: "aks-spec-verification-loop",
          state: "blocked",
          status: "blocked",
          goal: "Wait for GitHub auth restoration.",
          outputs: ["evidence/archive/wait-spec-auth.md"],
          acceptance: ["Auth restored"],
          blocker: {
            condition: "GitHub auth required",
            category: "external-wait"
          }
        },
      },
    });

    expect(listRunnableBacklogTaskIds(config(appDir), 10)).toEqual([]);
    expect(confirmRunnableBacklogLeaves(config(appDir), 10)).toEqual([]);
  });

  test("suppresses stranded exhausted residue spec-loop durable controllers from runnable backlog", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          state: "backlog",
          children: ["aks-spec-verification-loop"],
          goal: "project",
          outputs: ["tasks/tree.json"],
          acceptance: ["done"],
        },
        "aks-spec-verification-loop": {
          id: "aks-spec-verification-loop",
          parent_id: "project",
          state: "backlog",
          status: "backlog",
          workflow: "spec-loop-controller",
          priority: "P1",
          children: ["wait-spec-external-signal"],
          goal: "Keep spec verification moving.",
          outputs: [".state/spec-loop/state.json"],
          acceptance: ["Loop remains present until explicitly retired."],
          context: {
            workflowProgress: {
              completionReady: false,
              executionDrained: true,
              noRefillNow: true,
              strandedExhaustedResidueOnly: true,
              reason:
                "spec-loop execution is drained and only exact blocked waits plus stranded exhausted residue remain",
              pending: 123,
              dispatchablePending: 0,
              strandedPending: 123,
              running: 0,
              error: 203,
              retryBudgetExhausted: 203,
              blockedWaitChildren: 1,
              openChildren: 0,
              openFollowups: 0,
            },
          },
        },
        "wait-spec-external-signal": {
          id: "wait-spec-external-signal",
          parent_id: "aks-spec-verification-loop",
          state: "blocked",
          status: "blocked",
          goal: "Wait for exact blocked wait resume signal.",
          outputs: ["evidence/archive/wait-spec.md"],
          acceptance: ["Signal returned"],
          blocker: {
            condition: "external signal required",
            category: "external-wait"
          }
        },
      },
    });

    expect(listRunnableBacklogTaskIds(config(appDir), 10)).toEqual([]);
    expect(confirmRunnableBacklogLeaves(config(appDir), 10)).toEqual([]);
  });

  test("suppresses retry-exhausted feature-reference durable controllers from runnable backlog", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          state: "backlog",
          children: ["aks-feature-reference-loop"],
          goal: "project",
          outputs: ["tasks/tree.json"],
          acceptance: ["done"],
        },
        "aks-feature-reference-loop": {
          id: "aks-feature-reference-loop",
          parent_id: "project",
          state: "backlog",
          status: "backlog",
          workflow: "feature-reference-loop-controller",
          priority: "P1",
          children: ["recorded-collector"],
          goal: "Keep feature references current.",
          outputs: [".state/feature-reference-loop/state.json"],
          acceptance: ["Loop remains present until explicitly retired."],
          context: {
            workflowProgress: {
              completionReady: false,
              reason: "feature-reference loop state still has non-terminal features",
              pending: 0,
              running: 0,
              done: 245,
              error: 46,
              retryBudgetExhausted: 46,
              openChildren: 0,
            },
          },
        },
        "recorded-collector": {
          id: "recorded-collector",
          parent_id: "aks-feature-reference-loop",
          state: "done",
          status: "done",
          goal: "Previously recorded collector task.",
          outputs: ["evidence/archive/feature-reference.md"],
          acceptance: ["done"],
        },
      },
    });

    expect(listRunnableBacklogTaskIds(config(appDir), 10)).toEqual([]);
    expect(confirmRunnableBacklogLeaves(config(appDir), 10)).toEqual([]);
  });

  test("rolls durable workflow controller to blocked when only blocked wait children remain", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          state: "backlog",
          children: ["aks-spec-verification-loop"],
          goal: "project",
          outputs: ["tasks/tree.json"],
          acceptance: ["done"],
        },
        "aks-spec-verification-loop": {
          id: "aks-spec-verification-loop",
          parent_id: "project",
          state: "backlog",
          status: "backlog",
          workflow: "spec-loop-controller",
          priority: "P1",
          children: ["wait-spec-auth", "wait-spec-proof"],
          goal: "Keep spec verification moving.",
          outputs: [".state/spec-loop/state.json"],
          acceptance: ["Loop remains present until explicitly retired."],
          context: {
            workflowProgress: {
              completionReady: false,
              executionDrained: true,
              noRefillNow: true,
              strandedExhaustedResidueOnly: true,
              reason:
                "spec-loop execution is drained and the remaining frontier is exact wait stewardship",
              pending: 244,
              dispatchablePending: 0,
              strandedPending: 244,
              running: 0,
              error: 5,
              retryBudgetExhausted: 5,
              unrepresentedNonTerminalCount: 0,
              blockedWaitChildren: 2,
              openChildren: 0,
              openFollowups: 0,
              activeChildren: 0,
              reviewChildren: 0,
              waitingChildren: 0,
              backlogChildren: 0,
            },
          },
        },
        "wait-spec-auth": {
          id: "wait-spec-auth",
          parent_id: "aks-spec-verification-loop",
          state: "blocked",
          status: "blocked",
          goal: "Wait for GitHub auth restoration.",
          outputs: ["evidence/archive/wait-spec-auth.md"],
          acceptance: ["Auth restored"],
          blocker: {
            condition: "GitHub auth required",
            category: "external-wait",
          },
        },
        "wait-spec-proof": {
          id: "wait-spec-proof",
          parent_id: "aks-spec-verification-loop",
          state: "blocked",
          status: "blocked",
          goal: "Wait for exact proof return.",
          outputs: ["evidence/archive/wait-spec-proof.md"],
          acceptance: ["Proof returned"],
          blocker: {
            condition: "proof required",
            category: "external-wait",
          },
        },
      },
    });

    const repair = repairTaskTreeRollups(config(appDir));
    expect(repair.repaired).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: "aks-spec-verification-loop",
          from: "backlog",
          to: "blocked",
        }),
      ]),
    );

    const summary = summarizeTaskTree(config(appDir));
    expect(summary.frontier.runnable).toEqual([]);
    expect(summary.frontier.active).toEqual([]);
    expect(summary.frontier.blocked).toContain("aks-spec-verification-loop");

    const tree = readTaskTree(config(appDir));
    expect(tree.tasks["aks-spec-verification-loop"].status).toBe("blocked");
    expect(tree.tasks["aks-spec-verification-loop"].blocker).toMatchObject({
      category: "child-blocked",
    });
  });

  test("rolls durable workflow controller to blocked when only blocked waits plus done review residues remain", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          state: "backlog",
          children: ["aks-feature-compact-loop"],
          goal: "project",
          outputs: ["tasks/tree.json"],
          acceptance: ["done"],
        },
        "aks-feature-compact-loop": {
          id: "aks-feature-compact-loop",
          parent_id: "project",
          state: "backlog",
          status: "backlog",
          workflow: "feature-compact-loop-controller",
          priority: "P1",
          children: ["wait-compact-proof", "accepted-review-residue"],
          goal: "Keep feature compact planning current.",
          outputs: [".state/feature-compact-loop/state.json"],
          acceptance: ["Loop remains present until explicitly retired."],
          context: {
            workflowProgress: {
              completionReady: false,
              reason: "feature-compact loop state still has non-terminal features",
              pending: 0,
              running: 0,
              done: 26,
              blocked: 0,
              error: 58,
              retryBudgetExhausted: 55,
              unrepresentedNonTerminalCount: 0,
              activeGithubRuns: 0,
              openChildren: 0,
              openSupportChildren: 0,
              blockedWaitChildren: 1,
            },
          },
        },
        "wait-compact-proof": {
          id: "wait-compact-proof",
          parent_id: "aks-feature-compact-loop",
          state: "blocked",
          status: "blocked",
          goal: "Wait for exact compact proof return.",
          outputs: ["evidence/archive/wait-compact-proof.md"],
          acceptance: ["Proof returned"],
          blocker: {
            condition: "compact proof required",
            category: "external-wait",
          },
        },
        "accepted-review-residue": {
          id: "accepted-review-residue",
          parent_id: "aks-feature-compact-loop",
          state: "done",
          status: "done",
          goal: "Accepted compact reconciliation review already closed.",
          outputs: ["evidence/archive/accepted-review-residue.md"],
          acceptance: ["done"],
        },
      },
    });

    const repair = repairTaskTreeRollups(config(appDir));
    expect(repair.repaired).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: "aks-feature-compact-loop",
          from: "backlog",
          to: "blocked",
        }),
      ]),
    );

    const summary = summarizeTaskTree(config(appDir));
    expect(summary.frontier.runnable).toEqual([]);
    expect(summary.frontier.active).toEqual([]);
    expect(summary.frontier.blocked).toContain("aks-feature-compact-loop");

    const tree = readTaskTree(config(appDir));
    expect(tree.tasks["aks-feature-compact-loop"].status).toBe("blocked");
    expect(tree.tasks["aks-feature-compact-loop"].blocker).toMatchObject({
      category: "child-blocked",
    });
  });

  test("rollup parent refuses to archive unfinished child leaves", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          state: "active",
          children: ["lane"],
          goal: "project",
          outputs: ["tasks/tree.json"],
          acceptance: ["complete"],
        },
        lane: {
          id: "lane",
          parent_id: "project",
          state: "active",
          children: ["active-child"],
          goal: "lane",
          outputs: ["model"],
          acceptance: ["complete"],
        },
        "active-child": {
          id: "active-child",
          parent_id: "lane",
          state: "active",
          children: [],
          goal: "still running",
          outputs: ["evidence/archive/active.md"],
          acceptance: ["done"],
        },
      },
    });

    expect(() =>
      rollupParent(config(appDir), {
        parentId: "lane",
        summary: "This should not archive active work.",
        taskIds: ["active-child"],
      }),
    ).toThrow("not done");

    const tree = JSON.parse(await readFile(join(appDir, ".state", "tasks", "tree.json"), "utf8"));
    expect(tree.tasks["active-child"]).toBeDefined();
    expect(tree.tasks.lane.children).toEqual(["active-child"]);
  });
});
