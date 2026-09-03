import { describe, expect, it } from "bun:test";
import {
  freezeArtifactSha256,
  verifyExecutionFreezeManifest,
} from "./verification-allocation-freeze";
import {
  buildToyFactorialSchedule,
  renderFactorialPrompt,
} from "./verification-allocation-factorial";

function validFixture() {
  const schedule = buildToyFactorialSchedule();
  const bundleBytes = "fixture bundle bytes";
  const artifactContents = {
    "schedule.json": JSON.stringify(schedule),
    "model-resolution.json": JSON.stringify({
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
      proofTargetArtifact: "MANIFEST.sha256",
      proofTargetSha256: hash("MANIFEST.sha256"),
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

  it("labels arbitrary proof bytes as present but semantically unverified", () => {
    const { manifest, artifactContents } = validFixture();
    artifactContents["MANIFEST.sha256.ots"] = "not an OpenTimestamps proof";
    manifest.artifacts.find(
      (artifact) => artifact.name === "MANIFEST.sha256.ots",
    )!.sha256 = freezeArtifactSha256(artifactContents["MANIFEST.sha256.ots"]);

    const result = verifyExecutionFreezeManifest(manifest, artifactContents);

    expect(result).toMatchObject({
      ok: true,
      externalRegistrationEvidenceStatus: "local-byte-match-unverified",
      timestampProofEvidenceStatus: "local-byte-presence-unverified",
      providerCallsAuthorized: false,
    });
  });

  it("rejects caller-supplied proof authority outside the frozen schema", () => {
    const { manifest, artifactContents } = validFixture();
    Object.assign(manifest, {
      timestampVerificationStatus: "verified",
      providerAuthority: true,
    });
    Object.assign(manifest.externalRegistration, {
      verifierResult: "Bitcoin timestamp verified",
    });

    const result = verifyExecutionFreezeManifest(manifest, artifactContents);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("manifest contains unsupported fields");
    expect(result.errors).toContain(
      "external registration contains unsupported fields",
    );
    expect(result.externalRegistrationEvidenceStatus).toBe("");
    expect(result.timestampProofEvidenceStatus).toBe(
      "local-byte-presence-unverified",
    );
    expect(result.providerCallsAuthorized).toBe(false);
  });

  it("rejects unknown fields in every nested freeze-manifest object", () => {
    const { manifest, artifactContents } = validFixture();
    Object.assign(manifest.artifacts[0], { label: "execution bundle" });
    Object.assign(manifest.models[0], { modelAuthority: true });
    Object.assign(manifest.seedPolicy, { randomnessAuthority: "caller" });
    Object.assign(manifest.schedule, { providerAuthority: true });

    const result = verifyExecutionFreezeManifest(manifest, artifactContents);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("artifacts[0] contains unsupported fields");
    expect(result.errors).toContain("models[0] contains unsupported fields");
    expect(result.errors).toContain("seed policy contains unsupported fields");
    expect(result.errors).toContain(
      "schedule metadata contains unsupported fields",
    );
    expect(result.externalRegistrationEvidenceStatus).toBe("");
    expect(result.timestampProofEvidenceStatus).toBe(
      "local-byte-presence-unverified",
    );
    expect(result.providerCallsAuthorized).toBe(false);
  });

  it("rejects model-resolution evidence that contradicts its declaration", () => {
    const { manifest, artifactContents } = validFixture();
    artifactContents["model-resolution.json"] = JSON.stringify({
      schema: "scout.verification-allocation-model-resolution/v1",
      requestedId: "fixture-model",
      resolvedId: "fixture-model-b",
      resolutionKind: "content-addressed",
    });
    manifest.artifacts.find(
      (artifact) => artifact.name === "model-resolution.json",
    )!.sha256 = freezeArtifactSha256(artifactContents["model-resolution.json"]);

    const result = verifyExecutionFreezeManifest(manifest, artifactContents);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "models[0] resolution evidence does not match declaration",
    );
    expect(result.externalRegistrationEvidenceStatus).toBe("");
    expect(result.timestampProofEvidenceStatus).toBe(
      "local-byte-presence-unverified",
    );
    expect(result.policyScope).toBeNull();
    expect(result.providerCallsAuthorized).toBe(false);
  });

  it("rejects unversioned model-resolution evidence", () => {
    for (const schema of [
      undefined,
      "scout.verification-allocation-model-resolution/v2",
    ]) {
      const { manifest, artifactContents } = validFixture();
      const evidence = JSON.parse(artifactContents["model-resolution.json"]);
      if (schema === undefined) delete evidence.schema;
      else evidence.schema = schema;
      artifactContents["model-resolution.json"] = JSON.stringify(evidence);
      manifest.artifacts.find(
        (artifact) => artifact.name === "model-resolution.json",
      )!.sha256 = freezeArtifactSha256(
        artifactContents["model-resolution.json"],
      );

      const result = verifyExecutionFreezeManifest(manifest, artifactContents);
      expect(result.ok).toBe(false);
      expect(result.errors).toContain(
        "models[0] resolution evidence schema changed",
      );
    }
  });

  it("rejects opaque, duplicate-key, or extended model-resolution evidence", () => {
    const matchingFields =
      '"schema":"scout.verification-allocation-model-resolution/v1","requestedId":"fixture-model","resolvedId":"fixture-model-a","resolutionKind":"content-addressed"';
    const cases = [
      {
        bytes: "fixture model resolution",
        error: "models[0] resolution evidence is not canonical verifiable JSON",
      },
      {
        bytes: `{${matchingFields},"requestedId":"fixture-model"}`,
        error: "models[0] resolution evidence is not canonical verifiable JSON",
      },
      {
        bytes: `{${matchingFields},"providerAuthority":true}`,
        error: "models[0] resolution evidence contains unsupported fields",
      },
    ];

    for (const { bytes, error } of cases) {
      const { manifest, artifactContents } = validFixture();
      artifactContents["model-resolution.json"] = bytes;
      manifest.artifacts.find(
        (artifact) => artifact.name === "model-resolution.json",
      )!.sha256 = freezeArtifactSha256(bytes);

      const result = verifyExecutionFreezeManifest(manifest, artifactContents);

      expect(result.ok).toBe(false);
      expect(result.errors).toContain(error);
      expect(result.policyScope).toBeNull();
      expect(result.providerCallsAuthorized).toBe(false);
    }
  });

  it("rejects seed-policy evidence that contradicts its declaration", () => {
    const { manifest, artifactContents } = validFixture();
    artifactContents["seed-policy.json"] = JSON.stringify({
      schema: "scout.verification-allocation-seed-policy/v1",
      namespace: "scout.verification-allocation/v1",
      algorithm: "enumerated-fixture-v1",
      seedIds: ["fixture-seed-00", "fixture-seed-02"],
    });
    manifest.artifacts.find(
      (artifact) => artifact.name === "seed-policy.json",
    )!.sha256 = freezeArtifactSha256(artifactContents["seed-policy.json"]);

    const result = verifyExecutionFreezeManifest(manifest, artifactContents);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "seed policy evidence does not match declaration",
    );
    expect(result.externalRegistrationEvidenceStatus).toBe("");
    expect(result.timestampProofEvidenceStatus).toBe(
      "local-byte-presence-unverified",
    );
    expect(result.policyScope).toBeNull();
    expect(result.providerCallsAuthorized).toBe(false);
  });

  it("rejects unversioned seed-policy evidence", () => {
    for (const schema of [
      undefined,
      "scout.verification-allocation-seed-policy/v2",
    ]) {
      const { manifest, artifactContents } = validFixture();
      const evidence = JSON.parse(artifactContents["seed-policy.json"]);
      if (schema === undefined) delete evidence.schema;
      else evidence.schema = schema;
      artifactContents["seed-policy.json"] = JSON.stringify(evidence);
      manifest.artifacts.find(
        (artifact) => artifact.name === "seed-policy.json",
      )!.sha256 = freezeArtifactSha256(artifactContents["seed-policy.json"]);

      const result = verifyExecutionFreezeManifest(manifest, artifactContents);
      expect(result.ok).toBe(false);
      expect(result.errors).toContain("seed policy evidence schema changed");
    }
  });

  it("rejects opaque, duplicate-key, or extended seed-policy evidence", () => {
    const matchingFields =
      '"schema":"scout.verification-allocation-seed-policy/v1","namespace":"scout.verification-allocation/v1","algorithm":"enumerated-fixture-v1","seedIds":["fixture-seed-00","fixture-seed-01"]';
    const cases = [
      {
        bytes: "fixture seeds are enumerated once",
        error: "seed policy evidence is not canonical verifiable JSON",
      },
      {
        bytes: `{${matchingFields},"algorithm":"enumerated-fixture-v1"}`,
        error: "seed policy evidence is not canonical verifiable JSON",
      },
      {
        bytes: `{${matchingFields},"providerAuthority":true}`,
        error: "seed policy evidence contains unsupported fields",
      },
    ];

    for (const { bytes, error } of cases) {
      const { manifest, artifactContents } = validFixture();
      artifactContents["seed-policy.json"] = bytes;
      manifest.artifacts.find(
        (artifact) => artifact.name === "seed-policy.json",
      )!.sha256 = freezeArtifactSha256(bytes);

      const result = verifyExecutionFreezeManifest(manifest, artifactContents);

      expect(result.ok).toBe(false);
      expect(result.errors).toContain(error);
      expect(result.policyScope).toBeNull();
      expect(result.providerCallsAuthorized).toBe(false);
    }
  });

  it("bounds deeply nested canonical artifacts before recursive serialization", () => {
    const bytes = '{"value":'.repeat(1_000) + "null" + "}".repeat(1_000);
    for (const [name, error] of [
      [
        "model-resolution.json",
        "models[0] resolution evidence is not canonical verifiable JSON",
      ],
      [
        "seed-policy.json",
        "seed policy evidence is not canonical verifiable JSON",
      ],
      [
        "schedule.json",
        "schedule artifact exceeds the supported JSON nesting limit",
      ],
    ] as const) {
      const { manifest, artifactContents } = validFixture();
      artifactContents[name] = bytes;
      const digest = freezeArtifactSha256(bytes);
      manifest.artifacts.find((artifact) => artifact.name === name)!.sha256 =
        digest;
      if (name === "schedule.json") manifest.schedule.sha256 = digest;

      const result = verifyExecutionFreezeManifest(manifest, artifactContents);

      expect(result.ok).toBe(false);
      expect(result.errors).toContain(error);
      expect(result.policyScope).toBeNull();
      expect(result.providerCallsAuthorized).toBe(false);
    }
  });

  it("bounds deeply nested JSON embedded in a quoted factorial prompt", () => {
    const { manifest, artifactContents } = validFixture();
    const baseline = verifyExecutionFreezeManifest(manifest, artifactContents);
    expect(baseline.ok).toBe(true);
    expect(baseline.providerCallsAuthorized).toBe(false);

    const schedule = JSON.parse(artifactContents["schedule.json"]);
    const episode = schedule.episodes[0];
    const nested = '{"value":'.repeat(50_000) + "null" + "}".repeat(50_000);
    episode.prompt =
      '{"lineageManifest":{"authority":"fixture://scout/allocation-v1","attestation":"fixture-only","records":[{"path":' +
      nested +
      '},{"path":"fixture"}]}}';

    artifactContents["schedule.json"] = JSON.stringify(schedule);
    const digest = freezeArtifactSha256(artifactContents["schedule.json"]);
    manifest.schedule.sha256 = digest;
    manifest.artifacts.find(
      (artifact) => artifact.name === "schedule.json",
    )!.sha256 = digest;

    const result = verifyExecutionFreezeManifest(manifest, artifactContents);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      `schedule factorial verification failed: ${episode.id}: prompt exceeds the supported JSON nesting limit`,
    );
    expect(result.errors).not.toContain(
      "schedule artifact is not valid verifiable JSON",
    );
    expect(result.policyScope).toBeNull();
    expect(result.providerCallsAuthorized).toBe(false);
  });

  it("stops an oversized shallow schedule before factorial traversal", () => {
    const { manifest, artifactContents } = validFixture();
    expect(verifyExecutionFreezeManifest(manifest, artifactContents).ok).toBe(
      true,
    );

    const schedule = JSON.parse(artifactContents["schedule.json"]);
    schedule.episodes = Array.from({ length: 5_000 }, () =>
      structuredClone(schedule.episodes[0]),
    );
    artifactContents["schedule.json"] = JSON.stringify(schedule);
    const digest = freezeArtifactSha256(artifactContents["schedule.json"]);
    manifest.schedule.sha256 = digest;
    manifest.artifacts.find(
      (artifact) => artifact.name === "schedule.json",
    )!.sha256 = digest;

    const result = verifyExecutionFreezeManifest(manifest, artifactContents);

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      "schedule bytes do not match the declared offline schedule",
    ]);
    expect(result.policyScope).toBeNull();
    expect(result.providerCallsAuthorized).toBe(false);
  });

  it("stops oversized model and seed metadata before factorial traversal", () => {
    const observations = (["models", "seeds"] as const).map((field) => {
      const { manifest, artifactContents } = validFixture();
      expect(verifyExecutionFreezeManifest(manifest, artifactContents).ok).toBe(
        true,
      );

      const schedule = JSON.parse(artifactContents["schedule.json"]);
      schedule[field] = Array.from(
        { length: 5_000 },
        (_, index) => `${field}-${index}`,
      );
      artifactContents["schedule.json"] = JSON.stringify(schedule);
      const digest = freezeArtifactSha256(artifactContents["schedule.json"]);
      manifest.schedule.sha256 = digest;
      manifest.artifacts.find(
        (artifact) => artifact.name === "schedule.json",
      )!.sha256 = digest;

      const result = verifyExecutionFreezeManifest(manifest, artifactContents);
      return {
        field,
        errorCount: result.errors.length,
        firstError: result.errors[0],
        policyScope: result.policyScope,
        providerCallsAuthorized: result.providerCallsAuthorized,
      };
    });

    expect(observations).toEqual(
      (["models", "seeds"] as const).map((field) => ({
        field,
        errorCount: 1,
        firstError: "schedule bytes do not match the declared offline schedule",
        policyScope: null,
        providerCallsAuthorized: false,
      })),
    );
  });

  it("rejects an oversized episode candidate list before prompt traversal", () => {
    const { manifest, artifactContents } = validFixture();
    expect(verifyExecutionFreezeManifest(manifest, artifactContents).ok).toBe(
      true,
    );

    const schedule = JSON.parse(artifactContents["schedule.json"]);
    const episode = schedule.episodes[0];
    episode.candidates = Array.from({ length: 20_000 }, () =>
      structuredClone(episode.candidates[0]),
    );
    episode.prompt = renderFactorialPrompt(episode);
    artifactContents["schedule.json"] = JSON.stringify(schedule);
    const digest = freezeArtifactSha256(artifactContents["schedule.json"]);
    manifest.schedule.sha256 = digest;
    manifest.artifacts.find(
      (artifact) => artifact.name === "schedule.json",
    )!.sha256 = digest;

    const result = verifyExecutionFreezeManifest(manifest, artifactContents);

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      `schedule factorial verification failed: ${episode.id}: candidates must describe both memories`,
    ]);
    expect(result.policyScope).toBeNull();
    expect(result.providerCallsAuthorized).toBe(false);
  });

  it("rejects duplicate candidate identities in a byte-bound episode", () => {
    const { manifest, artifactContents } = validFixture();
    const schedule = JSON.parse(artifactContents["schedule.json"]);
    const episode = schedule.episodes[0];
    episode.candidates = [
      structuredClone(episode.candidates[0]),
      structuredClone(episode.candidates[0]),
    ];
    episode.prompt = renderFactorialPrompt(episode);
    artifactContents["schedule.json"] = JSON.stringify(schedule);
    const digest = freezeArtifactSha256(artifactContents["schedule.json"]);
    manifest.schedule.sha256 = digest;
    manifest.artifacts.find(
      (artifact) => artifact.name === "schedule.json",
    )!.sha256 = digest;

    const result = verifyExecutionFreezeManifest(manifest, artifactContents);

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      `schedule factorial verification failed: ${episode.id}: candidates must describe both memories`,
    ]);
    expect(result.policyScope).toBeNull();
    expect(result.providerCallsAuthorized).toBe(false);
  });

  it("rejects unknown fields throughout the byte-bound schedule", () => {
    const { manifest, artifactContents } = validFixture();
    const schedule = JSON.parse(artifactContents["schedule.json"]);
    const episode = schedule.episodes[0];
    Object.assign(schedule, { sourceAuthority: "caller" });
    Object.assign(episode, { episodeAuthority: "caller" });
    Object.assign(episode.factors, { selectionAuthority: "caller" });
    Object.assign(episode.candidates[0], { memoryAuthority: "caller" });
    episode.prompt = renderFactorialPrompt(episode);

    artifactContents["schedule.json"] = JSON.stringify(schedule);
    const digest = freezeArtifactSha256(artifactContents["schedule.json"]);
    manifest.schedule.sha256 = digest;
    manifest.artifacts.find(
      (artifact) => artifact.name === "schedule.json",
    )!.sha256 = digest;

    const result = verifyExecutionFreezeManifest(manifest, artifactContents);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "schedule factorial verification failed: schedule contains unsupported fields",
    );
    expect(result.errors).toContain(
      `schedule factorial verification failed: ${episode.id}: episode contains unsupported fields`,
    );
    expect(result.errors).toContain(
      `schedule factorial verification failed: ${episode.id}: factors contain unsupported fields`,
    );
    expect(result.errors).toContain(
      `schedule factorial verification failed: ${episode.id}: candidates[0] contains unsupported fields`,
    );
    expect(result.externalRegistrationEvidenceStatus).toBe("");
    expect(result.timestampProofEvidenceStatus).toBe(
      "local-byte-presence-unverified",
    );
    expect(result.providerCallsAuthorized).toBe(false);
  });

  it("rejects nested unknown fields in the byte-bound prompt", () => {
    const { manifest, artifactContents } = validFixture();
    const schedule = JSON.parse(artifactContents["schedule.json"]);
    const episode = schedule.episodes[0];
    const prompt = JSON.parse(episode.prompt);
    Object.assign(prompt.lineageManifest, { providerAuthority: true });
    episode.prompt = JSON.stringify(prompt);

    artifactContents["schedule.json"] = JSON.stringify(schedule);
    const digest = freezeArtifactSha256(artifactContents["schedule.json"]);
    manifest.schedule.sha256 = digest;
    manifest.artifacts.find(
      (artifact) => artifact.name === "schedule.json",
    )!.sha256 = digest;

    const result = verifyExecutionFreezeManifest(manifest, artifactContents);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      `schedule factorial verification failed: ${episode.id}: prompt contains an unregistered difference`,
    );
    expect(result.externalRegistrationEvidenceStatus).toBe("");
    expect(result.timestampProofEvidenceStatus).toBe(
      "local-byte-presence-unverified",
    );
    expect(result.providerCallsAuthorized).toBe(false);
  });

  it("rejects duplicate keys in the byte-bound prompt JSON", () => {
    const { manifest, artifactContents } = validFixture();
    const schedule = JSON.parse(artifactContents["schedule.json"]);
    const episode = schedule.episodes[0];
    episode.prompt = episode.prompt.replace(
      '"authority":"fixture://scout/allocation-v1"',
      '"authority":"fixture://scout/allocation-v1","authority":"fixture://scout/allocation-v1"',
    );

    artifactContents["schedule.json"] = JSON.stringify(schedule);
    const digest = freezeArtifactSha256(artifactContents["schedule.json"]);
    manifest.schedule.sha256 = digest;
    manifest.artifacts.find(
      (artifact) => artifact.name === "schedule.json",
    )!.sha256 = digest;

    const result = verifyExecutionFreezeManifest(manifest, artifactContents);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      `schedule factorial verification failed: ${episode.id}: prompt contains an unregistered difference`,
    );
    expect(result.externalRegistrationEvidenceStatus).toBe("");
    expect(result.timestampProofEvidenceStatus).toBe(
      "local-byte-presence-unverified",
    );
    expect(result.providerCallsAuthorized).toBe(false);
  });

  it("rejects escaped-equivalent keys in the byte-bound prompt JSON", () => {
    const { manifest, artifactContents } = validFixture();
    const schedule = JSON.parse(artifactContents["schedule.json"]);
    const episode = schedule.episodes[0];
    episode.prompt = episode.prompt.replace(
      '"authority":"fixture://scout/allocation-v1"',
      '"auth\\u006frity":"fixture://scout/allocation-v1"',
    );

    artifactContents["schedule.json"] = JSON.stringify(schedule);
    const digest = freezeArtifactSha256(artifactContents["schedule.json"]);
    manifest.schedule.sha256 = digest;
    manifest.artifacts.find(
      (artifact) => artifact.name === "schedule.json",
    )!.sha256 = digest;

    const result = verifyExecutionFreezeManifest(manifest, artifactContents);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      `schedule factorial verification failed: ${episode.id}: prompt contains an unregistered difference`,
    );
    expect(result.externalRegistrationEvidenceStatus).toBe("");
    expect(result.timestampProofEvidenceStatus).toBe(
      "local-byte-presence-unverified",
    );
    expect(result.providerCallsAuthorized).toBe(false);
  });

  it("rejects duplicate keys in the byte-bound schedule JSON", () => {
    const { manifest, artifactContents } = validFixture();
    artifactContents["schedule.json"] = artifactContents[
      "schedule.json"
    ].replace(
      '"providerCallsAuthorized":false',
      '"providerCallsAuthorized":false,"providerCallsAuthorized":false',
    );
    const digest = freezeArtifactSha256(artifactContents["schedule.json"]);
    manifest.schedule.sha256 = digest;
    manifest.artifacts.find(
      (artifact) => artifact.name === "schedule.json",
    )!.sha256 = digest;

    const result = verifyExecutionFreezeManifest(manifest, artifactContents);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "schedule artifact is not canonical verifiable JSON",
    );
    expect(result.externalRegistrationEvidenceStatus).toBe("");
    expect(result.timestampProofEvidenceStatus).toBe(
      "local-byte-presence-unverified",
    );
    expect(result.providerCallsAuthorized).toBe(false);
  });

  it("separates overall validity, registration evidence, and proof presence", () => {
    const cases: Array<{
      name: string;
      mutate: (fixture: ReturnType<typeof validFixture>) => void;
      ok: boolean;
      registration: "local-byte-match-unverified" | "";
      proof: "local-byte-presence-unverified" | "";
      error?: string;
    }> = [
      {
        name: "valid local bundle",
        mutate: () => {},
        ok: true,
        registration: "local-byte-match-unverified",
        proof: "local-byte-presence-unverified",
      },
      {
        name: "unrelated schedule mismatch",
        mutate: ({ artifactContents }) => {
          artifactContents["schedule.json"] += "tampered";
        },
        ok: false,
        registration: "",
        proof: "local-byte-presence-unverified",
        error: "artifact schedule.json digest mismatch",
      },
      {
        name: "proof digest mismatch",
        mutate: ({ artifactContents }) => {
          artifactContents["MANIFEST.sha256.ots"] += "tampered";
        },
        ok: false,
        registration: "",
        proof: "",
        error: "artifact MANIFEST.sha256.ots digest mismatch",
      },
      {
        name: "missing proof bytes",
        mutate: ({ artifactContents }) => {
          delete (artifactContents as Partial<typeof artifactContents>)[
            "MANIFEST.sha256.ots"
          ];
        },
        ok: false,
        registration: "",
        proof: "",
        error: "artifact MANIFEST.sha256.ots has no supplied bytes",
      },
      {
        name: "undeclared proof bytes",
        mutate: ({ manifest }) => {
          manifest.artifacts = manifest.artifacts.filter(
            (artifact) => artifact.name !== "MANIFEST.sha256.ots",
          );
        },
        ok: false,
        registration: "",
        proof: "",
        error: "external registration proof artifact is missing",
      },
    ];

    for (const testCase of cases) {
      const fixture = validFixture();
      testCase.mutate(fixture);
      const result = verifyExecutionFreezeManifest(
        fixture.manifest,
        fixture.artifactContents,
      );

      expect(result, testCase.name).toMatchObject({
        ok: testCase.ok,
        externalRegistrationEvidenceStatus: testCase.registration,
        timestampProofEvidenceStatus: testCase.proof,
        providerCallsAuthorized: false,
      });
      if (testCase.error) {
        expect(result.errors, testCase.name).toContain(testCase.error);
      } else {
        expect(result.errors, testCase.name).toEqual([]);
      }
    }
  });

  it("requires the proof target to be the registered checksum manifest", () => {
    const { manifest, artifactContents } = validFixture();
    Object.assign(manifest.externalRegistration, {
      proofTargetArtifact: "schedule.json",
      proofTargetSha256: manifest.schedule.sha256,
    });

    const result = verifyExecutionFreezeManifest(manifest, artifactContents);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "external registration proof target does not bind its checksum manifest",
    );
    expect(result.externalRegistrationEvidenceStatus).toBe("");
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
      manifest.externalRegistration.proofTargetSha256 = checksumSha256;

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

    artifactContents["model-resolution.json"] = JSON.stringify({
      schema: "scout.verification-allocation-model-resolution/v1",
      requestedId: "fixture-model",
      resolvedId: "fixture-model-a",
      resolutionKind: "dated-snapshot",
    });
    manifest.models[0].resolutionKind = "dated-snapshot";
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

    artifactContents["seed-policy.json"] = JSON.stringify({
      schema: "scout.verification-allocation-seed-policy/v1",
      namespace: "scout.verification-allocation/v1",
      algorithm: "enumerated-fixture-v2",
      seedIds: ["fixture-seed-00", "fixture-seed-01"],
    });
    manifest.seedPolicy.algorithm = "enumerated-fixture-v2";
    manifest.artifacts.find(
      (artifact) => artifact.name === "seed-policy.json",
    )!.sha256 = freezeArtifactSha256(artifactContents["seed-policy.json"]);
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
    manifest.externalRegistration.proofTargetSha256 = manifestSha256;
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

  it("keeps policy scope content-addressed across same-byte evidence and schedule aliases", () => {
    for (const kind of ["model", "seed", "schedule"] as const) {
      const fixture = validFixture();
      const baseline = verifyExecutionFreezeManifest(
        fixture.manifest,
        fixture.artifactContents,
      );
      const contents = fixture.artifactContents as Record<string, string>;
      const original =
        kind === "model"
          ? "model-resolution.json"
          : kind === "seed"
            ? "seed-policy.json"
            : "schedule.json";
      const alias =
        kind === "model"
          ? "aliased-model-resolution.json"
          : kind === "seed"
            ? "aliased-seed-policy.json"
            : "aliased-schedule.json";
      contents[alias] = contents[original];
      delete contents[original];
      fixture.manifest.artifacts.find(
        (artifact) => artifact.name === original,
      )!.name = alias;
      if (kind === "model") {
        fixture.manifest.models[0].resolutionEvidenceArtifact = alias;
      } else if (kind === "seed") {
        fixture.manifest.seedPolicy.policyArtifact = alias;
      } else {
        fixture.manifest.schedule.artifact = alias;
      }

      const aliased = verifyExecutionFreezeManifest(
        fixture.manifest,
        fixture.artifactContents,
      );
      expect(aliased, kind).toMatchObject({
        ok: true,
        errors: [],
        providerCallsAuthorized: false,
      });
      expect(aliased.policyScope, kind).toEqual(baseline.policyScope);
    }
  });

  it("keeps local evidence labels across same-byte registration locator aliases", () => {
    for (const kind of ["checksum", "proof"] as const) {
      const fixture = validFixture();
      const baseline = verifyExecutionFreezeManifest(
        fixture.manifest,
        fixture.artifactContents,
      );
      const contents = fixture.artifactContents as Record<string, string>;
      const original =
        kind === "checksum" ? "MANIFEST.sha256" : "MANIFEST.sha256.ots";
      const alias =
        kind === "checksum"
          ? "aliased-MANIFEST.sha256"
          : "aliased-MANIFEST.sha256.ots";
      contents[alias] = contents[original];
      delete contents[original];
      fixture.manifest.artifacts.find(
        (artifact) => artifact.name === original,
      )!.name = alias;
      if (kind === "checksum") {
        fixture.manifest.externalRegistration.manifestArtifact = alias;
        fixture.manifest.externalRegistration.proofTargetArtifact = alias;
      } else {
        fixture.manifest.externalRegistration.proofArtifact = alias;
      }

      const aliased = verifyExecutionFreezeManifest(
        fixture.manifest,
        fixture.artifactContents,
      );
      expect(aliased, kind).toMatchObject({
        ok: true,
        errors: [],
        externalRegistrationEvidenceStatus: "local-byte-match-unverified",
        timestampProofEvidenceStatus: "local-byte-presence-unverified",
        providerCallsAuthorized: false,
      });
      expect(aliased.policyScope, kind).toEqual(baseline.policyScope);
    }
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
    delete (evidence as Partial<typeof evidence>)["seed-policy.json"];

    const result = verifyExecutionFreezeManifest(manifest, evidence);
    const errors = result.errors;
    expect(errors).toContain("artifact schedule.json digest mismatch");
    expect(errors).toContain("artifact seed-policy.json has no supplied bytes");
    expect(errors).toContain("undeclared artifact bytes: undeclared.txt");
    expect(result.externalRegistrationEvidenceStatus).toBe("");
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

  it("rejects candidate path or revision drift across factor cells", () => {
    const observations = (["path", "revision"] as const).map((field) => {
      const { manifest, artifactContents } = validFixture();
      const schedule = JSON.parse(artifactContents["schedule.json"]);
      const episode = schedule.episodes[0];
      const candidate = episode.candidates.find(
        ({ memoryId }: { memoryId: string }) => memoryId === "memory-a",
      );
      candidate[field] = `${candidate[field]}-drifted`;
      episode.prompt = renderFactorialPrompt(episode);
      artifactContents["schedule.json"] = JSON.stringify(schedule);
      const digest = freezeArtifactSha256(artifactContents["schedule.json"]);
      manifest.schedule.sha256 = digest;
      manifest.artifacts.find(
        (artifact) => artifact.name === "schedule.json",
      )!.sha256 = digest;

      const result = verifyExecutionFreezeManifest(manifest, artifactContents);
      return {
        field,
        ok: result.ok,
        errors: result.errors,
        policyScope: result.policyScope,
        providerCallsAuthorized: result.providerCallsAuthorized,
      };
    });

    expect(observations).toEqual(
      (["path", "revision"] as const).map((field) => ({
        field,
        ok: false,
        errors: [
          "schedule factorial verification failed: memory-a: candidate path/revision changed across factor cells",
        ],
        policyScope: null,
        providerCallsAuthorized: false,
      })),
    );
  });

  it("rejects one candidate path/revision tuple shared by both memories", () => {
    const { manifest, artifactContents } = validFixture();
    const schedule = JSON.parse(artifactContents["schedule.json"]);
    for (const episode of schedule.episodes) {
      const memoryA = episode.candidates.find(
        ({ memoryId }: { memoryId: string }) => memoryId === "memory-a",
      );
      const memoryB = episode.candidates.find(
        ({ memoryId }: { memoryId: string }) => memoryId === "memory-b",
      );
      memoryB.path = memoryA.path;
      memoryB.revision = memoryA.revision;
      episode.prompt = renderFactorialPrompt(episode);
    }
    artifactContents["schedule.json"] = JSON.stringify(schedule);
    const digest = freezeArtifactSha256(artifactContents["schedule.json"]);
    manifest.schedule.sha256 = digest;
    manifest.artifacts.find(
      (artifact) => artifact.name === "schedule.json",
    )!.sha256 = digest;

    const result = verifyExecutionFreezeManifest(manifest, artifactContents);

    expect({
      ok: result.ok,
      errors: result.errors,
      policyScope: result.policyScope,
      providerCallsAuthorized: result.providerCallsAuthorized,
    }).toEqual({
      ok: false,
      errors: [
        "schedule factorial verification failed: candidate path/revision tuples must identify distinct memories",
      ],
      policyScope: null,
      providerCallsAuthorized: false,
    });
  });

  it("rejects one candidate body shared by both memories", () => {
    const { manifest, artifactContents } = validFixture();
    const schedule = JSON.parse(artifactContents["schedule.json"]);
    for (const episode of schedule.episodes) {
      const memoryA = episode.candidates.find(
        ({ memoryId }: { memoryId: string }) => memoryId === "memory-a",
      );
      const memoryB = episode.candidates.find(
        ({ memoryId }: { memoryId: string }) => memoryId === "memory-b",
      );
      memoryB.body = memoryA.body;
      episode.prompt = renderFactorialPrompt(episode);
    }
    artifactContents["schedule.json"] = JSON.stringify(schedule);
    const digest = freezeArtifactSha256(artifactContents["schedule.json"]);
    manifest.schedule.sha256 = digest;
    manifest.artifacts.find(
      (artifact) => artifact.name === "schedule.json",
    )!.sha256 = digest;

    const result = verifyExecutionFreezeManifest(manifest, artifactContents);

    expect({
      ok: result.ok,
      errors: result.errors,
      policyScope: result.policyScope,
      providerCallsAuthorized: result.providerCallsAuthorized,
    }).toEqual({
      ok: false,
      errors: [
        "schedule factorial verification failed: candidate bodies must identify distinct memories",
      ],
      policyScope: null,
      providerCallsAuthorized: false,
    });
  });

  it("rejects candidate bodies swapped between registered memories", () => {
    const { manifest, artifactContents } = validFixture();
    const schedule = JSON.parse(artifactContents["schedule.json"]);
    for (const episode of schedule.episodes) {
      const memoryA = episode.candidates.find(
        ({ memoryId }: { memoryId: string }) => memoryId === "memory-a",
      );
      const memoryB = episode.candidates.find(
        ({ memoryId }: { memoryId: string }) => memoryId === "memory-b",
      );
      [memoryA.body, memoryB.body] = [memoryB.body, memoryA.body];
      episode.prompt = renderFactorialPrompt(episode);
    }
    artifactContents["schedule.json"] = JSON.stringify(schedule);
    const digest = freezeArtifactSha256(artifactContents["schedule.json"]);
    manifest.schedule.sha256 = digest;
    manifest.artifacts.find(
      (artifact) => artifact.name === "schedule.json",
    )!.sha256 = digest;

    const result = verifyExecutionFreezeManifest(manifest, artifactContents);

    expect({
      ok: result.ok,
      errors: result.errors,
      policyScope: result.policyScope,
      providerCallsAuthorized: result.providerCallsAuthorized,
    }).toEqual({
      ok: false,
      errors: [
        "schedule factorial verification failed: candidate bodies do not match their registered memories",
      ],
      policyScope: null,
      providerCallsAuthorized: false,
    });
  });

  it("rejects candidate provenance swapped between registered memories", () => {
    const { manifest, artifactContents } = validFixture();
    const schedule = JSON.parse(artifactContents["schedule.json"]);
    for (const episode of schedule.episodes) {
      const memoryA = episode.candidates.find(
        ({ memoryId }: { memoryId: string }) => memoryId === "memory-a",
      );
      const memoryB = episode.candidates.find(
        ({ memoryId }: { memoryId: string }) => memoryId === "memory-b",
      );
      [memoryA.path, memoryB.path] = [memoryB.path, memoryA.path];
      [memoryA.revision, memoryB.revision] = [
        memoryB.revision,
        memoryA.revision,
      ];
      episode.prompt = renderFactorialPrompt(episode);
    }
    artifactContents["schedule.json"] = JSON.stringify(schedule);
    const digest = freezeArtifactSha256(artifactContents["schedule.json"]);
    manifest.schedule.sha256 = digest;
    manifest.artifacts.find(
      (artifact) => artifact.name === "schedule.json",
    )!.sha256 = digest;

    const result = verifyExecutionFreezeManifest(manifest, artifactContents);

    expect({
      ok: result.ok,
      errors: result.errors,
      policyScope: result.policyScope,
      providerCallsAuthorized: result.providerCallsAuthorized,
    }).toEqual({
      ok: false,
      errors: [
        "schedule factorial verification failed: candidate path/revision tuples do not match their registered memories",
      ],
      policyScope: null,
      providerCallsAuthorized: false,
    });
  });

  it("rejects candidate order that contradicts the registered presentation factor", () => {
    const { manifest, artifactContents } = validFixture();
    const schedule = JSON.parse(artifactContents["schedule.json"]);
    for (const episode of schedule.episodes) {
      episode.candidates.reverse();
      episode.prompt = renderFactorialPrompt(episode);
    }
    artifactContents["schedule.json"] = JSON.stringify(schedule);
    const digest = freezeArtifactSha256(artifactContents["schedule.json"]);
    manifest.schedule.sha256 = digest;
    manifest.artifacts.find(
      (artifact) => artifact.name === "schedule.json",
    )!.sha256 = digest;

    const result = verifyExecutionFreezeManifest(manifest, artifactContents);

    expect({
      ok: result.ok,
      errors: result.errors,
      policyScope: result.policyScope,
      providerCallsAuthorized: result.providerCallsAuthorized,
    }).toEqual({
      ok: false,
      errors: [
        "schedule factorial verification failed: candidate order does not match the registered presentation factor",
      ],
      policyScope: null,
      providerCallsAuthorized: false,
    });
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
