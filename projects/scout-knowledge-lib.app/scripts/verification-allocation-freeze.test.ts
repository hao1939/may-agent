import { describe, expect, it } from "bun:test";
import {
  freezeArtifactSha256,
  verifyExecutionFreezeManifest,
} from "./verification-allocation-freeze";
import { buildToyFactorialSchedule } from "./verification-allocation-factorial";

function validFixture() {
  const schedule = buildToyFactorialSchedule();
  const bundleBytes = "fixture bundle bytes";
  const artifactContents = {
    "schedule.json": JSON.stringify(schedule),
    "model-resolution.json": JSON.stringify({
      requestedId: "fixture-model",
      resolvedId: "fixture-model-a",
      resolutionKind: "content-addressed",
    }),
    "seed-policy.md": "fixture seeds are enumerated once",
    "bundle.zip": bundleBytes,
    "MANIFEST.sha256": `${freezeArtifactSha256(bundleBytes)}  bundle.zip\n`,
    "MANIFEST.sha256.ots": "fixture timestamp proof",
  };
  const artifacts = Object.entries(artifactContents).map(([name, bytes]) => ({
    name,
    sha256: freezeArtifactSha256(bytes),
  }));
  const hash = (name: keyof typeof artifactContents) =>
    freezeArtifactSha256(artifactContents[name]);
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
        resolutionEvidenceArtifact: "model-resolution.json",
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
    artifacts,
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
  return { manifest, artifactContents };
}

describe("verification-allocation execution freeze", () => {
  it("fails closed on an incomplete unknown manifest", () => {
    const result = verifyExecutionFreezeManifest({}, {});

    expect(result.ok).toBe(false);
    expect(result.policyScope).toBeNull();
    expect(result.providerCallsAuthorized).toBe(false);
    expect(result.errors).toContain("manifest schema changed");
    expect(result.errors).toContain("models must not be empty");
    expect(result.errors).toContain("seed policy is missing");
    expect(result.errors).toContain("schedule metadata is missing");
    expect(result.errors).toContain("external registration is not verified");
  });

  it("labels a byte-bound offline registration as locally matched without provider authority", () => {
    const { manifest, artifactContents } = validFixture();
    expect(manifest.externalRegistration.url).toBe(
      "https://example.invalid/scout-freeze/fixture",
    );
    const result = verifyExecutionFreezeManifest(manifest, artifactContents);

    expect(result).toMatchObject({
      ok: true,
      errors: [],
      artifactCount: 6,
      modelCount: 1,
      seedCount: 2,
      episodeCount: 64,
      externalRegistrationEvidenceStatus: "local-byte-match-unverified",
      providerCallsAuthorized: false,
    });
    expect(result.policyScope).toMatchObject({
      schema: "scout.verification-allocation-freeze-policy-scope/v1",
    });
    expect(result.policyScope?.protocolReference).toMatch(
      /^freeze-protocol-sha256:[0-9a-f]{64}$/,
    );
    expect(result.policyScope?.modelScopeReference).toMatch(
      /^freeze-model-scope-sha256:[0-9a-f]{64}$/,
    );
  });

  it("rejects opaque or contradictory external checksum manifests", () => {
    for (const checksumBytes of [
      "fixture checksum manifest",
      `${"0".repeat(64)}  bundle.zip\n`,
    ]) {
      const { manifest, artifactContents } = validFixture();
      artifactContents["MANIFEST.sha256"] = checksumBytes;
      const checksumSha256 = freezeArtifactSha256(checksumBytes);
      manifest.artifacts.find(
        (artifact) => artifact.name === "MANIFEST.sha256",
      )!.sha256 = checksumSha256;
      manifest.externalRegistration.manifestSha256 = checksumSha256;

      const result = verifyExecutionFreezeManifest(manifest, artifactContents);
      expect(result.ok).toBe(false);
      expect(result.errors).toContain(
        "external registration checksum manifest does not bind its artifact",
      );
      expect(result.externalRegistrationEvidenceStatus).toBe("");
    }
  });

  it("derives stable and factor-specific policy scope references", () => {
    const { manifest, artifactContents } = validFixture();
    const first = verifyExecutionFreezeManifest(manifest, artifactContents);
    const repeated = verifyExecutionFreezeManifest(manifest, artifactContents);
    expect(repeated.policyScope).toEqual(first.policyScope);

    artifactContents["model-resolution.json"] = "changed model evidence";
    manifest.artifacts.find(
      (artifact) => artifact.name === "model-resolution.json",
    )!.sha256 = freezeArtifactSha256(artifactContents["model-resolution.json"]);
    const changedModel = verifyExecutionFreezeManifest(
      manifest,
      artifactContents,
    );
    expect(changedModel.ok).toBe(true);
    expect(changedModel.policyScope?.protocolReference).toBe(
      first.policyScope?.protocolReference,
    );
    expect(changedModel.policyScope?.modelScopeReference).not.toBe(
      first.policyScope?.modelScopeReference,
    );

    artifactContents["seed-policy.md"] = "changed seed policy evidence";
    manifest.artifacts.find(
      (artifact) => artifact.name === "seed-policy.md",
    )!.sha256 = freezeArtifactSha256(artifactContents["seed-policy.md"]);
    const changedProtocol = verifyExecutionFreezeManifest(
      manifest,
      artifactContents,
    );
    expect(changedProtocol.ok).toBe(true);
    expect(changedProtocol.policyScope?.protocolReference).not.toBe(
      changedModel.policyScope?.protocolReference,
    );
    expect(changedProtocol.policyScope?.modelScopeReference).toBe(
      changedModel.policyScope?.modelScopeReference,
    );

    artifactContents["bundle.zip"] = "changed execution bundle";
    const bundleSha256 = freezeArtifactSha256(artifactContents["bundle.zip"]);
    manifest.artifacts.find(
      (artifact) => artifact.name === "bundle.zip",
    )!.sha256 = bundleSha256;
    manifest.externalRegistration.artifactSha256 = bundleSha256;
    artifactContents["MANIFEST.sha256"] = `${bundleSha256}  bundle.zip\n`;
    const manifestSha256 = freezeArtifactSha256(
      artifactContents["MANIFEST.sha256"],
    );
    manifest.artifacts.find(
      (artifact) => artifact.name === "MANIFEST.sha256",
    )!.sha256 = manifestSha256;
    manifest.externalRegistration.manifestSha256 = manifestSha256;
    const changedBundle = verifyExecutionFreezeManifest(
      manifest,
      artifactContents,
    );
    expect(changedBundle.ok).toBe(true);
    expect(changedBundle.policyScope?.protocolReference).not.toBe(
      changedProtocol.policyScope?.protocolReference,
    );
    expect(changedBundle.policyScope?.modelScopeReference).toBe(
      changedProtocol.policyScope?.modelScopeReference,
    );
  });

  it("keeps locally unverified registration metadata outside policy applicability", () => {
    const { manifest, artifactContents } = validFixture();
    const first = verifyExecutionFreezeManifest(manifest, artifactContents);
    const substituted = structuredClone(manifest);
    substituted.externalRegistration.url =
      "https://substitute.example.invalid/scout-freeze/other";
    substituted.externalRegistration.identifier = "substitute-registration";
    substituted.externalRegistration.depositTimestampUtc =
      "2026-09-03T00:00:00Z";

    const second = verifyExecutionFreezeManifest(substituted, artifactContents);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.externalRegistrationEvidenceStatus).toBe(
      "local-byte-match-unverified",
    );
    expect(second.policyScope).toEqual(first.policyScope);
  });

  it("rejects result-bearing or provider-authorized manifests", () => {
    const { manifest, artifactContents } = validFixture();
    const unsafe = {
      ...manifest,
      providerCallsAuthorized: true,
      results: [{ selected_memory_id: "memory-a" }],
    };

    expect(
      verifyExecutionFreezeManifest(unsafe, artifactContents).errors,
    ).toContain(
      "manifest must remain offline preparation with provider calls denied and empty results",
    );
  });

  it("rejects tampered, missing, and undeclared artifact bytes", () => {
    const { manifest, artifactContents } = validFixture();
    const evidence = {
      ...artifactContents,
      "schedule.json": `${artifactContents["schedule.json"]}tampered`,
      "undeclared.txt": "not in the manifest",
    };
    delete (evidence as Partial<typeof evidence>)["seed-policy.md"];

    const errors = verifyExecutionFreezeManifest(manifest, evidence).errors;
    expect(errors).toContain("artifact schedule.json digest mismatch");
    expect(errors).toContain("artifact seed-policy.md has no supplied bytes");
    expect(errors).toContain("undeclared artifact bytes: undeclared.txt");
    expect(errors).toContain(
      "schedule artifact digest does not match its binding",
    );
  });

  it("rejects schedule model, seed, cell, and count mismatches", () => {
    const { manifest, artifactContents } = validFixture();
    const mismatched = structuredClone(manifest);
    mismatched.schedule.modelIds = ["undated-alias"];
    mismatched.schedule.seedIds = ["foreign-seed"];
    mismatched.schedule.cellsPerModelSeed = 18;
    mismatched.schedule.episodeCount = 5400;

    const errors = verifyExecutionFreezeManifest(
      mismatched,
      artifactContents,
    ).errors;
    expect(errors).toContain(
      "schedule does not describe the 32-cell Scout factorial",
    );
    expect(errors).toContain(
      "schedule model IDs do not match immutable resolutions",
    );
    expect(errors).toContain("schedule seed IDs do not match the seed policy");
    expect(errors).toContain("schedule episode count must be 64, found 5400");
    expect(errors).toContain(
      "schedule bytes do not match the declared offline schedule",
    );
  });

  it("rejects a re-hashed schedule that fails factorial isolation", () => {
    const { manifest, artifactContents } = validFixture();
    const changedSchedule = JSON.parse(artifactContents["schedule.json"]);
    changedSchedule.episodes[0].candidates[0].body = "drifted body";
    changedSchedule.episodes[0].prompt = JSON.stringify({
      ...JSON.parse(changedSchedule.episodes[0].prompt),
      candidates: changedSchedule.episodes[0].candidates,
    });
    artifactContents["schedule.json"] = JSON.stringify(changedSchedule);
    const digest = freezeArtifactSha256(artifactContents["schedule.json"]);
    manifest.schedule.sha256 = digest;
    manifest.artifacts.find(
      (artifact) => artifact.name === "schedule.json",
    )!.sha256 = digest;

    expect(
      verifyExecutionFreezeManifest(manifest, artifactContents).errors,
    ).toContain(
      "schedule factorial verification failed: memory-a: memory body changed across factor cells",
    );
  });

  it("rejects the Cycle 47 source archive as a Scout execution freeze", () => {
    const { manifest, artifactContents } = validFixture();
    const sourceArchive = structuredClone(manifest);
    sourceArchive.models = [
      {
        requestedId: "claude-opus-5",
        resolvedId: "claude-opus-5",
        resolutionKind: "alias" as "dated-snapshot",
        resolutionEvidenceArtifact: "model-resolution.json",
      },
      {
        requestedId: "claude-haiku-4-5",
        resolvedId: "claude-haiku-4-5-20251001",
        resolutionKind: "dated-snapshot",
        resolutionEvidenceArtifact: "model-resolution.json",
      },
    ];
    sourceArchive.seedPolicy.namespace =
      "stale-c1" as "scout.verification-allocation/v1";
    sourceArchive.seedPolicy.seedIds = Array.from({ length: 25 }, (_, index) =>
      String(index),
    );
    sourceArchive.schedule.modelIds = [
      "claude-opus-5",
      "claude-haiku-4-5-20251001",
    ];
    sourceArchive.schedule.seedIds = [...sourceArchive.seedPolicy.seedIds];
    sourceArchive.schedule.cellsPerModelSeed = 18;
    sourceArchive.schedule.episodeCount = 5400;
    sourceArchive.externalRegistration.status = "PENDING" as "verified";

    const errors = verifyExecutionFreezeManifest(
      sourceArchive,
      artifactContents,
    ).errors;
    expect(errors).toContain("models[0] is not an immutable model resolution");
    expect(errors).toContain("seed policy namespace is not Scout-specific");
    expect(errors).toContain(
      "schedule does not describe the 32-cell Scout factorial",
    );
    expect(errors).toContain("schedule episode count must be 1600, found 5400");
    expect(errors).toContain("external registration is not verified");
  });
});
