import { describe, expect, it } from "bun:test";
import { bindIdentityRobustPolicyEvidence } from "./verification-allocation-policy-provenance";

const policySha256 = "a".repeat(64);
const evidenceReference = "decision-record:fixture";
const base = {
  schema: "scout.verification-allocation-policy-evidence/v1",
  evidenceClass: "caller-supplied-policy-provenance",
  policySha256,
  evidenceReference,
  decisionOwner: "fixture-owner",
  decisionRevision: "decision-revision:fixture",
  observedAt: "2026-09-03T00:00:00.000Z",
  independentEvidenceStatus: "not-provided",
};

describe("identity-robust policy provenance", () => {
  it("binds the exact policy, owner, revision, clock, and no-evidence status", () => {
    const result = bindIdentityRobustPolicyEvidence(
      policySha256,
      evidenceReference,
      base,
    );
    expect(result).toMatchObject({
      ok: true,
      evidenceStatus: "caller-supplied-unverified",
      errors: [],
    });
    expect(result.manifestSha256).toHaveLength(64);
  });

  it("rejects a different policy, reference, malformed clock, or extra field", () => {
    for (const candidate of [
      { ...base, policySha256: "b".repeat(64) },
      { ...base, evidenceReference: "decision-record:different" },
      { ...base, observedAt: "2026-09-03T00:00:00Z" },
      { ...base, unboundClaim: true },
    ]) {
      expect(
        bindIdentityRobustPolicyEvidence(
          policySha256,
          evidenceReference,
          candidate,
        ),
      ).toMatchObject({
        ok: false,
        manifestSha256: "",
        evidenceStatus: "",
      });
    }
  });

  it("records independent evidence only as provided and unverified", () => {
    expect(
      bindIdentityRobustPolicyEvidence(policySha256, evidenceReference, {
        ...base,
        independentEvidenceStatus: "provided-unverified",
        independentEvidenceReference: "review:fixture",
      }),
    ).toMatchObject({ ok: true, evidenceStatus: "caller-supplied-unverified" });
    expect(
      bindIdentityRobustPolicyEvidence(policySha256, evidenceReference, {
        ...base,
        independentEvidenceStatus: "provided-unverified",
      }),
    ).toMatchObject({ ok: false });
    expect(
      bindIdentityRobustPolicyEvidence(policySha256, evidenceReference, {
        ...base,
        independentEvidenceReference: "review:contradicts-none-status",
      }),
    ).toMatchObject({ ok: false });
  });
});
