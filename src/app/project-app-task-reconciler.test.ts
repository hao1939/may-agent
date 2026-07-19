import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readTaskTree, saveTaskTree } from "@may-agent/sdk";
import { trackProjectAppConditionEvent } from "./project-app-condition-tracker.ts";
import {
  claimProjectAppTask,
  claimObservedProjectAppTask,
  completeProjectAppTask,
  deferProjectAppTask,
  acknowledgeProjectAppTaskRecoveryAttention,
  markProjectAppTaskAttention,
  observeProjectAppTaskIntent,
  listRunnableProjectAppTaskIds,
  readProjectAppTaskIntent,
  pendingProjectAppTaskRecoveryAttention,
  repairPreviousRuntimeRecoveryAttention,
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
            children: ["categorized-task"],
          },
          "categorized-task": {
            id: "categorized-task",
            revision: 1,
            parent_id: "operations",
            state: "backlog",
            kind: "domain",
            goal: "Categorized bounded work",
            acceptance: ["The categorized work converges"],
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
            },
            status: {
              observedGeneration: 0,
              phase: "pending",
              updatedAt: "2026-07-19T00:00:00.000Z",
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

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe("project app task reconciler state", () => {
  it("lists only runnable task ids for passive resync", () => {
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
      reason: "handler-blocked",
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
    const maintainClaim = claimProjectAppTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (maintainClaim.kind !== "claimed") throw new Error("expected maintain claim");
    completeProjectAppTask(config, maintainClaim, { summary: "monitor converged" });

    expect(listRunnableProjectAppTaskIds(config)).toEqual(["categorized-task", "work/pending"]);

    observeProjectAppTaskIntent(config, {
      intent: attentionIntent,
      appOwner: "app-owner",
      trigger: { type: "manual.wake", data: { reason: "fresh owner evidence" } },
    });
    expect(listRunnableProjectAppTaskIds(config)).toEqual(["categorized-task", "work/attention", "work/pending"]);

    trackProjectAppConditionEvent(config, {
      type: "session.end",
      sessionId: "s_evidence",
      status: "done",
    });
    expect(listRunnableProjectAppTaskIds(config)).toEqual([
      "categorized-task",
      "work/attention",
      "work/waiting",
      "work/pending",
    ]);
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

    const observedTree = readTaskTree(config);
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
    const claimedTree = readTaskTree(config);
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

  it("invalidates an old attempt when desired state changes generation", () => {
    const { config } = fixture();
    const first = claimProjectAppTask(config, {
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
    const changedTree = readTaskTree(config);
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
      trace: {
        current_attempt_id: "a_legacy",
        current_task_revision: 0,
        assigned_at: "2026-07-18T00:00:00Z",
        assigned_by: "planner",
        assigned_worker: "owner",
      },
    };
    tree.tasks.operations.children = [...(tree.tasks.operations.children ?? []), "pipeline-monitor"];
    saveTaskTree(config, tree);

    const claim = claimProjectAppTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(claim.kind).toBe("claimed");

    const claimed = readTaskTree(config).tasks["pipeline-monitor"];
    expect(claimed.trace?.current_attempt_id).toBeUndefined();
    expect(claimed.trace?.assigned_by).toBeUndefined();
    expect(readTaskTree(config).resources?.["pipeline-monitor"]).toMatchObject({
      status: { phase: "running" },
    });
    expect(claimed.trace?.reconciliation).toBeUndefined();
  });

  it("absorbs achieved work into a completion receipt and deduplicates redelivery", () => {
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
    expect(tree.resources?.[claim.taskId]).toBeUndefined();
    expect(tree.tasks.operations.children).not.toContain(claim.taskId);
    expect(tree.receipts?.[claim.taskId]).toMatchObject({
      metadata: { id: claim.taskId, generation: 1, resourceVersion: 1 },
      handler: "workflow:known-workflow",
      summary: "session evaluated",
      outcome: "Evaluate session 1",
      workflow: "known-workflow",
      evidence: [],
      failureFingerprints: [],
    });
    expect(tree.attempts?.[claim.attemptId]).toMatchObject({
      state: "completed",
      summary: "session evaluated",
    });

    expect(
      claimProjectAppTask(config, {
        intent: intent(),
        appOwner: "app-owner",
        handler: "workflow:known-workflow",
      }),
    ).toMatchObject({ kind: "completed", taskId: claim.taskId, generation: 1 });
    expect(readFileSync(join(appDir, "tasks", "seed.json"), "utf8")).not.toContain("evaluate:session-1");
  });

  it("creates a new achieve generation when a completed task specification changes", () => {
    const { config } = fixture();
    const first = claimProjectAppTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected claim");
    completeProjectAppTask(config, first, { summary: "first shape completed" });

    expect(
      claimProjectAppTask(config, {
        intent: {
          ...intent(),
          outcome: "Evaluate session 1 with the revised policy",
        },
        appOwner: "app-owner",
        handler: "workflow:known-workflow",
      }),
    ).toMatchObject({ kind: "claimed", generation: 2 });
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

    const dependencyClaim = claimProjectAppTask(config, {
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
    expect(readTaskTree(config).receipts?.[dependency.id]).toMatchObject({
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
    interrupted.attempts![first.attemptId].runtimeId = "previous-runtime";
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
    const recovered = readTaskTree(config);
    expect(recovered.attempts?.[first.attemptId]).toMatchObject({ state: "interrupted" });
    expect(recovered.attempts?.[reclaimed.attemptId]).toMatchObject({
      state: "running",
      reason: `attempt-recovery:${first.taskId}`,
      trigger: { type: "session.end" },
    });
  });

  it("requeues a previous-runtime attempt when no trigger was persisted", () => {
    const { config } = fixture();
    const claim = claimProjectAppTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const interrupted = readTaskTree(config);
    interrupted.attempts![claim.attemptId].runtimeId = "previous-runtime";
    saveTaskTree(config, interrupted);

    const [recovery] = recoverableProjectAppTaskAttempts(config);
    expect(recovery.taskId).toBe(claim.taskId);
    expect(recovery.trigger).toBeUndefined();
    expect(releaseInterruptedProjectAppTaskAttempt(config, claim.taskId, "trigger packet was not persisted")).toBe(true);

    const released = readTaskTree(config);
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

  it("reclaims a previous-runtime attempt without a trigger from current evidence during resync", () => {
    const { config } = fixture();
    const claim = claimProjectAppTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const interrupted = readTaskTree(config);
    interrupted.attempts![claim.attemptId].runtimeId = "previous-runtime";
    saveTaskTree(config, interrupted);

    const reclaimed = claimProjectAppTask(config, {
        intent: intent(),
        appOwner: "app-owner",
        handler: "workflow:known-workflow",
        reason: "task-controller",
      });
    expect(reclaimed).toMatchObject({
      kind: "claimed",
      taskId: claim.taskId,
      generation: claim.generation,
    });
    if (reclaimed.kind !== "claimed") throw new Error("expected reclaimed claim");

    const released = readTaskTree(config);
    expect(released.tasks[claim.taskId]).toMatchObject({
      state: "active",
    });
    expect(released.attempts?.[claim.attemptId]).toMatchObject({
      state: "interrupted",
      failureReason: "previous-runtime-attempt-requeued",
    });
    expect(released.attempts?.[reclaimed.attemptId]).toMatchObject({
      state: "running",
      reason: "task-controller",
    });
    expect(released.active_task_ids).toContain(claim.taskId);
  });

  it("repairs existing previous-runtime attention records on startup", () => {
    const { config } = fixture();
    const claim = claimProjectAppTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    const stale = readTaskTree(config);
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
    saveTaskTree(config, stale);

    expect(repairPreviousRuntimeRecoveryAttention(config)).toMatchObject([
      { taskId: "evaluate:session-1", disposition: "requeued" },
    ]);

    const repaired = readTaskTree(config);
    expect(repaired.resources?.["evaluate:session-1"]).toMatchObject({
      status: { phase: "pending", observedGeneration: 0 },
    });
    expect(repaired.tasks["evaluate:session-1"].state).toBe("backlog");
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
    const convergedTree = readTaskTree(config);
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

    const next = claimProjectAppTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
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
    const claim = claimProjectAppTask(config, {
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
    const tree = readTaskTree(config);
    expect(tree.tasks[parentIntent.id]).toBeTruthy();
    expect(tree.resources?.[parentIntent.id]?.status.phase).toBe("running");
    expect(tree.receipts?.[parentIntent.id]).toBeUndefined();
    expect(tree.tasks[childIntent.id]).toBeTruthy();
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
            mode: "achieve",
            outputs: ["proof.md"],
            acceptance: ["Never applied"],
          },
        ],
      }).status,
    ).toBe("stale");
    expect(readTaskTree(config).tasks["stale-action-must-not-apply"]).toBeUndefined();
    expect(completeProjectAppTask(config, fallback, { summary: "owner handled exception" }).status).toBe("applied");
  });

  it("does not reclaim attention tasks during plain resync", () => {
    const { config } = fixture();
    const claim = claimProjectAppTask(config, {
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
    ).toBe("applied");

    expect(
      claimProjectAppTask(config, {
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

    const tree = readTaskTree(config);
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
    const claim = claimProjectAppTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    markProjectAppTaskAttention(config, claim, {
      summary: "waiting for new evidence",
      reason: "handler-blocked",
    });

    const next = claimProjectAppTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
      reason: "event",
      trigger: { type: "project.problem.resolved", data: { project: "sample" } },
    });
    expect(next).toMatchObject({ kind: "claimed", taskId: claim.taskId, generation: claim.generation });
    if (next.kind !== "claimed") throw new Error("expected reclaim");
    expect(readTaskTree(config).tasks[claim.taskId]).toMatchObject({ state: "active" });
    expect(readTaskTree(config).attempts?.[next.attemptId]).toMatchObject({
      trigger: { type: "project.problem.resolved" },
    });
  });

  it("rejects a result when the task resource version changed after claim", () => {
    const { config } = fixture();
    const claim = claimProjectAppTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const concurrent = readTaskTree(config);
    concurrent.resources![claim.taskId].metadata.resourceVersion += 1;
    concurrent.resources![claim.taskId].status.summary = "concurrent observation";
    saveTaskTree(config, concurrent);

    expect(completeProjectAppTask(config, claim, { summary: "stale handler result" })).toMatchObject({
      status: "stale",
      actionsApplied: [],
    });
    expect(readTaskTree(config).resources?.[claim.taskId]).toMatchObject({
      metadata: { resourceVersion: claim.resourceVersion + 1 },
      status: { phase: "running", summary: "concurrent observation" },
    });
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
    const tree = readTaskTree(config);
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
    const claim = claimProjectAppTask(config, {
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
            goal: "Verify the owner action boundary",
            mode: "achieve",
            outputs: ["proof.md"],
            acceptance: ["The reconciler creates this task"],
            owner: "branch-owner",
            workflow: "project",
          },
        ],
      }),
    ).toThrow("workflow must name a real workflow; omit workflow for owner-handled project work");
    expect(readTaskTree(config).tasks["owner-created-task"]).toBeUndefined();
  });

  it("updates task mode without overwriting its domain category", () => {
    const { config } = fixture();
    const claim = claimProjectAppTask(config, {
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

    const task = readTaskTree(config).tasks["categorized-task"];
    expect(task.reconcile_mode).toBe("achieve");
    expect(task.kind).toBe("domain");
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
            mode: "achieve",
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
        conditions: [{} as never],
      }),
    ).toThrow("Condition for pipeline-monitor identity requires a non-empty string");
    expect(readTaskTree(config).tasks[claim.taskId].state).toBe("active");

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
    const task = readTaskTree(config).tasks[claim.taskId];
    expect(task.state).toBe("blocked");
    expect(readTaskTree(config).resources?.[claim.taskId]).toMatchObject({
      status: {
        phase: "waiting",
        conditionIds: ["session-terminal:s_1"],
      },
    });
    expect(readTaskTree(config).conditions?.["session-terminal:s_1"]).toMatchObject({
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
        recovery: false,
        intent: { id: "pipeline-monitor", workflow: "known-workflow", mode: "maintain" },
      },
    ]);
    expect(readTaskTree(config).conditions?.["session-terminal:s_1"]).toMatchObject({
      metadata: { generation: 1, resourceVersion: 2 },
      status: {
        observedGeneration: 1,
        state: "true",
        observed: { eventType: "session.end", sessionId: "s_1", state: "done" },
      },
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
    expect(readTaskTree(config).conditions?.["session-terminal:s_1"]).toBeUndefined();
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
    const claim = claimProjectAppTask(config, {
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
      const claim = claimProjectAppTask(config, {
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
    expect(readTaskTree(config).conditions?.["shared-dependency"]).toMatchObject({
      metadata: { generation: 1, resourceVersion: 2 },
      status: { observedGeneration: 1, state: "true" },
    });

    for (const taskIntent of intents) {
      const resumed = claimProjectAppTask(config, {
        intent: taskIntent,
        appOwner: "app-owner",
        handler: "workflow:known-workflow",
      });
      if (resumed.kind !== "claimed") throw new Error("expected resumed claim");
      completeProjectAppTask(config, resumed, { summary: `${taskIntent.id} converged` });
    }
    expect(readTaskTree(config).conditions?.["shared-dependency"]).toBeUndefined();
  });

  it("advances Condition generation when its desired observation changes", () => {
    const { config } = fixture();
    const first = claimProjectAppTask(config, {
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
    const resumed = claimProjectAppTask(config, {
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

    expect(readTaskTree(config).conditions?.["session-terminal"]).toMatchObject({
      metadata: { generation: 2, resourceVersion: 3 },
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
    const claim = claimProjectAppTask(config, {
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

  it("keeps waiting until the Condition observer reports state", () => {
    const { config } = fixture();
    const claim = claimProjectAppTask(config, {
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
          id: "evidence-window",
          type: "evidence.available",
          subject: "taskId:pipeline-monitor",
          expected: { field: "available", equals: true },
        },
      ],
    });
    const stale = readTaskTree(config);
    stale.conditions!["evidence-window"].status.observedAt = "2026-01-01T00:00:00.000Z";
    saveTaskTree(config, stale);

    expect(
      claimProjectAppTask(config, {
        intent: intent("maintain"),
        appOwner: "app-owner",
        handler: "workflow:known-workflow",
        reason: "periodic-resync",
      }),
    ).toMatchObject({ kind: "waiting", taskId: "pipeline-monitor", conditionIds: ["evidence-window"] });
  });

  it("links a watcher event Condition without monitoring the pipeline itself", () => {
    const { config } = fixture();
    const claim = claimProjectAppTask(config, {
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
    const waitingTree = readTaskTree(config);
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
      claimProjectAppTask(config, {
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
});
