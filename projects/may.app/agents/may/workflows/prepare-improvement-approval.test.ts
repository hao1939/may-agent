import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { admitTaskReconcileResult } from "@may-agent/sdk";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import { packetHash } from "../../../improvement-approval";
import {
  execute,
  prepareImprovementApproval,
} from "./prepare-improvement-approval";

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

function pinEvaluationSubject(data: ReturnType<typeof fixture>) {
  const evaluationSubject = {
    appId: "may",
    taskId: "goal/subject",
    generation: 4,
    evidenceHash: "subject-evidence",
    assessmentPurpose: "ongoing" as const,
    rubricVersion: "rubric-v1",
    validityIdentity: "validity-v1",
  };
  const body = { ...data.packet, evaluationSubject };
  delete (body as Partial<typeof body>).packetHash;
  const packet = { ...body, packetHash: packetHash(body) };
  writeFileSync(data.files.packet, JSON.stringify(packet));
  return evaluationSubject;
}

function approvalContext(data: ReturnType<typeof fixture>) {
  return createTestAppWorkflowContext({
    input: {
      files: data.files,
      proposalPath: join(data.root, "proposal.json"),
      revision: 1,
      finding: {
        disposition: "improve" as const,
        userImpact: "A bounded fixture demonstrates the approval handoff.",
        recurrenceOrRisk: "The wrong candidate must never be applied.",
        evidenceAndConfidence:
          "The production workflow inspects real evidence.",
        doNothingOrSimplerAlternative: "Reuse the existing human Condition.",
      },
      candidate: {
        disposition: "present-for-approval" as const,
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
  });
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

test("execute binds proposal preparation to the exact packet whose subject was checked", async () => {
  const data = fixture();
  const pin = pinEvaluationSubject(data);
  const result = await execute(approvalContext(data), async () => {
    const packet = JSON.parse(readFileSync(data.files.packet, "utf8"));
    const changedSubject = {
      ...packet.evaluationSubject,
      evidenceHash: "changed",
    };
    const { packetHash: _old, ...body } = {
      ...packet,
      evaluationSubject: changedSubject,
    };
    writeFileSync(
      data.files.packet,
      JSON.stringify({ ...body, packetHash: packetHash(body) }),
    );
    return {
      disposition: "eligible",
      generation: pin.generation,
      evidenceHash: pin.evidenceHash,
      rubricVersion: pin.rubricVersion,
      validityIdentity: pin.validityIdentity,
    };
  });
  expect(result.status).toBe("blocked");
  expect(JSON.stringify(result)).toContain("approval packet changed");
  expect(existsSync(join(data.root, "proposal.json"))).toBe(false);
});

test("execute gates Evaluation-pinned proposals on a fresh exact subject read", async () => {
  const matching = fixture();
  const pin = pinEvaluationSubject(matching);
  const accepted = await execute(approvalContext(matching), async () => ({
    disposition: "eligible",
    generation: pin.generation,
    evidenceHash: pin.evidenceHash,
    rubricVersion: pin.rubricVersion,
    validityIdentity: pin.validityIdentity,
  }));
  expect(accepted.status).toBe("done");
  expect(accepted.output?.state).toBe("waiting");
  expect(existsSync(join(matching.root, "proposal.json"))).toBe(true);

  for (const current of [
    {
      disposition: "eligible",
      generation: pin.generation,
      evidenceHash: "changed",
      rubricVersion: pin.rubricVersion,
      validityIdentity: pin.validityIdentity,
    },
    { disposition: "unavailable" },
    {
      disposition: "eligible",
      generation: pin.generation,
      evidenceHash: pin.evidenceHash,
      rubricVersion: pin.rubricVersion,
      validityIdentity: "crossed-boundary",
    },
  ]) {
    const rejected = fixture();
    pinEvaluationSubject(rejected);
    const result = await execute(
      approvalContext(rejected),
      async () => current,
    );
    expect(result.status).toBe("blocked");
    expect(JSON.stringify(result)).toContain("fresh review and approval");
    expect(existsSync(join(rejected.root, "proposal.json"))).toBe(false);
  }
});
