import { describe, expect, test } from "bun:test";

import { featureLoopResidueMigrationActions } from "./unified-feature-loop-residue-migration";

describe("feature loop residue migration", () => {
  test("moves unfinished and child-backed residues without deleting work", () => {
    const taskState = {
      resources: {
        "aks-feature-compact-loop": {
          metadata: { generation: 1 },
          spec: { parentId: "group/feature-compact", mode: "maintain" },
          status: { phase: "converged" },
        },
        waiting: {
          metadata: { generation: 2 },
          spec: { parentId: "group/feature-compact", mode: "achieve" },
          status: { phase: "waiting" },
        },
        "child-backed": {
          metadata: { generation: 3 },
          spec: { parentId: "group/feature-compact", mode: "maintain" },
          status: { phase: "converged" },
        },
        child: {
          metadata: { generation: 1 },
          spec: { parentId: "child-backed", mode: "achieve" },
          status: { phase: "waiting" },
        },
        history: {
          metadata: { generation: 4 },
          spec: { parentId: "group/feature-compact", mode: "maintain" },
          status: { phase: "converged" },
        },
      },
    };

    expect(featureLoopResidueMigrationActions(taskState)).toEqual([
      {
        kind: "update-task",
        taskId: "child-backed",
        expectedGeneration: 3,
        parentId: "aks-feature-compact-loop",
        mode: "achieve",
      },
      {
        kind: "update-task",
        taskId: "waiting",
        expectedGeneration: 2,
        parentId: "aks-feature-compact-loop",
      },
    ]);
  });
});
