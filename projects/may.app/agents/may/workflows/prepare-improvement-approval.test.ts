import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { admitTaskReconcileResult } from "@may-agent/sdk";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import { packetHash } from "../../../improvement-approval";
import { execute } from "./prepare-improvement-approval";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-approval-admission-"));
  roots.push(root);
  const repository = join(root, "repository");
  mkdirSync(repository);
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", repository, ...args], {
      encoding: "utf8",
    }).trim();
  git("init", "-b", "main");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.test");
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
  const comparison =
    '{"kind":"comparison-decision","gymUsed":false,"fixture":true}\n';
  const body = {
    baselineCommit,
    candidateCommit,
    candidateTreeHash,
    diffSha256: sha256(diff),
    verificationSha256: sha256(verification),
    comparisonSha256: sha256(comparison),
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
  return { root, files };
}

test("execute returns a canonically admitted wait bound to the exact proposal", async () => {
  const f = fixture();
  const result = await execute(
    createTestAppWorkflowContext({
      input: {
        files: f.files,
        proposalPath: join(f.root, "proposal.json"),
        revision: 3,
        owner: "human:Hao",
        finding: {
          disposition: "improve",
          userImpact: "A bounded fixture demonstrates the approval handoff.",
          recurrenceOrRisk: "The wrong candidate must never be applied.",
          evidenceAndConfidence:
            "The production workflow inspects real Git evidence.",
          doNothingOrSimplerAlternative: "Reuse the existing human Condition.",
        },
        candidate: {
          disposition: "present-for-approval",
          verifiedBenefit: "The exact candidate is pinned.",
          regressionRisk: "Fixture only.",
          implementationCost: "Small.",
          ongoingCost: "None.",
          scopeAndLimitations: "Admission mechanics only.",
          simplerAlternative: "Reuse the existing gate.",
          worthApplying: "Yes, for this isolated fixture.",
        },
      },
      reconciliation: {
        appId: "may",
        taskId: "goal/approval-admission",
        generation: 7,
        resourceVersion: 1,
      },
    }),
  );

  expect(result.status).toBe("done");
  const output = result.output!;
  expect(output.state).toBe("waiting");
  expect(output.response).toBeUndefined();
  expect(output.summary).toContain("human review is required");

  const admitted = admitTaskReconcileResult(output, {
    allowNeedsAgent: false,
  });
  expect(admitted.ok).toBe(true);
  if (!admitted.ok) throw new Error(admitted.error);

  const proposal = output.result!.proposal;
  const condition = output.conditions![0];
  expect(condition).toMatchObject({
    id: proposal.conditionId,
    owner: "human:Hao",
    requestedAction: proposal.text,
    expected: {
      approvalId: proposal.approvalId,
      packetHash: proposal.packetHash,
      proposalHash: proposal.proposalHash,
      proposalRevision: 3,
      taskGeneration: 7,
      conditionId: proposal.conditionId,
    },
  });
  expect(proposal.task).toEqual({
    appId: "may",
    taskId: "goal/approval-admission",
    generation: 7,
  });
});
