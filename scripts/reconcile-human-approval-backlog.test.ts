import { describe, expect, test } from "bun:test";
import {
  collectActiveApprovalIds,
  collectApprovalBacklog,
  collectOrphanedApprovalNotifications,
} from "./reconcile-human-approval-backlog.js";

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

  test("closes old delivered approvals only when no live wait or decision remains", () => {
    const state = {
      resources: {
        live: {
          status: { phase: "waiting", conditionIds: ["live-approval"] },
        },
      },
      conditions: {
        "live-approval": {
          spec: {
            type: "project.approval.submitted",
            expected: { approvalId: "approval-live" },
          },
        },
      },
    };
    const notifications = [
      { approvalId: "approval-orphan", approvalKind: "review", agent: "gym", sentAt: 100 },
      { approvalId: "approval-live", approvalKind: "review", agent: "gym", sentAt: 100 },
      { approvalId: "approval-resolved", approvalKind: "review", agent: "gym", sentAt: 100 },
      { approvalId: "approval-recent", approvalKind: "review", agent: "gym", sentAt: 900 },
    ];

    expect(
      collectOrphanedApprovalNotifications(
        notifications,
        collectActiveApprovalIds([state]),
        new Set(["approval-resolved"]),
        500,
      ),
    ).toEqual([expect.objectContaining({ approvalId: "approval-orphan" })]);
  });
});
