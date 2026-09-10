import { describe, expect, test } from "bun:test";
import {
  computeHashFenceReceipts,
  evaluateHashFenceReceipts,
  reviewHashFences,
  type HashFence,
  type HashFenceReceipt,
} from "./hash-fence-evidence";

const frozenFailureSession = "s_1787639175920_1";
const oppositeControlSession = "opposite-control-same-session";
const candidateRoot =
  "/app/projects/gym.app/.state/candidates/repair-stable-localkey-regression-emission";
const fences: readonly HashFence[] = [
  {
    path: `${candidateRoot}/CONTRACT.md`,
    requiredSha256:
      "e507fbf935be63a1f24fc83930121f08e254ebbcbc3a3177392234c4152e3e53",
  },
  {
    path: `${candidateRoot}/agents/gym/workflows/regression-run.ts`,
    requiredSha256:
      "81ae4b02372cdca0522a23cd85584c068b4f20a43871bff52704ff1f5d8180ee",
  },
  {
    path: `${candidateRoot}/agents/gym/workflows/regression-run.test.ts`,
    requiredSha256:
      "ccba55c21884c22ac1dc395a8d8baddae131061bf39fbf6c3289a808eaebd9a4",
  },
];

function copiedReceipt(
  fence: HashFence,
  computedSha256: string,
): HashFenceReceipt {
  return {
    sessionId: "execute-runtime-owned-fresh-regression-once",
    command: ["sha256sum", "--", fence.path],
    path: fence.path,
    computedSha256,
    requiredSha256: fence.requiredSha256,
    comparison: computedSha256 === fence.requiredSha256 ? "match" : "mismatch",
    exitStatus: 0,
  };
}

describe(`same-session hash fence controls frozen from ${frozenFailureSession}`, () => {
  test("classifies the three reads plus copied task hashes as insufficient while preserving HASH_GATE_REJECTED", () => {
    // These are the exact hashes copied from another task by the frozen session;
    // its own transcript contains reads but no independently executed checksum.
    const copied = [
      copiedReceipt(
        fences[0],
        "e507fbf935be63a1f24fc83930121f08e254ebbcbc3a3177392234c4152e3e53",
      ),
      copiedReceipt(
        fences[1],
        "080ca3761a7604829653fc9515840ac9c09487d5c7a5ce70b273331e67acd184",
      ),
      copiedReceipt(
        fences[2],
        "4874358e0666ad0e9639974f8f98def02b4ebbb22a51e57acde7b07a183552ba",
      ),
    ];

    const evidence = evaluateHashFenceReceipts(
      frozenFailureSession,
      fences,
      copied,
    );

    expect(evidence).toMatchObject({
      state: "non-converged",
      activationPermitted: false,
      decision: "HASH_GATE_REJECTED",
      disposition: "same-session-checksum-proof-insufficient",
      disclosure: expect.stringContaining("copied from another session"),
    });
  });

  test("opposite control executes SHA-256 over every exact current path and preserves complete same-session receipts", () => {
    const evidence = reviewHashFences(oppositeControlSession, fences);

    expect(evidence).toMatchObject({
      state: "converged",
      executingSessionId: oppositeControlSession,
      activationPermitted: true,
      disposition: "same-session-checksum-proof-sufficient",
    });
    expect(evidence.receipts).toHaveLength(3);
    for (const [index, receipt] of evidence.receipts.entries()) {
      expect(receipt).toEqual({
        sessionId: oppositeControlSession,
        command: ["sha256sum", "--", fences[index].path],
        path: fences[index].path,
        computedSha256: fences[index].requiredSha256,
        requiredSha256: fences[index].requiredSha256,
        comparison: "match",
        exitStatus: 0,
      });
    }
  });

  test("fails closed for a missing receipt, nonzero exit, or mismatch", () => {
    const valid = computeHashFenceReceipts(oppositeControlSession, fences);
    const missing = evaluateHashFenceReceipts(
      oppositeControlSession,
      fences,
      valid.slice(0, 2),
    );
    const failedCommand = evaluateHashFenceReceipts(
      oppositeControlSession,
      fences,
      valid.map((receipt, index) =>
        index === 1 ? { ...receipt, exitStatus: 1 } : receipt,
      ),
    );
    const mismatch = evaluateHashFenceReceipts(
      oppositeControlSession,
      fences,
      valid.map((receipt, index) =>
        index === 2
          ? {
              ...receipt,
              computedSha256: "0".repeat(64),
              comparison: "mismatch" as const,
            }
          : receipt,
      ),
    );

    for (const evidence of [missing, failedCommand, mismatch]) {
      expect(evidence).toMatchObject({
        state: "non-converged",
        activationPermitted: false,
        decision: "HASH_GATE_REJECTED",
        disposition: "same-session-checksum-proof-insufficient",
      });
    }
  });
});
