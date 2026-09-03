import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  hashIdentityRobustFrontierPolicy,
  selectIdentityRobustFrontierPoint,
  selectIdentityRobustFrontierPointFromLocalRecord,
  type IdentityRobustFrontierPoint,
  type IdentityRobustFrontierPolicy,
} from "./verification-allocation-frontier-policy";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

const frontier: IdentityRobustFrontierPoint[] = [
  {
    runBlockCount: 1_029,
    episodeCount: 32_928,
    allocation: [171, 171, 171, 172, 172, 172],
    uniformDriftBuffer: 0.000007052630048557755,
  },
  {
    runBlockCount: 1_032,
    episodeCount: 33_024,
    allocation: [172, 172, 172, 172, 172, 172],
    uniformDriftBuffer: 0.0006254995932553816,
  },
  {
    runBlockCount: 1_536,
    episodeCount: 49_152,
    allocation: [256, 256, 256, 256, 256, 256],
    uniformDriftBuffer: 0.044820541675075244,
  },
];

function manifest(policy: IdentityRobustFrontierPolicy) {
  const decisionId = policy.evidenceReference.replace(/^decision-record:/, "");
  const policyEvidenceApplicability =
    policy.selectionBasis === "minimum-uniform-drift-reserve"
      ? {
          schema: "scout.verification-allocation-policy-applicability/v1",
          evidenceKind: "uniform-marginal-drift-reserve",
          evidenceUnit: "probability-per-model",
          protocolReference: `freeze-protocol-sha256:${"a".repeat(64)}`,
          modelScopeReference: `freeze-model-scope-sha256:${"b".repeat(64)}`,
          applicabilityStatus: "protocol-matched-unverified",
        }
      : {
          schema: "scout.verification-allocation-policy-applicability/v1",
          evidenceKind: "complete-factorial-episode-ceiling",
          evidenceUnit: "complete-factorial-episodes",
          protocolReference: `freeze-protocol-sha256:${"a".repeat(64)}`,
          modelScopeReference: `freeze-model-scope-sha256:${"b".repeat(64)}`,
          applicabilityStatus: "protocol-matched-unverified",
        };
  const decisionRecord = `${JSON.stringify({
    schema: "scout.verification-allocation-policy-decision/v2",
    decisionId,
    decisionOwner: "fixture-owner",
    decisionRevision: "decision-revision:fixture",
    observedAt: "2026-09-03T00:00:00.000Z",
    policy,
    policyEvidenceApplicability,
    rationale: "Synthetic fixture.",
    independentEvidenceStatus: "not-provided",
    scopeLimit: "Local synthetic control only.",
  })}\n`;
  return {
    decisionRecord,
    policyScope: {
      schema: "scout.verification-allocation-freeze-policy-scope/v1",
      protocolReference: policyEvidenceApplicability.protocolReference,
      modelScopeReference: policyEvidenceApplicability.modelScopeReference,
    },
    value: {
      schema: "scout.verification-allocation-policy-evidence/v2",
      evidenceClass: "caller-supplied-policy-provenance",
      policySha256: hashIdentityRobustFrontierPolicy(policy),
      evidenceReference: policy.evidenceReference,
      decisionOwner: "fixture-owner",
      decisionRevision: "decision-revision:fixture",
      observedAt: "2026-09-03T00:00:00.000Z",
      decisionRecordArtifact: "decisions/policy.json",
      decisionRecordSha256: createHash("sha256")
        .update(decisionRecord)
        .digest("hex"),
      policyEvidenceApplicability,
      independentEvidenceStatus: "not-provided",
    },
  };
}

describe("identity-robust allocation frontier policy", () => {
  it("fails closed without exactly one explicit policy and evidence reference", () => {
    expect(selectIdentityRobustFrontierPoint(frontier, null)).toMatchObject({
      ok: false,
      policySha256: "",
      selected: null,
      errors: [
        "exactly one explicit frontier policy with evidence is required",
      ],
    });
    expect(
      selectIdentityRobustFrontierPoint(frontier, {
        schema: "scout.verification-allocation-frontier-policy/v1",
        evidenceClass: "caller-supplied-operating-policy",
        selectionBasis: "minimum-uniform-drift-reserve",
        minimumUniformDriftReserve: 0.0006,
        maximumEpisodeCount: 33_024,
        evidenceReference: "decision-record:fixture",
      }),
    ).toMatchObject({ ok: false, selected: null });
    expect(
      selectIdentityRobustFrontierPoint(frontier, {
        schema: "scout.verification-allocation-frontier-policy/v1",
        evidenceClass: "caller-supplied-operating-policy",
        selectionBasis: "maximum-episode-count",
        maximumEpisodeCount: 33_024,
        evidenceReference: "",
      }),
    ).toMatchObject({ ok: false, selected: null });
    expect(selectIdentityRobustFrontierPoint([], {})).toMatchObject({
      ok: false,
      selected: null,
      errors: ["identity-robust frontier is invalid"],
    });
    expect(
      selectIdentityRobustFrontierPoint(
        [{ ...frontier[0]!, episodeCount: 32_960 }],
        null,
      ),
    ).toMatchObject({
      ok: false,
      selected: null,
      errors: ["identity-robust frontier is invalid"],
    });
    const validPolicy: IdentityRobustFrontierPolicy = {
      schema: "scout.verification-allocation-frontier-policy/v1",
      evidenceClass: "caller-supplied-operating-policy",
      selectionBasis: "maximum-episode-count",
      maximumEpisodeCount: 33_024,
      evidenceReference: "decision-record:fixture-missing-manifest",
    };
    expect(
      selectIdentityRobustFrontierPoint(frontier, validPolicy),
    ).toMatchObject({
      ok: false,
      policySha256: hashIdentityRobustFrontierPolicy(validPolicy),
      evidenceManifestSha256: "",
      selected: null,
      errors: [
        "an exact caller-supplied policy provenance manifest is required",
      ],
    });
  });

  it("selects the cheapest point meeting an explicit reserve target", () => {
    const policy: IdentityRobustFrontierPolicy = {
      schema: "scout.verification-allocation-frontier-policy/v1",
      evidenceClass: "caller-supplied-operating-policy",
      selectionBasis: "minimum-uniform-drift-reserve",
      minimumUniformDriftReserve: 0.0006,
      evidenceReference: "decision-record:fixture-reserve",
    };
    const fixture = manifest(policy);
    const result = selectIdentityRobustFrontierPoint(
      frontier,
      policy,
      fixture.value,
      fixture.policyScope,
    );
    expect(result).toMatchObject({
      ok: true,
      policyEvidenceStatus: "caller-supplied-unverified",
      selected: { runBlockCount: 1_032, episodeCount: 33_024 },
      errors: [],
    });
    expect(result.policySha256).toHaveLength(64);
    expect(result.evidenceManifestSha256).toHaveLength(64);
  });

  it("selects the strongest point within an explicit episode ceiling", () => {
    const policy: IdentityRobustFrontierPolicy = {
      schema: "scout.verification-allocation-frontier-policy/v1",
      evidenceClass: "caller-supplied-operating-policy",
      selectionBasis: "maximum-episode-count",
      maximumEpisodeCount: 33_024,
      evidenceReference: "decision-record:fixture-budget",
    };
    const fixture = manifest(policy);
    expect(
      selectIdentityRobustFrontierPoint(
        frontier,
        policy,
        fixture.value,
        fixture.policyScope,
      ),
    ).toMatchObject({
      ok: true,
      policyEvidenceStatus: "caller-supplied-unverified",
      selected: { runBlockCount: 1_032, episodeCount: 33_024 },
      errors: [],
    });
  });

  it("returns no selection when the explicit policy is unattainable", () => {
    const policy: IdentityRobustFrontierPolicy = {
      schema: "scout.verification-allocation-frontier-policy/v1",
      evidenceClass: "caller-supplied-operating-policy",
      selectionBasis: "minimum-uniform-drift-reserve",
      minimumUniformDriftReserve: 0.05,
      evidenceReference: "decision-record:fixture-unattainable",
    };
    const fixture = manifest(policy);
    expect(
      selectIdentityRobustFrontierPoint(
        frontier,
        policy,
        fixture.value,
        fixture.policyScope,
      ),
    ).toMatchObject({
      ok: false,
      policyEvidenceStatus: "caller-supplied-unverified",
      selected: null,
      errors: ["no frontier point satisfies the explicit operating policy"],
    });
  });

  it("fails the actual selection closed unless the local decision record matches", async () => {
    const policy: IdentityRobustFrontierPolicy = {
      schema: "scout.verification-allocation-frontier-policy/v1",
      evidenceClass: "caller-supplied-operating-policy",
      selectionBasis: "minimum-uniform-drift-reserve",
      minimumUniformDriftReserve: 0.0006,
      evidenceReference: "decision-record:fixture-local",
    };
    const fixture = manifest(policy);
    const root = await mkdtemp(join(tmpdir(), "scout-frontier-policy-"));
    roots.push(root);
    await mkdir(join(root, "decisions"));
    await writeFile(
      join(root, "decisions", "policy.json"),
      fixture.decisionRecord,
    );

    expect(
      await selectIdentityRobustFrontierPointFromLocalRecord(
        frontier,
        policy,
        fixture.value,
        root,
        fixture.policyScope,
      ),
    ).toMatchObject({
      ok: true,
      selected: { runBlockCount: 1_032, episodeCount: 33_024 },
      decisionRecordSha256: fixture.value.decisionRecordSha256,
      decisionRecordByteLength: Buffer.byteLength(fixture.decisionRecord),
      decisionRecordEvidenceStatus: "local-byte-match-unverified",
      decisionRecordContentStatus: "local-content-match-unverified",
      errors: [],
    });

    await writeFile(join(root, "decisions", "policy.json"), "tampered\n");
    expect(
      await selectIdentityRobustFrontierPointFromLocalRecord(
        frontier,
        policy,
        fixture.value,
        root,
        fixture.policyScope,
      ),
    ).toMatchObject({
      ok: false,
      selected: null,
      decisionRecordSha256: "",
      decisionRecordEvidenceStatus: "",
      errors: ["local evidence bytes do not match the declared SHA-256"],
    });

    const contradictoryRecord = `${JSON.stringify({
      ...JSON.parse(fixture.decisionRecord),
      decisionRevision: "decision-revision:different",
    })}\n`;
    await writeFile(
      join(root, "decisions", "policy.json"),
      contradictoryRecord,
    );
    expect(
      await selectIdentityRobustFrontierPointFromLocalRecord(
        frontier,
        policy,
        {
          ...fixture.value,
          decisionRecordSha256: createHash("sha256")
            .update(contradictoryRecord)
            .digest("hex"),
        },
        root,
        fixture.policyScope,
      ),
    ).toMatchObject({
      ok: false,
      selected: null,
      decisionRecordEvidenceStatus: "local-byte-match-unverified",
      decisionRecordContentStatus: "",
      errors: [
        "local decision record does not match the provenance manifest and policy",
      ],
    });
  });

  it("records a coherent caller-manifest substitution as a distinct unverified identity", async () => {
    const policy: IdentityRobustFrontierPolicy = {
      schema: "scout.verification-allocation-frontier-policy/v1",
      evidenceClass: "caller-supplied-operating-policy",
      selectionBasis: "minimum-uniform-drift-reserve",
      minimumUniformDriftReserve: 0.0006,
      evidenceReference: "decision-record:fixture-substitution",
    };
    const fixture = manifest(policy);
    const root = await mkdtemp(join(tmpdir(), "scout-frontier-substitution-"));
    roots.push(root);
    await mkdir(join(root, "decisions"));
    await writeFile(
      join(root, "decisions", "policy.json"),
      fixture.decisionRecord,
    );
    const baseline = await selectIdentityRobustFrontierPointFromLocalRecord(
      frontier,
      policy,
      fixture.value,
      root,
      fixture.policyScope,
    );

    const substituteRecord = `${JSON.stringify({
      ...JSON.parse(fixture.decisionRecord),
      decisionRevision: "decision-revision:substitute",
      observedAt: "2026-09-03T00:01:00.000Z",
    })}\n`;
    const substituteManifest = {
      ...fixture.value,
      decisionRevision: "decision-revision:substitute",
      observedAt: "2026-09-03T00:01:00.000Z",
      decisionRecordArtifact: "decisions/substitute.json",
      decisionRecordSha256: createHash("sha256")
        .update(substituteRecord)
        .digest("hex"),
    };
    await writeFile(
      join(root, "decisions", "substitute.json"),
      substituteRecord,
    );
    const substituted = await selectIdentityRobustFrontierPointFromLocalRecord(
      frontier,
      policy,
      substituteManifest,
      root,
      fixture.policyScope,
    );

    expect(baseline).toMatchObject({
      ok: true,
      policyEvidenceStatus: "caller-supplied-unverified",
      selected: { runBlockCount: 1_032, episodeCount: 33_024 },
      decisionRecordEvidenceStatus: "local-byte-match-unverified",
      decisionRecordContentStatus: "local-content-match-unverified",
    });
    expect(substituted).toMatchObject({
      ok: true,
      policyEvidenceStatus: "caller-supplied-unverified",
      selected: { runBlockCount: 1_032, episodeCount: 33_024 },
      decisionRecordEvidenceStatus: "local-byte-match-unverified",
      decisionRecordContentStatus: "local-content-match-unverified",
    });
    expect(substituted.policySha256).toBe(baseline.policySha256);
    expect(substituted.evidenceManifestSha256).not.toBe(
      baseline.evidenceManifestSha256,
    );
    expect(substituted.decisionRecordSha256).not.toBe(
      baseline.decisionRecordSha256,
    );
    expect(await readdir(root)).toEqual(["decisions"]);
  });
});
