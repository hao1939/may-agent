/** Trusted-event source application used by May; the packet-hash operator route remains a fallback. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  applicationDenial,
  assertCurrentEvaluationSubject,
  trustedDecisionFromEvent,
  type ApprovalPacket,
  type ApprovalProposal,
  type TrustedApprovalEvent,
} from "../improvement-approval";

export type ApplicationFiles = {
  packet: string;
  repository: string;
  diff: string;
  verification: string;
  comparison: string;
};

const sha256 = (bytes: Buffer | string) =>
  createHash("sha256").update(bytes).digest("hex");

function git(repository: string, args: string[]): string {
  return execFileSync("git", ["-C", repository, ...args], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  }).trim();
}

/** Reads actual source and evidence. It does not accept a model's current-state assertions. */
export function inspectApplication(files: ApplicationFiles) {
  const packet = JSON.parse(
    readFileSync(files.packet, "utf8"),
  ) as ApprovalPacket;
  const repository = realpathSync(files.repository);
  if (git(repository, ["rev-parse", "--show-toplevel"]) !== repository)
    throw new Error("repository must be the worktree root");
  if (git(repository, ["status", "--porcelain"]))
    throw new Error("application worktree is not clean");
  git(repository, ["symbolic-ref", "--quiet", "HEAD"]);
  for (const key of [
    "baselineCommit",
    "candidateCommit",
    "candidateTreeHash",
    "rollbackCommit",
  ] as const) {
    if (!/^[0-9a-f]{40}$/.test(packet[key] ?? ""))
      throw new Error(`invalid ${key}`);
  }
  const current = {
    baselineCommit: git(repository, ["rev-parse", "HEAD"]),
    candidateCommit: git(repository, [
      "rev-parse",
      `${packet.candidateCommit}^{commit}`,
    ]),
    candidateTreeHash: git(repository, [
      "rev-parse",
      `${packet.candidateCommit}^{tree}`,
    ]),
    activationScope: `git-fast-forward:${repository}`,
  };
  if (packet.rollbackCommit !== packet.baselineCommit)
    throw new Error("rollback must identify the previous baseline");
  if (packet.candidateCommit === packet.baselineCommit)
    throw new Error("candidate makes no source change");
  git(repository, [
    "merge-base",
    "--is-ancestor",
    packet.baselineCommit,
    packet.candidateCommit,
  ]);
  const diff = execFileSync(
    "git",
    [
      "-C",
      repository,
      "diff",
      "--binary",
      "--no-ext-diff",
      "--no-renames",
      packet.baselineCommit,
      packet.candidateCommit,
    ],
    { maxBuffer: 16 * 1024 * 1024 },
  );
  if (
    sha256(diff) !== packet.diffSha256 ||
    sha256(readFileSync(files.diff)) !== packet.diffSha256
  )
    throw new Error("complete Git diff does not match the reviewed diff");
  const verificationBytes = readFileSync(files.verification);
  const comparisonBytes = readFileSync(files.comparison);
  if (sha256(verificationBytes) !== packet.verificationSha256)
    throw new Error("verification evidence changed");
  if (sha256(comparisonBytes) !== packet.comparisonSha256)
    throw new Error("comparison evidence changed");
  // A trusted human decision is supplied only by the operator invocation below.
  // Extra JSON fields claiming human authority have no effect.
  return {
    packet,
    current,
    repository,
    evidence: {
      diffSha256: packet.diffSha256,
      verificationSha256: packet.verificationSha256,
      comparisonSha256: packet.comparisonSha256,
    },
  };
}

export function applyImprovement(
  files: ApplicationFiles,
  approvedPacketHash?: string,
) {
  const inspected = inspectApplication(files);
  const { packet, current, repository } = inspected;
  const decision = approvedPacketHash
    ? {
        decision: "approved" as const,
        trustedHumanControl: true,
        packetHash: approvedPacketHash,
        baselineCommit: packet.baselineCommit,
        candidateCommit: packet.candidateCommit,
        candidateTreeHash: packet.candidateTreeHash,
        activationScope: packet.activationScope,
        ...(packet.activation ? { activation: packet.activation } : {}),
      }
    : null;
  // A replay of the exact approved operation is a successful no-op. This is
  // checked only after the packet/evidence and approval identity were reread.
  if (current.baselineCommit === packet.candidateCommit) {
    // applicationDenial normally requires HEAD at the approved baseline. For
    // replay only, substitute that one invariant after proving actual HEAD is
    // already the candidate; every packet, decision, tree and scope invariant
    // must still pass against this exact checkout.
    const replayDenial = applicationDenial(packet, decision, {
      ...current,
      baselineCommit: packet.baselineCommit,
    });
    if (!replayDenial) {
      return {
        applied: true,
        alreadyApplied: true,
        appliedCommit: packet.candidateCommit,
        ...inspected,
      };
    }
    return { applied: false, denial: replayDenial, ...inspected };
  }
  const denial = applicationDenial(packet, decision, current);
  if (denial) return { applied: false, denial, ...inspected };
  // Operator owns exclusive use of this clean checkout during this bounded command.
  // Ordinary Git locking applies; this command is not a distributed deployment lock.
  const rechecked = inspectApplication(files);
  if (rechecked.packet.packetHash !== approvedPacketHash)
    throw new Error("approval packet changed before application");
  const changed = applicationDenial(
    rechecked.packet,
    decision,
    rechecked.current,
  );
  if (changed) throw new Error(changed);
  git(repository, ["merge", "--ff-only", packet.candidateCommit]);
  const appliedCommit = git(repository, ["rev-parse", "HEAD"]);
  if (
    appliedCommit !== packet.candidateCommit ||
    git(repository, ["status", "--porcelain"])
  )
    throw new Error(
      "source application verification failed; inspect current checkout before further action",
    );
  return { applied: true, appliedCommit, ...inspected };
}

/**
 * Production source-application entrypoint for the plain-text approval path.
 * It rereads the Host-stamped journal event through the public control plane;
 * a caller-provided approval flag is not accepted. Activation remains a
 * separate, explicitly scoped Task after this source-only receipt.
 */
export function currentProposalMatches(
  task: Record<string, unknown>,
  proposal: ApprovalProposal,
): boolean {
  const diagnostics = task.diagnostics as Record<string, unknown> | undefined;
  const conditions = Array.isArray(diagnostics?.conditions)
    ? diagnostics.conditions
    : [];
  const matches = conditions.filter((entry) => {
    const wrapper = entry as Record<string, unknown>;
    const condition = (wrapper.condition ?? wrapper) as Record<string, unknown>;
    const spec = condition.spec as Record<string, unknown> | undefined;
    const status = condition.status as Record<string, unknown> | undefined;
    const expected = spec?.expected as Record<string, unknown> | undefined;
    return (
      wrapper.id === proposal.conditionId &&
      spec?.type === "project.approval.submitted" &&
      (status?.state === "false" || status?.state === "true") &&
      (spec?.owner === "human" ||
        String(spec?.owner ?? "").startsWith("human:")) &&
      spec?.requestedAction === proposal.text &&
      expected?.approvalId === proposal.approvalId &&
      expected?.packetHash === proposal.packetHash &&
      expected?.proposalHash === proposal.proposalHash &&
      expected?.proposalRevision === proposal.proposalRevision &&
      expected?.taskGeneration === proposal.task.generation &&
      expected?.conditionId === proposal.conditionId
    );
  });
  return (
    task.appId === proposal.task.appId &&
    (task.taskId === proposal.task.taskId ||
      task.id === proposal.task.taskId) &&
    task.generation === proposal.task.generation &&
    ["pending", "waiting", "running", "attention"].includes(
      String(task.status),
    ) &&
    task.terminal !== true &&
    matches.length === 1
  );
}

export async function applyImprovementFromTrustedEvent(
  files: ApplicationFiles,
  proposal: ApprovalProposal,
  eventId: number,
  readEvent: (
    eventId: number,
  ) => Promise<TrustedApprovalEvent | undefined> = async (id) => {
    const { createPublicTaskEvidenceProvider } =
      await import("../../evaluation.app/agents/evaluator/workflows/lib/public-task-evidence.js");
    const provider = createPublicTaskEvidenceProvider();
    return (await provider.getEvent(id)) as unknown as TrustedApprovalEvent;
  },
  readTask: (
    appId: string,
    taskId: string,
  ) => Promise<Record<string, unknown>> = async (appId, taskId) => {
    const { createPublicTaskEvidenceProvider } =
      await import("../../evaluation.app/agents/evaluator/workflows/lib/public-task-evidence.js");
    const provider = createPublicTaskEvidenceProvider();
    return provider.getTask(appId, taskId);
  },
  readEvaluationSubject: (subject: {
    appId: string;
    taskId: string;
  }) => Promise<{
    disposition: string;
    evidenceHash?: string;
    task?: Record<string, unknown>;
    validityIdentity?: string;
    rubricVersion?: string;
  }> = async (identity) => {
    const { readSubjectTask } =
      await import("../../evaluation.app/agents/evaluator/workflows/lib/public-task-evidence.js");
    const { assessmentContext } =
      await import("../../evaluation.app/agents/evaluator/workflows/lib/task-assessment-context.js");
    const subject = await readSubjectTask(identity);
    const assessment =
      subject.disposition === "eligible"
        ? assessmentContext(subject, "ongoing")
        : undefined;
    return {
      ...subject,
      validityIdentity: assessment?.validityIdentity,
      rubricVersion: assessment?.rubricVersion,
    };
  },
) {
  const packet = JSON.parse(
    readFileSync(files.packet, "utf8"),
  ) as ApprovalPacket;
  const before = await readTask(proposal.task.appId, proposal.task.taskId);
  if (!currentProposalMatches(before, proposal))
    throw new Error("approval proposal is no longer the current human wait");
  const decision = await trustedDecisionFromEvent(
    packet,
    proposal,
    eventId,
    readEvent,
  );
  if (decision.decision !== "approved") {
    return {
      applied: false,
      denial: `human decision is ${decision.decision}`,
      decision: decision.decision,
    };
  }
  const current = await readTask(proposal.task.appId, proposal.task.taskId);
  if (!currentProposalMatches(current, proposal))
    throw new Error("approval proposal changed before source application");
  if (packet.evaluationSubject) {
    const pinned = packet.evaluationSubject;
    const subject = await readEvaluationSubject({
      appId: pinned.appId,
      taskId: pinned.taskId,
    });
    const detail = (subject.task?.detail ?? {}) as Record<string, unknown>;
    assertCurrentEvaluationSubject(pinned, {
      disposition: subject.disposition,
      generation:
        typeof detail.generation === "number" ? detail.generation : undefined,
      evidenceHash: subject.evidenceHash,
      validityIdentity: subject.validityIdentity,
      rubricVersion: subject.rubricVersion,
    });
  }
  return applyImprovement(files, decision.packetHash);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const option = (name: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const required = (name: string) => {
    const value = option(name);
    if (!value || value.startsWith("--")) throw new Error(`required ${name}`);
    return resolve(value);
  };
  const files = {
    packet: required("--packet"),
    repository: required("--repo"),
    diff: required("--diff"),
    verification: required("--verification"),
    comparison: required("--comparison"),
  };
  const receiptPath = required("--receipt");
  const proposalPathOption = option("--proposal");
  const retainedProposal = proposalPathOption
    ? (JSON.parse(
        readFileSync(resolve(proposalPathOption), "utf8"),
      ) as ApprovalProposal)
    : undefined;
  const authority = option("--event-id")
    ? {
        kind: "trusted-journal-event",
        eventId: option("--event-id"),
        proposal: proposalPathOption ? resolve(proposalPathOption) : undefined,
        task: retainedProposal?.task,
        conditionId: retainedProposal?.conditionId,
        proposalHash: retainedProposal?.proposalHash,
        packetHash: retainedProposal?.packetHash,
      }
    : {
        kind: "operator-packet-hash",
        supplied: Boolean(option("--approve")),
      };
  // Evidence and receipts must be outside the target checkout so inspection is clean.
  writeFileSync(
    receiptPath,
    JSON.stringify({
      stage: "source-application",
      phase: "requested",
      files,
      authority,
    }) + "\n",
    { flag: "wx" },
  );
  try {
    const eventIdText = option("--event-id");
    const proposalPath = option("--proposal");
    if (Boolean(eventIdText) !== Boolean(proposalPath))
      throw new Error("--event-id and --proposal must be supplied together");
    const eventId = eventIdText ? Number(eventIdText) : 0;
    if (eventIdText && (!Number.isSafeInteger(eventId) || eventId < 1))
      throw new Error("--event-id must be a positive integer");
    const result = eventIdText
      ? await applyImprovementFromTrustedEvent(
          files,
          JSON.parse(
            readFileSync(resolve(proposalPath!), "utf8"),
          ) as ApprovalProposal,
          eventId,
        )
      : applyImprovement(files, option("--approve"));
    writeFileSync(
      receiptPath,
      JSON.stringify(
        {
          stage: "source-application",
          time: new Date().toISOString(),
          files,
          authority,
          ...result,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      JSON.stringify({
        applied: result.applied,
        receipt: receiptPath,
        ...("denial" in result ? { denial: result.denial } : {}),
      }),
    );
    if (!result.applied) process.exitCode = 2;
  } catch (error) {
    writeFileSync(
      receiptPath,
      JSON.stringify(
        {
          stage: "source-application",
          phase: "failed",
          files,
          authority,
          error: String(error),
          time: new Date().toISOString(),
        },
        null,
        2,
      ) + "\n",
    );
    throw error;
  }
}
