import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  bindIdentityRobustPolicyEvidence,
  bindIdentityRobustPolicyEvidenceFromLocalRecord,
} from "./verification-allocation-policy-provenance";

const evidenceReference = "decision-record:fixture";
const policy = {
  schema: "scout.verification-allocation-frontier-policy/v1",
  evidenceClass: "caller-supplied-operating-policy",
  selectionBasis: "minimum-uniform-drift-reserve",
  minimumUniformDriftReserve: 0.0006,
  evidenceReference,
};
const policySha256 = createHash("sha256")
  .update(JSON.stringify(policy))
  .digest("hex");
const policyEvidenceApplicability = {
  schema: "scout.verification-allocation-policy-applicability/v1",
  evidenceKind: "uniform-marginal-drift-reserve",
  evidenceUnit: "probability-per-model",
  protocolReference: `freeze-protocol-sha256:${"a".repeat(64)}`,
  modelScopeReference: `freeze-model-scope-sha256:${"b".repeat(64)}`,
  applicabilityStatus: "protocol-matched-unverified",
} as const;
const verifiedPolicyScope = {
  schema: "scout.verification-allocation-freeze-policy-scope/v1",
  protocolReference: policyEvidenceApplicability.protocolReference,
  modelScopeReference: policyEvidenceApplicability.modelScopeReference,
} as const;
const decisionRecordObject = {
  schema: "scout.verification-allocation-policy-decision/v2",
  decisionId: "fixture",
  decisionOwner: "fixture-owner",
  decisionRevision: "decision-revision:fixture",
  observedAt: "2026-09-03T00:00:00.000Z",
  policy,
  policyEvidenceApplicability,
  rationale: "Synthetic fixture.",
  independentEvidenceStatus: "not-provided",
  scopeLimit: "Local synthetic control only.",
};
const decisionRecord = `${JSON.stringify(decisionRecordObject)}\n`;
const decisionRecordSha256 = createHash("sha256")
  .update(decisionRecord)
  .digest("hex");
const base = {
  schema: "scout.verification-allocation-policy-evidence/v2",
  evidenceClass: "caller-supplied-policy-provenance",
  policySha256,
  evidenceReference,
  decisionOwner: "fixture-owner",
  decisionRevision: "decision-revision:fixture",
  observedAt: "2026-09-03T00:00:00.000Z",
  decisionRecordArtifact: "decisions/policy.json",
  decisionRecordSha256,
  policyEvidenceApplicability,
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
      policy,
      base,
      verifiedPolicyScope,
    );
    expect(result).toMatchObject({
      ok: true,
      evidenceStatus: "caller-supplied-unverified",
      errors: [],
    });
    expect(result.manifestSha256).toHaveLength(64);
  });

  it("binds an optional frontier snapshot identity and rejects a rollover mismatch", () => {
    const frontierSnapshotReference = `frontier-snapshot-sha256:${"c".repeat(64)}`;
    const snapshotApplicability = {
      ...policyEvidenceApplicability,
      frontierSnapshotReference,
    };
    const snapshotManifest = {
      ...base,
      policyEvidenceApplicability: snapshotApplicability,
    };
    expect(
      bindIdentityRobustPolicyEvidence(
        policySha256,
        evidenceReference,
        policy,
        snapshotManifest,
        { ...verifiedPolicyScope, frontierSnapshotReference },
      ),
    ).toMatchObject({ ok: true });
    expect(
      bindIdentityRobustPolicyEvidence(
        policySha256,
        evidenceReference,
        policy,
        snapshotManifest,
        {
          ...verifiedPolicyScope,
          frontierSnapshotReference: `frontier-snapshot-sha256:${"d".repeat(64)}`,
        },
      ),
    ).toMatchObject({
      ok: false,
      errors: [
        "a matching verified freeze and frontier snapshot policy scope is required for applicability",
      ],
    });
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
          policy,
          candidate,
          verifiedPolicyScope,
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
      bindIdentityRobustPolicyEvidence(
        policySha256,
        evidenceReference,
        policy,
        {
          ...base,
          independentEvidenceStatus: "provided-unverified",
          independentEvidenceReference: "review:fixture",
        },
        verifiedPolicyScope,
      ),
    ).toMatchObject({ ok: true, evidenceStatus: "caller-supplied-unverified" });
    expect(
      bindIdentityRobustPolicyEvidence(
        policySha256,
        evidenceReference,
        policy,
        {
          ...base,
          independentEvidenceStatus: "provided-unverified",
        },
        verifiedPolicyScope,
      ),
    ).toMatchObject({ ok: false });
    expect(
      bindIdentityRobustPolicyEvidence(
        policySha256,
        evidenceReference,
        policy,
        {
          ...base,
          independentEvidenceReference: "review:contradicts-none-status",
        },
        verifiedPolicyScope,
      ),
    ).toMatchObject({ ok: false });
  });

  it("rejects unitless, wrong-unit, and non-applicable policy evidence", () => {
    const { policyEvidenceApplicability: _omitted, ...unitless } = base;
    for (const candidate of [
      unitless,
      {
        ...base,
        policyEvidenceApplicability: {
          ...policyEvidenceApplicability,
          evidenceKind: "complete-factorial-episode-ceiling",
          evidenceUnit: "complete-factorial-episodes",
        },
      },
      {
        ...base,
        policyEvidenceApplicability: {
          ...policyEvidenceApplicability,
          evidenceKind: "retrieved-record-count",
          evidenceUnit: "memory-ids",
        },
      },
      {
        ...base,
        policyEvidenceApplicability: {
          ...policyEvidenceApplicability,
          protocolReference: "design:free-text-is-not-byte-bound",
        },
      },
    ]) {
      expect(
        bindIdentityRobustPolicyEvidence(
          policySha256,
          evidenceReference,
          policy,
          candidate,
          verifiedPolicyScope,
        ),
      ).toMatchObject({
        ok: false,
        manifestSha256: "",
        evidenceStatus: "",
        errors: [
          "an exact caller-supplied policy provenance manifest is required",
        ],
      });
    }

    expect(
      bindIdentityRobustPolicyEvidence(
        policySha256,
        evidenceReference,
        policy,
        {
          ...base,
          policyEvidenceApplicability: {
            ...policyEvidenceApplicability,
            applicabilityStatus: "not-established",
          },
        },
        verifiedPolicyScope,
      ),
    ).toMatchObject({
      ok: false,
      errors: [
        "policy evidence applicability is not established for this protocol and model scope",
      ],
    });

    expect(
      bindIdentityRobustPolicyEvidence(
        policySha256,
        evidenceReference,
        policy,
        base,
        {
          ...verifiedPolicyScope,
          modelScopeReference: `freeze-model-scope-sha256:${"c".repeat(64)}`,
        },
      ),
    ).toMatchObject({
      ok: false,
      errors: [
        "a matching verified freeze policy scope is required for applicability",
      ],
    });
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
        policy,
        base,
        root,
        verifiedPolicyScope,
      ),
    ).toMatchObject({
      ok: true,
      evidenceStatus: "caller-supplied-unverified",
      decisionRecordSha256,
      decisionRecordByteLength: Buffer.byteLength(decisionRecord),
      decisionRecordEvidenceStatus: "local-byte-match-unverified",
      decisionRecordContentStatus: "local-content-match-unverified",
      errors: [],
    });

    await writeFile(join(root, "decisions", "policy.json"), "tampered\n");
    expect(
      await bindIdentityRobustPolicyEvidenceFromLocalRecord(
        policySha256,
        evidenceReference,
        policy,
        base,
        root,
        verifiedPolicyScope,
      ),
    ).toMatchObject({
      ok: false,
      decisionRecordSha256: "",
      decisionRecordEvidenceStatus: "",
      errors: ["local evidence bytes do not match the declared SHA-256"],
    });
  });

  it("rejects duplicate keys throughout a byte-matched local decision record", async () => {
    const root = await mkdtemp(join(tmpdir(), "scout-policy-duplicate-"));
    roots.push(root);
    await mkdir(join(root, "decisions"));
    for (const duplicatedRecord of [
      decisionRecord.replace(
        '"decisionOwner":"fixture-owner"',
        '"decisionOwner":"fixture-owner","decisionOwner":"fixture-owner"',
      ),
      decisionRecord.replace(
        '"minimumUniformDriftReserve":0.0006',
        '"minimumUniformDriftReserve":0.0006,"minimumUniformDriftReserve":0.0006',
      ),
    ]) {
      await writeFile(join(root, "decisions", "policy.json"), duplicatedRecord);
      const duplicatedManifest = {
        ...base,
        decisionRecordSha256: createHash("sha256")
          .update(duplicatedRecord)
          .digest("hex"),
      };

      expect(
        await bindIdentityRobustPolicyEvidenceFromLocalRecord(
          policySha256,
          evidenceReference,
          policy,
          duplicatedManifest,
          root,
          verifiedPolicyScope,
        ),
      ).toMatchObject({
        ok: false,
        decisionRecordEvidenceStatus: "local-byte-match-unverified",
        decisionRecordContentStatus: "",
        errors: ["local decision record contains duplicate JSON object keys"],
      });
    }
  });

  it("rejects byte-matched content that contradicts the manifest", async () => {
    const root = await mkdtemp(join(tmpdir(), "scout-policy-content-"));
    roots.push(root);
    await mkdir(join(root, "decisions"));
    for (const candidate of [
      { ...decisionRecordObject, decisionId: "different" },
      { ...decisionRecordObject, decisionOwner: "different-owner" },
      { ...decisionRecordObject, decisionRevision: "different-revision" },
      { ...decisionRecordObject, observedAt: "2026-09-03T00:00:01.000Z" },
      {
        ...decisionRecordObject,
        policy: { ...policy, minimumUniformDriftReserve: 0.0007 },
      },
      {
        ...decisionRecordObject,
        independentEvidenceStatus: "provided-unverified",
      },
      {
        ...decisionRecordObject,
        policyEvidenceApplicability: {
          ...policyEvidenceApplicability,
          protocolReference: "design:different",
        },
      },
      { ...decisionRecordObject, unboundClaim: true },
    ]) {
      const contradictoryRecord = `${JSON.stringify(candidate)}\n`;
      await writeFile(
        join(root, "decisions", "policy.json"),
        contradictoryRecord,
      );
      const contradictoryManifest = {
        ...base,
        decisionRecordSha256: createHash("sha256")
          .update(contradictoryRecord)
          .digest("hex"),
      };

      expect(
        await bindIdentityRobustPolicyEvidenceFromLocalRecord(
          policySha256,
          evidenceReference,
          policy,
          contradictoryManifest,
          root,
          verifiedPolicyScope,
        ),
      ).toMatchObject({
        ok: false,
        decisionRecordEvidenceStatus: "local-byte-match-unverified",
        decisionRecordContentStatus: "",
        errors: [
          "local decision record does not match the provenance manifest and policy",
        ],
      });
    }
  });
});
