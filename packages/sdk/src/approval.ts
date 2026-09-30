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
  decision: string;
  proposal: ApprovalProposal;
  hostApproval: HostApprovalStamp;
};

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Parse a trusted Host journal read. Caller/model JSON is not authorization.
 * The App still checks the exact current Task, candidate, evidence and scope.
 */
export function readVerifiedApprovalDecision(event: {
  type: string;
  source?: string;
  data: Record<string, unknown>;
}): VerifiedApprovalDecision | null {
  if (event.type !== "project.approval.submitted" || (event.source !== "telegram" && event.source !== "control-socket"))
    return null;
  if (!record(event.data)) return null;
  const stamp = event.data.hostApproval;
  const proposal = event.data.proposal;
  if (!record(stamp) || !record(proposal)) return null;
  if (
    stamp.version !== 1 ||
    stamp.ingressSource !== event.source ||
    !record(stamp.actor) ||
    !nonempty(stamp.actor.id) ||
    stamp.actor.kind !== (event.source === "telegram" ? "human" : "operator") ||
    !record(stamp.authorization) ||
    !nonempty(stamp.authorization.reference) ||
    !record(stamp.authorization.evidence) ||
    !nonempty(event.data.decision) ||
    !Number.isSafeInteger(proposal.taskGeneration) ||
    Number(proposal.taskGeneration) < 1 ||
    !nonempty(proposal.conditionId) ||
    !Number.isSafeInteger(proposal.conditionGeneration) ||
    Number(proposal.conditionGeneration) < 1 ||
    !nonempty(proposal.subject) ||
    !nonempty(proposal.requestedAction) ||
    !("expected" in proposal)
  )
    return null;
  return {
    decision: event.data.decision,
    proposal: proposal as ApprovalProposal,
    hostApproval: stamp as HostApprovalStamp,
  };
}
