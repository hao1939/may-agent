import { describe, expect, it } from "bun:test";
import type { AppTaskResource as AppTaskResource } from "./app-task-state.js";
import { buildAppTaskTreeProjection, normalizeTaskStateInPlace, type TaskTree } from "./app-task-store.js";

function resource(
  id: string,
  phase: AppTaskResource["status"]["phase"],
  options: {
    mode?: "achieve" | "maintain";
    parentId?: string;
    dependsOn?: string[];
    conditionIds?: string[];
    currentAttemptId?: string;
    input?: Record<string, unknown>;
    owner?: string;
  } = {},
): AppTaskResource {
  return {
    metadata: { id, generation: 2, resourceVersion: 3 },
    spec: {
      parentId: options.parentId ?? "root",
      outcome: `Outcome ${id}`,
      acceptance: [`Accept ${id}`],
      mode: options.mode ?? "achieve",
      dependsOn: options.dependsOn,
      input: options.input,
      owner: options.owner,
    },
    status: {
      observedGeneration: phase === "converged" ? 2 : 1,
      phase,
      conditionIds: options.conditionIds,
      currentAttemptId: options.currentAttemptId,
      updatedAt: "2026-07-20T00:00:00.000Z",
    },
  };
}

function projection(resources: Record<string, AppTaskResource>, extra: Partial<TaskTree> = {}, maxConcurrent = 2) {
  const tree: TaskTree = {
    project: "sample",
    project_lifecycle: "active",
    root_task_id: "root",
    groups: { root: { id: "root", parent_id: null, owner: "owner" } },
    resources,
    tasks: {},
    ...extra,
  };
  normalizeTaskStateInPlace(tree);
  return buildAppTaskTreeProjection(tree, maxConcurrent);
}

describe("canonical project task projection", () => {
  it("classifies readiness and diagnoses a conditionless wait even with live children", () => {
    const result = projection(
      {
        ready: resource("ready", "pending"),
        held: resource("held", "pending", { dependsOn: ["missing"] }),
        waiting: resource("waiting", "waiting", { conditionIds: ["credential-ready:xhs"] }),
        woken: resource("woken", "waiting", { conditionIds: ["pipeline-run:42-completed"] }),
        parent: resource("parent", "waiting"),
        child: resource("child", "pending", { parentId: "parent" }),
        standing: resource("standing", "converged", { mode: "maintain" }),
      },
      {
        conditions: {
          "credential-ready:xhs": {
            metadata: { id: "credential-ready:xhs", generation: 1, resourceVersion: 1 },
            spec: { type: "credential.ready", subject: "credential:xhs", expected: { state: "ready" } },
            status: { observedGeneration: 0, state: "unknown" },
          },
          "pipeline-run:42-completed": {
            metadata: { id: "pipeline-run:42-completed", generation: 1, resourceVersion: 2 },
            spec: {
              type: "pipeline-run.state",
              subject: "pipeline-run:42",
              expected: { field: "state", equals: "completed" },
            },
            status: { observedGeneration: 1, state: "true" },
          },
        },
      },
    );

    expect(result.tasks.ready.readiness).toMatchObject({ state: "ready" });
    expect(result.tasks.held.readiness).toEqual({
      state: "dependency-blocked",
      reason: "Waiting for missing",
      related_ids: ["missing"],
    });
    expect(result.tasks.waiting.readiness).toEqual({
      state: "condition-blocked",
      reason: "Waiting for credential-ready:xhs",
      related_ids: ["credential-ready:xhs"],
    });
    expect(result.tasks.woken.readiness).toEqual({
      state: "ready",
      reason: "Condition satisfied: pipeline-run:42-completed",
      related_ids: ["pipeline-run:42-completed"],
    });
    expect(result.tasks.parent.readiness).toEqual({
      state: "condition-blocked",
      reason: "Waiting without a linked Condition",
      related_ids: [],
    });
    expect(result.integrity.filter((finding) => finding.code === "waiting-without-condition")).toEqual([
      {
        code: "waiting-without-condition",
        task_id: "parent",
        related_ids: [],
        message: "Waiting task has no linked Condition",
      },
    ]);
    expect(result.tasks.standing).toMatchObject({
      mode: "maintain",
      phase: "converged",
      synchronized: true,
      readiness: { state: "not-applicable" },
    });
  });

  it("reports capacity and structural integrity without scheduling work", () => {
    const result = projection(
      {
        running: resource("running", "running", { currentAttemptId: "missing-attempt" }),
        pending: resource("pending", "pending"),
        woken: resource("woken", "waiting", { conditionIds: ["pipeline-run:42-completed"] }),
        malformedWait: resource("malformedWait", "waiting"),
      },
      {
        conditions: {
          "pipeline-run:42-completed": {
            metadata: { id: "pipeline-run:42-completed", generation: 1, resourceVersion: 2 },
            spec: {
              type: "pipeline-run.state",
              subject: "pipeline-run:42",
              expected: { field: "state", equals: "completed" },
            },
            status: { observedGeneration: 1, state: "true" },
          },
        },
      },
      1,
    );

    expect(result.tasks.pending.readiness).toMatchObject({ state: "capacity-blocked" });
    expect(result.tasks.woken.readiness).toMatchObject({ state: "capacity-blocked" });
    expect(result.integrity.map((finding) => finding.code)).toEqual(
      expect.arrayContaining(["running-without-attempt", "waiting-without-condition"]),
    );
  });

  it("preserves bounded desired input and the current wake trigger", () => {
    const result = projection(
      {
        waiting: resource("waiting", "waiting", {
          input: { approval: { id: "approval-1" } },
          conditionIds: ["approval-ready"],
        }),
      },
      {
        taskTriggers: {
          waiting: {
            taskId: "waiting",
            event: { type: "project.approval.submitted", approvalId: "approval-1" },
          },
        },
      },
    );

    expect(result.tasks.waiting).toMatchObject({
      input: { approval: { id: "approval-1" } },
      trigger: { type: "project.approval.submitted", approvalId: "approval-1" },
    });
  });

  it("derives relationships and inherited ownership from resources instead of the compatibility tree", () => {
    const tree: TaskTree = {
      groups: { root: { id: "root", parent_id: null, owner: "root-owner" } },
      resources: {
        parent: resource("parent", "pending", { owner: "task-owner" }),
        child: resource("child", "pending", { parentId: "parent" }),
      },
      tasks: {
        root: { id: "root", children: ["stale"] },
        parent: { id: "parent", owner: "stale-owner", children: [] },
        stale: { id: "stale", parent_id: "root" },
      },
    };

    const result = buildAppTaskTreeProjection(tree, 2);

    expect(result.tasks.root.children).toEqual(["parent"]);
    expect(result.tasks.parent).toMatchObject({ owner: "task-owner", children: ["child"] });
    expect(result.tasks.child).toMatchObject({ owner: "task-owner", children: [] });
    expect(result.tasks.stale).toBeUndefined();
  });
});
