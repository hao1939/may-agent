import { describe, expect, test } from "bun:test";

import {
  featureLoopResidueMigrationActions,
  featureLoopResidueMigrationBatch,
} from "./unified-feature-loop-residue-migration";

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

  test("limits one reconciliation to the shared 16-action contract", () => {
    const resources = Object.fromEntries(
      Array.from({ length: 20 }, (_, index) => [
        `waiting-${String(index).padStart(2, "0")}`,
        {
          metadata: { generation: 1 },
          spec: { parentId: "group/feature-compact", mode: "achieve" },
          status: { phase: "waiting" },
        },
      ]),
    );

    expect(featureLoopResidueMigrationActions({ resources })).toHaveLength(16);
  });

  test("reads the batch label from the reconciliation task prompt", () => {
    expect(
      featureLoopResidueMigrationBatch(`
## Reconciliation Task
\`\`\`json
{"input":{"batch":"2"}}
\`\`\`
`),
    ).toBe(2);
  });
});
