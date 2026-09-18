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

export function packetHash(packet: Omit<ApprovalPacket, "packetHash">): string {
  return createHash("sha256").update(JSON.stringify(packet)).digest("hex");
}

/** Pure eligibility check. trustedHumanControl must come from the operator route, never report/model content. */
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
