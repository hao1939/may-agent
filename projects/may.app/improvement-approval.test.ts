import { approvalEventFixture } from "./test-fixtures/improvement-approval";
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
    activation: {
      appId: "may-agent",
      operation: "runtime.reload.requested",
      target: "app:may",
    },
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
    activation: packet.activation,
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
    task: { appId: "may", taskId: "goal/improve", generation: 1 },
    revision: 2,
    finding,
    candidate,
  });
  const event = approvalEventFixture(proposal);
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
          task: { appId: "may", taskId: "goal/improve", generation: 1 },
          revision: 1,
          finding: { ...finding, disposition },
          candidate,
        }),
      ).toThrow("does not permit");
    }
    expect(() =>
      buildApprovalProposal({
        packet,
        task: { appId: "may", taskId: "goal/improve", generation: 1 },
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
    expect(condition.requestedAction).toContain("Source application scope:");
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
  test.each([
    ["approve", "approved"],
    ["reject", "rejected"],
    ["defer", "deferred"],
  ])("reads the current Host contract for %s", async (input, decision) => {
    const { packet, proposal } = proposalFixture();
    const result = await trustedDecisionFromEvent(
      packet,
      proposal,
      42,
      async () => approvalEventFixture(proposal, 42, input),
    );
    expect(result).toMatchObject({
      decision,
      trustedHumanControl: true,
      packetHash: packet.packetHash,
      candidateCommit: packet.candidateCommit,
      candidateTreeHash: packet.candidateTreeHash,
      activation: packet.activation,
    });
  });

  test.each([
    [
      "wrong journal id",
      (e: any) => {
        e.id = 41;
      },
    ],
    [
      "wrong source",
      (e: any) => {
        e.source = "app:may";
      },
    ],
    [
      "missing Host stamp",
      (e: any) => {
        delete e.data.hostApproval;
      },
    ],
    [
      "operator approval",
      (e: any) => {
        e.source = e.data.hostApproval.ingressSource = "control-socket";
        e.data.hostApproval.actor.kind = "operator";
      },
    ],
    [
      "wrong App",
      (e: any) => {
        e.target.appId = "other";
      },
    ],
    [
      "wrong Task",
      (e: any) => {
        e.target.taskId = "goal/other";
      },
    ],
    [
      "old Task generation",
      (e: any) => {
        e.data.proposal.taskGeneration = 2;
      },
    ],
    [
      "wrong Condition",
      (e: any) => {
        e.data.proposal.conditionId = "other";
      },
    ],
    [
      "wrong subject",
      (e: any) => {
        e.data.proposal.subject = "approvalId:other";
      },
    ],
    [
      "changed displayed text",
      (e: any) => {
        e.data.proposal.requestedAction += "\nchanged";
      },
    ],
    [
      "different packet",
      (e: any) => {
        e.data.proposal.expected.packetHash = "other";
      },
    ],
    [
      "different approval",
      (e: any) => {
        e.data.proposal.expected.approvalId = "other";
      },
    ],
    [
      "old proposal revision",
      (e: any) => {
        e.data.proposal.expected.proposalRevision = 1;
      },
    ],
    [
      "missing proposal hash",
      (e: any) => {
        delete e.data.proposal.expected.proposalHash;
      },
    ],
    [
      "widened decisions",
      (e: any) => {
        e.data.proposal.expected.allowedDecisions.push("anything");
      },
    ],
  ])("rejects %s", async (_label, change) => {
    const { packet, proposal, event } = proposalFixture();
    change(event);
    await expect(
      trustedDecisionFromEvent(packet, proposal, 42, async () => event),
    ).rejects.toThrow("not the exact trusted");
  });

  test("legacy Telegram provenance cannot replace Host authorization", async () => {
    const { packet, proposal, event } = proposalFixture();
    const legacy = {
      ...event,
      data: {
        ...event.data.proposal.expected,
        decision: "approve",
        provenance: {
          provider: "telegram",
          authenticatedSenderId: "7",
          sourceMessageId: 10,
          replyToMessageId: 9,
        },
      },
    };
    await expect(
      trustedDecisionFromEvent(packet, proposal, 42, async () => legacy),
    ).rejects.toThrow("not the exact trusted");
    await expect(
      trustedDecisionFromEvent(packet, proposal, 42, async () => undefined),
    ).rejects.toThrow("not the exact trusted");
  });

  test("rejects an unrecognized decision even with a valid stamp", async () => {
    const { packet, proposal } = proposalFixture();
    await expect(
      trustedDecisionFromEvent(packet, proposal, 42, async () =>
        approvalEventFixture(proposal, 42, "approve if tests pass"),
      ),
    ).rejects.toThrow("decision is invalid");
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
      newSubjectTask: {
        appId: "may",
        taskId: "goal/new-work-after-adoption",
        generation: 3,
        evidenceHash: "e".repeat(64),
      },
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
        appId: "alex",
        input: {
          kind: "review-task-outcome",
          data: {
            appId: "may",
            taskId: "goal/new-work-after-adoption",
            subjectGeneration: 3,
            evidenceHash: "e".repeat(64),
          },
        },
      },
    });
  });
});
