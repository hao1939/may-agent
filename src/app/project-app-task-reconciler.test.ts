import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readTaskTree, saveTaskTree } from "@may-agent/sdk";
import {
  claimProjectAppTask,
  completeProjectAppTask,
  deferProjectAppTask,
  acknowledgeProjectAppTaskRecoveryAttention,
  markProjectAppTaskAttention,
  observeProjectAppTaskConditions,
  pendingProjectAppTaskRecoveryAttention,
  recoverableProjectAppTaskAttempts,
  releaseInterruptedProjectAppTaskAttempt,
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
        tasks: {
          root: {
            id: "root",
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

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe("project app task reconciler state", () => {
  it("inherits ownership, claims one attempt, and deduplicates concurrent wakes", () => {
    const { config } = fixture();
    const first = claimProjectAppTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(first).toMatchObject({ kind: "claimed", owner: "branch-owner", generation: 1 });

    const duplicate = claimProjectAppTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(duplicate).toMatchObject({ kind: "busy", taskId: "evaluate:session-1" });

    const tree = readTaskTree(config);
    expect(tree.tasks["evaluate:session-1"]).toMatchObject({
      state: "active",
      owner: "branch-owner",
      workflow: "known-workflow",
      revision: 1,
    });
    expect(tree.active_task_ids).toContain("evaluate:session-1");
  });

  it("clears legacy assignment authority when reconciliation claims a task", () => {
    const { config } = fixture();
    const tree = readTaskTree(config);
    tree.tasks["pipeline-monitor"] = {
      id: "pipeline-monitor",
      parent_id: "operations",
      state: "active",
      children: [],
      goal: "Legacy duplicate execution",
      outputs: ["legacy.md"],
      acceptance: ["Legacy execution finishes"],
      session_id: "s_legacy",
      trace: {
        current_attempt_id: "a_legacy",
        current_task_revision: 0,
        assigned_at: "2026-07-18T00:00:00Z",
        assigned_by: "planner",
        assigned_worker: "owner",
      },
    };
    tree.tasks.operations.children = [
      ...(tree.tasks.operations.children ?? []),
      "pipeline-monitor",
    ];
    saveTaskTree(config, tree);

    const claim = claimProjectAppTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(claim.kind).toBe("claimed");

    const claimed = readTaskTree(config).tasks["pipeline-monitor"];
    expect(claimed.session_id).toBeUndefined();
    expect(claimed.trace?.current_attempt_id).toBeUndefined();
    expect(claimed.trace?.assigned_by).toBeUndefined();
    expect(claimed.trace?.reconciliation).toMatchObject({
      phase: "running",
      handler: "workflow:known-workflow",
    });
  });

  it("absorbs achieved work into a minimal tombstone and deduplicates redelivery", () => {
    const { config, appDir } = fixture();
    const claim = claimProjectAppTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(completeProjectAppTask(config, claim, { summary: "session evaluated" }).status).toBe("applied");
    const tree = readTaskTree(config);
    expect(tree.tasks[claim.taskId]).toBeUndefined();
    expect(tree.tasks.operations.children).not.toContain(claim.taskId);
    expect(tree.completions?.[claim.taskId]).toMatchObject({
      generation: 1,
      handler: "workflow:known-workflow",
      summary: "session evaluated",
    });

    expect(
      claimProjectAppTask(config, {
        intent: { ...intent(), input: { sessionId: "session-1", redeliveredAt: "later" } },
        appOwner: "app-owner",
        handler: "workflow:known-workflow",
      }),
    ).toMatchObject({ kind: "completed", taskId: claim.taskId, generation: 1 });
    expect(readFileSync(join(appDir, "tasks", "seed.json"), "utf8")).not.toContain("evaluate:session-1");
  });

  it("keeps active parent rollups out of the executable projection", () => {
    const { config } = fixture();
    const claim = claimProjectAppTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const running = readTaskTree(config);
    running.tasks.root.state = "active";
    running.tasks.operations.state = "active";
    saveTaskTree(config, running);

    completeProjectAppTask(config, claim, { summary: "session evaluated" });

    const completed = readTaskTree(config);
    expect(completed.active_task_ids).toEqual([]);
    expect(completed.active_task_id).toBeNull();
  });

  it("recovers an interrupted attempt only from a previous runtime trigger", () => {
    const { config } = fixture();
    const first = claimProjectAppTask(config, {
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

    const interrupted = readTaskTree(config);
    const trace = interrupted.tasks[first.taskId].trace?.reconciliation as Record<string, unknown>;
    trace.runtimeId = "previous-runtime";
    saveTaskTree(config, interrupted);

    const [recovery] = recoverableProjectAppTaskAttempts(config);
    expect(recovery).toMatchObject({
      taskId: first.taskId,
      intent: { id: first.taskId },
      trigger: {
        type: "session.end",
        data: { project: "sample", sessionId: "session-1" },
      },
    });

    const reclaimed = claimProjectAppTask(config, {
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
    expect(
      (readTaskTree(config).tasks[first.taskId].trace?.reconciliation as Record<string, unknown>).recoveredFromAttempt,
    ).toBe(first.attemptId);
  });

  it("releases a previous-runtime attempt when no trigger was persisted", () => {
    const { config } = fixture();
    const claim = claimProjectAppTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const interrupted = readTaskTree(config);
    const trace = interrupted.tasks[claim.taskId].trace?.reconciliation as Record<string, unknown>;
    trace.runtimeId = "previous-runtime";
    saveTaskTree(config, interrupted);

    const [recovery] = recoverableProjectAppTaskAttempts(config);
    expect(recovery.taskId).toBe(claim.taskId);
    expect(recovery.trigger).toBeUndefined();
    expect(releaseInterruptedProjectAppTaskAttempt(config, claim.taskId, "trigger packet was not persisted")).toBe(
      true,
    );

    const released = readTaskTree(config);
    expect(released.tasks[claim.taskId]).toMatchObject({
      state: "review",
      summary: "trigger packet was not persisted",
    });
    expect((released.tasks[claim.taskId].trace?.reconciliation as Record<string, unknown>).attemptId).toBeUndefined();
    expect(released.active_task_ids).not.toContain(claim.taskId);
    expect(pendingProjectAppTaskRecoveryAttention(config)).toEqual([
      {
        taskId: claim.taskId,
        summary: "trigger packet was not persisted",
      },
    ]);
    expect(acknowledgeProjectAppTaskRecoveryAttention(config, claim.taskId)).toBe(true);
    expect(pendingProjectAppTaskRecoveryAttention(config)).toEqual([]);
  });

  it("keeps converged maintain tasks live for the next event", () => {
    const { config } = fixture();
    const claim = claimProjectAppTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(completeProjectAppTask(config, claim, { summary: "pipeline healthy" }).status).toBe("applied");
    const task = readTaskTree(config).tasks[claim.taskId];
    expect(task).toMatchObject({ state: "backlog", reconcile_mode: "maintain", summary: "pipeline healthy" });
    expect((task.trace?.reconciliation as Record<string, unknown>)?.phase).toBe("converged");

    const next = claimProjectAppTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(next).toMatchObject({ kind: "claimed", generation: claim.generation });
  });

  it("rejects stale results after a fallback attempt takes ownership", () => {
    const { config } = fixture();
    const primary = claimProjectAppTask(config, {
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
    ).toBe("applied");

    const fallback = claimProjectAppTask(config, {
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
            goal: "This task must not exist",
            outputs: ["proof.md"],
            acceptance: ["Never applied"],
          },
        ],
      }).status,
    ).toBe("stale");
    expect(readTaskTree(config).tasks["stale-action-must-not-apply"]).toBeUndefined();
    expect(completeProjectAppTask(config, fallback, { summary: "owner handled exception" }).status).toBe("applied");
  });

  it("applies handler actions atomically with reconciliation completion", () => {
    const { config } = fixture();
    const claim = claimProjectAppTask(config, {
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
          goal: "Verify the owner action boundary",
          outputs: ["proof.md"],
          acceptance: ["The reconciler creates this task"],
        },
      ],
    });

    expect(applied).toEqual({ status: "applied", actionsApplied: ["created owner-created-task"] });
    const tree = readTaskTree(config);
    expect(tree.tasks["owner-created-task"]).toMatchObject({
      state: "backlog",
      owner: "branch-owner",
      revision: 0,
    });
    expect(tree.tasks.operations.children).toContain("owner-created-task");
    expect((tree.tasks[claim.taskId].trace?.reconciliation as Record<string, unknown>)?.actionsApplied).toEqual([
      "created owner-created-task",
    ]);
  });

  it("rejects an invalid action batch without partially applying earlier actions", () => {
    const { config } = fixture();
    const claim = claimProjectAppTask(config, {
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
            goal: "Must not be persisted",
            outputs: ["proof.md"],
            acceptance: ["No partial apply"],
          },
          {
            kind: "close-task",
            taskId: "missing-task",
            expectedRevision: 0,
            summary: "invalid",
          },
        ],
      }),
    ).toThrow("Handler action task not found: missing-task");
    const tree = readTaskTree(config);
    expect(tree.tasks["must-roll-back"]).toBeUndefined();
    expect(tree.tasks[claim.taskId].state).toBe("active");
  });

  it("rejects malformed action payloads and blank evidence before mutation", () => {
    const { config } = fixture();
    const claim = claimProjectAppTask(config, {
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
            goal: "Must not be persisted",
            outputs: ["proof.md"],
            acceptance: ["No partial apply"],
          },
        ],
      }),
    ).toThrow("require non-empty evidence");
    expect(readTaskTree(config).tasks["must-not-apply"]).toBeUndefined();

    expect(() =>
      completeProjectAppTask(config, claim, {
        summary: "invalid runtime payload",
        evidence: ["runtime validation test"],
        actions: [{ kind: "create-task", id: "bad-shape" } as never],
      }),
    ).toThrow("parentId requires a non-empty string");
    expect(readTaskTree(config).tasks["bad-shape"]).toBeUndefined();
    expect(readTaskTree(config).tasks[claim.taskId].state).toBe("active");
  });

  it("ends waiting attempts only with an exact Condition", () => {
    const { config } = fixture();
    const claim = claimProjectAppTask(config, {
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
    expect(readTaskTree(config).tasks[claim.taskId].state).toBe("active");

    expect(() =>
      deferProjectAppTask(config, claim, {
        disposition: "waiting",
        summary: "waiting with an ambiguous condition",
        conditions: [{}],
      }),
    ).toThrow("Condition for pipeline-monitor identity requires a non-empty string");
    expect(readTaskTree(config).tasks[claim.taskId].state).toBe("active");

    expect(() =>
      deferProjectAppTask(config, claim, {
        disposition: "waiting",
        summary: "waiting without an observer",
        conditions: [{ id: "session-terminal:s_1" }],
      }),
    ).toThrow("Condition session-terminal:s_1 observer requires a non-empty string");

    const result = deferProjectAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for the source session",
      evidence: ["source session is still running"],
      conditions: [{ id: "session-terminal:s_1", observer: "session.end" }],
    });
    expect(result.status).toBe("applied");
    const task = readTaskTree(config).tasks[claim.taskId];
    expect(task.state).toBe("blocked");
    expect(task.blocker).toMatchObject({
      condition: "session-terminal:s_1",
      condition_id: "session-terminal:s_1",
    });
    expect((task.trace?.reconciliation as Record<string, unknown>)?.phase).toBe("waiting");
    expect(readTaskTree(config).conditions?.["session-terminal:s_1"]).toMatchObject({
      id: "session-terminal:s_1",
      status: "open",
      observer: "session.end",
      waitingTaskId: "pipeline-monitor",
      waitingTaskGeneration: 1,
    });

    const timerWake = claimProjectAppTask(config, {
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
      observeProjectAppTaskConditions(config, {
        type: "session.end",
        sessionId: "s_other",
        status: "done",
      }),
    ).toEqual([]);

    const wakes = observeProjectAppTaskConditions(config, {
      type: "session.end",
      sessionId: "s_1",
      status: "done",
      source: "test",
    });
    expect(wakes).toMatchObject([
      {
        conditionId: "session-terminal:s_1",
        taskId: "pipeline-monitor",
        recovery: false,
        intent: { id: "pipeline-monitor", workflow: "known-workflow", mode: "maintain" },
      },
    ]);
    expect(readTaskTree(config).conditions?.["session-terminal:s_1"]).toMatchObject({
      status: "satisfied",
      lastObservation: { eventType: "session.end", sessionId: "s_1", state: "done" },
    });

    const resumed = claimProjectAppTask(config, {
      intent: wakes[0].intent,
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
      reason: "condition:session-terminal:s_1",
    });
    expect(resumed.kind).toBe("claimed");
    if (resumed.kind !== "claimed") throw new Error("expected resumed claim");
    completeProjectAppTask(config, resumed, { summary: "session terminal observed" });
    expect(readTaskTree(config).conditions?.["session-terminal:s_1"]).toMatchObject({
      status: "resolved",
    });
    expect(readTaskTree(config).tasks["pipeline-monitor"].blocker).toBeUndefined();
  });

  it("filters task Conditions by subject and expected state", () => {
    const { config } = fixture();
    const claim = claimProjectAppTask(config, {
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
          observer: "project.task.reconciled",
          taskId: "dependency-1",
          expectedState: "done",
        },
      ],
    });

    expect(
      observeProjectAppTaskConditions(config, {
        type: "project.task.reconciled",
        taskId: "dependency-2",
        disposition: "converged",
      }),
    ).toEqual([]);
    expect(
      observeProjectAppTaskConditions(config, {
        type: "project.task.reconciled",
        taskId: "dependency-1",
        disposition: "waiting",
      }),
    ).toEqual([]);
    expect(
      observeProjectAppTaskConditions(config, {
        type: "project.task.reconciled",
        taskId: "dependency-1",
        disposition: "converged",
      }),
    ).toMatchObject([{ conditionId: "task-done:dependency-1", taskId: "pipeline-monitor" }]);
  });

  it("does not turn progressing advisory conditions into durable waits", () => {
    const { config } = fixture();
    const claim = claimProjectAppTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(
      deferProjectAppTask(config, claim, {
        disposition: "progressing",
        summary: "useful step landed; more work remains",
        conditions: [
          {
            id: "advisory-follow-up",
            observer: "future-review",
            fallback: "review again later",
          },
        ],
      }),
    ).toMatchObject({ status: "applied" });
    const task = readTaskTree(config).tasks["pipeline-monitor"];
    expect(task.state).toBe("backlog");
    expect(task.blocker).toBeUndefined();
    expect(readTaskTree(config).conditions?.["advisory-follow-up"]).toBeUndefined();
  });
});
