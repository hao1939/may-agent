import { expect, test } from "bun:test";

import { taskStateWaitMigrationActions } from "./unified-task-state-migration";

test("replaces a matching task-state Condition with dependsOn", () => {
  const taskId =
    "domain/master-validation-failure/spec.traffic-api-proxy.service-reachability/030606162f889d54fd53";
  const dependencyId =
    "domain/repair-master-validation-api-proxy-cpu-overload-manager-storage-toggle-auth-20260802";
  expect(
    taskStateWaitMigrationActions({
      resources: {
        [taskId]: {
          metadata: { generation: 4 },
          spec: { dependsOn: ["prior-proof"] },
          status: { phase: "waiting", conditionIds: ["wait"] },
        },
        [dependencyId]: {
          metadata: { generation: 1 },
          status: { phase: "pending", conditionIds: [] },
        },
      },
      conditions: {
        wait: {
          spec: { type: "task-phase", subject: `task:${dependencyId}` },
        },
      },
    }),
  ).toEqual([
    {
      kind: "update-task",
      taskId,
      expectedGeneration: 4,
      dependsOn: ["prior-proof", dependencyId],
    },
  ]);
});
