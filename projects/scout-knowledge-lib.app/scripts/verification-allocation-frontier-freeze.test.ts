import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "bun:test";
import {
  mkdtemp,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  freezeArtifactSha256,
  verifyExecutionFreezeManifest,
} from "./verification-allocation-freeze";
import { selectIdentityRobustFrontierPointFromFreezeBundle } from "./verification-allocation-frontier-freeze";
import { IDENTITY_ROBUST_SNAPSHOT_SELECTION_OUTPUT_SCHEMA } from "./verification-allocation-frontier-output";
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
  const bundleBytes = "fixture bundle bytes";
  const contents = {
    "schedule.json": JSON.stringify(buildToyFactorialSchedule()),
    "evidence/model-resolution.json": JSON.stringify({
      schema: "scout.verification-allocation-model-resolution/v1",
      requestedId: "fixture-model",
      resolvedId: "fixture-model-a",
      resolutionKind: "content-addressed",
    }),
    "seed-policy.json": JSON.stringify({
      schema: "scout.verification-allocation-seed-policy/v1",
      namespace: "scout.verification-allocation/v1",
      algorithm: "enumerated-fixture-v1",
      seedIds: ["fixture-seed-00", "fixture-seed-01"],
    }),
    "bundle.zip": bundleBytes,
    "MANIFEST.sha256": `${freezeArtifactSha256(bundleBytes)}  bundle.zip\n`,
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
      policyArtifact: "seed-policy.json",
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
      proofTargetArtifact: "MANIFEST.sha256",
      proofTargetSha256: hash("MANIFEST.sha256"),
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
    await mkdir(join(policy.evidenceRoot, "policies"));
    const manifestBytes = `${JSON.stringify(policy.evidenceManifest)}\n`;
    const manifestSha256 = createHash("sha256")
      .update(manifestBytes)
      .digest("hex");
    await writeFile(
      join(policy.evidenceRoot, "policies", "manifest.json"),
      manifestBytes,
    );
    await writeFile(
      join(policy.evidenceRoot, "policies", "manifest-alias.json"),
      manifestBytes,
    );
    const localManifestResult =
      await selectIdentityRobustFrontierPointFromSnapshot(
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
        {
          schema:
            "scout.verification-allocation-local-policy-manifest-input/v1",
          manifestArtifact: "policies/manifest.json",
          manifestSha256,
        },
        policy.evidenceRoot,
        freeze.root,
      );
    const aliasedManifestResult =
      await selectIdentityRobustFrontierPointFromSnapshot(
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
        {
          schema:
            "scout.verification-allocation-local-policy-manifest-input/v1",
          manifestArtifact: "policies/manifest-alias.json",
          manifestSha256,
        },
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
    expect(localManifestResult).toMatchObject({
      snapshotVerification: { ok: true },
      frozenSelection: {
        freezeVerification: { ok: true },
        selection: {
          ok: true,
          selected: { runBlockCount: 1_032, episodeCount: 33_024 },
          manifestArtifact: "policies/manifest.json",
          manifestArtifactSha256: manifestSha256,
          manifestArtifactEvidenceStatus: "local-byte-match-unverified",
          manifestArtifactContentStatus: "local-content-match-unverified",
          decisionRecordEvidenceStatus: "local-byte-match-unverified",
          decisionRecordContentStatus: "local-content-match-unverified",
        },
      },
      providerCallsAuthorized: false,
    });
    expect(aliasedManifestResult.frozenSelection?.selection).toMatchObject({
      ok: true,
      selected: { runBlockCount: 1_032, episodeCount: 33_024 },
      manifestArtifact: "policies/manifest-alias.json",
      manifestArtifactSha256: manifestSha256,
    });
    expect(
      aliasedManifestResult.frozenSelection?.selection.evidenceManifestSha256,
    ).toBe(
      localManifestResult.frozenSelection?.selection.evidenceManifestSha256,
    );
    const summary = summarizeIdentityRobustSnapshotFrontierSelection(result);
    expect(summary.schema).toBe(
      IDENTITY_ROBUST_SNAPSHOT_SELECTION_OUTPUT_SCHEMA,
    );
    const frontierSnapshotReference = identityRobustFrontierSnapshotReference({
      rowSha256: snapshot.rowSha256,
      resultSha256: snapshot.resultSha256,
      frontierSha256: snapshot.frontierSha256,
      frontierCount: snapshot.frontier.length,
    });
    expect(summary.snapshotVerification.snapshot).toMatchObject({
      frontierCount: 2,
      frontierSha256: snapshot.frontierSha256,
      frontierSnapshotReference,
      providerCallsAuthorized: false,
    });
    expect(summary.frozenSelection?.freezeVerification.policyScope).toEqual(
      freeze.policyScope,
    );
    const serializedSummary = JSON.stringify(summary);
    expect(serializedSummary).toContain(freeze.policyScope.protocolReference);
    expect(serializedSummary).toContain(freeze.policyScope.modelScopeReference);
    expect(serializedSummary).not.toContain('"frontier":');
    const localManifestSummary = JSON.stringify(
      summarizeIdentityRobustSnapshotFrontierSelection(localManifestResult),
    );
    expect(localManifestSummary).toContain(manifestSha256);
    expect(localManifestSummary).toContain(
      localManifestResult.frozenSelection!.selection.evidenceManifestSha256,
    );
    expect(localManifestSummary).toContain("policies/manifest.json");
    const aliasedManifestSummary = JSON.stringify(
      summarizeIdentityRobustSnapshotFrontierSelection(aliasedManifestResult),
    );
    expect(aliasedManifestSummary).toContain("policies/manifest-alias.json");
    expect(aliasedManifestSummary).not.toContain(
      '"manifestArtifact":"policies/manifest.json"',
    );

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

  it("selects the same snapshot-bound point through local locator aliases", async () => {
    const freeze = await freezeFixture();
    const snapshot = createIdentityRobustFrontierSnapshot(
      frontier,
      "a".repeat(64),
      "b".repeat(64),
    );
    const expectedSnapshot = {
      rowSha256: snapshot.rowSha256,
      resultSha256: snapshot.resultSha256,
      frontierSha256: snapshot.frontierSha256,
      frontierCount: snapshot.frontier.length,
    };
    const policy = await policyFixture(
      freeze.policyScope,
      identityRobustFrontierSnapshotReference(expectedSnapshot),
    );
    const snapshotRoot = await mkdtemp(
      join(tmpdir(), "scout-frontier-local-aliases-"),
    );
    temporaryRoots.push(snapshotRoot);
    const snapshotBytes = `${JSON.stringify(snapshot)}\n`;
    const snapshotSha256 = createHash("sha256")
      .update(snapshotBytes)
      .digest("hex");
    await writeFile(join(snapshotRoot, "frontier.json"), snapshotBytes);

    const baseline = await selectIdentityRobustFrontierPointFromSnapshot(
      snapshotRoot,
      "frontier.json",
      snapshotSha256,
      expectedSnapshot,
      policy.policy,
      policy.evidenceManifest,
      policy.evidenceRoot,
      freeze.root,
    );
    await rename(
      join(snapshotRoot, "frontier.json"),
      join(snapshotRoot, "aliased-frontier.json"),
    );
    await rename(
      join(policy.evidenceRoot, "decisions", "policy.json"),
      join(policy.evidenceRoot, "decisions", "aliased-policy.json"),
    );
    policy.evidenceManifest.decisionRecordArtifact =
      "decisions/aliased-policy.json";

    const aliased = await selectIdentityRobustFrontierPointFromSnapshot(
      snapshotRoot,
      "aliased-frontier.json",
      snapshotSha256,
      expectedSnapshot,
      policy.policy,
      policy.evidenceManifest,
      policy.evidenceRoot,
      freeze.root,
    );

    expect(aliased).toMatchObject({
      snapshotVerification: {
        ok: true,
        snapshotEvidenceStatus:
          baseline.snapshotVerification.snapshotEvidenceStatus,
        providerCallsAuthorized: false,
      },
      frozenSelection: {
        freezeVerification: {
          ok: true,
          policyScope: freeze.policyScope,
          providerCallsAuthorized: false,
        },
        selection: {
          ok: true,
          selected: { runBlockCount: 1_032, episodeCount: 33_024 },
          decisionRecordEvidenceStatus: "local-byte-match-unverified",
          decisionRecordContentStatus: "local-content-match-unverified",
          errors: [],
        },
      },
      providerCallsAuthorized: false,
    });
    expect(aliased.frozenSelection?.selection.selected).toEqual(
      baseline.frozenSelection?.selection.selected,
    );
    expect(aliased.frozenSelection?.selection.decisionRecordSha256).toBe(
      baseline.frozenSelection?.selection.decisionRecordSha256,
    );
    expect(aliased.frozenSelection?.selection.policySha256).toBe(
      baseline.frozenSelection?.selection.policySha256,
    );
    const baselineManifestSha256 =
      baseline.frozenSelection?.selection.evidenceManifestSha256;
    const aliasedManifestSha256 =
      aliased.frozenSelection?.selection.evidenceManifestSha256;
    expect(aliasedManifestSha256).not.toBe(baselineManifestSha256);

    const aliasedSummary =
      summarizeIdentityRobustSnapshotFrontierSelection(aliased);
    expect(
      aliasedSummary.frozenSelection?.selection.evidenceManifestSha256,
    ).toBe(aliasedManifestSha256);
    const serializedSummary = JSON.stringify(aliasedSummary);
    expect(serializedSummary).toContain(aliasedManifestSha256!);
    expect(serializedSummary).not.toContain(baselineManifestSha256!);
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

  it("selects the same frontier point from a fully aliased evidence bundle", async () => {
    const freeze = await freezeFixture();
    const policy = await policyFixture(freeze.policyScope);
    const baseline = await selectIdentityRobustFrontierPointFromFreezeBundle(
      frontier,
      policy.policy,
      policy.evidenceManifest,
      policy.evidenceRoot,
      freeze.root,
    );
    const manifestPath = join(freeze.root, "freeze-manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const aliases = new Map([
      [
        "evidence/model-resolution.json",
        "evidence/aliased-model-resolution.json",
      ],
      ["seed-policy.json", "aliased-seed-policy.json"],
      ["schedule.json", "aliased-schedule.json"],
      ["MANIFEST.sha256", "aliased-MANIFEST.sha256"],
      ["MANIFEST.sha256.ots", "aliased-MANIFEST.sha256.ots"],
    ]);
    for (const [original, alias] of aliases) {
      await rename(join(freeze.root, original), join(freeze.root, alias));
      manifest.artifacts.find(
        (artifact: { name: string }) => artifact.name === original,
      ).name = alias;
    }
    manifest.models[0].resolutionEvidenceArtifact = aliases.get(
      "evidence/model-resolution.json",
    );
    manifest.seedPolicy.policyArtifact = aliases.get("seed-policy.json");
    manifest.schedule.artifact = aliases.get("schedule.json");
    manifest.externalRegistration.manifestArtifact =
      aliases.get("MANIFEST.sha256");
    manifest.externalRegistration.proofArtifact = aliases.get(
      "MANIFEST.sha256.ots",
    );
    manifest.externalRegistration.proofTargetArtifact =
      aliases.get("MANIFEST.sha256");
    await writeFile(manifestPath, JSON.stringify(manifest));

    const aliased = await selectIdentityRobustFrontierPointFromFreezeBundle(
      frontier,
      policy.policy,
      policy.evidenceManifest,
      policy.evidenceRoot,
      freeze.root,
    );

    expect(aliased.freezeVerification).toMatchObject({
      ok: true,
      externalRegistrationEvidenceStatus:
        baseline.freezeVerification.externalRegistrationEvidenceStatus,
      timestampProofEvidenceStatus:
        baseline.freezeVerification.timestampProofEvidenceStatus,
      policyScope: freeze.policyScope,
      providerCallsAuthorized: false,
    });
    expect(aliased.selection).toMatchObject({
      ok: true,
      selected: { runBlockCount: 1_032, episodeCount: 33_024 },
      decisionRecordEvidenceStatus: "local-byte-match-unverified",
      decisionRecordContentStatus: "local-content-match-unverified",
      errors: [],
    });
    expect(aliased.selection).toEqual(baseline.selection);
  });

  it("keeps an old local decision applicable across unverified registration metadata", async () => {
    const freeze = await freezeFixture();
    const policy = await policyFixture(freeze.policyScope);
    const manifestPath = join(freeze.root, "freeze-manifest.json");
    const substituted = JSON.parse(await readFile(manifestPath, "utf8"));
    substituted.externalRegistration.url =
      "https://substitute.example.invalid/scout-freeze/other";
    substituted.externalRegistration.identifier = "substitute-registration";
    substituted.externalRegistration.depositTimestampUtc =
      "2026-09-03T00:00:00Z";
    await writeFile(manifestPath, JSON.stringify(substituted));

    const result = await selectIdentityRobustFrontierPointFromFreezeBundle(
      frontier,
      policy.policy,
      policy.evidenceManifest,
      policy.evidenceRoot,
      freeze.root,
    );

    expect(result.freezeVerification).toMatchObject({
      ok: true,
      externalRegistrationEvidenceStatus: "local-byte-match-unverified",
      policyScope: freeze.policyScope,
      providerCallsAuthorized: false,
    });
    expect(result.selection).toMatchObject({
      ok: true,
      selected: { runBlockCount: 1_032, episodeCount: 33_024 },
    });
  });

  it("rejects old decision evidence across execution-bundle substitution", async () => {
    const freeze = await freezeFixture();
    const snapshot = createIdentityRobustFrontierSnapshot(
      frontier,
      "a".repeat(64),
      "b".repeat(64),
    );
    const expectedSnapshot = {
      rowSha256: snapshot.rowSha256,
      resultSha256: snapshot.resultSha256,
      frontierSha256: snapshot.frontierSha256,
      frontierCount: snapshot.frontier.length,
    };
    const policy = await policyFixture(
      freeze.policyScope,
      identityRobustFrontierSnapshotReference(expectedSnapshot),
    );
    const snapshotRoot = await mkdtemp(
      join(tmpdir(), "scout-frontier-bundle-substitution-"),
    );
    temporaryRoots.push(snapshotRoot);
    const snapshotBytes = `${JSON.stringify(snapshot)}\n`;
    const snapshotSha256 = createHash("sha256")
      .update(snapshotBytes)
      .digest("hex");
    await writeFile(join(snapshotRoot, "frontier.json"), snapshotBytes);

    const baseline = await selectIdentityRobustFrontierPointFromSnapshot(
      snapshotRoot,
      "frontier.json",
      snapshotSha256,
      expectedSnapshot,
      policy.policy,
      policy.evidenceManifest,
      policy.evidenceRoot,
      freeze.root,
    );
    expect(baseline.frozenSelection?.selection).toMatchObject({
      ok: true,
      selected: { runBlockCount: 1_032, episodeCount: 33_024 },
      decisionRecordSha256:
        "d8afac0be91cf4542a0d11d4baa987775978b76e8dd004557daeb682cf99384a",
    });

    const manifestPath = join(freeze.root, "freeze-manifest.json");
    const substituted = JSON.parse(await readFile(manifestPath, "utf8"));
    const substituteBytes = "substitute fixture bundle bytes";
    const substituteSha256 = freezeArtifactSha256(substituteBytes);
    substituted.artifacts.find(
      (artifact: { name: string }) => artifact.name === "bundle.zip",
    ).sha256 = substituteSha256;
    substituted.externalRegistration.artifactSha256 = substituteSha256;
    const substituteManifest = `${substituteSha256}  bundle.zip\n`;
    const substituteManifestSha256 = freezeArtifactSha256(substituteManifest);
    substituted.artifacts.find(
      (artifact: { name: string }) => artifact.name === "MANIFEST.sha256",
    ).sha256 = substituteManifestSha256;
    substituted.externalRegistration.manifestSha256 = substituteManifestSha256;
    substituted.externalRegistration.proofTargetSha256 =
      substituteManifestSha256;
    await writeFile(join(freeze.root, "bundle.zip"), substituteBytes);
    await writeFile(join(freeze.root, "MANIFEST.sha256"), substituteManifest);
    await writeFile(manifestPath, JSON.stringify(substituted));

    const result = await selectIdentityRobustFrontierPointFromSnapshot(
      snapshotRoot,
      "frontier.json",
      snapshotSha256,
      expectedSnapshot,
      policy.policy,
      policy.evidenceManifest,
      policy.evidenceRoot,
      freeze.root,
    );

    expect(result.snapshotVerification).toMatchObject({
      ok: true,
      snapshotEvidenceStatus: "local-byte-match-unverified",
      providerCallsAuthorized: false,
    });
    expect(result.frozenSelection).toMatchObject({
      freezeVerification: {
        ok: true,
        externalRegistrationEvidenceStatus: "local-byte-match-unverified",
        providerCallsAuthorized: false,
      },
      selection: {
        ok: false,
        selected: null,
        errors: [
          "a matching verified freeze and frontier snapshot policy scope is required for applicability",
        ],
      },
    });
    expect(result.frozenSelection?.freezeVerification.policyScope).not.toEqual(
      freeze.policyScope,
    );
  });

  it("rejects old decision evidence across same-byte execution-artifact aliasing", async () => {
    const freeze = await freezeFixture();
    const snapshot = createIdentityRobustFrontierSnapshot(
      frontier,
      "a".repeat(64),
      "b".repeat(64),
    );
    const expectedSnapshot = {
      rowSha256: snapshot.rowSha256,
      resultSha256: snapshot.resultSha256,
      frontierSha256: snapshot.frontierSha256,
      frontierCount: snapshot.frontier.length,
    };
    const policy = await policyFixture(
      freeze.policyScope,
      identityRobustFrontierSnapshotReference(expectedSnapshot),
    );
    const snapshotRoot = await mkdtemp(
      join(tmpdir(), "scout-frontier-artifact-alias-"),
    );
    temporaryRoots.push(snapshotRoot);
    const snapshotBytes = `${JSON.stringify(snapshot)}\n`;
    const snapshotSha256 = createHash("sha256")
      .update(snapshotBytes)
      .digest("hex");
    await writeFile(join(snapshotRoot, "frontier.json"), snapshotBytes);

    const baseline = await selectIdentityRobustFrontierPointFromSnapshot(
      snapshotRoot,
      "frontier.json",
      snapshotSha256,
      expectedSnapshot,
      policy.policy,
      policy.evidenceManifest,
      policy.evidenceRoot,
      freeze.root,
    );
    expect(baseline.frozenSelection?.selection).toMatchObject({
      ok: true,
      selected: { runBlockCount: 1_032, episodeCount: 33_024 },
    });

    const manifestPath = join(freeze.root, "freeze-manifest.json");
    const aliased = JSON.parse(await readFile(manifestPath, "utf8"));
    const bundleArtifact = aliased.artifacts.find(
      (artifact: { name: string }) => artifact.name === "bundle.zip",
    );
    const originalDigest = bundleArtifact.sha256;
    bundleArtifact.name = "aliased-bundle.zip";
    aliased.externalRegistration.artifactName = "aliased-bundle.zip";
    const aliasedManifest = `${originalDigest}  aliased-bundle.zip\n`;
    const aliasedManifestSha256 = freezeArtifactSha256(aliasedManifest);
    aliased.artifacts.find(
      (artifact: { name: string }) => artifact.name === "MANIFEST.sha256",
    ).sha256 = aliasedManifestSha256;
    aliased.externalRegistration.manifestSha256 = aliasedManifestSha256;
    aliased.externalRegistration.proofTargetSha256 = aliasedManifestSha256;
    await rename(
      join(freeze.root, "bundle.zip"),
      join(freeze.root, "aliased-bundle.zip"),
    );
    await writeFile(join(freeze.root, "MANIFEST.sha256"), aliasedManifest);
    await writeFile(manifestPath, JSON.stringify(aliased));

    const result = await selectIdentityRobustFrontierPointFromSnapshot(
      snapshotRoot,
      "frontier.json",
      snapshotSha256,
      expectedSnapshot,
      policy.policy,
      policy.evidenceManifest,
      policy.evidenceRoot,
      freeze.root,
    );

    expect(result.snapshotVerification.ok).toBe(true);
    expect(result.frozenSelection).toMatchObject({
      freezeVerification: {
        ok: true,
        externalRegistrationEvidenceStatus: "local-byte-match-unverified",
        providerCallsAuthorized: false,
      },
      selection: {
        ok: false,
        selected: null,
        errors: [
          "a matching verified freeze and frontier snapshot policy scope is required for applicability",
        ],
      },
    });
    expect(
      result.frozenSelection?.freezeVerification.policyScope?.protocolReference,
    ).not.toBe(freeze.policyScope.protocolReference);
    expect(
      result.frozenSelection?.freezeVerification.policyScope
        ?.modelScopeReference,
    ).toBe(freeze.policyScope.modelScopeReference);
  });

  it("keeps snapshot-bound decisions stable across local timestamp-proof byte changes", async () => {
    const freeze = await freezeFixture();
    const snapshot = createIdentityRobustFrontierSnapshot(
      frontier,
      "a".repeat(64),
      "b".repeat(64),
    );
    const expectedSnapshot = {
      rowSha256: snapshot.rowSha256,
      resultSha256: snapshot.resultSha256,
      frontierSha256: snapshot.frontierSha256,
      frontierCount: snapshot.frontier.length,
    };
    const policy = await policyFixture(
      freeze.policyScope,
      identityRobustFrontierSnapshotReference(expectedSnapshot),
    );
    const snapshotRoot = await mkdtemp(
      join(tmpdir(), "scout-frontier-timestamp-proof-"),
    );
    temporaryRoots.push(snapshotRoot);
    const snapshotBytes = `${JSON.stringify(snapshot)}\n`;
    const snapshotSha256 = createHash("sha256")
      .update(snapshotBytes)
      .digest("hex");
    await writeFile(join(snapshotRoot, "frontier.json"), snapshotBytes);

    const baseline = await selectIdentityRobustFrontierPointFromSnapshot(
      snapshotRoot,
      "frontier.json",
      snapshotSha256,
      expectedSnapshot,
      policy.policy,
      policy.evidenceManifest,
      policy.evidenceRoot,
      freeze.root,
    );
    expect(baseline.frozenSelection?.selection).toMatchObject({
      ok: true,
      selected: { runBlockCount: 1_032, episodeCount: 33_024 },
      decisionRecordSha256:
        "d8afac0be91cf4542a0d11d4baa987775978b76e8dd004557daeb682cf99384a",
    });

    const manifestPath = join(freeze.root, "freeze-manifest.json");
    const changedProof = JSON.parse(await readFile(manifestPath, "utf8"));
    const changedProofBytes = "different local timestamp proof bytes";
    changedProof.artifacts.find(
      (artifact: { name: string }) => artifact.name === "MANIFEST.sha256.ots",
    ).sha256 = freezeArtifactSha256(changedProofBytes);
    await writeFile(
      join(freeze.root, "MANIFEST.sha256.ots"),
      changedProofBytes,
    );
    await writeFile(manifestPath, JSON.stringify(changedProof));

    const result = await selectIdentityRobustFrontierPointFromSnapshot(
      snapshotRoot,
      "frontier.json",
      snapshotSha256,
      expectedSnapshot,
      policy.policy,
      policy.evidenceManifest,
      policy.evidenceRoot,
      freeze.root,
    );

    expect(result.snapshotVerification).toMatchObject({
      ok: true,
      snapshotEvidenceStatus: "local-byte-match-unverified",
      providerCallsAuthorized: false,
    });
    expect(result.frozenSelection).toMatchObject({
      freezeVerification: {
        ok: true,
        externalRegistrationEvidenceStatus: "local-byte-match-unverified",
        policyScope: freeze.policyScope,
        providerCallsAuthorized: false,
      },
      selection: {
        ok: true,
        selected: { runBlockCount: 1_032, episodeCount: 33_024 },
        decisionRecordSha256:
          "d8afac0be91cf4542a0d11d4baa987775978b76e8dd004557daeb682cf99384a",
      },
    });
  });

  it("rejects snapshot-scoped policy through the direct freeze-only adapter", async () => {
    const freeze = await freezeFixture();
    const frontierSnapshotReference = `frontier-snapshot-sha256:${"d".repeat(64)}`;
    const policy = await policyFixture(
      freeze.policyScope,
      frontierSnapshotReference,
    );

    const result = await selectIdentityRobustFrontierPointFromFreezeBundle(
      frontier,
      policy.policy,
      policy.evidenceManifest,
      policy.evidenceRoot,
      freeze.root,
    );

    expect(result).toMatchObject({
      freezeVerification: { ok: true },
      selection: {
        ok: false,
        selected: null,
        errors: [
          "a matching verified freeze and frontier snapshot policy scope is required for applicability",
        ],
      },
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
      externalRegistrationEvidenceStatus: "",
      timestampProofEvidenceStatus: "",
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
