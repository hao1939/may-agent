import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  freezeArtifactSha256,
  verifyExecutionFreezeManifest,
} from "./verification-allocation-freeze";
import { selectIdentityRobustFrontierPointFromFreezeBundle } from "./verification-allocation-frontier-freeze";
import {
  selectIdentityRobustFrontierPointFromSnapshot,
  summarizeIdentityRobustSnapshotFrontierSelection,
} from "./verification-allocation-frontier-snapshot-select";
import {
  createIdentityRobustFrontierSnapshot,
  identityRobustFrontierSnapshotReference,
} from "./verification-allocation-frontier-snapshot";
import {
  hashIdentityRobustFrontierPolicy,
  type IdentityRobustFrontierPoint,
  type IdentityRobustFrontierPolicy,
} from "./verification-allocation-frontier-policy";
import { buildToyFactorialSchedule } from "./verification-allocation-factorial";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })),
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
];

async function freezeFixture() {
  const root = await mkdtemp(join(tmpdir(), "scout-frontier-freeze-"));
  temporaryRoots.push(root);
  const contents = {
    "schedule.json": JSON.stringify(buildToyFactorialSchedule()),
    "evidence/model-resolution.json": "fixture model resolution",
    "seed-policy.md": "fixture seeds are enumerated once",
    "bundle.zip": "fixture bundle bytes",
    "MANIFEST.sha256": "fixture checksum manifest",
    "MANIFEST.sha256.ots": "fixture timestamp proof",
  };
  const hash = (name: keyof typeof contents) =>
    freezeArtifactSha256(contents[name]);
  const manifest = {
    schema: "scout.verification-allocation-freeze/v1",
    evidenceClass: "offline-execution-preparation",
    providerCallsAuthorized: false,
    results: [],
    models: [
      {
        requestedId: "fixture-model",
        resolvedId: "fixture-model-a",
        resolutionKind: "content-addressed",
        resolutionEvidenceArtifact: "evidence/model-resolution.json",
      },
    ],
    seedPolicy: {
      namespace: "scout.verification-allocation/v1",
      algorithm: "enumerated-fixture-v1",
      policyArtifact: "seed-policy.md",
      seedIds: ["fixture-seed-00", "fixture-seed-01"],
    },
    schedule: {
      artifact: "schedule.json",
      sha256: hash("schedule.json"),
      schema: "scout.verification-allocation-schedule/v1",
      modelIds: ["fixture-model-a"],
      seedIds: ["fixture-seed-00", "fixture-seed-01"],
      cellsPerModelSeed: 32,
      episodeCount: 64,
    },
    artifacts: Object.entries(contents).map(([name, bytes]) => ({
      name,
      sha256: freezeArtifactSha256(bytes),
    })),
    externalRegistration: {
      status: "verified",
      url: "https://example.invalid/scout-freeze/fixture",
      identifier: "fixture-registration",
      depositTimestampUtc: "2026-09-02T00:00:00Z",
      artifactName: "bundle.zip",
      artifactSha256: hash("bundle.zip"),
      manifestArtifact: "MANIFEST.sha256",
      manifestSha256: hash("MANIFEST.sha256"),
      proofArtifact: "MANIFEST.sha256.ots",
    },
  };

  await mkdir(join(root, "evidence"));
  await Promise.all(
    Object.entries(contents).map(([name, bytes]) =>
      writeFile(join(root, name), bytes),
    ),
  );
  await writeFile(join(root, "freeze-manifest.json"), JSON.stringify(manifest));

  const freezeVerification = verifyExecutionFreezeManifest(manifest, contents);
  expect(freezeVerification.ok).toBe(true);
  expect(freezeVerification.policyScope).not.toBeNull();
  return { root, policyScope: freezeVerification.policyScope! };
}

async function policyFixture(
  policyScope: {
    protocolReference: string;
    modelScopeReference: string;
  },
  frontierSnapshotReference?: string,
) {
  const evidenceRoot = await mkdtemp(
    join(tmpdir(), "scout-frontier-evidence-"),
  );
  temporaryRoots.push(evidenceRoot);
  await mkdir(join(evidenceRoot, "decisions"));
  const policy: IdentityRobustFrontierPolicy = {
    schema: "scout.verification-allocation-frontier-policy/v1",
    evidenceClass: "caller-supplied-operating-policy",
    selectionBasis: "minimum-uniform-drift-reserve",
    minimumUniformDriftReserve: 0.0006,
    evidenceReference: "decision-record:fixture-frozen",
  };
  const policyEvidenceApplicability = {
    schema: "scout.verification-allocation-policy-applicability/v1",
    evidenceKind: "uniform-marginal-drift-reserve",
    evidenceUnit: "probability-per-model",
    protocolReference: policyScope.protocolReference,
    modelScopeReference: policyScope.modelScopeReference,
    ...(frontierSnapshotReference ? { frontierSnapshotReference } : {}),
    applicabilityStatus: "protocol-matched-unverified",
  };
  const decisionRecord = `${JSON.stringify({
    schema: "scout.verification-allocation-policy-decision/v2",
    decisionId: "fixture-frozen",
    decisionOwner: "fixture-owner",
    decisionRevision: "decision-revision:fixture",
    observedAt: "2026-09-03T00:00:00.000Z",
    policy,
    policyEvidenceApplicability,
    rationale: "Synthetic frozen fixture.",
    independentEvidenceStatus: "not-provided",
    scopeLimit: "Local synthetic control only.",
  })}\n`;
  await writeFile(
    join(evidenceRoot, "decisions", "policy.json"),
    decisionRecord,
  );
  const evidenceManifest = {
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
  };
  return { evidenceRoot, policy, evidenceManifest };
}

describe("identity-robust frontier freeze adapter", () => {
  it("selects only the expected snapshot and rejects a re-hashed substitute before freeze verification", async () => {
    const freeze = await freezeFixture();
    const snapshot = createIdentityRobustFrontierSnapshot(
      frontier,
      "a".repeat(64),
      "b".repeat(64),
    );
    const policy = await policyFixture(
      freeze.policyScope,
      identityRobustFrontierSnapshotReference({
        rowSha256: snapshot.rowSha256,
        resultSha256: snapshot.resultSha256,
        frontierSha256: snapshot.frontierSha256,
        frontierCount: snapshot.frontier.length,
      }),
    );
    const snapshotBytes = `${JSON.stringify(snapshot)}\n`;
    const snapshotRoot = await mkdtemp(
      join(tmpdir(), "scout-frontier-selection-snapshot-"),
    );
    temporaryRoots.push(snapshotRoot);
    await writeFile(join(snapshotRoot, "frontier.json"), snapshotBytes);

    const result = await selectIdentityRobustFrontierPointFromSnapshot(
      snapshotRoot,
      "frontier.json",
      createHash("sha256").update(snapshotBytes).digest("hex"),
      {
        rowSha256: snapshot.rowSha256,
        resultSha256: snapshot.resultSha256,
        frontierSha256: snapshot.frontierSha256,
        frontierCount: snapshot.frontier.length,
      },
      policy.policy,
      policy.evidenceManifest,
      policy.evidenceRoot,
      freeze.root,
    );

    expect(result).toMatchObject({
      snapshotVerification: {
        ok: true,
        snapshotEvidenceStatus: "local-byte-match-unverified",
        providerCallsAuthorized: false,
      },
      frozenSelection: {
        freezeVerification: { ok: true, providerCallsAuthorized: false },
        selection: {
          ok: true,
          selected: { runBlockCount: 1_032, episodeCount: 33_024 },
          decisionRecordEvidenceStatus: "local-byte-match-unverified",
          decisionRecordContentStatus: "local-content-match-unverified",
        },
      },
      providerCallsAuthorized: false,
    });
    const summary = summarizeIdentityRobustSnapshotFrontierSelection(result);
    expect(summary.snapshotVerification.snapshot).toMatchObject({
      frontierCount: 2,
      frontierSha256: snapshot.frontierSha256,
      providerCallsAuthorized: false,
    });
    expect(JSON.stringify(summary)).not.toContain('"frontier":');

    const substituteSnapshot = createIdentityRobustFrontierSnapshot(
      [
        snapshot.frontier[0],
        { ...snapshot.frontier[1], uniformDriftBuffer: 0.0007 },
      ],
      snapshot.rowSha256,
      snapshot.resultSha256,
    );
    const substituteBytes = `${JSON.stringify(substituteSnapshot)}\n`;
    await writeFile(join(snapshotRoot, "substitute.json"), substituteBytes);
    const substituted = await selectIdentityRobustFrontierPointFromSnapshot(
      snapshotRoot,
      "substitute.json",
      createHash("sha256").update(substituteBytes).digest("hex"),
      {
        rowSha256: snapshot.rowSha256,
        resultSha256: snapshot.resultSha256,
        frontierSha256: snapshot.frontierSha256,
        frontierCount: snapshot.frontier.length,
      },
      policy.policy,
      policy.evidenceManifest,
      policy.evidenceRoot,
      freeze.root,
    );
    expect(substituted).toMatchObject({
      snapshotVerification: {
        ok: false,
        errors: ["frontier snapshot does not match the expected computation"],
        providerCallsAuthorized: false,
      },
      frozenSelection: null,
      providerCallsAuthorized: false,
    });
  });

  it("rejects old decision evidence across an expected-snapshot version rollover", async () => {
    const freeze = await freezeFixture();
    const oldSnapshot = createIdentityRobustFrontierSnapshot(
      frontier,
      "a".repeat(64),
      "b".repeat(64),
    );
    const newSnapshot = createIdentityRobustFrontierSnapshot(
      [
        oldSnapshot.frontier[0],
        { ...oldSnapshot.frontier[1], uniformDriftBuffer: 0.0007 },
      ],
      oldSnapshot.rowSha256,
      "c".repeat(64),
    );
    const policy = await policyFixture(
      freeze.policyScope,
      identityRobustFrontierSnapshotReference({
        rowSha256: oldSnapshot.rowSha256,
        resultSha256: oldSnapshot.resultSha256,
        frontierSha256: oldSnapshot.frontierSha256,
        frontierCount: oldSnapshot.frontier.length,
      }),
    );
    const snapshotRoot = await mkdtemp(
      join(tmpdir(), "scout-frontier-version-rollover-"),
    );
    temporaryRoots.push(snapshotRoot);
    const oldBytes = `${JSON.stringify(oldSnapshot)}\n`;
    const newBytes = `${JSON.stringify(newSnapshot)}\n`;
    await writeFile(join(snapshotRoot, "old.json"), oldBytes);
    await writeFile(join(snapshotRoot, "new.json"), newBytes);

    const oldResult = await selectIdentityRobustFrontierPointFromSnapshot(
      snapshotRoot,
      "old.json",
      createHash("sha256").update(oldBytes).digest("hex"),
      {
        rowSha256: oldSnapshot.rowSha256,
        resultSha256: oldSnapshot.resultSha256,
        frontierSha256: oldSnapshot.frontierSha256,
        frontierCount: oldSnapshot.frontier.length,
      },
      policy.policy,
      policy.evidenceManifest,
      policy.evidenceRoot,
      freeze.root,
    );
    const newResult = await selectIdentityRobustFrontierPointFromSnapshot(
      snapshotRoot,
      "new.json",
      createHash("sha256").update(newBytes).digest("hex"),
      {
        rowSha256: newSnapshot.rowSha256,
        resultSha256: newSnapshot.resultSha256,
        frontierSha256: newSnapshot.frontierSha256,
        frontierCount: newSnapshot.frontier.length,
      },
      policy.policy,
      policy.evidenceManifest,
      policy.evidenceRoot,
      freeze.root,
    );

    expect(oldResult.frozenSelection?.selection).toMatchObject({
      ok: true,
      selected: { runBlockCount: 1_032, episodeCount: 33_024 },
    });
    expect(newResult).toMatchObject({
      snapshotVerification: { ok: true },
      frozenSelection: {
        freezeVerification: { ok: true },
        selection: {
          ok: false,
          selected: null,
          errors: [
            "a matching verified freeze and frontier snapshot policy scope is required for applicability",
          ],
        },
      },
      providerCallsAuthorized: false,
    });
    expect(newSnapshot.frontierSha256).not.toBe(oldSnapshot.frontierSha256);
  });

  it("selects only after descriptor-safe freeze and local-record verification", async () => {
    const freeze = await freezeFixture();
    const policy = await policyFixture(freeze.policyScope);

    const result = await selectIdentityRobustFrontierPointFromFreezeBundle(
      frontier,
      policy.policy,
      policy.evidenceManifest,
      policy.evidenceRoot,
      freeze.root,
    );

    expect(result.freezeVerification).toMatchObject({
      ok: true,
      providerCallsAuthorized: false,
      policyScope: freeze.policyScope,
    });
    expect(result.selection).toMatchObject({
      ok: true,
      selected: { runBlockCount: 1_032, episodeCount: 33_024 },
      decisionRecordEvidenceStatus: "local-byte-match-unverified",
      decisionRecordContentStatus: "local-content-match-unverified",
      errors: [],
    });
  });

  it("returns the exact freeze error and no selection for an invalid root", async () => {
    const result = await selectIdentityRobustFrontierPointFromFreezeBundle(
      frontier,
      null,
      null,
      "/unused/evidence",
      "relative-freeze",
    );

    expect(result.freezeVerification).toEqual({
      ok: false,
      errors: ["bundle root must be an explicit absolute path"],
      artifactCount: 0,
      modelCount: 0,
      seedCount: 0,
      episodeCount: 0,
      policyScope: null,
      providerCallsAuthorized: false,
    });
    expect(result.selection).toMatchObject({ ok: false, selected: null });
  });

  it("denies a policy whose applicability names a different freeze scope", async () => {
    const freeze = await freezeFixture();
    const policy = await policyFixture({
      ...freeze.policyScope,
      modelScopeReference: `freeze-model-scope-sha256:${"c".repeat(64)}`,
    });

    const result = await selectIdentityRobustFrontierPointFromFreezeBundle(
      frontier,
      policy.policy,
      policy.evidenceManifest,
      policy.evidenceRoot,
      freeze.root,
    );

    expect(result.freezeVerification).toMatchObject({
      ok: true,
      providerCallsAuthorized: false,
    });
    expect(result.selection).toMatchObject({
      ok: false,
      selected: null,
      errors: [
        "a matching verified freeze policy scope is required for applicability",
      ],
    });
  });
});
