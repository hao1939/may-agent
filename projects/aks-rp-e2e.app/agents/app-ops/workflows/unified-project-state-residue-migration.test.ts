import { expect, test } from "bun:test";

import { projectStateResidueCloseActions } from "./unified-project-state-residue-migration";

test("closes exact completed LocalDNS children before their holder and closes the finite runtime carrier", () => {
  const localDnsHolder =
    "hold-compact-localdns-mixed-frontier-a564608562-20260728";
  const childA =
    "wait-localdns-compact-mixed-frontier-origin-dev-advance-110b4497-20260728";
  const childB =
    "wait-localdns-compact-mixed-frontier-origin-dev-advance-68084bdc-20260728";
  const runtimeCarrier =
    "compact/repair-compact-feature-runtime-container-representation-c4c7695238-ceb5e59f32";
  const projectState = (
    parentId: string,
    mode: string,
    phase: string,
    generation: number,
    conditionId?: string,
  ) => ({
    metadata: { generation },
    spec: { parentId, mode },
    status: { phase, conditionIds: conditionId ? [conditionId] : [] },
  });

  expect(
    projectStateResidueCloseActions({
      resources: {
        [localDnsHolder]: projectState(
          "group/feature-compact",
          "maintain",
          "waiting",
          2,
          "localdns-state",
        ),
        [childA]: projectState(localDnsHolder, "maintain", "converged", 3),
        [childB]: projectState(localDnsHolder, "maintain", "converged", 4),
        [runtimeCarrier]: projectState(
          "group/feature-compact",
          "achieve",
          "waiting",
          5,
          "runtime-state",
        ),
      },
      conditions: {
        "localdns-state": { spec: { type: "project.state" } },
        "runtime-state": { spec: { type: "project.state" } },
      },
    }),
  ).toEqual([
    {
      kind: "close-task",
      taskId: childA,
      expectedGeneration: 3,
      summary:
        "Compacted completed legacy LocalDNS repo-ref carrier into a receipt.",
    },
    {
      kind: "close-task",
      taskId: childB,
      expectedGeneration: 4,
      summary:
        "Compacted completed legacy LocalDNS repo-ref carrier into a receipt.",
    },
    {
      kind: "close-task",
      taskId: localDnsHolder,
      expectedGeneration: 2,
      summary:
        "Retired legacy LocalDNS project-state holder; the stable feature loop owns future observation.",
    },
    {
      kind: "close-task",
      taskId: runtimeCarrier,
      expectedGeneration: 5,
      summary:
        "Closed completed representation repair; the stable feature loop owns future runtime-container observation.",
    },
  ]);
});

test("skips the LocalDNS family when its topology changed", () => {
  const holder = "hold-compact-localdns-mixed-frontier-a564608562-20260728";
  expect(
    projectStateResidueCloseActions({
      resources: {
        [holder]: {
          metadata: { generation: 1 },
          spec: { parentId: "group/feature-compact", mode: "maintain" },
          status: { phase: "waiting", conditionIds: ["state"] },
        },
      },
      conditions: { state: { spec: { type: "project.state" } } },
    }),
  ).toEqual([]);
});
