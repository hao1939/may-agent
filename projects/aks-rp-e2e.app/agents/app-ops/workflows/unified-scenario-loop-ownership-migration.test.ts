import { describe, expect, test } from "bun:test";

import {
  scenarioLoopOwnershipMigrationActions,
  scenarioLoopOwnershipMigrationBatch,
} from "./unified-scenario-loop-ownership-migration";

describe("scenario loop ownership migration", () => {
  test("moves unfinished siblings without changing their workflow", () => {
    const taskState = {
      resources: {
        "scenario-normalization": {
          metadata: { generation: 1 },
          spec: { parentId: "group/scenario-normalization", mode: "maintain" },
          status: { phase: "converged" },
        },
        waiting: {
          metadata: { generation: 2 },
          spec: { parentId: "group/scenario-normalization", mode: "achieve" },
          status: { phase: "waiting" },
        },
        history: {
          metadata: { generation: 3 },
          spec: { parentId: "group/scenario-normalization", mode: "maintain" },
          status: { phase: "converged" },
        },
      },
    };

    expect(scenarioLoopOwnershipMigrationActions(taskState)).toEqual([
      {
        kind: "update-task",
        taskId: "waiting",
        expectedGeneration: 2,
        parentId: "scenario-normalization",
      },
    ]);
  });

  test("limits one reconciliation to 16 actions", () => {
    const resources = Object.fromEntries(
      Array.from({ length: 20 }, (_, index) => [
        `waiting-${index}`,
        {
          metadata: { generation: 1 },
          spec: { parentId: "group/scenario-normalization", mode: "achieve" },
          status: { phase: "waiting" },
        },
      ]),
    );
    expect(scenarioLoopOwnershipMigrationActions({ resources })).toHaveLength(
      16,
    );
  });

  test("reads its stable batch label from the task prompt", () => {
    expect(
      scenarioLoopOwnershipMigrationBatch(`
## Reconciliation Task
\`\`\`json
{"input":{"batch":"2"}}
\`\`\`
`),
    ).toBe(2);
  });
});
