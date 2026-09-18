import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildApprovalProposal,
  packetHash,
  type CandidateJudgment,
  type FindingJudgment,
} from "../improvement-approval";
import {
  applyImprovement,
  applyImprovementFromTrustedEvent,
} from "./apply-improvement";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
const sha = (bytes: string | Buffer) =>
  createHash("sha256").update(bytes).digest("hex");

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-operator-apply-"));
  roots.push(root);
  const repository = join(root, "repo");
  mkdirSync(repository);
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", repository, ...args], {
      encoding: "utf8",
    }).trim();
  git("init", "-b", "main");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.com");
  writeFileSync(join(repository, "behavior.txt"), "before\n");
  git("add", ".");
  git("commit", "-m", "baseline");
  const baselineCommit = git("rev-parse", "HEAD");
  git("checkout", "-b", "candidate");
  writeFileSync(join(repository, "behavior.txt"), "after\n");
  git("commit", "-am", "candidate");
  const candidateCommit = git("rev-parse", "HEAD");
  const candidateTreeHash = git("rev-parse", "HEAD^{tree}");
  git("checkout", "main");
  const diff = execFileSync("git", [
    "-C",
    repository,
    "diff",
    "--binary",
    "--no-ext-diff",
    "--no-renames",
    baselineCommit,
    candidateCommit,
  ]);
  const verification = '{"status":"passed","fixture":true}\n';
  const comparison = '{"verdict":"candidate-supported","fixture":true}\n';
  const body = {
    baselineCommit,
    candidateCommit,
    candidateTreeHash,
    diffSha256: sha(diff),
    verificationSha256: sha(verification),
    comparisonSha256: sha(comparison),
    activationScope: `git-fast-forward:${repository}`,
    rollbackCommit: baselineCommit,
  };
  const packet = { ...body, packetHash: packetHash(body) };
  const files = {
    repository,
    packet: join(root, "packet.json"),
    diff: join(root, "diff.patch"),
    verification: join(root, "verification.json"),
    comparison: join(root, "comparison.json"),
  };
  writeFileSync(files.packet, JSON.stringify(packet));
  writeFileSync(files.diff, diff);
  writeFileSync(files.verification, verification);
  writeFileSync(files.comparison, comparison);
  return { root, git, packet, files };
}

test("real Git application requires an exact operator decision and preserves source on denial", () => {
  const f = fixture();
  expect(applyImprovement(f.files).applied).toBe(false);
  writeFileSync(
    f.files.packet,
    JSON.stringify({ ...f.packet, trustedHumanControl: true }),
  );
  expect(applyImprovement(f.files).applied).toBe(false);
  writeFileSync(f.files.packet, JSON.stringify(f.packet));
  expect(applyImprovement(f.files, "0".repeat(64)).applied).toBe(false);
  expect(f.git("rev-parse", "HEAD")).toBe(f.packet.baselineCommit);
  expect(applyImprovement(f.files, f.packet.packetHash).applied).toBe(true);
  expect(readFileSync(join(f.files.repository, "behavior.txt"), "utf8")).toBe(
    "after\n",
  );
  expect(applyImprovement(f.files, f.packet.packetHash)).toMatchObject({
    applied: true,
    alreadyApplied: true,
    appliedCommit: f.packet.candidateCommit,
  });
});

function waitingTask(proposal: {
  task: { appId: string; taskId: string; generation: number };
  conditionId: string;
  approvalId: string;
  packetHash: string;
  proposalHash: string;
  proposalRevision: number;
  text: string;
}) {
  return {
    appId: proposal.task.appId,
    taskId: proposal.task.taskId,
    status: "waiting",
    generation: proposal.task.generation,
    terminal: false,
    diagnostics: {
      conditions: [
        {
          id: proposal.conditionId,
          condition: {
            spec: {
              type: "project.approval.submitted",
              owner: "human:Hao",
              requestedAction: proposal.text,
              expected: {
                approvalId: proposal.approvalId,
                packetHash: proposal.packetHash,
                proposalHash: proposal.proposalHash,
                proposalRevision: proposal.proposalRevision,
                taskGeneration: proposal.task.generation,
                conditionId: proposal.conditionId,
              },
            },
            status: { state: "false" },
          },
        },
      ],
    },
  };
}

test("trusted journal decision drives the real Git guard once and remains source-only", async () => {
  const f = fixture();
  const finding: FindingJudgment = {
    disposition: "improve",
    userImpact: "A recurring user-visible result can be lost.",
    recurrenceOrRisk: "Material when the bounded path is reached.",
    evidenceAndConfidence:
      "The isolated production-module fixture reproduces it.",
    doNothingOrSimplerAlternative:
      "Do nothing retains loss; this reuses the existing guard.",
  };
  const candidate: CandidateJudgment = {
    disposition: "present-for-approval",
    verifiedBenefit:
      "The regression passes against the exact source candidate.",
    regressionRisk: "The change is limited to the application entrypoint.",
    implementationCost: "One adapter and fixture.",
    ongoingCost: "One bounded event reread per decision; no service.",
    scopeAndLimitations:
      "Source fast-forward only; activation is not authorized or proved.",
    simplerAlternative: "Reuse event.get and the existing Git packet guard.",
    worthApplying:
      "Yes; it closes the missing authority connection with less machinery.",
  };
  const proposal = buildApprovalProposal({
    packet: f.packet,
    task: { appId: "may", taskId: "goal/improvement", generation: 1 },
    revision: 1,
    finding,
    candidate,
  });
  const event = {
    id: 77,
    type: "project.approval.submitted",
    source: "telegram",
    target: { appId: "may", taskId: "goal/improvement" },
    data: {
      approvalId: proposal.approvalId,
      packetHash: proposal.packetHash,
      proposalHash: proposal.proposalHash,
      proposalRevision: 1,
      taskGeneration: proposal.task.generation,
      conditionId: proposal.conditionId,
      decision: "approve",
      provenance: {
        provider: "telegram",
        authenticatedSenderId: "hao",
        sourceMessageId: 22,
        replyToMessageId: 21,
      },
    },
  };
  let reads = 0;
  const first = await applyImprovementFromTrustedEvent(
    f.files,
    proposal,
    77,
    async () => {
      reads++;
      return event;
    },
    async () => waitingTask(proposal),
  );
  expect(first).toMatchObject({
    applied: true,
    appliedCommit: f.packet.candidateCommit,
  });
  expect(reads).toBe(1);
  expect(f.git("rev-parse", "HEAD")).toBe(f.packet.candidateCommit);
  const replay = await applyImprovementFromTrustedEvent(
    f.files,
    proposal,
    77,
    async () => event,
    async () => ({
      ...waitingTask(proposal),
      status: "running",
      diagnostics: {
        conditions: [
          {
            id: proposal.conditionId,
            condition: {
              ...waitingTask(proposal).diagnostics.conditions[0].condition,
              status: { state: "true" },
            },
          },
        ],
      },
    }),
  );
  expect(replay).toMatchObject({ applied: true, alreadyApplied: true });
  expect(replay).not.toHaveProperty("activationReceipt");
});

test("trusted event rejection and stale proposal make zero Git mutation", async () => {
  const f = fixture();
  const proposal = {
    approvalId: `improvement:${f.packet.packetHash}`,
    packetHash: f.packet.packetHash,
    proposalHash: sha("review exactly this"),
    proposalRevision: 1,
    conditionId: `approval-${f.packet.packetHash.slice(0, 24)}-r1`,
    task: { appId: "may", taskId: "goal/improvement", generation: 1 },
    text: "review exactly this",
  };
  const baseEvent = {
    id: 78,
    type: "project.approval.submitted",
    source: "telegram",
    target: proposal.task,
    data: {
      approvalId: proposal.approvalId,
      packetHash: proposal.packetHash,
      proposalHash: proposal.proposalHash,
      proposalRevision: 1,
      taskGeneration: proposal.task.generation,
      conditionId: proposal.conditionId,
      decision: "reject",
      provenance: {
        provider: "telegram",
        authenticatedSenderId: "hao",
        sourceMessageId: 23,
        replyToMessageId: 21,
      },
    },
  };
  expect(
    await applyImprovementFromTrustedEvent(
      f.files,
      proposal,
      78,
      async () => baseEvent,
      async () => waitingTask(proposal),
    ),
  ).toMatchObject({ applied: false, decision: "rejected" });
  await expect(
    applyImprovementFromTrustedEvent(
      f.files,
      proposal,
      78,
      async () => ({
        ...baseEvent,
        data: {
          ...baseEvent.data,
          proposalHash: "0".repeat(64),
          decision: "approve",
        },
      }),
      async () => waitingTask(proposal),
    ),
  ).rejects.toThrow("not the exact trusted");
  expect(f.git("rev-parse", "HEAD")).toBe(f.packet.baselineCommit);
});

test("candidate HEAD in a different target cannot masquerade as an idempotent replay", () => {
  const f = fixture();
  const wrong = join(f.root, "wrong-target");
  execFileSync("git", ["clone", "--quiet", f.files.repository, wrong]);
  execFileSync("git", [
    "-C",
    wrong,
    "checkout",
    "--quiet",
    "-b",
    "candidate-local",
    f.packet.candidateCommit,
  ]);
  const result = applyImprovement(
    { ...f.files, repository: wrong },
    f.packet.packetHash,
  );
  expect(result).toMatchObject({ applied: false });
  expect(result.denial).toContain("activationScope");
  expect(f.git("rev-parse", "HEAD")).toBe(f.packet.baselineCommit);
});

test("changed retained verification and dirty target fail before Git application", () => {
  const f = fixture();
  writeFileSync(f.files.verification, '{"status":"failed"}\n');
  expect(() => applyImprovement(f.files, f.packet.packetHash)).toThrow(
    "verification evidence changed",
  );
  expect(f.git("rev-parse", "HEAD")).toBe(f.packet.baselineCommit);
  writeFileSync(join(f.files.repository, "unrelated.txt"), "preserve me");
  expect(() => applyImprovement(f.files, f.packet.packetHash)).toThrow(
    "not clean",
  );
  expect(readFileSync(join(f.files.repository, "unrelated.txt"), "utf8")).toBe(
    "preserve me",
  );
});

test("a later target baseline and a changed candidate packet invalidate previous approval", () => {
  const f = fixture();
  writeFileSync(
    f.files.packet,
    JSON.stringify({ ...f.packet, candidateTreeHash: "0".repeat(40) }),
  );
  expect(applyImprovement(f.files, f.packet.packetHash).applied).toBe(false);
  writeFileSync(f.files.packet, JSON.stringify(f.packet));
  writeFileSync(join(f.files.repository, "other.txt"), "later baseline\n");
  f.git("add", ".");
  f.git("commit", "-m", "other work");
  const before = f.git("rev-parse", "HEAD");
  expect(applyImprovement(f.files, f.packet.packetHash).applied).toBe(false);
  expect(f.git("rev-parse", "HEAD")).toBe(before);
});
