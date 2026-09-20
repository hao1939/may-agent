import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";
import {
  approvalCondition,
  buildApprovalProposal,
  packetHash,
  type ApprovalPacket,
  type ApprovalProposal,
  type CandidateJudgment,
  type FindingJudgment,
} from "../../../improvement-approval.js";
import {
  inspectApplication,
  type ApplicationFiles,
} from "../../../scripts/apply-improvement.js";

export const name = "prepare-improvement-approval";
export const description =
  "Verify a prepared source candidate and pinned evidence against the current clean target, write the exact human proposal, and return the ordinary human-owned approval Condition. This prepares a wait; it does not approve, apply, activate, or deploy.";

type Input = {
  files: ApplicationFiles;
  proposalPath: string;
  revision: number;
  owner?: "human" | `human:${string}`;
  finding: FindingJudgment;
  candidate: CandidateJudgment;
};

const sha256 = (bytes: string | Buffer) =>
  createHash("sha256").update(bytes).digest("hex");

/** Idempotently retain the exact proposal bytes outside the target checkout. */
function retainProposal(path: string, proposal: ApprovalProposal): string {
  const bytes = `${JSON.stringify(proposal, null, 2)}\n`;
  try {
    writeFileSync(path, bytes, { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    if (readFileSync(path, "utf8") !== bytes)
      throw new Error("proposal path already contains different bytes");
  }
  return sha256(bytes);
}

export function prepareImprovementApproval(
  input: Input,
  task: { appId: string; taskId: string; generation: number },
) {
  const files = {
    packet: resolve(input.files.packet),
    repository: resolve(input.files.repository),
    diff: resolve(input.files.diff),
    verification: resolve(input.files.verification),
    comparison: resolve(input.files.comparison),
  };
  const inspected = inspectApplication(files);
  const packet = inspected.packet as ApprovalPacket;
  const { packetHash: claimed, ...body } = packet;
  if (packetHash(body) !== claimed) throw new Error("approval packet changed");
  for (const key of [
    "baselineCommit",
    "candidateCommit",
    "candidateTreeHash",
    "activationScope",
  ] as const) {
    if (inspected.current[key] !== packet[key])
      throw new Error(`current ${key} mismatch`);
  }
  const proposal = buildApprovalProposal({
    packet,
    task,
    revision: input.revision,
    finding: input.finding,
    candidate: input.candidate,
  });
  const proposalPath = resolve(input.proposalPath);
  const proposalSha256 = retainProposal(proposalPath, proposal);
  return {
    proposal,
    proposalPath,
    proposalSha256,
    condition: approvalCondition(proposal, input.owner ?? "human"),
    files,
  };
}

export async function execute(
  ctx: WorkflowContext<Input>,
): Promise<ExecutionResult> {
  const taskId = ctx.reconciliation?.taskId;
  if (!taskId)
    return ctx.blocked("Approval preparation requires an ordinary owner Task");
  try {
    const prepared = prepareImprovementApproval(ctx.input, {
      appId: "may",
      taskId,
      generation: ctx.reconciliation!.generation,
    });
    const summary =
      "Exact candidate and evidence verified; human review is required before source application.";
    return ctx.done(summary, {
      state: "waiting",
      summary,
      result: {
        stage: "improvement-approval-prepared",
        proposal: prepared.proposal,
        proposalPath: prepared.proposalPath,
        proposalSha256: prepared.proposalSha256,
        files: prepared.files,
        nextOwner: prepared.condition.owner,
        nextAction:
          "Reply approve, reject, or defer to the exact proposal card.",
      },
      facts: [
        `approval-proposal:${prepared.proposalPath}`,
        `approval-proposal-sha256:${prepared.proposalSha256}`,
        `approval-packet:${prepared.files.packet}`,
      ],
      conditions: [prepared.condition],
    });
  } catch (error) {
    return ctx.blocked(`Approval preparation failed: ${String(error)}`);
  }
}
