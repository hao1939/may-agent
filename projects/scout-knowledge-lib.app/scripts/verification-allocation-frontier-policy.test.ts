import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  hashIdentityRobustFrontierPolicy,
  selectIdentityRobustFrontierPoint,
  selectIdentityRobustFrontierPointFromLocalRecord,
  type IdentityRobustFrontierPoint,
  type IdentityRobustFrontierPolicy,
} from "./verification-allocation-frontier-policy";

const decisionRecord = '{"decision":"synthetic fixture"}\n';
const decisionRecordSha256 = createHash("sha256")
  .update(decisionRecord)
  .digest("hex");
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
  return {
    schema: "scout.verification-allocation-policy-evidence/v1",
    evidenceClass: "caller-supplied-policy-provenance",
    policySha256: hashIdentityRobustFrontierPolicy(policy),
    evidenceReference: policy.evidenceReference,
    decisionOwner: "fixture-owner",
    decisionRevision: "decision-revision:fixture",
    observedAt: "2026-09-03T00:00:00.000Z",
    decisionRecordArtifact: "decisions/policy.json",
    decisionRecordSha256,
    independentEvidenceStatus: "not-provided",
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
    const result = selectIdentityRobustFrontierPoint(
      frontier,
      policy,
      manifest(policy),
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
    expect(
      selectIdentityRobustFrontierPoint(frontier, policy, manifest(policy)),
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
    expect(
      selectIdentityRobustFrontierPoint(frontier, policy, manifest(policy)),
    ).toMatchObject({
      ok: false,
      policyEvidenceStatus: "caller-supplied-unverified",
      selected: null,
      errors: ["no frontier point satisfies the explicit operating policy"],
    });
  });

  it("fails the actual selection closed unless the local decision record matches", async () => {
    const root = await mkdtemp(join(tmpdir(), "scout-frontier-policy-"));
    roots.push(root);
    await mkdir(join(root, "decisions"));
    await writeFile(join(root, "decisions", "policy.json"), decisionRecord);
    const policy: IdentityRobustFrontierPolicy = {
      schema: "scout.verification-allocation-frontier-policy/v1",
      evidenceClass: "caller-supplied-operating-policy",
      selectionBasis: "minimum-uniform-drift-reserve",
      minimumUniformDriftReserve: 0.0006,
      evidenceReference: "decision-record:fixture-local",
    };

    expect(
      await selectIdentityRobustFrontierPointFromLocalRecord(
        frontier,
        policy,
        manifest(policy),
        root,
      ),
    ).toMatchObject({
      ok: true,
      selected: { runBlockCount: 1_032, episodeCount: 33_024 },
      decisionRecordSha256,
      decisionRecordByteLength: Buffer.byteLength(decisionRecord),
      decisionRecordEvidenceStatus: "local-byte-match-unverified",
      errors: [],
    });

    await writeFile(join(root, "decisions", "policy.json"), "tampered\n");
    expect(
      await selectIdentityRobustFrontierPointFromLocalRecord(
        frontier,
        policy,
        manifest(policy),
        root,
      ),
    ).toMatchObject({
      ok: false,
      selected: null,
      decisionRecordSha256: "",
      decisionRecordEvidenceStatus: "",
      errors: ["local evidence bytes do not match the declared SHA-256"],
    });
  });
});
