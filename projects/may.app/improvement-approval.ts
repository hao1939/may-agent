import { createHash } from "node:crypto";

export interface ApprovalPacket {
  packetHash: string;
  baselineCommit: string;
  candidateCommit: string;
  candidateTreeHash: string;
  diffSha256: string;
  verificationSha256: string;
  comparisonSha256: string;
  activationScope: string;
  rollbackCommit: string;
}

export interface HumanDecision {
  decision: "approved" | "rejected" | "deferred";
  trustedHumanControl: boolean;
  packetHash: string;
  baselineCommit: string;
  candidateCommit: string;
  candidateTreeHash: string;
  activationScope: string;
}

export interface CurrentApplicationIdentity {
  baselineCommit: string;
  candidateCommit: string;
  candidateTreeHash: string;
  activationScope: string;
}

export interface FindingJudgment {
  disposition:
    | "successful-no-change"
    | "recovered-or-duplicate"
    | "evidence-gap"
    | "low-value"
    | "improve";
  userImpact: string;
  recurrenceOrRisk: string;
  evidenceAndConfidence: string;
  doNothingOrSimplerAlternative: string;
}

export interface CandidateJudgment {
  disposition: "revise" | "do-not-present" | "present-for-approval";
  verifiedBenefit: string;
  regressionRisk: string;
  implementationCost: string;
  ongoingCost: string;
  scopeAndLimitations: string;
  simplerAlternative: string;
  worthApplying: string;
}

export interface ApprovalProposal {
  approvalId: string;
  packetHash: string;
  proposalHash: string;
  proposalRevision: number;
  task: { appId: string; taskId: string };
  text: string;
}

export interface ApprovalCondition {
  id: string;
  type: "project.approval.submitted";
  subject: string;
  expected: {
    approvalId: string;
    packetHash: string;
    proposalHash: string;
    proposalRevision: number;
    allowedDecisions: readonly ["approve", "reject", "defer"];
  };
  owner: "human" | `human:${string}`;
  requestedAction: string;
  reviewAfterMs: number;
}

export interface TrustedApprovalEvent {
  id?: number;
  type: string;
  source?: string;
  owner?: string;
  target?: { appId?: string; taskId?: string };
  data?: Record<string, unknown>;
}

export interface VerifiedActivation {
  activationTask: { appId: string; taskId: string };
  candidateCommit: string;
  activeRevision: string;
  adoptionCheck: "passed" | "failed" | "inconclusive";
  receipt: string;
}

export function packetHash(packet: Omit<ApprovalPacket, "packetHash">): string {
  return createHash("sha256").update(JSON.stringify(packet)).digest("hex");
}

function requiredJudgmentText(value: string, field: string): string {
  const text = value.trim();
  if (!text) throw new Error(`approval judgment requires ${field}`);
  return text;
}

/**
 * Gate two is deliberately agent-owned prose, not a score. Gate one must have
 * selected a worthwhile improvement before an exact proposal can exist.
 */
export function buildApprovalProposal(input: {
  packet: ApprovalPacket;
  task: { appId: string; taskId: string };
  revision: number;
  finding: FindingJudgment;
  candidate: CandidateJudgment;
}): ApprovalProposal {
  if (input.finding.disposition !== "improve")
    throw new Error(
      `finding disposition ${input.finding.disposition} does not permit a candidate approval`,
    );
  if (input.candidate.disposition !== "present-for-approval")
    throw new Error(
      `candidate disposition ${input.candidate.disposition} is not ready for approval`,
    );
  if (!Number.isSafeInteger(input.revision) || input.revision < 1)
    throw new Error("proposal revision must be a positive integer");
  const task = {
    appId: requiredJudgmentText(input.task.appId, "task appId"),
    taskId: requiredJudgmentText(input.task.taskId, "task taskId"),
  };
  const lines = [
    "Improvement approval proposal",
    `Task: ${task.appId}/${task.taskId}`,
    `Packet: ${input.packet.packetHash}`,
    `Candidate: ${input.packet.candidateCommit} (baseline ${input.packet.baselineCommit})`,
    `Impact: ${requiredJudgmentText(input.finding.userImpact, "user impact")}`,
    `Recurrence/risk: ${requiredJudgmentText(input.finding.recurrenceOrRisk, "recurrence or risk")}`,
    `Evidence/confidence: ${requiredJudgmentText(input.finding.evidenceAndConfidence, "evidence and confidence")}`,
    `Do nothing or simpler option: ${requiredJudgmentText(input.finding.doNothingOrSimplerAlternative, "do-nothing or simpler alternative")}`,
    `Verified benefit: ${requiredJudgmentText(input.candidate.verifiedBenefit, "verified benefit")}`,
    `Regression risk: ${requiredJudgmentText(input.candidate.regressionRisk, "regression risk")}`,
    `Implementation cost: ${requiredJudgmentText(input.candidate.implementationCost, "implementation cost")}`,
    `Ongoing operating/maintenance cost: ${requiredJudgmentText(input.candidate.ongoingCost, "ongoing cost")}`,
    `Scope and limitations: ${requiredJudgmentText(input.candidate.scopeAndLimitations, "scope and limitations")}`,
    `Simpler solution reconsidered: ${requiredJudgmentText(input.candidate.simplerAlternative, "simpler alternative")}`,
    `Is it worth applying? ${requiredJudgmentText(input.candidate.worthApplying, "worth-applying judgment")}`,
    `Application/activation scope: ${input.packet.activationScope}`,
    `Rollback: ${input.packet.rollbackCommit}`,
    "Reply exactly approve, reject, or defer to this message. Corrections and conditional replies remain conversation.",
  ];
  const text = lines.join("\n");
  const proposalHash = createHash("sha256").update(text).digest("hex");
  return {
    approvalId: `improvement:${input.packet.packetHash}`,
    packetHash: input.packet.packetHash,
    proposalHash,
    proposalRevision: input.revision,
    task,
    text,
  };
}

export function approvalCondition(
  proposal: ApprovalProposal,
  owner: ApprovalCondition["owner"] = "human",
): ApprovalCondition {
  return {
    id: `approval-${proposal.packetHash.slice(0, 24)}-r${proposal.proposalRevision}`,
    type: "project.approval.submitted",
    subject: `approvalId:${proposal.approvalId}`,
    expected: {
      approvalId: proposal.approvalId,
      packetHash: proposal.packetHash,
      proposalHash: proposal.proposalHash,
      proposalRevision: proposal.proposalRevision,
      allowedDecisions: ["approve", "reject", "defer"],
    },
    owner,
    // The exact Condition is the durable proposal presentation. HumanTaskService
    // may derive a compact /todo summary, but exact cards must render these bytes.
    requestedAction: proposal.text,
    reviewAfterMs: 86_400_000,
  };
}

/**
 * Re-read one Host journal event by id. Payload provenance alone is never
 * trusted: only the Host-stamped Telegram source plus the exact target and
 * proposal association can become a mechanical decision.
 */
export async function trustedDecisionFromEvent(
  packet: ApprovalPacket,
  proposal: ApprovalProposal,
  eventId: number,
  readEvent: (eventId: number) => Promise<TrustedApprovalEvent | undefined>,
): Promise<HumanDecision> {
  if (packet.packetHash !== proposal.packetHash)
    throw new Error("proposal does not bind the supplied packet");
  if (
    createHash("sha256").update(proposal.text).digest("hex") !==
    proposal.proposalHash
  )
    throw new Error("proposal text changed after its identity was bound");
  if (!Number.isSafeInteger(eventId) || eventId < 1)
    throw new Error("trusted approval requires a positive event id");
  const event = await readEvent(eventId);
  const data = event?.data ?? {};
  const provenance =
    data.provenance &&
    typeof data.provenance === "object" &&
    !Array.isArray(data.provenance)
      ? (data.provenance as Record<string, unknown>)
      : {};
  if (
    event?.id !== eventId ||
    event.type !== "project.approval.submitted" ||
    event.source !== "telegram" ||
    event.target?.appId !== proposal.task.appId ||
    event.target?.taskId !== proposal.task.taskId ||
    data.approvalId !== proposal.approvalId ||
    data.packetHash !== proposal.packetHash ||
    data.proposalHash !== proposal.proposalHash ||
    data.proposalRevision !== proposal.proposalRevision ||
    provenance.provider !== "telegram" ||
    typeof provenance.authenticatedSenderId !== "string" ||
    !provenance.authenticatedSenderId.trim() ||
    typeof provenance.sourceMessageId !== "number" ||
    typeof provenance.replyToMessageId !== "number"
  ) {
    throw new Error(
      "approval event is not the exact trusted Telegram proposal decision",
    );
  }
  const decision = data.decision;
  if (decision !== "approve" && decision !== "reject" && decision !== "defer")
    throw new Error("approval event decision is invalid");
  return {
    decision:
      decision === "approve"
        ? "approved"
        : decision === "reject"
          ? "rejected"
          : "deferred",
    trustedHumanControl: true,
    packetHash: proposal.packetHash,
    baselineCommit: packet.baselineCommit,
    candidateCommit: packet.candidateCommit,
    candidateTreeHash: packet.candidateTreeHash,
    activationScope: packet.activationScope,
  };
}

/** Pure eligibility check. trustedHumanControl must come from a verified journal read, never report/model content. */
export function applicationDenial(
  packet: ApprovalPacket,
  decision: HumanDecision | null,
  current: CurrentApplicationIdentity,
): string | null {
  const { packetHash: claimed, ...body } = packet;
  if (packetHash(body) !== claimed) return "approval packet changed";
  if (!decision?.trustedHumanControl) return "missing trusted human approval";
  if (decision.decision !== "approved")
    return `human decision is ${decision.decision}`;
  for (const key of [
    "packetHash",
    "baselineCommit",
    "candidateCommit",
    "candidateTreeHash",
    "activationScope",
  ] as const) {
    if (decision[key] !== packet[key]) return `approval ${key} mismatch`;
  }
  for (const key of [
    "baselineCommit",
    "candidateCommit",
    "candidateTreeHash",
    "activationScope",
  ] as const) {
    if (current[key] !== packet[key]) return `current ${key} mismatch`;
  }
  return null;
}

/** Mechanical boundary only. Authentication remains operator-owned for the first release. */
export async function applyWithExactApproval(
  packet: ApprovalPacket,
  decision: HumanDecision | null,
  current: CurrentApplicationIdentity,
  operatorApply: (packet: ApprovalPacket) => Promise<void>,
): Promise<{ applied: boolean; denial?: string }> {
  const denial = applicationDenial(packet, decision, current);
  if (denial) return { applied: false, denial };
  await operatorApply(packet);
  return { applied: true };
}

/** Independent Evaluation follows only separate, verified live adoption. */
export function followUpAfterVerifiedActivation(
  packet: ApprovalPacket,
  activation: VerifiedActivation,
):
  | { state: "activation-failed" | "activation-inconclusive"; receipt: string }
  | {
      state: "ready-for-independent-follow-up";
      dependency: {
        id: string;
        appId: "evaluation";
        input: {
          kind: "review-task-outcome";
          data: { appId: string; taskId: string };
        };
      };
    } {
  if (activation.candidateCommit !== packet.candidateCommit)
    return { state: "activation-inconclusive", receipt: activation.receipt };
  if (activation.adoptionCheck !== "passed")
    return {
      state:
        activation.adoptionCheck === "failed"
          ? "activation-failed"
          : "activation-inconclusive",
      receipt: activation.receipt,
    };
  if (activation.activeRevision !== packet.candidateCommit)
    return { state: "activation-inconclusive", receipt: activation.receipt };
  return {
    state: "ready-for-independent-follow-up",
    dependency: {
      id: `post-adoption-review:${packet.packetHash}`,
      appId: "evaluation",
      input: {
        kind: "review-task-outcome",
        data: {
          appId: activation.activationTask.appId,
          taskId: activation.activationTask.taskId,
        },
      },
    },
  };
}
