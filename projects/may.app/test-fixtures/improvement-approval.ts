import {
  approvalCondition,
  type ApprovalProposal,
} from "../improvement-approval";

/** Synthetic journal output for App tests. Real ingress stamping belongs to Host. */
export function approvalEventFixture(
  proposal: ApprovalProposal,
  id = 42,
  decision = "approve",
) {
  const condition = approvalCondition(proposal);
  return {
    id,
    type: "project.approval.submitted",
    source: "telegram",
    target: { appId: proposal.task.appId, taskId: proposal.task.taskId },
    data: {
      decision,
      proposal: {
        taskGeneration: proposal.task.generation,
        conditionId: condition.id,
        conditionGeneration: 1,
        subject: condition.subject,
        expected: condition.expected,
        requestedAction: condition.requestedAction,
      },
      hostApproval: {
        version: 1,
        ingressSource: "telegram",
        actor: { kind: "human", id: "7" },
        authorization: {
          reference: "telegram:123:10:9",
          evidence: { chatId: "123", sourceMessageId: 10, replyToMessageId: 9 },
        },
      },
    },
  };
}
