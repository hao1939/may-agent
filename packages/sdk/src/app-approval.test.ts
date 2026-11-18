import { describe, expect, test } from "bun:test";
import { readVerifiedApprovalDecision } from "./app-approval.js";

function approval(source: "web-ui" | "control-socket", operatorId = "operator-1") {
  return {
    type: "project.approval.submitted",
    source,
    data: {
      decision: "approve",
      proposal: {
        taskGeneration: 2,
        conditionId: "approval",
        conditionGeneration: 1,
        subject: "resource:example",
        expected: { state: "ready" },
        requestedAction: "Approve release",
      },
      hostApproval: {
        version: 1,
        ingressSource: source,
        actor: { kind: "operator", id: operatorId },
        authorization: { reference: "proposal-1", evidence: { channel: "may-console" } },
      },
    },
  };
}

describe("verified App approval decisions", () => {
  test("accepts formal HTTP operator approvals", () => {
    expect(readVerifiedApprovalDecision(approval("web-ui"))).toMatchObject({
      decision: "approve",
      hostApproval: { ingressSource: "web-ui", actor: { kind: "operator", id: "operator-1" } },
    });
  });

  test("rejects HTTP approvals without an operator identity", () => {
    expect(readVerifiedApprovalDecision(approval("web-ui", " "))).toBeNull();
  });
});
