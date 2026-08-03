import { describe, expect, test } from "bun:test";

import { featureLoopOwnershipMigrationActions } from "./unified-feature-loop-ownership-migration";

describe("feature loop ownership migration", () => {
  test("reparents current work and converts finite maintain carriers", () => {
    const taskState = {
      resources: {
        "current-achieve": {
          metadata: { generation: 2 },
          spec: { parentId: "group/feature-compact", mode: "achieve" },
          status: { phase: "waiting" },
        },
        "current-maintain": {
          metadata: { generation: 4 },
          spec: { parentId: "group/feature-compact", mode: "maintain" },
          status: { phase: "pending" },
        },
        "stale-unreferenced": {
          metadata: { generation: 1 },
          spec: { parentId: "group/feature-compact", mode: "maintain" },
          status: { phase: "converged" },
        },
        "already-owned": {
          metadata: { generation: 1 },
          spec: { parentId: "aks-feature-compact-loop", mode: "achieve" },
          status: { phase: "waiting" },
        },
      },
    };
    const featureState = {
      features: {
        first: { taskId: "current-achieve" },
        second: {
          frontierTaskIds: ["current-maintain", "already-owned"],
        },
      },
    };

    expect(
      featureLoopOwnershipMigrationActions(taskState, featureState),
    ).toEqual([
      {
        kind: "update-task",
        taskId: "current-achieve",
        expectedGeneration: 2,
        parentId: "aks-feature-compact-loop",
      },
      {
        kind: "update-task",
        taskId: "current-maintain",
        expectedGeneration: 4,
        parentId: "aks-feature-compact-loop",
        mode: "achieve",
      },
    ]);
  });

  test("uses exact waiting-for references and rejects completed or changed work", () => {
    expect(
      featureLoopOwnershipMigrationActions(
        {
          resources: {
            "exact-wait": {
              metadata: { generation: 1 },
              spec: { parentId: "group/feature-compact", mode: "achieve" },
              status: { phase: "waiting" },
            },
            completed: {
              metadata: { generation: 1 },
              spec: { parentId: "group/feature-compact", mode: "maintain" },
              status: { phase: "converged" },
            },
          },
        },
        {
          features: {
            feature: {
              waitingFor: {
                taskId: "exact-wait",
                representedTaskIds: ["completed"],
              },
            },
          },
        },
      ),
    ).toEqual([
      {
        kind: "update-task",
        taskId: "exact-wait",
        expectedGeneration: 1,
        parentId: "aks-feature-compact-loop",
      },
    ]);
  });
});
