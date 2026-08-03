import { expect, test } from "bun:test";

import {
  completedIdentityRepairActions,
  producerlessWaitCloseActions,
  projectStateHolderCloseActions,
} from "./unified-resource-migration";

test("closes only a named childless legacy project-state holder", () => {
  const condition = (type: string) => ({ spec: { type } });
  const holder = (generation: number, conditionId: string) => ({
    metadata: { generation },
    spec: { mode: "maintain", parentId: "group/feature-compact" },
    status: { phase: "waiting", conditionIds: [conditionId] },
  });
  const eligible =
    "hold-compact-storage-csi-mixed-frontier-13555d99f7-20260728";
  const hasChild =
    "hold-compact-bootstrap-profile-byo-acr-cache-switch-frontier-c8dce044a7-20260728";

  expect(
    projectStateHolderCloseActions({
      resources: {
        [eligible]: holder(3, "eligible-condition"),
        [hasChild]: holder(2, "parent-condition"),
        child: {
          metadata: { generation: 1 },
          spec: { mode: "achieve", parentId: hasChild },
          status: { phase: "pending", conditionIds: [] },
        },
        "unknown-holder": holder(1, "unknown-condition"),
      },
      conditions: {
        "eligible-condition": condition("project.state"),
        "parent-condition": condition("project.state"),
        "unknown-condition": condition("project.state"),
      },
    }),
  ).toEqual([
    {
      kind: "close-task",
      taskId: eligible,
      expectedGeneration: 3,
      summary:
        "Retired legacy compact holder; the standing feature loop owns future reconciliation and project state is no longer a scheduling Condition.",
    },
  ]);
});

test("closes only named producerless childless waits", () => {
  const dead =
    "compact/repair-compact-feature-app-monitoring-representation-140dcd4cc6";
  const protectedByCondition =
    "compact/repair-compact-feature-ccp-metricsserver-representation-1173beaf09";
  const protectedByChild =
    "compact/repair-compact-feature-network-cni-representation-75be0f2c63";
  const wait = (generation: number, conditionIds: string[] = []) => ({
    metadata: { generation },
    spec: { mode: "achieve", parentId: "aks-feature-compact-loop" },
    status: { phase: "waiting", conditionIds },
  });

  expect(
    producerlessWaitCloseActions({
      resources: {
        [dead]: wait(2),
        [protectedByCondition]: wait(3, ["external-fact"]),
        [protectedByChild]: wait(4),
        child: {
          metadata: { generation: 1 },
          spec: { mode: "achieve", parentId: protectedByChild },
          status: { phase: "pending", conditionIds: [] },
        },
      },
    }),
  ).toEqual([
    {
      kind: "close-task",
      taskId: dead,
      expectedGeneration: 2,
      summary:
        "Removed a producerless representation repair that had no Condition and no child capable of waking it.",
    },
  ]);
});

test("revises a representation repair that tried to reuse a completed id", () => {
  const taskId = "compact/repair-workload-identity";
  const completedId = "hold-compact-workload-identity-old";
  expect(
    completedIdentityRepairActions({
      resources: {
        [taskId]: {
          metadata: { generation: 2 },
          spec: {
            mode: "achieve",
            parentId: "aks-feature-compact-loop",
            outcome:
              "Repair the feature-compact representation for workload-identity",
            acceptance: ["Keep one truthful holder."],
          },
          status: {
            phase: "attention",
            conditionIds: [],
            summary: `Handler action task already exists or completed: ${completedId}`,
          },
        },
      },
      receipts: { [completedId]: {} },
    }),
  ).toEqual([
    {
      kind: "update-task",
      taskId,
      expectedGeneration: 2,
      acceptance: [
        "Keep one truthful holder.",
        `Completed task ID ${completedId} is immutable. Check receipts before creating a holder; if the frontier is still live, create one new deterministic holder ID and repoint the ledger to it.`,
      ],
    },
  ]);
});
