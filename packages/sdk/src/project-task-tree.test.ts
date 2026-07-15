import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assignRunnableBacklogTasks,
  assignTask,
  compactDoneLeaves,
  completeTask,
  confirmRunnableBacklogLeaves,
  createTask,
  dependenciesSatisfied,
  drainTaskAssignments,
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
  saveTaskTree,
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

    saveTaskTree(config(appDir), tree);
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
    expect(assignment.sessionId).toContain("s_task_leaf_");
    expect(assignment).toEqual({
      taskId: "leaf",
      attemptId: assignment.attemptId,
      sessionId: assignment.sessionId,
      worker: "owner-agent",
      assignedAt: assignment.assignedAt,
    });
    expect(peekTaskAssignments(config(appDir))).toEqual([assignment]);
    expect(drainTaskAssignments(config(appDir))).toEqual([assignment]);
    expect(peekTaskAssignments(config(appDir))).toEqual([]);

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
    expect(tree.tasks.project.status).toBe("backlog");
    expect(tree.tasks.project.result).toBeUndefined();

    markTaskDone(config(appDir), {
      taskId: "leaf",
      summary: "owner accepted the artifact",
    });

    tree = readTaskTree(config(appDir));
    expect(tree.tasks.leaf.status).toBe("done");
    expect(tree.tasks.project.status).toBe("backlog");
    expect(tree.active_task_ids).toEqual([]);
  });

  test("drops write-ahead assignments that were not committed to the tree", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      tasks: {
        project: { id: "project", state: "backlog", children: ["leaf"] },
        leaf: {
          id: "leaf",
          parent_id: "project",
          state: "backlog",
          children: [],
          goal: "work",
          outputs: ["artifact"],
          acceptance: ["done"],
        },
      },
    });
    await writeFile(
      join(appDir, ".state", "task-assignments.jsonl"),
      `${JSON.stringify({
        taskId: "leaf",
        attemptId: "attempt-before-crash",
        sessionId: "session-before-crash",
        worker: "owner-agent",
        assignedAt: new Date().toISOString(),
      })}\n`,
      "utf8",
    );

    expect(drainTaskAssignments(config(appDir))).toEqual([]);
    expect(peekTaskAssignments(config(appDir))).toEqual([]);
    expect(readTaskTree(config(appDir)).tasks.leaf.status).toBe("backlog");
  });

  test("uses a fresh session when an archived task id is created again", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          state: "active",
          children: [],
          goal: "project",
          outputs: ["tasks/tree.json"],
          acceptance: ["complete"],
        },
      },
    });

    createTask(config(appDir), {
      id: "reused-leaf",
      parentId: "project",
      goal: "first incarnation",
      outputs: ["first"],
      acceptance: ["first complete"],
    });
    const first = assignTask(config(appDir), {
      taskId: "reused-leaf",
      attemptId: "attempt-first",
    });

    const archivedTree = readTaskTree(config(appDir));
    delete archivedTree.tasks["reused-leaf"];
    archivedTree.tasks.project.children = [];
    archivedTree.active_task_id = null;
    archivedTree.active_task_ids = [];
    await writeTree(appDir, archivedTree);

    createTask(config(appDir), {
      id: "reused-leaf",
      parentId: "project",
      goal: "second incarnation",
      outputs: ["second"],
      acceptance: ["second complete"],
    });
    const second = assignTask(config(appDir), {
      taskId: "reused-leaf",
      attemptId: "attempt-second",
    });

    expect(second.sessionId).not.toBe(first.sessionId);
    expect(first.sessionId).toContain("attempt-first");
    expect(second.sessionId).toContain("attempt-second");
  });

  test("returns blocked parent hints without mutating owner judgment", async () => {
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

    const hints = repairTaskTreeRollups(config(appDir));
    expect(hints.repaired).toEqual(
      expect.arrayContaining([expect.objectContaining({ taskId: "lane", from: "active", to: "blocked" })]),
    );

    const tree = readTaskTree(config(appDir));
    expect(tree.tasks.lane.status).toBe("active");
    expect(tree.tasks.lane.blocker).toBeUndefined();
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

  test("refuses to unblock a future-window blocked leaf before resume_at unless forced", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          state: "blocked",
          children: ["future-window-leaf"],
          goal: "project",
          outputs: ["tasks/tree.json"],
          acceptance: ["complete"],
        },
        "future-window-leaf": {
          id: "future-window-leaf",
          parent_id: "project",
          state: "blocked",
          children: [],
          blocker: {
            condition: "Do not start before the review window opens.",
            resume_at: "2099-06-26T12:00:00.000Z",
          },
          goal: "rerun after the future review window",
          outputs: ["artifact"],
          acceptance: ["rerun completed"],
        },
      },
    });

    expect(() =>
      unblockTask(config(appDir), {
        taskId: "future-window-leaf",
        reason: "resume window passed",
      }),
    ).toThrow(/remains time-gated until 2099-06-26T12:00:00.000Z/);

    const forced = unblockTask(config(appDir), {
      taskId: "future-window-leaf",
      reason: "explicit operator override",
      force: true,
    });
    expect(forced.state).toBe("backlog");
    expect(forced.trace?.unblock_reason).toBe("explicit operator override");
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
    const assignment = assignTask(config(appDir), {
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
      review: {
        summary: "The artifact has no verification evidence.",
        findings: ["artifact exists but no test result was cited"],
        feedback: ["Run the artifact verification and cite its result."],
        artifacts: ["artifact"],
        verification: ["artifact has evidence"],
      },
    });

    const tree = readTaskTree(config(appDir));
    expect(tree.tasks.leaf.status).toBe("backlog");
    expect(tree.tasks.leaf.session_id).toBeUndefined();
    expect(tree.tasks.leaf.session_history).toEqual([assignment.sessionId]);
    expect(tree.tasks.leaf.trace?.review_reject_reason).toBe("acceptance not met: no evidence");
    expect(tree.tasks.leaf.trace?.review_reject).toEqual({
      summary: "The artifact has no verification evidence.",
      findings: ["artifact exists but no test result was cited"],
      feedback: ["Run the artifact verification and cite its result."],
      artifacts: ["artifact"],
      verification: ["artifact has evidence"],
    });
    expect(tree.tasks.leaf.trace?.review_reject_fresh_session).toBe(true);
    expect(tree.tasks.leaf.trace?.previous_attempt_id).toBe("attempt-1");
    expect(tree.tasks.leaf.trace?.current_attempt_id).toBeUndefined();
    expect(tree.active_task_ids).toEqual([]);

    const retry = assignTask(config(appDir), {
      taskId: "leaf",
      attemptId: "attempt-2",
    });
    expect(retry.sessionId).not.toBe(assignment.sessionId);
    expect(retry.sessionId).toContain("attempt-2");

    const retryTree = readTaskTree(config(appDir));
    expect(retryTree.tasks.leaf.session_history).toEqual([
      assignment.sessionId,
      retry.sessionId,
    ]);
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
    const assignment = assignTask(config(appDir), {
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

    expect(retry.sessionId).not.toBe(assignment.sessionId);
    expect(retry.sessionId).toContain("attempt-2");

    const retryTree = readTaskTree(config(appDir));
    expect(retryTree.tasks.leaf.session_history).toEqual([
      assignment.sessionId,
      retry.sessionId,
    ]);
    expect(retryTree.tasks.leaf.trace?.review_reject_fresh_session).toBe(false);
    expect(retryTree.tasks.leaf.trace?.last_session).toBe(retry.sessionId);
  });

  test("rejects assignment when worker, owner, and config worker are all empty", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          state: "backlog",
          children: ["leaf"],
          goal: "project",
          outputs: ["tasks/tree.json"],
          acceptance: ["complete"],
        },
        leaf: {
          id: "leaf",
          parent_id: "project",
          state: "backlog",
          children: [],
          goal: "unassigned leaf",
          outputs: ["artifact"],
          acceptance: ["artifact exists"],
          owner: "",
        },
      },
    });

    expect(() =>
      assignTask(
        taskTreeConfig({
          appDir,
          projectDir: appDir,
          worker: "",
          maxConcurrent: 1,
        }),
        { taskId: "leaf", worker: "" },
      ),
    ).toThrow(/non-empty worker\/owner contract/);

    const tree = readTaskTree(
      taskTreeConfig({
        appDir,
        projectDir: appDir,
        worker: "",
        maxConcurrent: 1,
      }),
    );
    expect(tree.tasks.leaf.state).toBe("backlog");
    expect(tree.tasks.leaf.status).toBe("backlog");
    expect(tree.tasks.leaf.trace?.assigned_worker).toBeUndefined();
    expect(peekTaskAssignments(
      taskTreeConfig({
        appDir,
        projectDir: appDir,
        worker: "",
        maxConcurrent: 1,
      }),
    )).toHaveLength(0);
  });

  test("trims blank worker input and falls back to task owner", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          state: "backlog",
          children: ["leaf"],
          goal: "project",
          outputs: ["tasks/tree.json"],
          acceptance: ["complete"],
        },
        leaf: {
          id: "leaf",
          parent_id: "project",
          state: "backlog",
          children: [],
          goal: "owned leaf",
          outputs: ["artifact"],
          acceptance: ["artifact exists"],
          owner: "app-ops",
        },
      },
    });

    const assignment = assignTask(config(appDir), {
      taskId: "leaf",
      worker: "   ",
      attemptId: "attempt-blank-worker",
    });

    expect(assignment.worker).toBe("app-ops");
    const tree = readTaskTree(config(appDir));
    expect(tree.tasks.leaf.owner).toBe("app-ops");
    expect(tree.tasks.leaf.trace?.assigned_worker).toBe("app-ops");
    const queued = peekTaskAssignments(config(appDir));
    expect(queued).toHaveLength(1);
    expect(queued[0]?.worker).toBe("app-ops");
  });

  test("assignRunnableBacklogTasks skips blank worker input and preserves truthful owner fallback", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          state: "backlog",
          children: ["leaf"],
          goal: "project",
          outputs: ["tasks/tree.json"],
          acceptance: ["complete"],
        },
        leaf: {
          id: "leaf",
          parent_id: "project",
          state: "backlog",
          children: [],
          goal: "owned leaf",
          outputs: ["artifact"],
          acceptance: ["artifact exists"],
          owner: "aks-explorer",
        },
      },
    });

    const result = assignRunnableBacklogTasks(config(appDir), {
      worker: "",
      limit: 1,
    });

    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0]?.worker).toBe("aks-explorer");
    const tree = readTaskTree(config(appDir));
    expect(tree.tasks.leaf.owner).toBe("aks-explorer");
    expect(tree.tasks.leaf.trace?.assigned_worker).toBe("aks-explorer");
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

  test("planningPacket excludes durable loop roots from compaction candidates even when done and completion-ready", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          state: "active",
          children: ["aks-feature-reference-loop", "ordinary-open"],
          goal: "project root",
          outputs: ["tasks/tree.json"],
          acceptance: ["complete"],
          context: {
            archived_done_leaf_count: 7,
            rollup_summary: "Parent already summarizes retained durable loop context.",
          },
        },
        "aks-feature-reference-loop": {
          id: "aks-feature-reference-loop",
          parent_id: "project",
          state: "done",
          status: "done",
          workflow: "feature-reference-loop-controller",
          children: [],
          goal: "Keep feature references current.",
          outputs: [".state/feature-reference-loop/state.json"],
          acceptance: ["Loop remains present until explicitly retired."],
          context: {
            workflowProgress: {
              completionReady: true,
              reason: "feature-reference loop state has no pending, running, or error features",
              pending: 0,
              running: 0,
              done: 305,
              error: 0,
              openChildren: 0,
            },
          },
        },
        "ordinary-open": {
          id: "ordinary-open",
          parent_id: "project",
          state: "blocked",
          status: "blocked",
          children: [],
          goal: "Wait for exact external return.",
          outputs: ["evidence/archive/ordinary-open.md"],
          acceptance: ["resume when proof returns"],
          blocker: "external proof pending",
        },
      },
    });

    const packet = planningPacket(config(appDir));

    expect(packet.task_tree_hygiene).toBeUndefined();
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

  test("structured blocker updates ignore null wait-target patches and preserve the existing structured wait metadata", async () => {
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
          goal: "keep the exact approval wait",
          outputs: ["evidence/archive/blocked.md"],
          acceptance: ["approval return reviewed"],
          blocker: {
            condition: "Waiting for returned approval.",
            category: "external-wait",
            owner: "human",
            waiting_for: {
              type: "project.approval.submitted",
              taskId: "blocked-leaf",
              pathId: "focus-review-off_track-approval-refresh-20260712",
            },
            observed_by: {
              workflow: "project-planner",
              trigger: "project.approval.submitted",
            },
            resume_condition: "Resume when the returned approval lands.",
          },
        },
      },
    });

    const updated = updateTaskText(config(appDir), {
      taskId: "blocked-leaf",
      blocker: {
        condition: "Still waiting for returned approval after a same-lineage refresh.",
        waiting_for: null,
        observed_by: null,
      },
      nextCheckAt: "2099-06-27T12:00:00.000Z",
      fallbackAt: "2099-06-28T00:00:00.000Z",
    });

    expect(updated.blocker).toMatchObject({
      condition:
        "Still waiting for returned approval after a same-lineage refresh.",
      waiting_for: {
        type: "project.approval.submitted",
        taskId: "blocked-leaf",
        pathId: "focus-review-off_track-approval-refresh-20260712",
      },
      observed_by: {
        workflow: "project-planner",
        trigger: "project.approval.submitted",
      },
      next_check_at: "2099-06-27T12:00:00.000Z",
      fallback_at: "2099-06-28T00:00:00.000Z",
    });
  });

  test("string blocker edits preserve existing structured wait metadata on blocked tasks", async () => {
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
          goal: "keep the exact approval wait",
          outputs: ["evidence/archive/blocked.md"],
          acceptance: ["approval return reviewed"],
          blocker: {
            condition: "Waiting for returned approval.",
            category: "external-wait",
            owner: "human",
            waiting_for: {
              type: "project.approval.submitted",
              taskId: "blocked-leaf",
              pathId: "focus-terminal-frontier-finality-reconciliation-20260714",
            },
            observed_by: {
              workflow: "project-planner",
              trigger: "project.approval.submitted",
            },
            resume_condition: "Resume when the returned approval lands.",
            next_check_at: "2099-06-27T12:00:00.000Z",
            fallback_at: "2099-06-28T00:00:00.000Z",
          },
        },
      },
    });

    const updated = updateTaskText(config(appDir), {
      taskId: "blocked-leaf",
      blocker: "Waiting for the same returned approval after a readout refresh.",
    });

    expect(updated.blocker).toMatchObject({
      condition:
        "Waiting for the same returned approval after a readout refresh.",
      category: "external-wait",
      owner: "human",
      waiting_for: {
        type: "project.approval.submitted",
        taskId: "blocked-leaf",
        pathId: "focus-terminal-frontier-finality-reconciliation-20260714",
      },
      observed_by: {
        workflow: "project-planner",
        trigger: "project.approval.submitted",
      },
      resume_condition: "Resume when the returned approval lands.",
      next_check_at: "2099-06-27T12:00:00.000Z",
      fallback_at: "2099-06-28T00:00:00.000Z",
    });
  });

  test("refreshing next check without explicit resume moves resume watch time", async () => {
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
          goal: "wait for owner response",
          outputs: ["evidence/archive/blocked.md"],
          acceptance: ["owner response handled"],
          blocker: {
            condition: "Waiting for owner response.",
            category: "external-wait",
            owner: "human",
            resume_condition: "Resume when owner responds.",
            resume_at: "2001-01-01T00:00:00.000Z",
            next_check_at: "2001-01-01T00:00:00.000Z",
            fallback_at: "2001-01-02T00:00:00.000Z",
            fallback_action: "Refresh or escalate.",
          },
        },
      },
    });

    const updated = updateTaskText(config(appDir), {
      taskId: "blocked-leaf",
      nextCheckAt: "2099-06-27T12:00:00.000Z",
      fallbackAt: "2099-06-28T00:00:00.000Z",
      fallbackAction: "Refresh again or escalate.",
    });

    expect(updated.blocker).toMatchObject({
      condition: "Waiting for owner response.",
      resume_at: "2099-06-27T12:00:00.000Z",
      next_check_at: "2099-06-27T12:00:00.000Z",
      fallback_at: "2099-06-28T00:00:00.000Z",
      fallback_action: "Refresh again or escalate.",
    });
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

  test("suggests blocked workflow-controller rollup without applying it", async () => {
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
    expect(summary.frontier.blocked).not.toContain("aks-spec-verification-loop");

    const tree = readTaskTree(config(appDir));
    expect(tree.tasks["aks-spec-verification-loop"].status).toBe("backlog");
    expect(tree.tasks["aks-spec-verification-loop"].blocker).toBeUndefined();
  });

  test("suggests blocked workflow-controller rollup with done residues without applying it", async () => {
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
    expect(summary.frontier.runnable).toContain("aks-feature-compact-loop");
    expect(summary.frontier.active).toEqual([]);
    expect(summary.frontier.blocked).not.toContain("aks-feature-compact-loop");

    const tree = readTaskTree(config(appDir));
    expect(tree.tasks["aks-feature-compact-loop"].status).toBe("backlog");
    expect(tree.tasks["aks-feature-compact-loop"].blocker).toBeUndefined();
  });

  test("suggests reopening a blocked controller without mutating it", async () => {
    const appDir = await makeApp();
    await writeTree(appDir, {
      root_task_id: "project",
      active_task_id: null,
      active_task_ids: [],
      tasks: {
        project: {
          id: "project",
          state: "blocked",
          children: ["aks-feature-compact-loop"],
          goal: "project",
          outputs: ["tasks/tree.json"],
          acceptance: ["done"],
        },
        "aks-feature-compact-loop": {
          id: "aks-feature-compact-loop",
          parent_id: "project",
          state: "blocked",
          status: "blocked",
          workflow: "feature-compact-loop-controller",
          priority: "P1",
          children: ["wait-compact-proof"],
          goal: "Keep feature compact planning current.",
          outputs: [".state/feature-compact-loop/state.json"],
          acceptance: ["Loop remains present until explicitly retired."],
          context: {
            workflowProgress: {
              completionReady: false,
              dispatchHeld: true,
              dispatchHold:
                "feature-compact loop live dispatch held because 5 Azure DevOps pipeline run(s) are already in progress on dev; limit=5",
              reason:
                "feature-compact loop live dispatch held because 5 Azure DevOps pipeline run(s) are already in progress on dev; limit=5",
              pending: 19,
              running: 1,
              done: 33,
              blocked: 27,
              error: 4,
              unrepresentedNonTerminalCount: 19,
              activeGithubRuns: 5,
              githubActiveRunLimit: 5,
              openChildren: 0,
              openSupportChildren: 0,
              blockedWaitChildren: 1,
            },
          },
          blocker: {
            condition: "Child blocked: wait-compact-proof.",
            category: "child-blocked",
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
      },
    });

    const repair = repairTaskTreeRollups(config(appDir));
    expect(repair.repaired).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: "aks-feature-compact-loop",
          from: "blocked",
          to: "backlog",
        }),
      ]),
    );

    const summary = summarizeTaskTree(config(appDir));
    expect(summary.frontier.runnable).not.toContain("aks-feature-compact-loop");
    expect(summary.frontier.blocked).toContain("aks-feature-compact-loop");

    const tree = readTaskTree(config(appDir));
    expect(tree.tasks["aks-feature-compact-loop"].status).toBe("blocked");
    expect(tree.tasks["aks-feature-compact-loop"].blocker).toMatchObject({ category: "child-blocked" });
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
