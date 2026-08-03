import { expect, test } from "bun:test";

import { finiteHolderMigrationActions } from "./unified-finite-holder-migration";

test("compacts safe holder history and reclassifies live finite holders", () => {
  expect(
    finiteHolderMigrationActions({
      resources: {
        "wait-complete": {
          metadata: { generation: 2 },
          spec: { mode: "maintain", parentId: "project" },
          status: { phase: "converged", conditionIds: [] },
        },
        "hold-live": {
          metadata: { generation: 3 },
          spec: { mode: "maintain", parentId: "project" },
          status: { phase: "waiting", conditionIds: ["external-fact"] },
        },
        "hold-parent": {
          metadata: { generation: 4 },
          spec: { mode: "maintain", parentId: "project" },
          status: { phase: "converged", conditionIds: [] },
        },
        child: {
          metadata: { generation: 1 },
          spec: { mode: "achieve", parentId: "hold-parent" },
          status: { phase: "pending", conditionIds: [] },
        },
        "runtime/wait-internal": {
          metadata: { generation: 1 },
          spec: { mode: "maintain", parentId: "project" },
          status: { phase: "converged", conditionIds: [] },
        },
      },
    }),
  ).toEqual([
    {
      kind: "update-task",
      taskId: "hold-live",
      expectedGeneration: 3,
      mode: "achieve",
    },
    {
      kind: "close-task",
      taskId: "wait-complete",
      expectedGeneration: 2,
      summary:
        "Compacted finite converged hold/wait history; Git, journal, and the task receipt retain the audit trail.",
    },
  ]);
});

test("bounds each migration batch to sixteen actions", () => {
  const resources = Object.fromEntries(
    Array.from({ length: 20 }, (_, index) => [
      `wait-history-${String(index).padStart(2, "0")}`,
      {
        metadata: { generation: 1 },
        spec: { mode: "maintain", parentId: "project" },
        status: { phase: "converged", conditionIds: [] },
      },
    ]),
  );
  expect(finiteHolderMigrationActions({ resources })).toHaveLength(16);
});
