import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readTaskState, saveTaskState, type ProjectAppTaskIntent, type TaskStateConfig } from "@may-agent/sdk";
import { trackProjectAppConditionEvent } from "./project-app-condition-tracker.ts";
import {
  associateProjectAppTaskSession,
  claimObservedProjectAppTask,
  completeProjectAppTask,
  deferProjectAppTask,
  acknowledgeProjectAppTaskRecoveryAttention,
  listHandlerExecutionFailedProjectAppTasks,
  listHandlerUnavailableProjectAppTasks,
  listWorkspacePreparationFailedProjectAppTasks,
  markProjectAppTaskAttention,
  observeProjectAppTaskIntent,
  listRunnableProjectAppTaskQueueEntries,
  listRunnableProjectAppTaskIds,
  readProjectAppTaskIntent,
  readProjectAppTaskTrigger,
  recordProjectAppTaskTrigger,
  pendingProjectAppTaskRecoveryAttention,
  projectAppTaskQueueEntries,
  ProjectAppTaskActionStaleError,
  repairPreviousRuntimeRecoveryAttention,
  repairRunningProjectAppTasksWithoutAttempt,
  recoverableProjectAppTaskAttempts,
  releaseHandlerExecutionFailedProjectAppTask,
  releaseHandlerUnavailableProjectAppTask,
  releaseWorkspacePreparationFailedProjectAppTask,
  releaseInterruptedProjectAppTaskAttempt,
  releaseStaleProjectAppTaskResult,
  recordProjectAppTaskAttemptSession,
  recordProjectAppTaskAttemptWorkspace,
  taskReconciliationConfig,
} from "./project-app-task-reconciler.ts";

const roots: string[] = [];

function fixture() {
  const root = join(tmpdir(), `task-reconciler-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  roots.push(root);
  const appDir = join(root, "projects", "sample.app");
  mkdirSync(join(appDir, "tasks"), { recursive: true });
  writeFileSync(
    join(appDir, "tasks", "seed.json"),
    `${JSON.stringify(
      {
        root_task_id: "root",
        groups: {
          root: {
            id: "root",
            parent_id: null,
            state: "backlog",
            owner: "branch-owner",
            children: ["operations"],
          },
          operations: {
            id: "operations",
            parent_id: "root",
            state: "backlog",
            children: [],
          },
        },
        resources: {
          "categorized-task": {
            metadata: {
              id: "categorized-task",
              generation: 1,
              resourceVersion: 1,
            },
            spec: {
              parentId: "operations",
              outcome: "Categorized bounded work",
              acceptance: ["The categorized work converges"],
              mode: "achieve",
              category: "domain",
            },
            status: {
              observedGeneration: 0,
              phase: "pending",
              updatedAt: new Date().toISOString(),
            },
          },
        },
      },
      null,
      2,
    )}\n`,
  );
  const config = taskReconciliationConfig({
    appDir,
    projectDir: appDir,
    owner: "app-owner",
    maxConcurrent: 3,
  });
  return { root, appDir, config };
}

function intent(mode: "achieve" | "maintain" = "achieve") {
  return {
    id: mode === "achieve" ? "evaluate:session-1" : "pipeline-monitor",
    parentId: "operations",
    outcome: mode === "achieve" ? "Evaluate session 1" : "Keep the pipeline observable",
    acceptance: ["The workflow returns evidence"],
    mode,
    workflow: "known-workflow",
    input: { sessionId: "session-1" },
  } as const;
}

function declareAndClaimTask(
  config: TaskStateConfig,
  input: {
    intent: ProjectAppTaskIntent;
    appOwner: string;
    handler: string;
    reason?: string;
    trigger?: Record<string, unknown>;
    isOwnerRunnable?: (owner: string) => boolean;
  },
) {
  const observed = observeProjectAppTaskIntent(config, {
    intent: input.intent,
    appOwner: input.appOwner,
    trigger: input.trigger,
  });
  if (observed.kind === "completed") return observed;
  return claimObservedProjectAppTask(config, {
    taskId: observed.taskId,
    appOwner: input.appOwner,
    handler: input.handler,
    reason: input.reason,
    isOwnerRunnable: input.isOwnerRunnable,
  });
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe("project app task reconciler state", () => {
  it("keeps an achieve task live when its handler revises the same task generation", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("achieve"),
      appOwner: "app-owner",
      handler: "owner:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const result = completeProjectAppTask(config, claim, {
      summary: "Bound the newly observed cleanup proof",
      evidence: ["cleanup-proof:resource-group-absent"],
      actions: [
        {
          kind: "update-task",
          taskId: claim.taskId,
          expectedGeneration: claim.generation,
          workflow: "known-workflow",
          input: {
            sessionId: "session-1",
            cleanupProof: "resource-group-absent",
          },
        },
      ],
    });

    expect(result).toMatchObject({
      status: "applied",
      actionsApplied: [`updated ${claim.taskId}`],
      dependentTaskIds: [claim.taskId],
      taskContinues: true,
    });
    const tree = readTaskState(config);
    expect(tree.resources?.[claim.taskId]).toMatchObject({
      metadata: { generation: claim.generation + 1 },
      spec: {
        workflow: "known-workflow",
        input: {
          sessionId: "session-1",
          cleanupProof: "resource-group-absent",
        },
      },
      status: { phase: "pending" },
    });
    expect(tree.attempts?.[claim.attemptId]?.state).toBe("completed");
    expect(tree.receipts?.[claim.taskId]).toBeUndefined();
  });

  it("rejects a no-op or mixed self-update", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("achieve"),
      appOwner: "app-owner",
      handler: "owner:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(() =>
      completeProjectAppTask(config, claim, {
        summary: "No effective correction",
        evidence: ["reviewed-current-input"],
        actions: [
          {
            kind: "update-task",
            taskId: claim.taskId,
            expectedGeneration: claim.generation,
            input: { sessionId: "session-1" },
          },
        ],
      }),
    ).toThrow("must change task execution intent");

    expect(() =>
      completeProjectAppTask(config, claim, {
        summary: "Mixed correction",
        evidence: ["reviewed-current-input"],
        actions: [
          {
            kind: "update-task",
            taskId: claim.taskId,
            expectedGeneration: claim.generation,
            input: { sessionId: "session-2" },
          },
          {
            kind: "create-task",
            id: "unrelated-followup",
            parentId: "operations",
            outcome: "Do unrelated work",
            mode: "achieve",
            outputs: [],
            acceptance: ["The unrelated work completes"],
          },
        ],
      }),
    ).toThrow("must be the only reconciliation action");
  });

  it("carries observed workspace lineage from the attempt into its completion receipt", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("achieve"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    const workspace = {
      kind: "task-worktree" as const,
      path: "/tmp/worktrees/example",
      baseRef: "origin/dev",
      baseCommit: "a".repeat(40),
      branch: "task/example",
      headCommit: "b".repeat(40),
      disposition: "branch-retained" as const,
    };

    expect(recordProjectAppTaskAttemptWorkspace(config, claim, workspace)).toBe(true);
    expect(completeProjectAppTask(config, claim, { summary: "completed in isolated workspace" }).status).toBe(
      "applied",
    );
    expect(readTaskState(config).receipts?.[claim.taskId]?.workspace).toEqual(workspace);
  });
  it("rejects a missing or completed parent instead of creating an orphan", () => {
    const { config } = fixture();

    expect(() =>
      observeProjectAppTaskIntent(config, {
        intent: {
          ...intent(),
          id: "work/orphan",
          parentId: "already-absorbed-parent",
        },
        appOwner: "app-owner",
      }),
    ).toThrow("parent does not exist in the live graph");

    expect(readProjectAppTaskIntent(config, "work/orphan")).toBeNull();
  });

  it("lists pending and explicit owner handoff tasks but keeps unavailable workflows asleep", () => {
    const { config } = fixture();
    const attentionIntent = {
      ...intent(),
      id: "work/attention",
      outcome: "Needs owner review",
    };
    const waitingIntent = {
      ...intent(),
      id: "work/waiting",
      outcome: "Waits for evidence",
    };
    const pendingIntent = {
      ...intent(),
      id: "work/pending",
      outcome: "Ready work",
    };
    const unavailableIntent = {
      ...intent(),
      id: "work/unavailable",
      outcome: "Run only after the workflow binding is repaired",
      workflow: "missing-workflow",
    };

    observeProjectAppTaskIntent(config, { intent: attentionIntent, appOwner: "app-owner" });
    const attentionClaim = claimObservedProjectAppTask(config, {
      taskId: attentionIntent.id,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
      reason: "task-controller",
    });
    if (attentionClaim.kind !== "claimed") throw new Error("expected attention claim");
    markProjectAppTaskAttention(config, attentionClaim, {
      summary: "owner must decide",
      reason: "needs-owner",
    });

    observeProjectAppTaskIntent(config, { intent: unavailableIntent, appOwner: "app-owner" });
    const unavailableClaim = claimObservedProjectAppTask(config, {
      taskId: unavailableIntent.id,
      appOwner: "app-owner",
      handler: "workflow:missing-workflow",
      reason: "task-controller",
    });
    if (unavailableClaim.kind !== "claimed") throw new Error("expected unavailable claim");
    markProjectAppTaskAttention(config, unavailableClaim, {
      summary: "workflow is not installed",
      reason: "HandlerUnavailable",
    });

    observeProjectAppTaskIntent(config, { intent: waitingIntent, appOwner: "app-owner" });
    const waitingClaim = claimObservedProjectAppTask(config, {
      taskId: waitingIntent.id,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
      reason: "task-controller",
    });
    if (waitingClaim.kind !== "claimed") throw new Error("expected waiting claim");
    deferProjectAppTask(config, waitingClaim, {
      disposition: "waiting",
      summary: "waiting for evidence",
      conditions: [
        {
          id: "evidence-window",
          type: "session.end",
          subject: "session:s_evidence",
          expected: "done",
        },
      ],
    });

    observeProjectAppTaskIntent(config, { intent: pendingIntent, appOwner: "app-owner" });
    const maintainClaim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (maintainClaim.kind !== "claimed") throw new Error("expected maintain claim");
    completeProjectAppTask(config, maintainClaim, { summary: "monitor converged" });

    expect(listRunnableProjectAppTaskIds(config)).toEqual(["categorized-task", "work/attention", "work/pending"]);
    expect(listHandlerUnavailableProjectAppTasks(config, "app-owner")).toEqual([
      { taskId: "work/unavailable", owner: "branch-owner", workflow: "missing-workflow" },
    ]);

    observeProjectAppTaskIntent(config, {
      intent: attentionIntent,
      appOwner: "app-owner",
      trigger: { type: "manual.wake", data: { reason: "fresh owner evidence" } },
    });
    expect(listRunnableProjectAppTaskIds(config)).toEqual(["work/attention", "categorized-task", "work/pending"]);

    trackProjectAppConditionEvent(config, {
      type: "session.end",
      sessionId: "s_evidence",
      status: "done",
    });
    expect(listRunnableProjectAppTaskIds(config)).toEqual([
      "work/attention",
      "work/waiting",
      "categorized-task",
      "work/pending",
    ]);

    expect(releaseHandlerUnavailableProjectAppTask(config, "work/unavailable")).toBe(true);
    expect(listRunnableProjectAppTaskIds(config)).toEqual([
      "work/attention",
      "work/waiting",
      "categorized-task",
      "work/pending",
      "work/unavailable",
    ]);
  });

  it("lists and releases only structured workspace preparation failures for the current generation", () => {
    const { config } = fixture();
    const workspaceIntent = {
      ...intent(),
      id: "work/workspace-failed",
      outcome: "Resume a task workspace",
      workflow: "workspace-worker",
    };
    observeProjectAppTaskIntent(config, { intent: workspaceIntent, appOwner: "app-owner" });
    const claim = claimObservedProjectAppTask(config, {
      taskId: workspaceIntent.id,
      appOwner: "app-owner",
      handler: "workflow:workspace-worker",
      reason: "task-controller",
    });
    if (claim.kind !== "claimed") throw new Error("expected workspace claim");
    recordProjectAppTaskAttemptWorkspace(config, claim, {
      kind: "task-worktree",
      path: "/tmp/workspace-failed",
      baseRef: "origin/dev",
      baseCommit: "base",
      branch: "task/workspace-failed",
      headCommit: "head",
      disposition: "active",
    });
    markProjectAppTaskAttention(config, claim, {
      summary: "workspace preparation failed",
      reason: "WorkspacePreparationFailed",
    });

    expect(listWorkspacePreparationFailedProjectAppTasks(config, "app-owner")).toEqual([
      {
        taskId: "work/workspace-failed",
        generation: 1,
        owner: "branch-owner",
        workflow: "workspace-worker",
        previous: expect.objectContaining({ path: "/tmp/workspace-failed" }),
      },
    ]);
    expect(releaseWorkspacePreparationFailedProjectAppTask(config, workspaceIntent.id, 2)).toBe(false);
    expect(releaseWorkspacePreparationFailedProjectAppTask(config, workspaceIntent.id, 1)).toBe(true);
    expect(readTaskState(config).resources?.[workspaceIntent.id].status.phase).toBe("pending");
  });

  it("separates desired-state observation from attempt claiming", () => {
    const { config } = fixture();
    expect(
      observeProjectAppTaskIntent(config, {
        intent: intent("maintain"),
        appOwner: "app-owner",
        trigger: { type: "pipeline.changed", data: { project: "sample" } },
      }),
    ).toMatchObject({ kind: "observed", taskId: "pipeline-monitor", generation: 1, changed: true });

    const observedTree = readTaskState(config);
    expect(observedTree.tasks["pipeline-monitor"]).toMatchObject({
      state: "backlog",
      revision: 1,
    });
    expect(observedTree.resources?.["pipeline-monitor"]).toMatchObject({
      metadata: { id: "pipeline-monitor", generation: 1, resourceVersion: 1 },
      spec: { outcome: "Keep the pipeline observable", mode: "maintain" },
      status: { observedGeneration: 0, phase: "pending" },
    });
    expect(readProjectAppTaskIntent(config, "pipeline-monitor")).toEqual(intent("maintain"));

    const claim = claimObservedProjectAppTask(config, {
      taskId: "pipeline-monitor",
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
      reason: "queue",
    });
    expect(claim).toMatchObject({ kind: "claimed", taskId: "pipeline-monitor", generation: 1 });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    const claimedTree = readTaskState(config);
    expect(claimedTree.resources?.["pipeline-monitor"]).toMatchObject({
      metadata: { generation: 1, resourceVersion: 2 },
      status: { phase: "running", currentAttemptId: claim.attemptId },
    });
    expect(claimedTree.attempts?.[claim.attemptId]).toMatchObject({
      metadata: { id: claim.attemptId, resourceVersion: 1 },
      taskId: "pipeline-monitor",
      taskGeneration: 1,
      state: "running",
      handler: "workflow:known-workflow",
    });
    expect(claimedTree.attempts?.[claim.attemptId]).toMatchObject({
      reason: "queue",
      trigger: { type: "pipeline.changed" },
    });
    expect(claimedTree.tasks["pipeline-monitor"].trace?.reconciliation).toBeUndefined();
  });

  it("orders runnable tasks by declared priority before lower-priority work", () => {
    const { config } = fixture();
    for (const [id, priority] of [
      ["work/p2", "P2"],
      ["work/p0-z", "P0"],
      ["work/p1", "P1"],
      ["work/p0-a", "P0"],
    ] as const) {
      observeProjectAppTaskIntent(config, {
        intent: { ...intent("achieve"), id, priority },
        appOwner: "app-owner",
      });
    }

    expect(listRunnableProjectAppTaskIds(config)).toEqual([
      "work/p0-z",
      "work/p0-a",
      "work/p1",
      "categorized-task",
      "work/p2",
    ]);
  });

  it("prefers older ready work over newer peers within the same priority", () => {
    const { config } = fixture();
    observeProjectAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/a-newer", priority: "P2" },
      appOwner: "app-owner",
    });
    observeProjectAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/z-older", priority: "P2" },
      appOwner: "app-owner",
    });

    const tree = readTaskState(config);
    if (!tree.resources?.["work/a-newer"] || !tree.resources?.["work/z-older"]) {
      throw new Error("expected runnable resources");
    }
    tree.resources["work/a-newer"].status.updatedAt = "2026-07-25T10:00:00.000Z";
    tree.resources["work/z-older"].status.updatedAt = "2026-07-25T09:00:00.000Z";
    saveTaskState(config, tree);

    const runnable = listRunnableProjectAppTaskIds(config);
    expect(runnable.indexOf("work/z-older")).toBeLessThan(runnable.indexOf("work/a-newer"));
  });

  it("ages ready work toward P1 without erasing the explicit P0 boundary", () => {
    const { config } = fixture();
    for (const [id, priority] of [
      ["work/fresh-p0", "P0"],
      ["work/aged-p1", "P1"],
      ["work/aged-p2", "P2"],
      ["work/aged-p3", "P3"],
      ["work/fresh-p1", "P1"],
    ] as const) {
      observeProjectAppTaskIntent(config, {
        intent: { ...intent("achieve"), id, priority },
        appOwner: "app-owner",
      });
    }

    const tree = readTaskState(config);
    const nowMs = Date.now();
    for (const [id, ageMinutes] of [
      ["work/aged-p1", 5],
      ["work/aged-p2", 10],
      ["work/aged-p3", 15],
    ] as const) {
      const resource = tree.resources?.[id];
      if (!resource) throw new Error(`expected ${id}`);
      resource.status.updatedAt = new Date(nowMs - ageMinutes * 60_000 - 1_000).toISOString();
    }
    saveTaskState(config, tree);

    const entries = listRunnableProjectAppTaskQueueEntries(config);
    expect(entries.filter((entry) => entry.taskId.startsWith("work/aged-"))).toEqual([
      { taskId: "work/aged-p3", options: { front: false, priority: "P1" } },
      { taskId: "work/aged-p2", options: { front: false, priority: "P1" } },
      { taskId: "work/aged-p1", options: { front: false, priority: "P1" } },
    ]);
    expect(entries.find((entry) => entry.taskId === "work/fresh-p1")?.options.priority).toBe("P1");
  });

  it("uses persisted age when enqueuing selected task IDs", () => {
    const { config } = fixture();
    observeProjectAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/aged-p2", priority: "P2" },
      appOwner: "app-owner",
    });
    const tree = readTaskState(config);
    const resource = tree.resources?.["work/aged-p2"];
    if (!resource) throw new Error("expected aged resource");
    resource.status.updatedAt = new Date(Date.now() - 10 * 60_000 - 1_000).toISOString();
    saveTaskState(config, tree);

    expect(projectAppTaskQueueEntries(config, ["work/aged-p2"])).toEqual([
      { taskId: "work/aged-p2", options: { front: false, priority: "P1" } },
    ]);
  });

  it("ages triggered work from when it became ready instead of its old waiting status", () => {
    const { config } = fixture();
    observeProjectAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/fresh-trigger-p2", priority: "P2" },
      appOwner: "app-owner",
      trigger: { type: "repo.ref.changed", data: { ref: "origin/dev" } },
    });
    observeProjectAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/aged-trigger-p2", priority: "P2" },
      appOwner: "app-owner",
      trigger: { type: "repo.ref.changed", data: { ref: "origin/dev" } },
    });

    const tree = readTaskState(config);
    const oldStatus = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const oldTrigger = new Date(Date.now() - 10 * 60_000 - 1_000).toISOString();
    for (const id of ["work/fresh-trigger-p2", "work/aged-trigger-p2"]) {
      const resource = tree.resources?.[id];
      if (!resource) throw new Error(`expected ${id}`);
      resource.status.updatedAt = oldStatus;
    }
    const agedTrigger = tree.taskTriggers?.["work/aged-trigger-p2"];
    if (!agedTrigger) throw new Error("expected persisted trigger");
    agedTrigger.observedAt = oldTrigger;
    saveTaskState(config, tree);

    const entries = listRunnableProjectAppTaskQueueEntries(config);
    expect(entries.find((entry) => entry.taskId === "work/fresh-trigger-p2")).toEqual({
      taskId: "work/fresh-trigger-p2",
      options: { front: true, priority: "P2" },
    });
    expect(entries.find((entry) => entry.taskId === "work/aged-trigger-p2")).toEqual({
      taskId: "work/aged-trigger-p2",
      options: { front: true, priority: "P0" },
    });
  });

  it("schedules an unresolved direct project comment before autonomous priority backlog", () => {
    const { config } = fixture();
    observeProjectAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/autonomous-p0", priority: "P0" },
      appOwner: "app-owner",
    });
    observeProjectAppTaskIntent(config, {
      intent: { ...intent("maintain"), id: "runtime/owner-review", priority: "P1" },
      appOwner: "app-owner",
      trigger: {
        type: "project.owner.requested",
        ownerIntentRefs: [
          {
            eventId: 42,
            eventType: "project.comment.created",
            data: { comment: "Review current project direction" },
          },
        ],
      },
    });

    expect(listRunnableProjectAppTaskIds(config).slice(0, 2)).toEqual(["runtime/owner-review", "work/autonomous-p0"]);
  });

  it("schedules a persisted event continuation before untriggered desired work", () => {
    const { config } = fixture();
    observeProjectAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/new-p0", priority: "P0" },
      appOwner: "app-owner",
    });
    observeProjectAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/live-result-p2", priority: "P2" },
      appOwner: "app-owner",
      trigger: {
        type: "pipeline-run.state",
        data: { runId: "42", status: "completed", result: "succeeded" },
      },
    });

    expect(listRunnableProjectAppTaskIds(config).slice(0, 2)).toEqual([
      "work/live-result-p2",
      "work/new-p0",
    ]);
    expect(listRunnableProjectAppTaskQueueEntries(config).slice(0, 2)).toEqual([
      {
        taskId: "work/live-result-p2",
        options: { front: true, priority: "P2" },
      },
      {
        taskId: "work/new-p0",
        options: { front: false, priority: "P0" },
      },
    ]);
  });

  it("keeps triggered work behind unresolved dependencies during passive resync", () => {
    const { config } = fixture();
    observeProjectAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/dependency" },
      appOwner: "app-owner",
    });
    observeProjectAppTaskIntent(config, {
      intent: {
        ...intent("achieve"),
        id: "work/dependent",
        dependsOn: ["work/dependency"],
      },
      appOwner: "app-owner",
      trigger: { type: "pipeline.completed", data: { runId: "42" } },
    });

    expect(listRunnableProjectAppTaskIds(config)).toContain("work/dependency");
    expect(listRunnableProjectAppTaskIds(config)).not.toContain("work/dependent");
    expect(readProjectAppTaskTrigger(config, "work/dependent")).toEqual({
      type: "pipeline.completed",
      data: { runId: "42" },
    });
  });

  it("persists the exact Condition observation as the next attempt trigger", () => {
    const { config } = fixture();
    const waitingIntent = {
      ...intent(),
      id: "work/condition-trigger",
      outcome: "Continue after the exact session observation",
      category: "domain",
    };
    observeProjectAppTaskIntent(config, { intent: waitingIntent, appOwner: "app-owner" });
    const first = claimObservedProjectAppTask(config, {
      taskId: waitingIntent.id,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected initial claim");
    deferProjectAppTask(config, first, {
      disposition: "waiting",
      summary: "waiting for session",
      conditions: [
        {
          id: "session-terminal:s_condition",
          type: "session.end",
          subject: "session:s_condition",
          expected: "done",
        },
      ],
    });

    const event = {
      type: "session.end",
      sessionId: "s_condition",
      status: "done",
      evidence: "session completed cleanly",
    };
    const [wake] = trackProjectAppConditionEvent(config, event);
    expect(wake?.taskId).toBe(waitingIntent.id);

    expect(readProjectAppTaskTrigger(config, waitingIntent.id)).toEqual(event);
    expect(readProjectAppTaskIntent(config, waitingIntent.id)?.category).toBe("domain");
    const resumed = claimObservedProjectAppTask(config, {
      taskId: waitingIntent.id,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (resumed.kind !== "claimed") throw new Error("expected resumed claim");
    expect(resumed.intent.category).toBe("domain");
    expect(resumed.trigger).toEqual(event);
    expect(readTaskState(config).attempts?.[resumed.attemptId]?.trigger).toEqual(event);
  });

  it("claims the current canonical spec after a stale reader observed an older version", () => {
    const { config } = fixture();
    const original = intent("maintain");
    observeProjectAppTaskIntent(config, { intent: original, appOwner: "app-owner" });
    const staleCopy = readProjectAppTaskIntent(config, original.id);
    if (!staleCopy) throw new Error("expected original intent");

    const current = {
      ...original,
      outcome: "Keep the current pipeline and its newer contract observable",
      acceptance: ["The newer contract is observed"],
    };
    observeProjectAppTaskIntent(config, { intent: current, appOwner: "app-owner" });
    expect(recordProjectAppTaskTrigger(config, original.id, { type: "pipeline.changed", revision: 2 })).toEqual({
      kind: "recorded",
    });

    const claim = claimObservedProjectAppTask(config, {
      taskId: original.id,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected current claim");
    expect(claim.intent.outcome).toBe(current.outcome);
    expect(claim.intent.outcome).not.toBe(staleCopy.outcome);
    expect(claim.generation).toBe(2);
    expect(claim.trigger).toEqual({ type: "pipeline.changed", revision: 2 });
  });

  it("keeps a waiting task asleep on a duplicate trigger unless overrideWait is explicit", () => {
    const { config } = fixture();
    const monitor = intent("maintain");

    observeProjectAppTaskIntent(config, { intent: monitor, appOwner: "app-owner" });
    const firstClaim = claimObservedProjectAppTask(config, {
      taskId: monitor.id,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
      reason: "task-controller",
    });
    if (firstClaim.kind !== "claimed") throw new Error("expected first claim");

    deferProjectAppTask(config, firstClaim, {
      disposition: "waiting",
      summary: "waiting for old condition",
      conditions: [
        {
          id: "external-run-finished",
          type: "ado.pipeline.completed",
          subject: "ado:run:123",
          expected: "completed",
        },
      ],
    });

    expect(
      claimObservedProjectAppTask(config, {
        taskId: monitor.id,
        appOwner: "app-owner",
        handler: "workflow:known-workflow",
        reason: "passive-resync",
      }),
    ).toMatchObject({
      kind: "waiting",
      conditionIds: ["external-run-finished"],
    });

    const trigger = {
      type: "project.task.tick",
      data: {
        project: "sample",
        taskId: monitor.id,
        action: "spec-loop",
      },
    };
    observeProjectAppTaskIntent(config, {
      intent: monitor,
      appOwner: "app-owner",
      trigger,
    });

    const duplicateClaim = claimObservedProjectAppTask(config, {
      taskId: monitor.id,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
      reason: "task-controller",
    });
    expect(duplicateClaim).toMatchObject({ kind: "waiting", taskId: monitor.id });

    const overrideTrigger = {
      type: "project.task.tick",
      data: {
        project: "sample",
        taskId: monitor.id,
        overrideWait: true,
      },
    };
    observeProjectAppTaskIntent(config, {
      intent: monitor,
      appOwner: "app-owner",
      trigger: overrideTrigger,
    });

    const secondClaim = claimObservedProjectAppTask(config, {
      taskId: monitor.id,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
      reason: "task-controller",
    });
    expect(secondClaim).toMatchObject({ kind: "claimed", taskId: monitor.id });
    if (secondClaim.kind !== "claimed") throw new Error("expected second claim");

    expect(readTaskState(config).attempts?.[secondClaim.attemptId]).toMatchObject({
      state: "running",
      trigger: overrideTrigger,
    });
  });

  it("wakes a waiting task for explicit owner input", () => {
    const { config } = fixture();
    const monitor = intent("maintain");

    observeProjectAppTaskIntent(config, { intent: monitor, appOwner: "app-owner" });
    const firstClaim = claimObservedProjectAppTask(config, {
      taskId: monitor.id,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (firstClaim.kind !== "claimed") throw new Error("expected first claim");

    deferProjectAppTask(config, firstClaim, {
      disposition: "waiting",
      summary: "waiting for an older external condition",
      conditions: [
        {
          id: "older-external-run-finished",
          type: "ado.pipeline.completed",
          subject: "ado:run:123",
          expected: "completed",
        },
      ],
    });

    const comment = {
      type: "project.comment.created",
      eventId: 42,
      data: { project: "sample", comment: "Verify the missing live proof" },
    };
    observeProjectAppTaskIntent(config, {
      intent: monitor,
      appOwner: "app-owner",
      trigger: comment,
    });

    const ownerClaim = claimObservedProjectAppTask(config, {
      taskId: monitor.id,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(ownerClaim).toMatchObject({ kind: "claimed", taskId: monitor.id, trigger: comment });
    expect(readTaskState(config).resources[monitor.id].status.conditionIds).toEqual([
      "older-external-run-finished",
    ]);
  });

  it("invalidates an old attempt when desired state changes generation", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected claim");

    const changed = observeProjectAppTaskIntent(config, {
      intent: { ...intent("maintain"), input: { sessionId: "session-2" } },
      appOwner: "app-owner",
    });
    expect(changed).toMatchObject({ kind: "observed", generation: 2, changed: true });
    const changedTree = readTaskState(config);
    expect(changedTree.tasks["pipeline-monitor"]).toMatchObject({ state: "backlog", revision: 2 });
    expect(changedTree.resources?.["pipeline-monitor"]).toMatchObject({
      metadata: { generation: 2, resourceVersion: 3 },
      status: { phase: "pending" },
    });
    expect(changedTree.attempts?.[first.attemptId]).toMatchObject({
      state: "interrupted",
      summary: "Task specification changed while the attempt was active",
    });
    expect(completeProjectAppTask(config, first, { summary: "late generation one result" }).status).toBe("stale");
  });

  it("detaches prior-generation Conditions and triggers when desired state changes", () => {
    const { config } = fixture();
    const monitor = intent("maintain");
    const first = declareAndClaimTask(config, {
      intent: monitor,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected first claim");

    deferProjectAppTask(config, first, {
      disposition: "waiting",
      summary: "waiting for the prior generation",
      conditions: [
        {
          id: "prior-generation-run",
          type: "ado.pipeline.completed",
          subject: "ado:run:123",
          expected: "completed",
        },
      ],
    });
    const waitingTree = readTaskState(config);
    waitingTree.taskTriggers = {
      ...(waitingTree.taskTriggers ?? {}),
      [monitor.id]: {
        taskId: monitor.id,
        taskGeneration: 1,
        resourceVersion: 1,
        event: { type: "prior-generation.trigger" },
        observedAt: "2026-07-20T00:00:00.000Z",
      },
    };
    saveTaskState(config, waitingTree);

    expect(
      observeProjectAppTaskIntent(config, {
        intent: { ...monitor, input: { sessionId: "session-2" } },
        appOwner: "app-owner",
      }),
    ).toMatchObject({ kind: "observed", generation: 2, changed: true });

    const changedTree = readTaskState(config);
    expect(changedTree.resources?.[monitor.id]).toMatchObject({
      metadata: { generation: 2 },
      status: { phase: "pending" },
    });
    expect(changedTree.resources?.[monitor.id]?.status.conditionIds ?? []).toEqual([]);
    expect(changedTree.conditions?.["prior-generation-run"]).toBeUndefined();
    expect(changedTree.taskTriggers?.[monitor.id]).toBeUndefined();
    expect(listRunnableProjectAppTaskIds(config)).toContain(monitor.id);
  });

  it("claims generation drift before honoring a stale waiting Condition", () => {
    const { config } = fixture();
    const monitor = intent("maintain");
    const first = declareAndClaimTask(config, {
      intent: monitor,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected first claim");

    deferProjectAppTask(config, first, {
      disposition: "waiting",
      summary: "waiting for a stale observation",
      conditions: [
        {
          id: "stale-run",
          type: "ado.pipeline.completed",
          subject: "ado:run:123",
          expected: "completed",
        },
      ],
    });
    const driftedTree = readTaskState(config);
    const resource = driftedTree.resources?.[monitor.id];
    if (!resource) throw new Error("expected task resource");
    resource.metadata.generation = 2;
    resource.metadata.resourceVersion += 1;
    saveTaskState(config, driftedTree);

    expect(listRunnableProjectAppTaskIds(config)).toContain(monitor.id);
    const claim = claimObservedProjectAppTask(config, {
      taskId: monitor.id,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
      reason: "passive-resync",
    });
    expect(claim).toMatchObject({ kind: "claimed", taskId: monitor.id, generation: 2 });
    const claimedTree = readTaskState(config);
    expect(claimedTree.conditions?.["stale-run"]).toBeUndefined();
    expect(claimedTree.resources?.[monitor.id]?.status.conditionIds ?? []).toEqual([]);
  });

  it("keeps an active generation when only containment, category, or priority changes", () => {
    const { config } = fixture();
    const original = { ...intent("maintain"), category: "monitor", priority: "P2" as const };
    const claim = declareAndClaimTask(config, {
      intent: original,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const observed = observeProjectAppTaskIntent(config, {
      intent: { ...original, parentId: "root", category: "operations", priority: "P0" },
      appOwner: "app-owner",
    });
    expect(observed).toEqual({ kind: "observed", taskId: claim.taskId, generation: 1, changed: true });

    const tree = readTaskState(config);
    expect(tree.resources?.[claim.taskId]).toMatchObject({
      metadata: { generation: 1, resourceVersion: claim.resourceVersion + 1 },
      spec: { parentId: "root", category: "operations", priority: "P0" },
      status: { phase: "running", currentAttemptId: claim.attemptId },
    });
    expect(tree.tasks.root.children).toContain(claim.taskId);
    expect(tree.tasks.operations.children).not.toContain(claim.taskId);
    expect(completeProjectAppTask(config, claim, { summary: "same execution completed" }).status).toBe("applied");
  });

  it("advances generation when a parent move changes effective ownership", () => {
    const { config } = fixture();
    const tree = readTaskState(config);
    tree.groups!.operations.owner = "operations-owner";
    saveTaskState(config, tree);
    const original = { ...intent("maintain"), parentId: "operations" };
    const claim = declareAndClaimTask(config, {
      intent: original,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    expect(claim.owner).toBe("operations-owner");

    const observed = observeProjectAppTaskIntent(config, {
      intent: { ...original, parentId: "root" },
      appOwner: "app-owner",
    });
    expect(observed).toMatchObject({ kind: "observed", generation: 2, changed: true });
    expect(readTaskState(config).attempts?.[claim.attemptId]).toMatchObject({ state: "interrupted" });
  });

  it("inherits ownership, claims one attempt, and deduplicates concurrent wakes", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(first).toMatchObject({ kind: "claimed", owner: "branch-owner", generation: 1 });

    const duplicate = declareAndClaimTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(duplicate).toMatchObject({ kind: "busy", taskId: "evaluate:session-1" });

    const tree = readTaskState(config);
    expect(tree.tasks["evaluate:session-1"]).toMatchObject({
      state: "active",
      owner: "branch-owner",
      workflow: "known-workflow",
      revision: 1,
    });
    expect(tree.active_task_ids).toContain("evaluate:session-1");
  });

  it("moves an unresolved owner to attention before claiming an attempt", () => {
    const { config } = fixture();
    const result = declareAndClaimTask(config, {
      intent: { ...intent(), owner: "human" },
      appOwner: "app-owner",
      handler: "auto",
      trigger: { type: "project.comment.created", data: { comment: "Please retry" } },
      isOwnerRunnable: (owner) => owner !== "human",
    });

    expect(result).toMatchObject({
      kind: "attention",
      summary: "Resolved owner human is not a runnable agent",
    });
    const tree = readTaskState(config);
    expect(tree.resources?.["evaluate:session-1"]).toMatchObject({
      status: {
        phase: "attention",
        summary: "Resolved owner human is not a runnable agent",
      },
    });
    expect(tree.resources?.["evaluate:session-1"].status.currentAttemptId).toBeUndefined();
    expect(tree.taskTriggers?.["evaluate:session-1"]).toBeUndefined();
    expect(Object.values(tree.attempts ?? {}).filter((attempt) => attempt.taskId === "evaluate:session-1")).toEqual([]);
  });

  it("clears legacy assignment authority when reconciliation claims a task", () => {
    const { config } = fixture();
    const tree = readTaskState(config);
    tree.tasks["pipeline-monitor"] = {
      id: "pipeline-monitor",
      parent_id: "operations",
      state: "active",
      children: [],
      goal: "Legacy duplicate execution",
      outputs: ["legacy.md"],
      acceptance: ["Legacy execution finishes"],
      trace: {
        current_attempt_id: "a_legacy",
        current_task_revision: 0,
        assigned_at: "2026-07-18T00:00:00Z",
        assigned_by: "planner",
        assigned_worker: "owner",
      },
    };
    tree.tasks.operations.children = [...(tree.tasks.operations.children ?? []), "pipeline-monitor"];
    saveTaskState(config, tree);

    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(claim.kind).toBe("claimed");

    const claimed = readTaskState(config).tasks["pipeline-monitor"];
    expect(claimed.trace?.current_attempt_id).toBeUndefined();
    expect(claimed.trace?.assigned_by).toBeUndefined();
    expect(readTaskState(config).resources?.["pipeline-monitor"]).toMatchObject({
      status: { phase: "running" },
    });
    expect(claimed.trace?.reconciliation).toBeUndefined();
  });

  it("absorbs achieved work into a completion receipt and deduplicates redelivery", () => {
    const { config, appDir } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(completeProjectAppTask(config, claim, { summary: "session evaluated" }).status).toBe("applied");
    const tree = readTaskState(config);
    expect(tree.tasks[claim.taskId]).toBeUndefined();
    expect(tree.resources?.[claim.taskId]).toBeUndefined();
    expect(tree.tasks.operations.children).not.toContain(claim.taskId);
    expect(tree.receipts?.[claim.taskId]).toMatchObject({
      metadata: { id: claim.taskId, generation: 1, resourceVersion: 1 },
      handler: "workflow:known-workflow",
      summary: "session evaluated",
      outcome: "Evaluate session 1",
      workflow: "known-workflow",
      evidence: [],
      acceptanceBasis: { method: "workflow-contract", evidence: [] },
      failureFingerprints: [],
    });
    expect(tree.attempts?.[claim.attemptId]).toMatchObject({
      state: "completed",
      summary: "session evaluated",
    });

    expect(
      declareAndClaimTask(config, {
        intent: intent(),
        appOwner: "app-owner",
        handler: "workflow:known-workflow",
      }),
    ).toMatchObject({ kind: "completed", taskId: claim.taskId, generation: 1 });
    expect(readFileSync(join(appDir, "tasks", "seed.json"), "utf8")).not.toContain("evaluate:session-1");
  });

  it("prunes a stale live duplicate when a matching achieve receipt already exists", () => {
    const { config } = fixture();
    const taskIntent = intent();
    const claim = declareAndClaimTask(config, {
      intent: taskIntent,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    completeProjectAppTask(config, claim, { summary: "session evaluated" });

    const tree = readTaskState(config);
    tree.resources = {
      ...(tree.resources ?? {}),
      [taskIntent.id]: {
        metadata: { id: taskIntent.id, generation: claim.generation, resourceVersion: 2 },
        spec: {
          parentId: taskIntent.parentId,
          outcome: taskIntent.outcome,
          acceptance: [...taskIntent.acceptance],
          mode: taskIntent.mode,
          owner: "branch-owner",
          workflow: taskIntent.workflow,
          outputs: [...(taskIntent.outputs ?? [])],
        },
        status: {
          observedGeneration: claim.generation,
          phase: "attention",
          updatedAt: "2026-07-20T00:00:00.000Z",
          summary: "stale duplicate attention",
          conditionIds: [],
        },
      },
    };
    tree.tasks[taskIntent.id] = {
      id: taskIntent.id,
      parent_id: taskIntent.parentId,
      children: [],
      state: "review",
    };
    tree.tasks.operations.children = [...new Set([...(tree.tasks.operations.children ?? []), taskIntent.id])];
    saveTaskState(config, tree);

    expect(
      observeProjectAppTaskIntent(config, {
        intent: taskIntent,
        appOwner: "app-owner",
      }),
    ).toMatchObject({ kind: "completed", taskId: taskIntent.id, generation: claim.generation });

    const repaired = readTaskState(config);
    expect(repaired.resources?.[taskIntent.id]).toBeUndefined();
    expect(repaired.tasks[taskIntent.id]).toBeUndefined();
    expect(repaired.tasks.operations.children).not.toContain(taskIntent.id);
    expect(repaired.receipts?.[taskIntent.id]).toBeDefined();
  });

  it("does not orphan live children while pruning a stale receipt duplicate", () => {
    const { config } = fixture();
    const taskIntent = intent();
    const claim = declareAndClaimTask(config, {
      intent: taskIntent,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    completeProjectAppTask(config, claim, { summary: "session evaluated" });

    const tree = readTaskState(config);
    tree.resources = {
      ...(tree.resources ?? {}),
      [taskIntent.id]: {
        metadata: { id: taskIntent.id, generation: claim.generation, resourceVersion: 2 },
        spec: {
          parentId: taskIntent.parentId,
          outcome: taskIntent.outcome,
          acceptance: [...taskIntent.acceptance],
          mode: taskIntent.mode,
          owner: "branch-owner",
          workflow: taskIntent.workflow,
          outputs: [...(taskIntent.outputs ?? [])],
        },
        status: {
          observedGeneration: claim.generation,
          phase: "attention",
          updatedAt: "2026-07-20T00:00:00.000Z",
          summary: "stale duplicate attention",
          conditionIds: [],
        },
      },
      "work/live-child": {
        metadata: { id: "work/live-child", generation: 1, resourceVersion: 1 },
        spec: {
          parentId: taskIntent.id,
          outcome: "Finish live child work",
          acceptance: ["Live child work is complete"],
          mode: "achieve",
          owner: "branch-owner",
          outputs: [],
        },
        status: {
          observedGeneration: 0,
          phase: "pending",
          updatedAt: "2026-07-20T00:00:00.000Z",
          summary: "Live child is still pending",
          conditionIds: [],
        },
      },
    };
    tree.tasks[taskIntent.id] = {
      id: taskIntent.id,
      parent_id: taskIntent.parentId,
      children: ["work/live-child"],
      state: "review",
    };
    tree.tasks["work/live-child"] = {
      id: "work/live-child",
      parent_id: taskIntent.id,
      children: [],
      state: "backlog",
    };
    tree.tasks.operations.children = [...new Set([...(tree.tasks.operations.children ?? []), taskIntent.id])];
    saveTaskState(config, tree);

    expect(() =>
      observeProjectAppTaskIntent(config, {
        intent: taskIntent,
        appOwner: "app-owner",
      }),
    ).toThrow("cannot be pruned while it has live children: work/live-child");

    const preserved = readTaskState(config);
    expect(preserved.tasks[taskIntent.id]?.children).toEqual(["work/live-child"]);
    expect(preserved.tasks["work/live-child"]?.parent_id).toBe(taskIntent.id);
  });

  it("creates a new achieve generation when a completed task specification changes", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected claim");
    completeProjectAppTask(config, first, { summary: "first shape completed" });

    expect(
      declareAndClaimTask(config, {
        intent: {
          ...intent(),
          outcome: "Evaluate session 1 with the revised policy",
        },
        appOwner: "app-owner",
        handler: "workflow:known-workflow",
      }),
    ).toMatchObject({ kind: "claimed", generation: 2 });
  });

  it("retains minimal completion receipts needed for durable deduplication", () => {
    const { config } = fixture();
    const tree = readTaskState(config);
    tree.receipts = Object.fromEntries(
      Array.from({ length: 1_001 }, (_, index) => {
        const id = `completed-${index}`;
        return [
          id,
          {
            metadata: { id, generation: 1, resourceVersion: 1 },
            specHash: `hash-${index}`,
            parentId: "operations",
            outcome: `Completed outcome ${index}`,
            acceptance: ["Completed"],
            owner: "app-owner",
            handler: "owner:app-owner",
            summary: "Completed",
            evidence: [],
            acceptanceBasis: { method: "owner-judgment", evidence: [] },
            failureFingerprints: [],
            completedAt: new Date(index).toISOString(),
          },
        ];
      }),
    );
    saveTaskState(config, tree);

    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    completeProjectAppTask(config, claim, { summary: "new completion" });

    const completed = readTaskState(config);
    expect(Object.keys(completed.receipts ?? {})).toHaveLength(1_002);
    expect(completed.receipts?.["completed-0"]).toBeTruthy();
    expect(completed.receipts?.[claim.taskId]).toBeTruthy();
  });

  it("commits a receipt and identifies dependents in the same absorption transaction", () => {
    const { config } = fixture();
    const dependency = intent();
    const dependent = {
      ...intent("maintain"),
      id: "dependent-monitor",
      outcome: "Run after evaluation completes",
      dependsOn: [dependency.id],
    };
    observeProjectAppTaskIntent(config, {
      intent: dependent,
      appOwner: "app-owner",
    });
    expect(
      claimObservedProjectAppTask(config, {
        taskId: dependent.id,
        appOwner: "app-owner",
        handler: "workflow:known-workflow",
      }),
    ).toMatchObject({
      kind: "waiting",
      dependencyIds: [dependency.id],
    });

    const dependencyClaim = declareAndClaimTask(config, {
      intent: dependency,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (dependencyClaim.kind !== "claimed") throw new Error("expected dependency claim");
    expect(
      completeProjectAppTask(config, dependencyClaim, {
        summary: "evaluation absorbed",
        evidence: ["artifact:evaluation.json"],
      }),
    ).toMatchObject({
      status: "applied",
      dependentTaskIds: [dependent.id],
    });
    expect(readTaskState(config).receipts?.[dependency.id]).toMatchObject({
      evidence: ["artifact:evaluation.json"],
      outcome: dependency.outcome,
    });
    expect(
      claimObservedProjectAppTask(config, {
        taskId: dependent.id,
        appOwner: "app-owner",
        handler: "workflow:known-workflow",
      }),
    ).toMatchObject({ kind: "claimed", taskId: dependent.id });
  });

  it("keeps active parent rollups out of the executable projection", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const running = readTaskState(config);
    running.tasks.root.state = "active";
    running.tasks.operations.state = "active";
    saveTaskState(config, running);

    completeProjectAppTask(config, claim, { summary: "session evaluated" });

    const completed = readTaskState(config);
    expect(completed.active_task_ids).toEqual([]);
    expect(completed.active_task_id).toBeNull();
  });

  it("recovers an interrupted attempt only from a previous runtime trigger", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
      trigger: {
        type: "session.end",
        data: { project: "sample", sessionId: "session-1" },
      },
    });
    if (first.kind !== "claimed") throw new Error("expected claim");
    expect(recoverableProjectAppTaskAttempts(config)).toEqual([]);

    const interrupted = readTaskState(config);
    interrupted.attempts![first.attemptId].runtimeId = "previous-runtime";
    saveTaskState(config, interrupted);

    const [recovery] = recoverableProjectAppTaskAttempts(config);
    expect(recovery).toMatchObject({
      taskId: first.taskId,
      intent: { id: first.taskId },
      trigger: {
        type: "session.end",
        data: { project: "sample", sessionId: "session-1" },
      },
    });

    const reclaimed = declareAndClaimTask(config, {
      intent: recovery.intent,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
      trigger: recovery.trigger,
      reason: `attempt-recovery:${first.taskId}`,
    });
    expect(reclaimed).toMatchObject({
      kind: "claimed",
      taskId: first.taskId,
      generation: first.generation,
    });
    if (reclaimed.kind !== "claimed") throw new Error("expected reclaim");
    expect(reclaimed.attemptId).not.toBe(first.attemptId);
    const recovered = readTaskState(config);
    expect(recovered.attempts?.[first.attemptId]).toMatchObject({ state: "interrupted" });
    expect(recovered.attempts?.[reclaimed.attemptId]).toMatchObject({
      state: "running",
      reason: `attempt-recovery:${first.taskId}`,
      trigger: { type: "session.end" },
    });
  });

  it("claims a previous-runtime attempt with a persisted trigger during ordinary resync", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
      trigger: {
        type: "session.end",
        data: { project: "sample", sessionId: "session-1" },
      },
    });
    if (first.kind !== "claimed") throw new Error("expected claim");

    const interrupted = readTaskState(config);
    interrupted.attempts![first.attemptId].runtimeId = "previous-runtime";
    saveTaskState(config, interrupted);

    const resync = declareAndClaimTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
      reason: "task-controller",
    });
    expect(resync).toMatchObject({
      kind: "claimed",
      taskId: first.taskId,
      generation: first.generation,
      trigger: {
        type: "session.end",
        data: { project: "sample", sessionId: "session-1" },
      },
    });
    if (resync.kind !== "claimed") throw new Error("expected reclaim");
    expect(resync.attemptId).not.toBe(first.attemptId);

    const tree = readTaskState(config);
    expect(tree.attempts?.[first.attemptId]).toMatchObject({
      runtimeId: "previous-runtime",
      state: "interrupted",
    });
    expect(tree.attempts?.[resync.attemptId]).toMatchObject({
      runtimeId: expect.any(String),
      state: "running",
      reason: "task-controller",
      trigger: {
        type: "session.end",
        data: { project: "sample", sessionId: "session-1" },
      },
    });
    expect(tree.resources?.[first.taskId].status).toMatchObject({
      phase: "running",
      currentAttemptId: resync.attemptId,
    });
  });

  it("returns superseded owner-session ids when reclaiming a previous-runtime attempt", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected claim");
    expect(recordProjectAppTaskAttemptSession(config, first, "session-old")).toBe(true);

    const interrupted = readTaskState(config);
    interrupted.attempts![first.attemptId].runtimeId = "previous-runtime";
    saveTaskState(config, interrupted);

    const reclaimed = declareAndClaimTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
      reason: `attempt-recovery:${first.taskId}`,
    });
    expect(reclaimed).toMatchObject({
      kind: "claimed",
      supersededSessionIds: ["session-old"],
    });
  });

  it("associates workflow sessions with the current attempt and rejects stale generations", () => {
    const { config } = fixture();
    const original = intent();
    const claim = declareAndClaimTask(config, {
      intent: original,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(
      associateProjectAppTaskSession(
        config,
        { taskId: claim.taskId, generation: claim.generation },
        "nested-workflow-session",
      ),
    ).toEqual({ status: "recorded", taskId: claim.taskId });
    expect(readTaskState(config).attempts?.[claim.attemptId].sessionId).toBe("nested-workflow-session");

    const revised: ProjectAppTaskIntent = {
      ...original,
      outcome: "Evaluate the revised session contract",
    };
    expect(
      observeProjectAppTaskIntent(config, {
        intent: revised,
        appOwner: "app-owner",
      }),
    ).toMatchObject({
      kind: "observed",
      generation: claim.generation + 1,
      supersededSessionIds: ["nested-workflow-session"],
    });
    expect(
      associateProjectAppTaskSession(
        config,
        { taskId: claim.taskId, generation: claim.generation },
        "late-stale-session",
      ),
    ).toEqual({ status: "superseded", taskId: claim.taskId });
    expect(
      associateProjectAppTaskSession(config, { taskId: "missing-task", generation: 1 }, "missing-session"),
    ).toEqual({ status: "missing", taskId: "missing-task" });
  });

  it("returns orphaned owner-session ids when requeueing a previous-runtime attempt without a trigger", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    expect(recordProjectAppTaskAttemptSession(config, claim, "session-old")).toBe(true);

    const interrupted = readTaskState(config);
    interrupted.attempts![claim.attemptId].runtimeId = "previous-runtime";
    delete interrupted.attempts![claim.attemptId].trigger;
    saveTaskState(config, interrupted);

    const [recovery] = recoverableProjectAppTaskAttempts(config);
    expect(recovery.taskId).toBe(claim.taskId);
    expect(recovery.trigger).toBeUndefined();
    expect(releaseInterruptedProjectAppTaskAttempt(config, claim.taskId, "trigger packet was not persisted")).toEqual({
      released: true,
      sessionIds: ["session-old"],
    });

    const released = readTaskState(config);
    expect(released.tasks[claim.taskId]).toMatchObject({
      state: "backlog",
      summary: "trigger packet was not persisted; retrying from current task evidence",
    });
    expect(released.resources?.[claim.taskId]).toMatchObject({
      status: { phase: "pending" },
    });
    expect(released.resources?.[claim.taskId].status.currentAttemptId).toBeUndefined();
    expect(released.active_task_ids).not.toContain(claim.taskId);
    expect(pendingProjectAppTaskRecoveryAttention(config)).toEqual([]);
    expect(acknowledgeProjectAppTaskRecoveryAttention(config, claim.taskId)).toBe(false);
  });

  it("requeues running tasks whose current attempt record is missing", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const orphaned = readTaskState(config);
    delete orphaned.attempts![claim.attemptId];
    saveTaskState(config, orphaned);

    expect(listRunnableProjectAppTaskIds(config)).toContain(claim.taskId);
    expect(repairRunningProjectAppTasksWithoutAttempt(config)).toEqual([
      expect.objectContaining({
        taskId: claim.taskId,
        disposition: "requeued",
      }),
    ]);

    const released = readTaskState(config);
    expect(released.resources?.[claim.taskId]).toMatchObject({
      status: {
        phase: "pending",
      },
    });
    expect(released.resources?.[claim.taskId].status.currentAttemptId).toBeUndefined();
    expect(released.active_task_ids).not.toContain(claim.taskId);
    expect(listRunnableProjectAppTaskIds(config)).toContain(claim.taskId);
  });

  it("claims running tasks whose current attempt record is missing", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const orphaned = readTaskState(config);
    delete orphaned.attempts![claim.attemptId];
    saveTaskState(config, orphaned);

    const reclaimed = claimObservedProjectAppTask(config, {
      taskId: claim.taskId,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
      reason: "test-reclaim",
    });
    expect(reclaimed).toMatchObject({
      kind: "claimed",
      taskId: claim.taskId,
      generation: claim.generation,
    });
    if (reclaimed.kind !== "claimed") throw new Error("expected reclaimed claim");
    expect(reclaimed.attemptId).not.toBe(claim.attemptId);
    expect(readTaskState(config).attempts?.[reclaimed.attemptId]).toMatchObject({
      state: "running",
      reason: "test-reclaim",
    });
  });

  it("persists a synthetic controller trigger so task-controller attempts survive restart", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(claim).toMatchObject({
      kind: "claimed",
      trigger: {
        type: "project.task.tick",
        source: "project-app:sample:task-controller",
        target: { project: "sample", taskId: "evaluate:session-1" },
        reason: "task-controller",
      },
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const interrupted = readTaskState(config);
    interrupted.attempts![claim.attemptId].runtimeId = "previous-runtime";
    saveTaskState(config, interrupted);

    const [recovery] = recoverableProjectAppTaskAttempts(config);
    expect(recovery).toMatchObject({
      taskId: claim.taskId,
      trigger: {
        type: "project.task.tick",
        source: "project-app:sample:task-controller",
        target: { project: "sample", taskId: "evaluate:session-1" },
        reason: "task-controller",
      },
    });

    expect(releaseInterruptedProjectAppTaskAttempt(config, claim.taskId, "previous runtime stopped")).toEqual({
      released: true,
      sessionIds: [],
    });
    const pending = readTaskState(config);
    expect(pending.resources?.[claim.taskId].status).toMatchObject({
      phase: "pending",
    });
    expect(pending.resources?.[claim.taskId].status.currentAttemptId).toBeUndefined();
    expect(pending.attempts?.[claim.attemptId]).toMatchObject({
      state: "interrupted",
      failureReason: "previous-runtime-attempt-requeued",
    });
    expect(pending.taskTriggers?.[claim.taskId]?.event).toMatchObject({
      type: "project.task.tick",
      source: "project-app:sample:task-controller",
      target: { project: "sample", taskId: "evaluate:session-1" },
      reason: "task-controller",
    });
    expect(listRunnableProjectAppTaskIds(config)).toContain(claim.taskId);

    const reclaimed = declareAndClaimTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
      reason: `attempt-recovery:${claim.taskId}`,
    });
    expect(reclaimed).toMatchObject({
      kind: "claimed",
      taskId: claim.taskId,
      generation: claim.generation,
      trigger: {
        type: "project.task.tick",
        source: "project-app:sample:task-controller",
        target: { project: "sample", taskId: "evaluate:session-1" },
        reason: "task-controller",
      },
    });
    if (reclaimed.kind !== "claimed") throw new Error("expected reclaimed claim");

    const released = readTaskState(config);
    expect(released.tasks[claim.taskId]).toMatchObject({
      state: "active",
    });
    expect(released.attempts?.[claim.attemptId]).toMatchObject({
      state: "interrupted",
    });
    expect(released.attempts?.[reclaimed.attemptId]).toMatchObject({
      state: "running",
      reason: `attempt-recovery:${claim.taskId}`,
      trigger: {
        type: "project.task.tick",
        source: "project-app:sample:task-controller",
        target: { project: "sample", taskId: "evaluate:session-1" },
        reason: "task-controller",
      },
    });
    expect(released.active_task_ids).toContain(claim.taskId);
  });

  it("repairs existing previous-runtime attention records on startup", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    const stale = readTaskState(config);
    for (const activeClaim of [claim]) {
      stale.attempts![activeClaim.attemptId].runtimeId = "previous-runtime";
      stale.attempts![activeClaim.attemptId].state = "interrupted";
      stale.attempts![activeClaim.attemptId].failureReason = "previous-runtime-attempt-not-recoverable";
      stale.resources![activeClaim.taskId].status = {
        ...stale.resources![activeClaim.taskId].status,
        phase: "attention",
        observedGeneration: activeClaim.generation,
        currentAttemptId: undefined,
        summary: `old attention ${activeClaim.taskId}`,
      };
      stale.tasks[activeClaim.taskId].state = "review";
    }
    stale.active_task_ids = [];
    stale.active_task_id = null;
    saveTaskState(config, stale);

    expect(repairPreviousRuntimeRecoveryAttention(config)).toMatchObject([
      { taskId: "evaluate:session-1", disposition: "requeued" },
    ]);

    const repaired = readTaskState(config);
    expect(repaired.resources?.["evaluate:session-1"]).toMatchObject({
      status: { phase: "pending", observedGeneration: 0 },
    });
    expect(repaired.tasks["evaluate:session-1"].state).toBe("backlog");
    expect(pendingProjectAppTaskRecoveryAttention(config)).toEqual([]);
  });

  it("keeps converged maintain tasks live for the next event", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(completeProjectAppTask(config, claim, { summary: "pipeline healthy" }).status).toBe("applied");
    const convergedTree = readTaskState(config);
    const task = convergedTree.tasks[claim.taskId];
    expect(task).toMatchObject({ state: "backlog", reconcile_mode: "maintain", summary: "pipeline healthy" });
    expect(task.trace?.reconciliation).toBeUndefined();
    expect(convergedTree.resources?.[claim.taskId]).toMatchObject({
      status: {
        observedGeneration: claim.generation,
        phase: "converged",
        summary: "pipeline healthy",
      },
    });
    expect(convergedTree.resources?.[claim.taskId].status.currentAttemptId).toBeUndefined();
    expect(convergedTree.attempts?.[claim.attemptId]).toMatchObject({ state: "completed" });

    expect(
      claimObservedProjectAppTask(config, {
        taskId: claim.taskId,
        appOwner: "app-owner",
        handler: "workflow:known-workflow",
      }),
    ).toMatchObject({ kind: "completed", generation: claim.generation });

    const next = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
      trigger: { type: "pipeline.changed", revision: 2 },
    });
    expect(next).toMatchObject({ kind: "claimed", generation: claim.generation });
  });

  it("rejects absorbing an achieve parent that still has live children", () => {
    const { config } = fixture();
    const parentIntent = {
      id: "normalize-frontier",
      parentId: "operations",
      outcome: "Normalize the remaining frontier",
      acceptance: ["The frontier is empty or every remainder has exact disposition"],
      mode: "achieve",
      workflow: "known-workflow",
    } as const;
    const childIntent = {
      id: "normalize-frontier/spec-a",
      parentId: parentIntent.id,
      outcome: "Normalize spec A",
      acceptance: ["Spec A has exact live proof or exact blocker"],
      mode: "achieve",
      workflow: "known-workflow",
    } as const;

    observeProjectAppTaskIntent(config, {
      intent: parentIntent,
      appOwner: "app-owner",
    });
    observeProjectAppTaskIntent(config, {
      intent: childIntent,
      appOwner: "app-owner",
    });
    const claim = declareAndClaimTask(config, {
      intent: parentIntent,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(() =>
      completeProjectAppTask(config, claim, {
        summary: "parent has no direct mutation to make",
      }),
    ).toThrow("cannot converge while it has live children");
    const tree = readTaskState(config);
    expect(tree.tasks[parentIntent.id]).toBeTruthy();
    expect(tree.resources?.[parentIntent.id]?.status.phase).toBe("running");
    expect(tree.receipts?.[parentIntent.id]).toBeUndefined();
    expect(tree.tasks[childIntent.id]).toBeTruthy();
  });

  it("rejects closing another task that still has live children", () => {
    const { config } = fixture();
    const parentIntent = {
      id: "parent-with-live-child",
      parentId: "operations",
      outcome: "Finish a parent only after its child",
      acceptance: ["Every child is absorbed first"],
      mode: "achieve",
    } as const;
    const childIntent = {
      id: "parent-with-live-child/child",
      parentId: parentIntent.id,
      outcome: "Finish the child",
      acceptance: ["The child is complete"],
      mode: "achieve",
    } as const;
    observeProjectAppTaskIntent(config, { intent: parentIntent, appOwner: "app-owner" });
    observeProjectAppTaskIntent(config, { intent: childIntent, appOwner: "app-owner" });

    const carrier = claimObservedProjectAppTask(config, {
      taskId: "categorized-task",
      appOwner: "app-owner",
      handler: "owner:branch-owner",
    });
    if (carrier.kind !== "claimed") throw new Error("expected carrier claim");

    expect(() =>
      completeProjectAppTask(config, carrier, {
        summary: "Attempted parent closure",
        evidence: ["review:parent-closure"],
        actions: [
          {
            kind: "close-task",
            taskId: parentIntent.id,
            expectedGeneration: 1,
            summary: "Parent complete",
          },
        ],
      }),
    ).toThrow("cannot absorb parent-with-live-child while it has live children");

    const tree = readTaskState(config);
    expect(tree.tasks[parentIntent.id]).toBeTruthy();
    expect(tree.resources?.[parentIntent.id]).toBeTruthy();
    expect(tree.receipts?.[parentIntent.id]).toBeUndefined();
    expect(tree.tasks[childIntent.id]).toBeTruthy();
  });

  it("allows a batch to reparent a live child before closing its old parent", () => {
    const { config } = fixture();
    const parentIntent = {
      id: "stale-parent",
      parentId: "operations",
      outcome: "Retire stale parent after preserving the useful child",
      acceptance: ["The useful child remains live"],
      mode: "achieve",
    } as const;
    const childIntent = {
      id: "useful-wait",
      parentId: parentIntent.id,
      outcome: "Wait on the exact external signal",
      acceptance: ["The wait has a typed condition"],
      mode: "achieve",
    } as const;
    observeProjectAppTaskIntent(config, { intent: parentIntent, appOwner: "app-owner" });
    observeProjectAppTaskIntent(config, { intent: childIntent, appOwner: "app-owner" });

    const carrier = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "owner:branch-owner",
    });
    if (carrier.kind !== "claimed") throw new Error("expected carrier claim");

    expect(
      completeProjectAppTask(config, carrier, {
        summary: "Collapsed stale parent",
        evidence: ["reparented useful wait before closing stale parent"],
        actions: [
          {
            kind: "update-task",
            taskId: childIntent.id,
            expectedGeneration: 1,
            parentId: "operations",
          },
          {
            kind: "close-task",
            taskId: parentIntent.id,
            expectedGeneration: 1,
            summary: "Parent was stale after child was preserved elsewhere",
          },
        ],
      }),
    ).toMatchObject({ status: "applied", actionsApplied: ["updated useful-wait", "closed stale-parent"] });

    const tree = readTaskState(config);
    expect(tree.tasks[parentIntent.id]).toBeUndefined();
    expect(tree.receipts?.[parentIntent.id]).toBeDefined();
    expect(tree.tasks[childIntent.id]?.parent_id).toBe("operations");
    expect(tree.tasks.operations.children).toContain(childIntent.id);
  });

  it("rejects stale results after a fallback attempt takes ownership", () => {
    const { config } = fixture();
    const primary = declareAndClaimTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (primary.kind !== "claimed") throw new Error("expected primary claim");
    expect(
      markProjectAppTaskAttention(config, primary, {
        summary: "workflow could not classify the task",
        reason: "needs-owner",
      }),
    ).toMatchObject({ status: "applied" });

    const fallback = declareAndClaimTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "owner:branch-owner",
      reason: "workflow-fallback",
    });
    if (fallback.kind !== "claimed") throw new Error("expected fallback claim");
    expect(
      completeProjectAppTask(config, primary, {
        summary: "late primary result",
        actions: [
          {
            kind: "create-task",
            id: "stale-action-must-not-apply",
            parentId: "operations",
            outcome: "This task must not exist",
            mode: "achieve",
            outputs: ["proof.md"],
            acceptance: ["Never applied"],
          },
        ],
      }).status,
    ).toBe("stale");
    expect(readTaskState(config).tasks["stale-action-must-not-apply"]).toBeUndefined();
    expect(completeProjectAppTask(config, fallback, { summary: "owner handled exception" }).status).toBe("applied");
  });

  it("does not reclaim attention tasks during plain resync", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(
      markProjectAppTaskAttention(config, claim, {
        summary: "reviewer must decide the next move",
        reason: "handler-blocked",
      }),
    ).toMatchObject({ status: "applied" });

    expect(
      declareAndClaimTask(config, {
        intent: intent(),
        appOwner: "app-owner",
        handler: "workflow:known-workflow",
        reason: "task-controller",
      }),
    ).toMatchObject({
      kind: "attention",
      taskId: claim.taskId,
      generation: claim.generation,
      summary: "reviewer must decide the next move",
    });

    const tree = readTaskState(config);
    expect(tree.tasks[claim.taskId]).toMatchObject({
      state: "review",
      summary: "reviewer must decide the next move",
    });
    expect(tree.resources?.[claim.taskId]).toMatchObject({
      status: {
        phase: "attention",
      },
    });
    expect(tree.resources?.[claim.taskId].status.currentAttemptId).toBeUndefined();
    expect(tree.active_task_ids).not.toContain(claim.taskId);
  });

  it("allows a new trigger to reclaim an attention task", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    markProjectAppTaskAttention(config, claim, {
      summary: "waiting for new evidence",
      reason: "handler-blocked",
    });

    const next = declareAndClaimTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
      reason: "event",
      trigger: { type: "project.problem.resolved", data: { project: "sample" } },
    });
    expect(next).toMatchObject({ kind: "claimed", taskId: claim.taskId, generation: claim.generation });
    if (next.kind !== "claimed") throw new Error("expected reclaim");
    expect(readTaskState(config).tasks[claim.taskId]).toMatchObject({ state: "active" });
    expect(readTaskState(config).attempts?.[next.attemptId]).toMatchObject({
      trigger: { type: "project.problem.resolved" },
    });
  });

  it("releases execution failure only after newer success from the same owner", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "owner:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    recordProjectAppTaskAttemptSession(config, claim, "failed-owner-session");
    markProjectAppTaskAttention(config, claim, {
      summary: "owner execution ended without a decision",
      reason: "HandlerExecutionFailed",
    });

    const [candidate] = listHandlerExecutionFailedProjectAppTasks(config);
    expect(candidate).toMatchObject({
      taskId: claim.taskId,
      owner: "branch-owner",
      failureReason: "HandlerExecutionFailed",
      sessionId: "failed-owner-session",
    });
    expect(
      releaseHandlerExecutionFailedProjectAppTask(config, claim.taskId, {
        owner: "other-owner",
        sessionId: "unrelated-success",
        observedAt: "2099-01-01T00:00:00.000Z",
      }),
    ).toBe(false);
    expect(
      releaseHandlerExecutionFailedProjectAppTask(config, claim.taskId, {
        owner: "branch-owner",
        sessionId: "new-success",
        observedAt: "invalid",
      }),
    ).toBe(false);
    expect(
      releaseHandlerExecutionFailedProjectAppTask(config, claim.taskId, {
        owner: "branch-owner",
        sessionId: "new-success",
        observedAt: "2000-01-01T00:00:00.000Z",
      }),
    ).toBe(false);
    expect(
      releaseHandlerExecutionFailedProjectAppTask(config, claim.taskId, {
        owner: "branch-owner",
        sessionId: "new-success",
        observedAt: "2099-01-01T00:00:00.000Z",
      }),
    ).toBe(true);
    expect(readTaskState(config).resources?.[claim.taskId].status.phase).toBe("pending");
  });

  it("accepts the current attempt after a status-only resource version change", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const concurrent = readTaskState(config);
    concurrent.resources![claim.taskId].metadata.resourceVersion += 1;
    concurrent.resources![claim.taskId].status.summary = "concurrent observation";
    saveTaskState(config, concurrent);

    expect(completeProjectAppTask(config, claim, { summary: "current handler result" })).toMatchObject({
      status: "applied",
      actionsApplied: [],
    });
    expect(readTaskState(config).resources?.[claim.taskId]).toMatchObject({
      metadata: { resourceVersion: claim.resourceVersion + 2 },
      status: { phase: "converged", summary: "current handler result" },
    });
  });

  it("can release a stale current attempt so the task is judged again from current evidence", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "owner:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const concurrent = readTaskState(config);
    concurrent.attempts![claim.attemptId].metadata.resourceVersion += 1;
    concurrent.attempts![claim.attemptId].specHash = "superseded-attempt-contract";
    saveTaskState(config, concurrent);

    expect(
      completeProjectAppTask(config, claim, {
        summary: "late result",
        evidence: ["stale result must not apply actions"],
        actions: [
          {
            kind: "create-task",
            id: "stale-action-must-not-apply",
            parentId: "operations",
            outcome: "This task must not exist",
            mode: "achieve",
            outputs: ["proof.md"],
            acceptance: ["Never applied"],
          },
        ],
      }),
    ).toMatchObject({ status: "stale", actionsApplied: [] });
    expect(readTaskState(config).tasks["stale-action-must-not-apply"]).toBeUndefined();

    expect(releaseStaleProjectAppTaskResult(config, claim)).toEqual({
      status: "released",
      taskId: claim.taskId,
    });
    const tree = readTaskState(config);
    expect(tree.resources?.[claim.taskId]).toMatchObject({
      status: {
        phase: "pending",
      },
    });
    expect(tree.resources?.[claim.taskId].status.currentAttemptId).toBeUndefined();
    expect(tree.attempts?.[claim.attemptId]).toMatchObject({
      state: "interrupted",
      failureReason: "stale-reconciliation-result",
    });
    expect(listRunnableProjectAppTaskIds(config)).toContain(claim.taskId);
  });

  it("applies handler actions atomically with reconciliation completion", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "owner:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const applied = completeProjectAppTask(config, claim, {
      summary: "owner proposed a bounded child",
      evidence: ["owner packet reviewed"],
      actions: [
        {
          kind: "create-task",
          id: "owner-created-task",
          parentId: "operations",
          outcome: "Verify the owner action boundary",
          mode: "achieve",
          outputs: ["proof.md"],
          acceptance: ["The reconciler creates this task"],
          input: { specId: "spec.network-cni.example" },
          dependsOn: ["categorized-task"],
        },
      ],
    });

    expect(applied).toEqual({
      status: "applied",
      actionsApplied: ["created owner-created-task"],
      dependentTaskIds: ["owner-created-task"],
    });
    const tree = readTaskState(config);
    expect(tree.tasks["owner-created-task"]).toMatchObject({
      state: "backlog",
      owner: "branch-owner",
      revision: 1,
      reconcile_mode: "achieve",
      depends_on: ["categorized-task"],
    });
    expect(readProjectAppTaskIntent(config, "owner-created-task")).toMatchObject({
      input: { specId: "spec.network-cni.example" },
      dependsOn: ["categorized-task"],
    });
    expect(tree.tasks["owner-created-task"].kind).toBeUndefined();
    expect(tree.tasks.operations.children).toContain("owner-created-task");
    expect(tree.resources?.["owner-created-task"]).toMatchObject({
      metadata: { generation: 1 },
      status: { phase: "pending" },
    });
  });

  it("lets a controller retry a known transient attention task without changing its generation", () => {
    const { config } = fixture();
    const retryIntent = {
      id: "retry-after-base-race",
      parentId: "operations",
      outcome: "Retry after the integration base moves",
      acceptance: ["The same task generation retries from current evidence"],
      mode: "achieve",
      workflow: "known-workflow",
    } as const;
    const failed = declareAndClaimTask(config, {
      intent: retryIntent,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (failed.kind !== "claimed") throw new Error("expected failed claim");
    expect(
      markProjectAppTaskAttention(config, failed, {
        summary: "integration base changed",
        reason: "transient-base-race",
      }),
    ).toMatchObject({ status: "applied" });

    const controller = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:controller",
    });
    if (controller.kind !== "claimed") throw new Error("expected controller claim");
    expect(
      completeProjectAppTask(config, controller, {
        summary: "retry transient attention",
        evidence: ["the integration base has stabilized"],
        actions: [
          {
            kind: "unblock-task",
            taskId: retryIntent.id,
            expectedGeneration: 1,
            reason: "Retry the same review against current origin/dev",
          },
        ],
      }),
    ).toMatchObject({
      status: "applied",
      actionsApplied: ["unblocked retry-after-base-race"],
    });
    expect(readTaskState(config).resources?.[retryIntent.id]).toMatchObject({
      metadata: { generation: 1 },
      status: { phase: "pending", observedGeneration: 0 },
    });
  });

  it("treats an unblock action whose target already advanced as stale", () => {
    const { config } = fixture();
    observeProjectAppTaskIntent(config, {
      intent: {
        id: "already-advancing",
        parentId: "operations",
        outcome: "Continue work already admitted by another reconciliation",
        acceptance: ["The task is reconciled once"],
        mode: "achieve",
      },
      appOwner: "app-owner",
    });
    const controller = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:controller",
    });
    if (controller.kind !== "claimed") throw new Error("expected controller claim");

    expect(() =>
      completeProjectAppTask(config, controller, {
        summary: "retry from the earlier snapshot",
        evidence: ["target was waiting when reviewed"],
        actions: [
          {
            kind: "unblock-task",
            taskId: "already-advancing",
            expectedGeneration: 1,
            reason: "Resume the target",
          },
        ],
      }),
    ).toThrow(ProjectAppTaskActionStaleError);
    expect(readTaskState(config).resources?.["already-advancing"]).toMatchObject({
      metadata: { generation: 1 },
      status: { phase: "pending" },
    });
  });

  it("rejects project as a fake workflow in observed intent", () => {
    const { config } = fixture();
    expect(() =>
      observeProjectAppTaskIntent(config, {
        intent: {
          ...intent("achieve"),
          workflow: "project",
        },
        appOwner: "app-owner",
      }),
    ).toThrow("workflow must name a real workflow; omit workflow for owner-handled project work");
  });

  it("rejects project as a fake workflow in create actions", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "owner:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(() =>
      completeProjectAppTask(config, claim, {
        summary: "owner proposed a bounded child",
        evidence: ["owner packet reviewed"],
        actions: [
          {
            kind: "create-task",
            id: "owner-created-task",
            parentId: "operations",
            outcome: "Verify the owner action boundary",
            mode: "achieve",
            outputs: ["proof.md"],
            acceptance: ["The reconciler creates this task"],
            owner: "branch-owner",
            workflow: "project",
          },
        ],
      }),
    ).toThrow("workflow must name a real workflow; omit workflow for owner-handled project work");
    expect(readTaskState(config).tasks["owner-created-task"]).toBeUndefined();
  });

  it("updates task mode without overwriting its domain category", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "owner:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(
      completeProjectAppTask(config, claim, {
        summary: "updated categorized task",
        evidence: ["task schema review"],
        actions: [
          {
            kind: "update-task",
            taskId: "categorized-task",
            expectedGeneration: 1,
            mode: "achieve",
          },
        ],
      }),
    ).toMatchObject({ status: "applied" });

    const task = readTaskState(config).tasks["categorized-task"];
    expect(task.reconcile_mode).toBe("achieve");
    expect(task.kind).toBe("domain");
  });

  it("repairs explicit owner and workflow bindings through an update action", () => {
    const { config } = fixture();
    const observed = observeProjectAppTaskIntent(config, {
      intent: {
        id: "categorized-task",
        parentId: "operations",
        outcome: "Categorized bounded work",
        acceptance: ["The categorized work converges"],
        mode: "achieve",
        owner: "human",
        workflow: "removed-workflow",
        category: "domain",
      },
      appOwner: "app-owner",
    });
    if (observed.kind !== "observed") throw new Error("expected observation");

    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "owner:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(
      completeProjectAppTask(config, claim, {
        summary: "repaired stale binding",
        evidence: ["removed workflow is not registered"],
        actions: [
          {
            kind: "update-task",
            taskId: "categorized-task",
            expectedGeneration: observed.generation,
            owner: "scout",
            workflow: null,
          },
        ],
      }),
    ).toMatchObject({ status: "applied" });

    expect(readProjectAppTaskIntent(config, "categorized-task")).toMatchObject({
      owner: "scout",
      category: "domain",
    });
    expect(readProjectAppTaskIntent(config, "categorized-task")?.workflow).toBeUndefined();
    expect(readTaskState(config).resources?.["categorized-task"].metadata.generation).toBe(observed.generation + 1);
  });

  it("rejects an invalid action batch without partially applying earlier actions", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "owner:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(() =>
      completeProjectAppTask(config, claim, {
        summary: "invalid batch",
        evidence: ["batch validation test"],
        actions: [
          {
            kind: "create-task",
            id: "must-roll-back",
            parentId: "operations",
            outcome: "Must not be persisted",
            mode: "achieve",
            outputs: ["proof.md"],
            acceptance: ["No partial apply"],
          },
          {
            kind: "close-task",
            taskId: "missing-task",
            expectedGeneration: 1,
            summary: "invalid",
          },
        ],
      }),
    ).toThrow("Handler action task not found: missing-task");
    const tree = readTaskState(config);
    expect(tree.tasks["must-roll-back"]).toBeUndefined();
    expect(tree.tasks[claim.taskId].state).toBe("active");
  });

  it("rejects task actions that declare outputs outside app and domain roots", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "owner:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(() =>
      completeProjectAppTask(config, claim, {
        summary: "invalid output root",
        evidence: ["path boundary test"],
        actions: [
          {
            kind: "create-task",
            id: "must-not-escape",
            parentId: "operations",
            outcome: "Write outside the project",
            mode: "achieve",
            outputs: ["../../outside/result.txt"],
            acceptance: ["Never accepted"],
            priority: "P2",
          },
        ],
      }),
    ).toThrow("escapes the app/domain roots");
    expect(readTaskState(config).tasks["must-not-escape"]).toBeUndefined();
  });

  it("treats repeated close actions against already receipted tasks as idempotent", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "owner:branch-owner",
    });
    if (first.kind !== "claimed") throw new Error("expected first claim");

    expect(
      completeProjectAppTask(config, first, {
        summary: "close completed child",
        evidence: ["first reconciliation"],
        actions: [
          {
            kind: "close-task",
            taskId: "categorized-task",
            expectedGeneration: 1,
            summary: "child finished",
          },
        ],
      }),
    ).toMatchObject({ status: "applied", actionsApplied: ["closed categorized-task"] });

    const second = declareAndClaimTask(config, {
      intent: {
        id: "route-review",
        parentId: "operations",
        outcome: "Review route residue",
        acceptance: ["Route residue is reconciled"],
        mode: "achieve",
        workflow: "known-workflow",
      },
      appOwner: "app-owner",
      handler: "owner:branch-owner",
    });
    if (second.kind !== "claimed") throw new Error("expected second claim");

    expect(
      completeProjectAppTask(config, second, {
        summary: "stale child close observed",
        evidence: ["second reconciliation"],
        actions: [
          {
            kind: "close-task",
            taskId: "categorized-task",
            expectedGeneration: 1,
            summary: "already finished",
          },
        ],
      }),
    ).toMatchObject({
      status: "applied",
      actionsApplied: ["already completed categorized-task"],
    });

    const tree = readTaskState(config);
    expect(tree.tasks["categorized-task"]).toBeUndefined();
    expect(tree.receipts?.["categorized-task"]).toBeDefined();
    expect(tree.tasks["route-review"]).toBeUndefined();
  });

  it("rejects update actions against completed task receipts", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "owner:branch-owner",
    });
    if (first.kind !== "claimed") throw new Error("expected first claim");
    completeProjectAppTask(config, first, {
      summary: "close completed child",
      evidence: ["first reconciliation"],
      actions: [
        {
          kind: "close-task",
          taskId: "categorized-task",
          expectedGeneration: 1,
          summary: "child finished",
        },
      ],
    });

    const review = declareAndClaimTask(config, {
      intent: {
        id: "receipt-update-review",
        parentId: "operations",
        outcome: "Review a completed task",
        acceptance: ["Completed work is handled truthfully"],
        mode: "maintain",
      },
      appOwner: "app-owner",
      handler: "owner:branch-owner",
    });
    if (review.kind !== "claimed") throw new Error("expected review claim");

    expect(() =>
      completeProjectAppTask(config, review, {
        summary: "attempted completed-task update",
        evidence: ["receipt inspection"],
        actions: [
          {
            kind: "update-task",
            taskId: "categorized-task",
            expectedGeneration: 1,
            mode: "maintain",
          },
        ],
      }),
    ).toThrow(
      "Handler update-task action cannot mutate completed task categorized-task; create a new linked task",
    );

    const tree = readTaskState(config);
    expect(tree.tasks["receipt-update-review"]?.state).toBe("active");
    expect(tree.receipts?.["categorized-task"]).toBeDefined();
  });

  it("rejects create actions that reuse a completed task identity", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "owner:branch-owner",
    });
    if (first.kind !== "claimed") throw new Error("expected first claim");
    completeProjectAppTask(config, first, {
      summary: "close completed child",
      evidence: ["first reconciliation"],
      actions: [
        {
          kind: "close-task",
          taskId: "categorized-task",
          expectedGeneration: 1,
          summary: "child finished",
        },
      ],
    });

    const review = declareAndClaimTask(config, {
      intent: {
        id: "receipt-create-review",
        parentId: "operations",
        outcome: "Review a completed task identity",
        acceptance: ["Completed identities are not reused"],
        mode: "maintain",
      },
      appOwner: "app-owner",
      handler: "owner:branch-owner",
    });
    if (review.kind !== "claimed") throw new Error("expected review claim");

    expect(() =>
      completeProjectAppTask(config, review, {
        summary: "attempted completed-task recreation",
        evidence: ["receipt inspection"],
        actions: [
          {
            kind: "create-task",
            id: "categorized-task",
            parentId: "operations",
            outcome: "Reuse a completed identity",
            acceptance: ["This action must be rejected"],
            mode: "achieve",
            outputs: [],
            priority: "P2",
          },
        ],
      }),
    ).toThrow("Handler action task already exists or completed: categorized-task");

    const tree = readTaskState(config);
    expect(tree.tasks["receipt-create-review"]?.state).toBe("active");
    expect(tree.receipts?.["categorized-task"]).toBeDefined();
  });

  it("rejects malformed action payloads and blank evidence before mutation", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "owner:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(() =>
      completeProjectAppTask(config, claim, {
        summary: "invalid runtime payload",
        evidence: ["  "],
        actions: [
          {
            kind: "create-task",
            id: "must-not-apply",
            parentId: "operations",
            outcome: "Must not be persisted",
            mode: "achieve",
            outputs: ["proof.md"],
            acceptance: ["No partial apply"],
          },
        ],
      }),
    ).toThrow("require non-empty evidence");
    expect(readTaskState(config).tasks["must-not-apply"]).toBeUndefined();

    expect(() =>
      completeProjectAppTask(config, claim, {
        summary: "invalid runtime payload",
        evidence: ["runtime validation test"],
        actions: [{ kind: "create-task", id: "bad-shape" } as never],
      }),
    ).toThrow("parentId requires a non-empty string");
    expect(readTaskState(config).tasks["bad-shape"]).toBeUndefined();
    expect(readTaskState(config).tasks[claim.taskId].state).toBe("active");
  });

  it("ends waiting attempts only with an exact Condition", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(() =>
      deferProjectAppTask(config, claim, {
        disposition: "waiting",
        summary: "waiting without identity",
      }),
    ).toThrow("requires at least one exact Condition");
    expect(readTaskState(config).tasks[claim.taskId].state).toBe("active");

    expect(() =>
      deferProjectAppTask(config, claim, {
        disposition: "waiting",
        summary: "waiting with an ambiguous condition",
        conditions: [{} as never],
      }),
    ).toThrow("Condition for pipeline-monitor identity requires a non-empty string");
    expect(readTaskState(config).tasks[claim.taskId].state).toBe("active");

    expect(() =>
      deferProjectAppTask(config, claim, {
        disposition: "waiting",
        summary: "waiting without a type",
        conditions: [{ id: "session-terminal:s_1" } as never],
      }),
    ).toThrow("Condition session-terminal:s_1 type requires a non-empty string");

    const result = deferProjectAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for the source session",
      evidence: ["source session is still running"],
      conditions: [
        {
          id: "session-terminal:s_1",
          type: "session.end",
          subject: "session:s_1",
          expected: "done",
        },
      ],
    });
    expect(result.status).toBe("applied");
    const task = readTaskState(config).tasks[claim.taskId];
    expect(task.state).toBe("blocked");
    expect(readTaskState(config).resources?.[claim.taskId]).toMatchObject({
      status: {
        phase: "waiting",
        conditionIds: ["session-terminal:s_1"],
      },
    });
    expect(readTaskState(config).conditions?.["session-terminal:s_1"]).toMatchObject({
      metadata: {
        id: "session-terminal:s_1",
        generation: 1,
        resourceVersion: 1,
      },
      spec: {
        type: "session.end",
        subject: "session:s_1",
        expected: "done",
      },
      status: { observedGeneration: 0, state: "unknown" },
    });

    const timerWake = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(timerWake).toMatchObject({
      kind: "waiting",
      taskId: "pipeline-monitor",
      conditionIds: ["session-terminal:s_1"],
    });

    expect(
      trackProjectAppConditionEvent(config, {
        type: "session.end",
        sessionId: "s_other",
        status: "done",
      }),
    ).toEqual([]);

    const wakes = trackProjectAppConditionEvent(config, {
      type: "session.end",
      sessionId: "s_1",
      status: "done",
      source: "test",
    });
    expect(wakes).toMatchObject([
      {
        conditionId: "session-terminal:s_1",
        taskId: "pipeline-monitor",
      },
    ]);
    expect(readTaskState(config).conditions?.["session-terminal:s_1"]).toMatchObject({
      metadata: { generation: 1, resourceVersion: 2 },
      status: {
        observedGeneration: 1,
        state: "true",
        observed: { eventType: "session.end", sessionId: "s_1", state: "done" },
      },
    });

    const resumed = claimObservedProjectAppTask(config, {
      taskId: wakes[0].taskId,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
      reason: "condition:session-terminal:s_1",
    });
    expect(resumed.kind).toBe("claimed");
    if (resumed.kind !== "claimed") throw new Error("expected resumed claim");
    completeProjectAppTask(config, resumed, { summary: "session terminal observed" });
    expect(readTaskState(config).conditions?.["session-terminal:s_1"]).toBeUndefined();
    expect(readTaskState(config).tasks["pipeline-monitor"].blocker).toBeUndefined();
  });

  it("keeps a decomposition parent open while applying child task actions", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("achieve"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(
      deferProjectAppTask(config, claim, {
        disposition: "waiting",
        summary: "declared bounded child work for the parent",
        evidence: ["frontier selected child-a and child-b"],
        actions: [
          {
            kind: "create-task",
            id: "work/child-a",
            parentId: claim.taskId,
            outcome: "Finish child A",
            acceptance: ["Child A converges"],
            mode: "achieve",
            outputs: [],
          },
          {
            kind: "create-task",
            id: "work/child-b",
            parentId: claim.taskId,
            outcome: "Finish child B",
            acceptance: ["Child B converges"],
            mode: "achieve",
            outputs: [],
          },
        ],
      }),
    ).toMatchObject({
      status: "applied",
      actionsApplied: ["created work/child-a", "created work/child-b"],
    });

    const tree = readTaskState(config);
    expect(tree.tasks[claim.taskId]).toMatchObject({
      state: "blocked",
      children: ["work/child-a", "work/child-b"],
    });
    expect(tree.resources?.[claim.taskId]?.status).toMatchObject({
      phase: "waiting",
      conditionIds: [],
    });
    expect(tree.tasks["work/child-a"]).toMatchObject({ parent_id: claim.taskId, state: "backlog" });
    expect(tree.tasks["work/child-b"]).toMatchObject({ parent_id: claim.taskId, state: "backlog" });
    expect(tree.conditions ?? {}).toEqual({});
    expect(listRunnableProjectAppTaskIds(config)).toEqual(
      expect.arrayContaining(["work/child-a", "work/child-b"]),
    );
  });

  it("filters task Conditions by subject and expected state", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferProjectAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for dependency completion",
      conditions: [
        {
          id: "task-done:dependency-1",
          type: "project.task.reconciled",
          subject: "task:dependency-1",
          expected: "done",
        },
      ],
    });

    expect(
      trackProjectAppConditionEvent(config, {
        type: "project.task.reconciled",
        taskId: "dependency-2",
        disposition: "converged",
      }),
    ).toEqual([]);
    expect(
      trackProjectAppConditionEvent(config, {
        type: "project.task.reconciled",
        taskId: "dependency-1",
        disposition: "waiting",
      }),
    ).toEqual([]);
    expect(
      trackProjectAppConditionEvent(config, {
        type: "project.task.reconciled",
        taskId: "dependency-1",
        disposition: "converged",
      }),
    ).toMatchObject([{ conditionId: "task-done:dependency-1", taskId: "pipeline-monitor" }]);
  });

  it("wakes an exact pipeline-run Condition from a watcher observation", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferProjectAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for pipeline",
      evidence: [],
      conditions: [
        {
          id: "pipeline:run-42",
          type: "project.test_run.completed",
          subject: "pipeline-run:run-42",
          expected: { field: "status", equals: "passed" },
        },
      ],
    });

    expect(
      trackProjectAppConditionEvent(config, {
        type: "project.test_run.completed",
        pipelineRunId: "run-42",
        status: "failed",
      }),
    ).toEqual([]);
    expect(
      trackProjectAppConditionEvent(config, {
        type: "project.test_run.completed",
        pipelineRunId: "run-42",
        status: "passed",
        source: "aks-pipeline-watcher",
      }),
    ).toMatchObject([{ conditionId: "pipeline:run-42", taskId: "pipeline-monitor" }]);
  });

  it("wakes every task linked to the same typed Condition", () => {
    const { config } = fixture();
    const intents = ["pipeline-a", "pipeline-b"].map((id) => ({
      ...intent("maintain"),
      id,
      outcome: `Keep ${id} current`,
    }));
    for (const taskIntent of intents) {
      const claim = declareAndClaimTask(config, {
        intent: taskIntent,
        appOwner: "app-owner",
        handler: "workflow:known-workflow",
      });
      if (claim.kind !== "claimed") throw new Error("expected claim");
      deferProjectAppTask(config, claim, {
        disposition: "waiting",
        summary: "waiting for the shared dependency",
        conditions: [
          {
            id: "shared-dependency",
            type: "project.task.reconciled",
            subject: "task:dependency-shared",
            expected: "done",
          },
        ],
      });
    }

    expect(
      trackProjectAppConditionEvent(config, {
        type: "project.task.reconciled",
        taskId: "dependency-shared",
        state: "converged",
      }).map((wake) => wake.taskId),
    ).toEqual(["pipeline-a", "pipeline-b"]);
    expect(readTaskState(config).conditions?.["shared-dependency"]).toMatchObject({
      metadata: { generation: 1, resourceVersion: 2 },
      status: { observedGeneration: 1, state: "true" },
    });

    for (const taskIntent of intents) {
      const resumed = declareAndClaimTask(config, {
        intent: taskIntent,
        appOwner: "app-owner",
        handler: "workflow:known-workflow",
      });
      if (resumed.kind !== "claimed") throw new Error("expected resumed claim");
      completeProjectAppTask(config, resumed, { summary: `${taskIntent.id} converged` });
    }
    expect(readTaskState(config).conditions?.["shared-dependency"]).toBeUndefined();
  });

  it("rejects changing a shared Condition specification", () => {
    const { config } = fixture();
    const firstIntent = { ...intent("maintain"), id: "pipeline-a" };
    const secondIntent = { ...intent("maintain"), id: "pipeline-b" };
    const first = declareAndClaimTask(config, {
      intent: firstIntent,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    const second = declareAndClaimTask(config, {
      intent: secondIntent,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed" || second.kind !== "claimed") throw new Error("expected claims");
    deferProjectAppTask(config, first, {
      disposition: "waiting",
      summary: "waiting for shared session",
      conditions: [
        {
          id: "shared-session",
          type: "session.end",
          subject: "session:first",
          expected: "done",
        },
      ],
    });

    expect(() =>
      deferProjectAppTask(config, second, {
        disposition: "waiting",
        summary: "attempted conflicting wait",
        conditions: [
          {
            id: "shared-session",
            type: "session.end",
            subject: "session:other",
            expected: "done",
          },
        ],
      }),
    ).toThrow("already linked to another task with a different specification");
  });

  it("consumes a satisfied Condition before waiting for the same observation again", () => {
    const { config } = fixture();
    const taskIntent = intent("maintain");
    const first = declareAndClaimTask(config, {
      intent: taskIntent,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected claim");
    const condition = {
      id: "session-terminal",
      type: "session.end",
      subject: "session:repeatable",
      expected: "done",
    } as const;
    deferProjectAppTask(config, first, {
      disposition: "waiting",
      summary: "waiting for first observation",
      conditions: [condition],
    });
    trackProjectAppConditionEvent(config, {
      type: "session.end",
      sessionId: "repeatable",
      status: "done",
    });
    const resumed = declareAndClaimTask(config, {
      intent: taskIntent,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (resumed.kind !== "claimed") throw new Error("expected resumed claim");
    expect(readTaskState(config).conditions?.[condition.id]).toBeUndefined();

    deferProjectAppTask(config, resumed, {
      disposition: "waiting",
      summary: "waiting for a new observation",
      conditions: [condition],
    });
    expect(readTaskState(config).conditions?.[condition.id]).toMatchObject({
      status: { observedGeneration: 0, state: "unknown" },
    });
    expect(
      trackProjectAppConditionEvent(config, {
        type: "unrelated.event",
        sessionId: "repeatable",
        status: "done",
      }),
    ).toEqual([]);
  });

  it("advances Condition generation when its desired observation changes", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected claim");
    deferProjectAppTask(config, first, {
      disposition: "waiting",
      summary: "waiting for first session",
      conditions: [
        {
          id: "session-terminal",
          type: "session.end",
          subject: "session:first",
          expected: "done",
        },
      ],
    });
    trackProjectAppConditionEvent(config, {
      type: "session.end",
      sessionId: "first",
      status: "done",
    });
    const resumed = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (resumed.kind !== "claimed") throw new Error("expected resumed claim");
    deferProjectAppTask(config, resumed, {
      disposition: "waiting",
      summary: "waiting for replacement session",
      conditions: [
        {
          id: "session-terminal",
          type: "session.end",
          subject: "session:replacement",
          expected: "done",
        },
      ],
    });

    expect(readTaskState(config).conditions?.["session-terminal"]).toMatchObject({
      metadata: { generation: 1, resourceVersion: 1 },
      spec: { subject: "session:replacement" },
      status: { observedGeneration: 0, state: "unknown" },
    });
    expect(
      trackProjectAppConditionEvent(config, {
        type: "session.end",
        sessionId: "first",
        status: "done",
      }),
    ).toEqual([]);
  });

  it("matches exact app-specific event fields without an app-specific controller", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferProjectAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for exact approval",
      conditions: [
        {
          id: "approval-returned",
          type: "project.approval.submitted",
          subject: "approvalId:approval-42",
          expected: { field: "decision", anyOf: ["approve", "decline"] },
        },
      ],
    });

    expect(
      trackProjectAppConditionEvent(config, {
        type: "project.approval.submitted",
        approvalId: "approval-42",
        decision: "hold",
      }),
    ).toEqual([]);
    expect(
      trackProjectAppConditionEvent(config, {
        type: "project.approval.submitted",
        approvalId: "approval-42",
        decision: "approve",
      }),
    ).toMatchObject([{ taskId: "pipeline-monitor", conditionId: "approval-returned" }]);
  });

  it("matches owner decision conditions using allowedDecisions against event decision", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferProjectAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for exact owner decision",
      conditions: [
        {
          id: "owner-decision",
          type: "project.owner-decision.recorded",
          subject: "task:pipeline-monitor",
          expected: {
            taskBranch: "task/pipeline-monitor",
            headCommit: "abc123",
            allowedDecisions: ["abandon-legacy-merge", "extract-current-lineage-successor"],
          },
        },
      ],
    });

    expect(
      trackProjectAppConditionEvent(config, {
        type: "project.owner-decision.recorded",
        taskId: "pipeline-monitor",
        taskBranch: "task/pipeline-monitor",
        headCommit: "abc123",
        decision: "hold",
      }),
    ).toEqual([]);
    expect(
      trackProjectAppConditionEvent(config, {
        type: "project.owner-decision.recorded",
        taskId: "pipeline-monitor",
        taskBranch: "task/pipeline-monitor",
        headCommit: "abc123",
        decision: "extract-current-lineage-successor",
      }),
    ).toMatchObject([{ taskId: "pipeline-monitor", conditionId: "owner-decision" }]);
  });

  it("matches owner decision conditions using acceptedDecisions against event decision", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferProjectAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for exact owner decision",
      conditions: [
        {
          id: "owner-decision",
          type: "project.owner-decision.recorded",
          subject: "project:alpha-project",
          expected: {
            taskId: "pipeline-monitor",
            sourceBranch: "codex/source",
            acceptedDecisions: ["abandon-stale-lineage", "approve-fresh-current-lineage-app-routing-successor"],
          },
        },
      ],
    });

    expect(
      trackProjectAppConditionEvent(config, {
        type: "project.owner-decision.recorded",
        project: "alpha-project",
        taskId: "pipeline-monitor",
        sourceBranch: "codex/source",
        decision: "approve-fresh-current-lineage-app-routing-successor",
      }),
    ).toMatchObject([{ taskId: "pipeline-monitor", conditionId: "owner-decision" }]);
  });

  it("keeps waiting until the Condition observer reports state", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferProjectAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for external evidence",
      conditions: [
        {
          id: "pipeline-result",
          type: "pipeline.result.available",
          subject: "pipeline-run:run-42",
          expected: { field: "status", equals: "succeeded" },
        },
      ],
    });
    const stale = readTaskState(config);
    stale.conditions!["pipeline-result"].status.observedAt = "2026-01-01T00:00:00.000Z";
    saveTaskState(config, stale);

    expect(
      declareAndClaimTask(config, {
        intent: intent("maintain"),
        appOwner: "app-owner",
        handler: "workflow:known-workflow",
        reason: "periodic-resync",
      }),
    ).toMatchObject({ kind: "waiting", taskId: "pipeline-monitor", conditionIds: ["pipeline-result"] });
  });

  it("links a watcher event Condition without monitoring the pipeline itself", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(
      deferProjectAppTask(config, claim, {
        disposition: "waiting",
        summary: "pipeline watcher will emit the terminal observation",
        conditions: [
          {
            id: "pipeline-run:42",
            type: "pipeline.completed",
            subject: "pipelineRun:42",
            expected: { field: "result", anyOf: ["succeeded", "failed"] },
          },
        ],
      }),
    ).toMatchObject({ status: "applied" });
    const waitingTree = readTaskState(config);
    const task = waitingTree.tasks["pipeline-monitor"];
    expect(task.state).toBe("blocked");
    expect(waitingTree.resources?.["pipeline-monitor"]).toMatchObject({
      status: {
        phase: "waiting",
        conditionIds: ["pipeline-run:42"],
      },
    });
    expect(waitingTree.conditions?.["pipeline-run:42"]).toMatchObject({
      spec: {
        type: "pipeline.completed",
        subject: "pipelineRun:42",
      },
      status: { state: "unknown" },
    });
    expect(
      declareAndClaimTask(config, {
        intent: intent("maintain"),
        appOwner: "app-owner",
        handler: "workflow:known-workflow",
      }),
    ).toMatchObject({ kind: "waiting", conditionIds: ["pipeline-run:42"] });

    expect(
      trackProjectAppConditionEvent(config, {
        type: "pipeline.completed",
        pipelineRun: "42",
        result: "succeeded",
      }),
    ).toMatchObject([{ taskId: "pipeline-monitor", conditionId: "pipeline-run:42" }]);
  });

  it("matches pull-request typed subjects through the generic Condition tracker", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferProjectAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for PR merge or review change",
      conditions: [
        {
          id: "pull-request-77-changed",
          type: "pull-request.state",
          subject: "pull-request:77",
          expected: {
            field: "state",
            anyOf: ["completed", "abandoned", "conflicted", "source-updated"],
          },
        },
      ],
    });

    expect(
      trackProjectAppConditionEvent(config, {
        type: "pull-request.state",
        pullRequestId: "77",
        state: "completed",
      }),
    ).toMatchObject([{ taskId: "pipeline-monitor", conditionId: "pull-request-77-changed" }]);
  });

  it("wakes when a level-observed PR source differs from the tested commit", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferProjectAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for PR source update",
      conditions: [
        {
          id: "pull-request-77-source-not-abc",
          type: "pull-request.state",
          subject: "pull-request:77",
          expected: { field: "sourceCommit", notEquals: "abc" },
        },
      ],
    });

    expect(
      trackProjectAppConditionEvent(config, {
        type: "pull-request.state",
        pullRequestId: "77",
        sourceCommit: "abc",
        state: "active",
      }),
    ).toEqual([]);
    expect(
      trackProjectAppConditionEvent(config, {
        type: "pull-request.state",
        pullRequestId: "77",
        sourceCommit: "def",
        state: "active",
      }),
    ).toMatchObject([
      {
        taskId: "pipeline-monitor",
        conditionId: "pull-request-77-source-not-abc",
      },
    ]);
  });

  it("supports future-only comparisons for level-based pipeline artifact facts", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferProjectAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for the first later artifact",
      conditions: [
        {
          id: "artifact-after-100",
          type: "pipeline-artifact.available",
          subject: "project:sample",
          expected: {
            artifactName: "slice-06-test-results",
            sourceBranch: "refs/heads/main",
            pipelineRunId: { gt: "100" },
          },
        },
      ],
    });

    expect(
      trackProjectAppConditionEvent(config, {
        type: "pipeline-artifact.available",
        project: "sample",
        artifactName: "slice-06-test-results",
        sourceBranch: "refs/heads/main",
        pipelineRunId: "100",
      }),
    ).toEqual([]);
    expect(
      trackProjectAppConditionEvent(config, {
        type: "pipeline-artifact.available",
        project: "sample",
        artifactName: "slice-06-test-results",
        sourceBranch: "refs/heads/main",
        pipelineRunId: "101",
      }),
    ).toMatchObject([
      {
        taskId: "pipeline-monitor",
        conditionId: "artifact-after-100",
      },
    ]);
  });
});
