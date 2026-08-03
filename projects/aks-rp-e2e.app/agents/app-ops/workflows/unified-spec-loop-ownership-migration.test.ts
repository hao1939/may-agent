import { describe, expect, test } from "bun:test";

import { specLoopOwnershipMigrationActions } from "./unified-spec-loop-ownership-migration";

describe("spec loop ownership migration", () => {
  test("reparents the child-backed wait and compacts exact completed holders", () => {
    const resources = {
      "wait-spec-serverless-virtual-nodes-runtime-readiness-family-20260708": {
        metadata: { generation: 1 },
        spec: { parentId: "group/spec-verification", mode: "achieve" },
        status: { phase: "waiting", conditionIds: [] },
      },
      "serverless-runtime-child": {
        metadata: { generation: 1 },
        spec: {
          parentId:
            "wait-spec-serverless-virtual-nodes-runtime-readiness-family-20260708",
          mode: "achieve",
        },
        status: { phase: "waiting", conditionIds: [] },
      },
      "hold-spec-trusted-access-dataplane-token-gateway-reviewed-exception-20260720":
        {
          metadata: { generation: 1 },
          spec: { parentId: "group/spec-verification", mode: "maintain" },
          status: { phase: "converged", conditionIds: [] },
        },
      "hold-spec-network-swift-v1-vnetscale-dual-stack-basic-datapath-reviewed-timeout-frontier-20260728":
        {
          metadata: { generation: 8 },
          spec: { parentId: "group/spec-verification", mode: "maintain" },
          status: { phase: "converged", conditionIds: [] },
        },
    };

    expect(specLoopOwnershipMigrationActions({ resources })).toEqual([
      {
        kind: "update-task",
        taskId:
          "wait-spec-serverless-virtual-nodes-runtime-readiness-family-20260708",
        expectedGeneration: 1,
        parentId: "aks-spec-verification-loop",
      },
      expect.objectContaining({
        kind: "close-task",
        taskId:
          "hold-spec-trusted-access-dataplane-token-gateway-reviewed-exception-20260720",
        expectedGeneration: 1,
      }),
      expect.objectContaining({
        kind: "close-task",
        taskId:
          "hold-spec-network-swift-v1-vnetscale-dual-stack-basic-datapath-reviewed-timeout-frontier-20260728",
        expectedGeneration: 8,
      }),
    ]);
  });

  test("leaves changed topology and exact external waits untouched", () => {
    expect(
      specLoopOwnershipMigrationActions({
        resources: {
          "wait-spec-serverless-virtual-nodes-runtime-readiness-family-20260708":
            {
              metadata: { generation: 1 },
              spec: { parentId: "group/spec-verification", mode: "achieve" },
              status: {
                phase: "waiting",
                conditionIds: ["pipeline-wait"],
              },
            },
          "hold-spec-trusted-access-dataplane-token-gateway-reviewed-exception-20260720":
            {
              metadata: { generation: 2 },
              spec: { parentId: "group/spec-verification", mode: "maintain" },
              status: { phase: "waiting", conditionIds: [] },
            },
        },
      }),
    ).toEqual([]);
  });
});
