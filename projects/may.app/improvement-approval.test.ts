import { describe, expect, test } from "bun:test";
import {
  approvalCondition,
  applyWithExactApproval,
  buildApprovalProposal,
  followUpAfterVerifiedActivation,
  packetHash,
  trustedDecisionFromEvent,
  type ApprovalPacket,
  type CandidateJudgment,
  type FindingJudgment,
} from "./improvement-approval";

function fixture() {
  const body = {
    baselineCommit: "base",
    candidateCommit: "candidate",
    candidateTreeHash: "tree",
    diffSha256: "diff",
    verificationSha256: "verify",
    comparisonSha256: "compare",
    activationScope: "may.app",
    rollbackCommit: "base",
  };
  const packet: ApprovalPacket = { packetHash: packetHash(body), ...body };
  const current = {
    baselineCommit: "base",
    candidateCommit: "candidate",
    candidateTreeHash: "tree",
    activationScope: "may.app",
  };
  const approved = {
    decision: "approved" as const,
    trustedHumanControl: true,
    packetHash: packet.packetHash,
    ...current,
  };
  return { packet, current, approved };
}

const finding: FindingJudgment = {
  disposition: "improve",
  userImpact: "A stale approval could apply a different change.",
  recurrenceOrRisk: "Rare but authority-critical.",
  evidenceAndConfidence: "Production adapter fixture reproduced it.",
  doNothingOrSimplerAlternative:
    "Do nothing leaves the stale-reply path; binding the existing Condition is simpler than a registry.",
};
const candidate: CandidateJudgment = {
  disposition: "present-for-approval",
  verifiedBenefit: "Exact stale replies are rejected.",
  regressionRisk: "Narrow adapter and application boundary changes.",
  implementationCost: "Two focused modules and fixtures.",
  ongoingCost: "No service or queue; existing journal reads only.",
  scopeAndLimitations:
    "Mechanics only; fixtures do not prove behavioral improvement.",
  simplerAlternative: "Reuse the existing Condition, packet and journal.",
  worthApplying: "Yes, because it closes an authority gap without a framework.",
};

function proposalFixture() {
  const { packet, current } = fixture();
  const proposal = buildApprovalProposal({
    packet,
    task: { appId: "may", taskId: "goal/improve" },
    revision: 2,
    finding,
    candidate,
  });
  const event = {
    id: 42,
    type: "project.approval.submitted",
    source: "telegram",
    owner: "app:may",
    target: { appId: "may", taskId: "goal/improve" },
    data: {
      approvalId: proposal.approvalId,
      packetHash: proposal.packetHash,
      proposalHash: proposal.proposalHash,
      proposalRevision: proposal.proposalRevision,
      decision: "approve",
      provenance: {
        provider: "telegram",
        authenticatedSenderId: "123",
        chatId: "456",
        sourceMessageId: 10,
        replyToMessageId: 9,
      },
    },
  };
  return { packet, current, proposal, event };
}

describe("two judgment gates and human Condition", () => {
  test("does not present successful work, evidence gaps or low-value candidates", () => {
    const { packet } = fixture();
    for (const disposition of [
      "successful-no-change",
      "recovered-or-duplicate",
      "evidence-gap",
      "low-value",
    ] as const) {
      expect(() =>
        buildApprovalProposal({
          packet,
          task: { appId: "may", taskId: "goal/improve" },
          revision: 1,
          finding: { ...finding, disposition },
          candidate,
        }),
      ).toThrow("does not permit");
    }
    expect(() =>
      buildApprovalProposal({
        packet,
        task: { appId: "may", taskId: "goal/improve" },
        revision: 1,
        finding,
        candidate: { ...candidate, disposition: "do-not-present" },
      }),
    ).toThrow("not ready");
  });

  test("binds both judgments and exact proposal in a human-owned wait", () => {
    const { proposal } = proposalFixture();
    expect(proposal.text).toContain("Do nothing or simpler option:");
    expect(proposal.text).toContain("Is it worth applying?");
    const condition = approvalCondition(proposal, "human:Hao");
    expect(condition.requestedAction).toBe(proposal.text);
    expect(condition.requestedAction).toContain("Impact:");
    expect(condition.requestedAction).toContain("Verified benefit:");
    expect(condition.requestedAction).toContain("Implementation cost:");
    expect(condition.requestedAction).toContain(
      "Simpler solution reconsidered:",
    );
    expect(condition.requestedAction).toContain(
      "Application/activation scope:",
    );
    expect(condition).toMatchObject({
      type: "project.approval.submitted",
      subject: `approvalId:${proposal.approvalId}`,
      owner: "human:Hao",
      expected: {
        packetHash: proposal.packetHash,
        proposalHash: proposal.proposalHash,
        proposalRevision: 2,
        allowedDecisions: ["approve", "reject", "defer"],
      },
    });
  });
});

describe("exact human approval boundary", () => {
  test("does not call application before authentic exact approval", async () => {
    const { packet, current, approved } = fixture();
    let calls = 0;
    const apply = async () => {
      calls++;
    };
    for (const decision of [
      null,
      { ...approved, trustedHumanControl: false },
      { ...approved, decision: "rejected" as const },
    ]) {
      expect(
        (await applyWithExactApproval(packet, decision, current, apply))
          .applied,
      ).toBeFalse();
    }
    expect(calls).toBe(0);
  });

  test("rejects stale baseline, changed candidate and changed scope", async () => {
    const { packet, current, approved } = fixture();
    const apply = async () => {};
    expect(
      (
        await applyWithExactApproval(
          packet,
          approved,
          { ...current, baselineCommit: "new-base" },
          apply,
        )
      ).denial,
    ).toContain("baselineCommit");
    expect(
      (
        await applyWithExactApproval(
          packet,
          approved,
          { ...current, candidateTreeHash: "changed" },
          apply,
        )
      ).denial,
    ).toContain("candidateTreeHash");
    expect(
      (
        await applyWithExactApproval(
          packet,
          { ...approved, activationScope: "all" },
          current,
          apply,
        )
      ).denial,
    ).toContain("activationScope");
  });

  test("permits only the operator callback after all identities match", async () => {
    const { packet, current, approved } = fixture();
    let applied = "";
    expect(
      (
        await applyWithExactApproval(
          packet,
          approved,
          current,
          async (exact) => {
            applied = exact.candidateCommit;
          },
        )
      ).applied,
    ).toBeTrue();
    expect(applied).toBe("candidate");
  });
});

describe("trusted decision, source application and follow-up composition", () => {
  test("rejects caller-authored provenance, wrong sender source, stale proposal and unbound events", async () => {
    const { packet, proposal, event } = proposalFixture();
    for (const changed of [
      { ...event, source: "control-socket" },
      { ...event, target: { ...event.target, taskId: "goal/other" } },
      { ...event, data: { ...event.data, proposalRevision: 1 } },
      { ...event, data: { ...event.data, proposalHash: undefined } },
    ]) {
      await expect(
        trustedDecisionFromEvent(packet, proposal, 42, async () => changed),
      ).rejects.toThrow("not the exact trusted");
    }
  });

  test("rejects a proposal whose displayed text changed without a new identity", async () => {
    const { packet, proposal, event } = proposalFixture();
    await expect(
      trustedDecisionFromEvent(
        packet,
        { ...proposal, text: `${proposal.text}\nChanged material cost: high` },
        42,
        async () => event,
      ),
    ).rejects.toThrow("proposal text changed");
  });

  test("independent follow-up requires a separate verified adoption receipt", () => {
    const { packet } = fixture();
    const activation = {
      activationTask: { appId: "may-agent", taskId: "activate/candidate" },
      candidateCommit: packet.candidateCommit,
      activeRevision: packet.candidateCommit,
      adoptionCheck: "passed" as const,
      receipt: "artifact:activation.json",
    };
    expect(
      followUpAfterVerifiedActivation(packet, {
        ...activation,
        adoptionCheck: "inconclusive",
      }),
    ).toEqual({
      state: "activation-inconclusive",
      receipt: "artifact:activation.json",
    });
    expect(followUpAfterVerifiedActivation(packet, activation)).toMatchObject({
      state: "ready-for-independent-follow-up",
      dependency: {
        appId: "evaluation",
        input: {
          kind: "review-task-outcome",
          data: { appId: "may-agent", taskId: "activate/candidate" },
        },
      },
    });
  });
});
