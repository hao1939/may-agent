import { describe, expect, test } from "bun:test";

import { featureLoopHistoryMigrationActions } from "./unified-feature-loop-history-migration";

describe("feature loop history migration", () => {
  test("compacts only stale converged childless maintain holders", () => {
    const taskState = {
      resources: {
        stale: {
          metadata: { generation: 3 },
          spec: { parentId: "group/feature-compact", mode: "maintain" },
          status: { phase: "converged", conditionIds: [] },
        },
        current: {
          metadata: { generation: 1 },
          spec: { parentId: "group/feature-compact", mode: "maintain" },
          status: { phase: "converged", conditionIds: [] },
        },
        "child-backed": {
          metadata: { generation: 2 },
          spec: { parentId: "group/feature-compact", mode: "maintain" },
          status: { phase: "converged", conditionIds: [] },
        },
        child: {
          metadata: { generation: 1 },
          spec: { parentId: "child-backed", mode: "achieve" },
          status: { phase: "waiting", conditionIds: [] },
        },
        conditioned: {
          metadata: { generation: 1 },
          spec: { parentId: "group/feature-compact", mode: "maintain" },
          status: { phase: "converged", conditionIds: ["external"] },
        },
        unfinished: {
          metadata: { generation: 1 },
          spec: { parentId: "group/feature-compact", mode: "maintain" },
          status: { phase: "waiting", conditionIds: [] },
        },
      },
    };
    const featureState = {
      features: { feature: { taskId: "current" } },
    };

    expect(featureLoopHistoryMigrationActions(taskState, featureState)).toEqual(
      [
        {
          kind: "close-task",
          taskId: "stale",
          expectedGeneration: 3,
          summary:
            "Compacted stale completed feature holder; the standing feature loop owns future reconciliation.",
        },
      ],
    );
  });
});
