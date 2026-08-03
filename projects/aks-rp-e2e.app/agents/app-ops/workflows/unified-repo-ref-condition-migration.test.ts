import { expect, test } from "bun:test";

import { legacyRepoRefConditionMigrationActions } from "./unified-repo-ref-condition-migration";

test("unblocks only a named wait with the legacy repo-ref condition shape", () => {
  const eligible =
    "hold-compact-localdns-split-frontier-e8d7677892-20260730";
  const canonical =
    "hold-compact-serverless-split-frontier-8f0161ccfd-20260730";
  const waiting = (generation: number, conditionId: string) => ({
    metadata: { generation },
    status: { phase: "waiting", conditionIds: [conditionId] },
  });

  expect(
    legacyRepoRefConditionMigrationActions({
      resources: {
        [eligible]: waiting(3, "legacy"),
        [canonical]: waiting(2, "canonical"),
        unknown: waiting(1, "legacy-unknown"),
      },
      conditions: {
        legacy: {
          spec: {
            type: "aks.repo-ref.observed",
            subject: "project:aks-rp-e2e",
            expected: { baseRef: "origin/dev", shaNotEquals: "old" },
          },
        },
        canonical: {
          spec: {
            type: "aks.repo-ref.observed",
            subject: "repoRef:origin/dev",
          },
        },
        "legacy-unknown": {
          spec: {
            type: "aks.repo-ref.observed",
            subject: "project:aks-rp-e2e",
            expected: { baseRef: "origin/dev", shaNotEquals: "old" },
          },
        },
      },
    }),
  ).toEqual([
    {
      kind: "unblock-task",
      taskId: eligible,
      expectedGeneration: 3,
      reason:
        "Legacy repo-ref Condition shape cannot be observed by the shared tracker; return the same task to its owner to install the canonical repoRef condition or close it.",
    },
  ]);
});
