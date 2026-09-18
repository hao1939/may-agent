import { describe, expect, test } from "bun:test";
import {
  applyWithExactApproval,
  packetHash,
  type ApprovalPacket,
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
