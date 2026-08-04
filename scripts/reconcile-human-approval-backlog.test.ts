import { describe, expect, test } from "bun:test";
import { collectApprovalBacklog } from "./reconcile-human-approval-backlog.js";

describe("historical human approval reconciliation", () => {
  test("collects each live approval once and ignores non-waiting history", () => {
    const items = collectApprovalBacklog({
      resources: {
        live: {
          metadata: { id: "live", generation: 3 },
          spec: { owner: "app-ops" },
          status: { phase: "waiting", conditionIds: ["a", "duplicate"] },
        },
        done: {
          metadata: { id: "done", generation: 1 },
          spec: { owner: "aks-explorer" },
          status: { phase: "converged", conditionIds: ["b"] },
        },
      },
      conditions: {
        a: {
          spec: {
            type: "project.approval.submitted",
            expected: { approvalId: "approval-1", waitId: "wait-1" },
          },
        },
        duplicate: {
          spec: {
            type: "project.approval.submitted",
            expected: { approvalId: "approval-1", waitId: "wait-1" },
          },
        },
        b: {
          spec: {
            type: "project.approval.submitted",
            expected: { approvalId: "approval-2" },
          },
        },
      },
    });

    expect(items).toEqual([
      expect.objectContaining({
        approvalId: "approval-1",
        waitId: "wait-1",
        taskId: "live",
        taskGeneration: 3,
        targetOwner: "app-ops",
      }),
    ]);
  });
});
