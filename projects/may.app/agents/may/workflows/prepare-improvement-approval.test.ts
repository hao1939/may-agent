import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packetHash } from "../../../improvement-approval";
import { prepareImprovementApproval } from "./prepare-improvement-approval";

const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-execution-approval-"));
  roots.push(root);
  const repository = join(root, "repository");
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
  const verification = `${JSON.stringify({
    status: "passed",
    source: {
      appId: "may",
      taskId: "goal/execution-failure",
      attemptId: "r_1_fixture",
      operationId: "op_fixture",
      executionId: "s_fixture",
    },
  })}\n`;
  const comparison = `${JSON.stringify({
    kind: "comparison-decision",
    gymUsed: false,
    reason: "The controlled blocker was deterministic.",
    evidence: ["focused regression and retained execution receipt"],
    limitations: ["No live adoption or original-symptom recheck."],
  })}\n`;
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
  return { root, packet, files };
}

describe("execution-origin improvement approval preparation", () => {
  test("pins execution-origin identity without inventing Evaluation or Gym receipts", () => {
    const data = fixture();
    const prepared = prepareImprovementApproval(
      {
        files: data.files,
        proposalPath: join(data.root, "proposal.json"),
        revision: 1,
        finding: {
          disposition: "improve",
          userImpact:
            "May goal/execution-failure is blocked; its accepted result links attempt r_1_fixture, operation op_fixture, and execution s_fixture.",
          recurrenceOrRisk:
            "The controlled defect repeats for the supported local command.",
          evidenceAndConfidence:
            "Read the accepted owner Task result and retained execution receipt; no Evaluation publication was used.",
          doNothingOrSimplerAlternative:
            "Same-Task recovery was attempted first; the linked repair is the smallest independent outcome.",
        },
        candidate: {
          disposition: "present-for-approval",
          verifiedBenefit:
            "The isolated deterministic command now completes and the focused regression passes.",
          regressionRisk: "Limited to the fixture behavior.",
          implementationCost: "One focused repair and regression.",
          ongoingCost:
            "No scanner, service, registry, or automatic Task creation.",
          scopeAndLimitations:
            "Candidate source only; live adoption and original-symptom recheck remain pending.",
          simplerAlternative:
            "Reuse owner Tasks and the existing approval path.",
          worthApplying: "Yes, subject to exact human approval.",
        },
      },
      {
        appId: "may",
        taskId: "goal/execution-failure",
        generation: 1,
      },
    );

    const comparison = JSON.parse(readFileSync(data.files.comparison, "utf8"));
    expect(comparison).toMatchObject({
      kind: "comparison-decision",
      gymUsed: false,
    });
    expect(prepared.proposal.text).toContain(
      "attempt r_1_fixture, operation op_fixture, and execution s_fixture",
    );
    expect(prepared.proposal.text).toContain(
      "no Evaluation publication was used",
    );
    expect(prepared.proposal.text).toContain(
      "live adoption and original-symptom recheck remain pending",
    );
    expect(prepared.condition.owner).toBe("human");
    expect(prepared.condition.expected.packetHash).toBe(data.packet.packetHash);
    expect(prepared.condition.requestedAction).toBe(prepared.proposal.text);
    expect(JSON.parse(readFileSync(prepared.proposalPath, "utf8"))).toEqual(
      prepared.proposal,
    );
  });
});
