export type ApprovalProposal = {
  taskGeneration: number;
  conditionId: string;
  conditionGeneration: number;
  subject: string;
  expected: unknown;
  requestedAction: string;
};

export type HostApprovalStamp = {
  version: 1;
  ingressSource: "telegram" | "control-socket";
  actor: { kind: "human" | "operator"; id: string };
  authorization: { reference: string; evidence: Record<string, unknown> };
};

export type VerifiedApprovalDecision = {
  decision: unknown;
  proposal: ApprovalProposal;
  hostApproval: HostApprovalStamp;
};

/** Read the Host authority contract without duplicating ingress source policy in an App. */
export function readVerifiedApprovalDecision(event: {
  type: string;
  source?: string;
  data: Record<string, unknown>;
}): VerifiedApprovalDecision | null {
  if (event.type !== "project.approval.submitted" || (event.source !== "telegram" && event.source !== "control-socket"))
    return null;
  const stamp = event.data.hostApproval;
  const proposal = event.data.proposal;
  if (
    !stamp ||
    typeof stamp !== "object" ||
    Array.isArray(stamp) ||
    !proposal ||
    typeof proposal !== "object" ||
    Array.isArray(proposal)
  )
    return null;
  const hostApproval = stamp as Partial<HostApprovalStamp>;
  const anchor = proposal as Partial<ApprovalProposal>;
  if (
    hostApproval.version !== 1 ||
    hostApproval.ingressSource !== event.source ||
    !hostApproval.actor ||
    !hostApproval.actor.id?.trim() ||
    !hostApproval.authorization ||
    !hostApproval.authorization.reference?.trim() ||
    !hostApproval.authorization.evidence ||
    typeof hostApproval.authorization.evidence !== "object" ||
    !Number.isSafeInteger(anchor.taskGeneration) ||
    Number(anchor.taskGeneration) < 1 ||
    !anchor.conditionId?.trim() ||
    !Number.isSafeInteger(anchor.conditionGeneration) ||
    Number(anchor.conditionGeneration) < 1 ||
    !anchor.subject?.trim() ||
    !anchor.requestedAction?.trim() ||
    !("expected" in anchor)
  )
    return null;
  return {
    decision: event.data.decision,
    proposal: anchor as ApprovalProposal,
    hostApproval: hostApproval as HostApprovalStamp,
  };
}
