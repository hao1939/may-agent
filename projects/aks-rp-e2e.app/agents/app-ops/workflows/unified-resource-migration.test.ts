import { expect, test } from "bun:test";

import { projectStateHolderCloseActions } from "./unified-resource-migration";

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
