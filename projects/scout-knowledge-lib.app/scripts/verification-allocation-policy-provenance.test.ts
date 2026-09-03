import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  bindIdentityRobustPolicyEvidence,
  bindIdentityRobustPolicyEvidenceFromLocalRecord,
} from "./verification-allocation-policy-provenance";

const policySha256 = "a".repeat(64);
const evidenceReference = "decision-record:fixture";
const decisionRecord = '{"decision":"synthetic fixture"}\n';
const decisionRecordSha256 = createHash("sha256")
  .update(decisionRecord)
  .digest("hex");
const base = {
  schema: "scout.verification-allocation-policy-evidence/v1",
  evidenceClass: "caller-supplied-policy-provenance",
  policySha256,
  evidenceReference,
  decisionOwner: "fixture-owner",
  decisionRevision: "decision-revision:fixture",
  observedAt: "2026-09-03T00:00:00.000Z",
  decisionRecordArtifact: "decisions/policy.json",
  decisionRecordSha256,
  independentEvidenceStatus: "not-provided",
};
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

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

  it("binds one descriptor-safe local decision record without promoting authority", async () => {
    const root = await mkdtemp(join(tmpdir(), "scout-policy-binding-"));
    roots.push(root);
    await mkdir(join(root, "decisions"));
    await writeFile(join(root, "decisions", "policy.json"), decisionRecord);

    expect(
      await bindIdentityRobustPolicyEvidenceFromLocalRecord(
        policySha256,
        evidenceReference,
        base,
        root,
      ),
    ).toMatchObject({
      ok: true,
      evidenceStatus: "caller-supplied-unverified",
      decisionRecordSha256,
      decisionRecordByteLength: Buffer.byteLength(decisionRecord),
      decisionRecordEvidenceStatus: "local-byte-match-unverified",
      errors: [],
    });

    await writeFile(join(root, "decisions", "policy.json"), "tampered\n");
    expect(
      await bindIdentityRobustPolicyEvidenceFromLocalRecord(
        policySha256,
        evidenceReference,
        base,
        root,
      ),
    ).toMatchObject({
      ok: false,
      decisionRecordSha256: "",
      decisionRecordEvidenceStatus: "",
      errors: ["local evidence bytes do not match the declared SHA-256"],
    });
  });
});
