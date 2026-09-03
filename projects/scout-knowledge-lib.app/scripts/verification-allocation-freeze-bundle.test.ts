import { afterEach, describe, expect, it } from "bun:test";
import {
  copyFile,
  lstat,
  link,
  mkdtemp,
  mkdir,
  readdir,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { verifyExecutionFreezeBundle } from "./verification-allocation-freeze-bundle";
import { freezeArtifactSha256 } from "./verification-allocation-freeze";
import {
  buildSyntheticFactorialSchedule,
  buildToyFactorialSchedule,
} from "./verification-allocation-factorial";

const temporaryRoots: string[] = [];

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "scout-freeze-bundle-"));
  temporaryRoots.push(root);
  const schedule = JSON.stringify(buildToyFactorialSchedule());
  const bundleBytes = "fixture bundle bytes";
  const contents = {
    "schedule.json": schedule,
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
  return { root, manifest };
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("verification-allocation freeze bundle", () => {
  it("loads an explicit byte-bound directory without provider authority", async () => {
    const { root } = await fixture();
    const result = await verifyExecutionFreezeBundle(root);

    expect(result).toMatchObject({
      ok: true,
      errors: [],
      artifactCount: 6,
      modelCount: 1,
      seedCount: 2,
      episodeCount: 64,
      providerCallsAuthorized: false,
    });
    expect(result.policyScope?.protocolReference).toMatch(
      /^freeze-protocol-sha256:[0-9a-f]{64}$/,
    );
    expect(result.policyScope?.modelScopeReference).toMatch(
      /^freeze-model-scope-sha256:[0-9a-f]{64}$/,
    );
  });

  it("preserves content-addressed aliases through descriptor-safe directory reads", async () => {
    const { root, manifest } = await fixture();
    const baseline = await verifyExecutionFreezeBundle(root);
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
      await rename(join(root, original), join(root, alias));
      manifest.artifacts.find((artifact) => artifact.name === original)!.name =
        alias;
    }
    manifest.models[0].resolutionEvidenceArtifact = aliases.get(
      "evidence/model-resolution.json",
    )!;
    manifest.seedPolicy.policyArtifact = aliases.get("seed-policy.json")!;
    manifest.schedule.artifact = aliases.get("schedule.json")!;
    manifest.externalRegistration.manifestArtifact =
      aliases.get("MANIFEST.sha256")!;
    manifest.externalRegistration.proofArtifact = aliases.get(
      "MANIFEST.sha256.ots",
    )!;
    manifest.externalRegistration.proofTargetArtifact =
      aliases.get("MANIFEST.sha256")!;
    await writeFile(
      join(root, "freeze-manifest.json"),
      JSON.stringify(manifest),
    );

    const aliased = await verifyExecutionFreezeBundle(root);
    expect(aliased).toMatchObject({
      ok: true,
      errors: [],
      artifactCount: 6,
      externalRegistrationEvidenceStatus: "local-byte-match-unverified",
      timestampProofEvidenceStatus: "local-byte-presence-unverified",
      providerCallsAuthorized: false,
    });
    expect(aliased.policyScope).toEqual(baseline.policyScope);
  });

  it("keeps descriptor-safe control and Unicode aliases literal", async () => {
    const { root, manifest } = await fixture();
    const aliases = [
      "proof\tartifact.ots",
      "proof\nartifact.ots",
      "caf\u00e9.ots",
      "cafe\u0301.ots",
      "PROOF.OTS",
      "proof.ots",
      "CON",
      "proof.",
      "a".repeat(255),
    ];
    let current = "MANIFEST.sha256.ots";

    for (const alias of aliases) {
      await rename(join(root, current), join(root, alias));
      manifest.artifacts.find((artifact) => artifact.name === current)!.name =
        alias;
      manifest.externalRegistration.proofArtifact = alias;
      await writeFile(
        join(root, "freeze-manifest.json"),
        JSON.stringify(manifest),
      );

      const result = await verifyExecutionFreezeBundle(root);
      expect(result.ok, JSON.stringify(alias)).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.providerCallsAuthorized).toBe(false);
      current = alias;
    }
  });

  it("keeps simultaneous platform-colliding names distinct on this host", async () => {
    const pairs = [
      ["proof.ots", "PROOF.OTS"],
      ["caf\u00e9.ots", "cafe\u0301.ots"],
      ["proof", "proof."],
    ] as const;

    for (const [left, right] of pairs) {
      const { root, manifest } = await fixture();
      await rename(join(root, "MANIFEST.sha256.ots"), join(root, left));
      manifest.artifacts.find(
        (artifact) => artifact.name === "MANIFEST.sha256.ots",
      )!.name = left;
      manifest.externalRegistration.proofArtifact = left;

      const rightBytes = `distinct peer for ${right}`;
      await writeFile(join(root, right), rightBytes);
      manifest.artifacts.push({
        name: right,
        sha256: freezeArtifactSha256(rightBytes),
      });
      await writeFile(
        join(root, "freeze-manifest.json"),
        JSON.stringify(manifest),
      );

      const result = await verifyExecutionFreezeBundle(root);
      expect(result.ok, JSON.stringify([left, right])).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.artifactCount).toBe(7);
      expect(result.providerCallsAuthorized).toBe(false);
    }
  });

  it("treats hard-linked and copied same-byte artifacts as content aliases", async () => {
    const buildAlias = async (hardLinked: boolean) => {
      const { root, manifest } = await fixture();
      const source = "MANIFEST.sha256.ots";
      const alias = hardLinked ? "hard-link-proof.ots" : "copied-proof.ots";
      const proofBytes = "fixture timestamp proof";
      if (hardLinked) {
        await link(join(root, source), join(root, alias));
      } else {
        await writeFile(join(root, alias), proofBytes);
      }
      manifest.artifacts.push({
        name: alias,
        sha256: freezeArtifactSha256(proofBytes),
      });
      await writeFile(
        join(root, "freeze-manifest.json"),
        JSON.stringify(manifest),
      );

      const [sourceStat, aliasStat] = await Promise.all([
        stat(join(root, source)),
        stat(join(root, alias)),
      ]);
      expect(sourceStat.ino === aliasStat.ino).toBe(hardLinked);
      const result = await verifyExecutionFreezeBundle(root);
      expect(result).toMatchObject({
        ok: true,
        errors: [],
        artifactCount: 7,
        providerCallsAuthorized: false,
      });
      return result;
    };

    const hardLinked = await buildAlias(true);
    const copied = await buildAlias(false);
    expect(hardLinked.policyScope).toEqual(copied.policyScope);
    expect(hardLinked.externalRegistrationEvidenceStatus).toBe(
      copied.externalRegistrationEvidenceStatus,
    );
    expect(hardLinked.timestampProofEvidenceStatus).toBe(
      copied.timestampProofEvidenceStatus,
    );
  });

  it("keeps a copied model-resolution alias as one model identity", async () => {
    const { root, manifest } = await fixture();
    const source = "evidence/model-resolution.json";
    const alias = "evidence/copied-model-resolution.json";
    await copyFile(join(root, source), join(root, alias));
    const sourceArtifact = manifest.artifacts.find(
      (artifact) => artifact.name === source,
    )!;
    manifest.artifacts.push({
      name: alias,
      sha256: sourceArtifact.sha256,
    });
    await writeFile(
      join(root, "freeze-manifest.json"),
      JSON.stringify(manifest),
    );

    const [sourceStatus, aliasStatus] = await Promise.all([
      stat(join(root, source)),
      stat(join(root, alias)),
    ]);
    expect(aliasStatus.ino).not.toBe(sourceStatus.ino);
    expect(
      manifest.artifacts.filter(
        (artifact) => artifact.sha256 === sourceArtifact.sha256,
      ),
    ).toHaveLength(2);

    const originalReferenced = await verifyExecutionFreezeBundle(root);
    manifest.models[0]!.resolutionEvidenceArtifact = alias;
    await writeFile(
      join(root, "freeze-manifest.json"),
      JSON.stringify(manifest),
    );
    const aliasReferenced = await verifyExecutionFreezeBundle(root);

    for (const result of [originalReferenced, aliasReferenced]) {
      expect(result).toMatchObject({
        ok: true,
        errors: [],
        artifactCount: 7,
        modelCount: 1,
        externalRegistrationEvidenceStatus: "local-byte-match-unverified",
        timestampProofEvidenceStatus: "local-byte-presence-unverified",
        providerCallsAuthorized: false,
      });
    }
    expect(aliasReferenced.policyScope).toEqual(originalReferenced.policyScope);
  });

  it("rejects a copied resolution alias reused by a distinct model", async () => {
    const { root, manifest } = await fixture();
    const source = "evidence/model-resolution.json";
    const alias = "evidence/copied-model-resolution.json";
    await copyFile(join(root, source), join(root, alias));
    const sourceArtifact = manifest.artifacts.find(
      (artifact) => artifact.name === source,
    )!;
    manifest.artifacts.push({
      name: alias,
      sha256: sourceArtifact.sha256,
    });
    manifest.models.push({
      requestedId: "fixture-model-peer",
      resolvedId: "fixture-model-b",
      resolutionKind: "content-addressed" as const,
      resolutionEvidenceArtifact: alias,
    });

    const schedule = JSON.stringify(
      buildSyntheticFactorialSchedule(
        manifest.models.map((model) => model.resolvedId),
        manifest.seedPolicy.seedIds,
      ),
    );
    await writeFile(join(root, "schedule.json"), schedule);
    const scheduleSha256 = freezeArtifactSha256(schedule);
    manifest.schedule.sha256 = scheduleSha256;
    manifest.schedule.modelIds = manifest.models.map(
      (model) => model.resolvedId,
    );
    manifest.schedule.episodeCount = 128;
    manifest.artifacts.find(
      (artifact) => artifact.name === "schedule.json",
    )!.sha256 = scheduleSha256;
    await writeFile(
      join(root, "freeze-manifest.json"),
      JSON.stringify(manifest),
    );

    const [sourceStatus, aliasStatus] = await Promise.all([
      stat(join(root, source)),
      stat(join(root, alias)),
    ]);
    expect(aliasStatus.ino).not.toBe(sourceStatus.ino);
    expect(
      manifest.artifacts.filter(
        (artifact) => artifact.sha256 === sourceArtifact.sha256,
      ),
    ).toHaveLength(2);
    expect(
      manifest.models.map((model) => model.resolutionEvidenceArtifact),
    ).toEqual([source, alias]);

    expect(await verifyExecutionFreezeBundle(root)).toMatchObject({
      ok: false,
      errors: ["models[1] resolution evidence does not match declaration"],
      artifactCount: 7,
      modelCount: 2,
      seedCount: 2,
      episodeCount: 128,
      policyScope: null,
      providerCallsAuthorized: false,
    });
  });

  it("rejects one hard-linked digest reused across semantic roles", async () => {
    const cases = [
      {
        source: "evidence/model-resolution.json",
        target: "seed-policy.json",
        errors: [
          "seed policy evidence contains unsupported fields",
          "seed policy evidence schema changed",
          "seed policy evidence does not match declaration",
        ],
      },
      {
        source: "seed-policy.json",
        target: "evidence/model-resolution.json",
        errors: [
          "models[0] resolution evidence contains unsupported fields",
          "models[0] resolution evidence schema changed",
          "models[0] resolution evidence does not match declaration",
        ],
      },
    ] as const;

    for (const testCase of cases) {
      const { root, manifest } = await fixture();
      await rm(join(root, testCase.target));
      await link(join(root, testCase.source), join(root, testCase.target));
      const sourceArtifact = manifest.artifacts.find(
        (artifact) => artifact.name === testCase.source,
      )!;
      manifest.artifacts.find(
        (artifact) => artifact.name === testCase.target,
      )!.sha256 = sourceArtifact.sha256;
      await writeFile(
        join(root, "freeze-manifest.json"),
        JSON.stringify(manifest),
      );

      const [sourceStatus, targetStatus] = await Promise.all([
        stat(join(root, testCase.source)),
        stat(join(root, testCase.target)),
      ]);
      expect(targetStatus.ino).toBe(sourceStatus.ino);

      const result = await verifyExecutionFreezeBundle(root);
      expect(result.ok).toBe(false);
      expect(result.policyScope).toBeNull();
      expect(result.providerCallsAuthorized).toBe(false);
      for (const error of testCase.errors) {
        expect(result.errors).toContain(error);
      }
    }
  });

  it("rejects one resolution object reused across distinct model declarations", async () => {
    const { root, manifest } = await fixture();
    const peerModel = {
      requestedId: "fixture-model-peer",
      resolvedId: "fixture-model-b",
      resolutionKind: "content-addressed" as const,
      resolutionEvidenceArtifact: "evidence/model-resolution.json",
    };
    manifest.models.push(peerModel);

    const schedule = JSON.stringify(
      buildSyntheticFactorialSchedule(
        manifest.models.map((model) => model.resolvedId),
        manifest.seedPolicy.seedIds,
      ),
    );
    await writeFile(join(root, "schedule.json"), schedule);
    const scheduleSha256 = freezeArtifactSha256(schedule);
    manifest.schedule.sha256 = scheduleSha256;
    manifest.schedule.modelIds = manifest.models.map(
      (model) => model.resolvedId,
    );
    manifest.schedule.episodeCount = 128;
    manifest.artifacts.find(
      (artifact) => artifact.name === "schedule.json",
    )!.sha256 = scheduleSha256;
    await writeFile(
      join(root, "freeze-manifest.json"),
      JSON.stringify(manifest),
    );

    expect(manifest.models[0].resolutionEvidenceArtifact).toBe(
      peerModel.resolutionEvidenceArtifact,
    );
    expect(
      manifest.artifacts.filter(
        (artifact) => artifact.name === peerModel.resolutionEvidenceArtifact,
      ),
    ).toHaveLength(1);

    const result = await verifyExecutionFreezeBundle(root);
    expect(result).toMatchObject({
      ok: false,
      errors: ["models[1] resolution evidence does not match declaration"],
      artifactCount: 6,
      modelCount: 2,
      seedCount: 2,
      episodeCount: 128,
      policyScope: null,
      providerCallsAuthorized: false,
    });
  });

  it("rejects duplicate keys in the raw freeze-manifest JSON", async () => {
    const { root, manifest } = await fixture();
    const rawManifest = JSON.stringify(manifest).replace(
      '"providerCallsAuthorized":false',
      '"providerCallsAuthorized":false,"providerCallsAuthorized":false',
    );
    await writeFile(join(root, "freeze-manifest.json"), rawManifest);

    const result = await verifyExecutionFreezeBundle(root);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "freeze-manifest.json is not canonical verifiable JSON",
    );
    expect(result.providerCallsAuthorized).toBe(false);
  });

  it("rejects an implicit relative root", async () => {
    expect(await verifyExecutionFreezeBundle("fixture")).toEqual({
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
  });

  it("rejects traversal-shaped artifact names before reading them", async () => {
    const { root, manifest } = await fixture();
    manifest.artifacts[0]!.name = "../schedule.json";
    await writeFile(
      join(root, "freeze-manifest.json"),
      JSON.stringify(manifest),
    );

    expect((await verifyExecutionFreezeBundle(root)).errors).toContain(
      "artifact name is not a canonical relative path: ../schedule.json",
    );
  });

  it("rejects NUL and backslash artifact names before reading them", async () => {
    for (const name of ["schedule\0.json", "evidence\\schedule.json"]) {
      const { root, manifest } = await fixture();
      manifest.artifacts[0]!.name = name;
      await writeFile(
        join(root, "freeze-manifest.json"),
        JSON.stringify(manifest),
      );

      expect((await verifyExecutionFreezeBundle(root)).errors).toContain(
        `artifact name is not a canonical relative path: ${name}`,
      );
    }
  });

  it("rejects symlinks even when their target is readable", async () => {
    const { root } = await fixture();
    await symlink(
      join(root, "seed-policy.json"),
      join(root, "linked-policy.json"),
    );

    expect((await verifyExecutionFreezeBundle(root)).errors).toContain(
      "symbolic links are not allowed in a freeze bundle: linked-policy.json",
    );
  });

  it("rejects an entry replaced by a symlink during directory inventory", async () => {
    const { root, manifest } = await fixture();
    const fillerNames = Array.from(
      { length: 1_500 },
      (_, index) => `filler-${index.toString().padStart(4, "0")}.txt`,
    );
    await Promise.all(
      fillerNames.map((name) => writeFile(join(root, name), "same")),
    );
    manifest.artifacts.push(
      ...fillerNames.map((name) => ({
        name,
        sha256: freezeArtifactSha256("same"),
      })),
    );
    const inventoryOrder = await readdir(root);
    const target = inventoryOrder.findLast((name) =>
      fillerNames.includes(name),
    )!;
    const source = fillerNames.find((name) => name !== target)!;
    manifest.seedPolicy.policyArtifact = target;
    manifest.models[0]!.resolutionEvidenceArtifact = source;
    await writeFile(
      join(root, "freeze-manifest.json"),
      JSON.stringify(manifest),
    );

    const resultPromise = verifyExecutionFreezeBundle(root);
    await Bun.sleep(5);
    const swap = join(root, ".swap-link");
    await symlink(source, swap);
    await rename(swap, join(root, target));
    const result = await resultPromise;

    expect((await lstat(join(root, target))).isSymbolicLink()).toBe(true);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) =>
        [
          `symbolic links are not allowed in a freeze bundle: ${target}`,
          `bundle entry could not be opened without following symbolic links: ${target}`,
        ].some((expected) => error.includes(expected)),
      ),
    ).toBe(true);
  });

  it("rejects a directory replaced by a symlink after root inventory", async () => {
    const { root, manifest } = await fixture();
    const directoryNames = Array.from(
      { length: 500 },
      (_, index) => `entry-${index.toString().padStart(4, "0")}`,
    );
    await Promise.all(
      directoryNames.map(async (name) => {
        const directory = join(root, name);
        await mkdir(directory);
        await writeFile(join(directory, "payload.txt"), "same");
      }),
    );
    manifest.artifacts.push(
      ...directoryNames.map((name) => ({
        name: `${name}/payload.txt`,
        sha256: freezeArtifactSha256("same"),
      })),
    );
    const inventoryOrder = await readdir(root);
    const target = inventoryOrder.findLast((name) =>
      directoryNames.includes(name),
    )!;
    const source = directoryNames.find((name) => name !== target)!;
    manifest.seedPolicy.policyArtifact = `${target}/payload.txt`;
    manifest.models[0]!.resolutionEvidenceArtifact = `${source}/payload.txt`;
    await writeFile(
      join(root, "freeze-manifest.json"),
      JSON.stringify(manifest),
    );

    const replacementRoot = await mkdtemp(
      join(tmpdir(), "scout-freeze-directory-swap-"),
    );
    temporaryRoots.push(replacementRoot);
    const replacement = join(replacementRoot, "replacement");
    await mkdir(replacement);
    await writeFile(join(replacement, "payload.txt"), "same");

    const resultPromise = verifyExecutionFreezeBundle(root);
    await Bun.sleep(5);
    await rename(join(root, target), join(replacementRoot, "moved"));
    await rename(replacement, join(root, ".replacement"));
    await symlink(".replacement", join(root, target));
    const result = await resultPromise;

    expect((await lstat(join(root, target))).isSymbolicLink()).toBe(true);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) =>
        error.includes(
          `bundle directory could not be opened without following symbolic links: ${target}`,
        ),
      ),
    ).toBe(true);
  });

  it("rejects undeclared files discovered by the directory inventory", async () => {
    const { root } = await fixture();
    await writeFile(join(root, "undeclared.txt"), "not in the manifest");

    expect((await verifyExecutionFreezeBundle(root)).errors).toContain(
      "undeclared artifact bytes: undeclared.txt",
    );
  });

  it("preserves the underlying provider-call denial", async () => {
    const { root, manifest } = await fixture();
    manifest.providerCallsAuthorized = true;
    await writeFile(
      join(root, "freeze-manifest.json"),
      JSON.stringify(manifest),
    );

    const result = await verifyExecutionFreezeBundle(root);
    expect(result.ok).toBe(false);
    expect(result.providerCallsAuthorized).toBe(false);
    expect(result.errors).toContain(
      "manifest must remain offline preparation with provider calls denied and empty results",
    );
  });
});
