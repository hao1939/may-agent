import { expect, test } from "bun:test";

import { taskTickHolderCloseActions } from "./unified-task-tick-migration";

test("closes only a named childless legacy task-tick holder", () => {
  const condition = (type: string) => ({ spec: { type } });
  const holder = (generation: number, conditionId: string) => ({
    metadata: { generation },
    spec: { mode: "maintain", parentId: "group/feature-compact" },
    status: { phase: "waiting", conditionIds: [conditionId] },
  });
  const eligible =
    "hold-compact-rp-cluster-lifecycle-reviewed-frontier-21fa9b3201-20260729";
  const hasChild =
    "hold-compact-ccp-metricsserver-reviewed-exception-ha-frontier-3d7512da55-20260730";

  expect(
    taskTickHolderCloseActions({
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
        "eligible-condition": condition("project.task.tick"),
        "parent-condition": condition("project.task.tick"),
        "unknown-condition": condition("project.task.tick"),
      },
    }),
  ).toEqual([
    {
      kind: "close-task",
      taskId: eligible,
      expectedGeneration: 3,
      summary:
        "Retired legacy compact holder; timer or semantic events wake the standing feature loop directly.",
    },
  ]);
});
