import { afterEach, describe, expect, it } from "bun:test";
import {
  lstat,
  mkdtemp,
  mkdir,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { verifyExecutionFreezeBundle } from "./verification-allocation-freeze-bundle";
import { freezeArtifactSha256 } from "./verification-allocation-freeze";
import { buildToyFactorialSchedule } from "./verification-allocation-factorial";

const temporaryRoots: string[] = [];

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "scout-freeze-bundle-"));
  temporaryRoots.push(root);
  const schedule = JSON.stringify(buildToyFactorialSchedule());
  const bundleBytes = "fixture bundle bytes";
  const contents = {
    "schedule.json": schedule,
    "evidence/model-resolution.json": JSON.stringify({
      requestedId: "fixture-model",
      resolvedId: "fixture-model-a",
      resolutionKind: "content-addressed",
    }),
    "seed-policy.md": "fixture seeds are enumerated once",
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

  it("rejects symlinks even when their target is readable", async () => {
    const { root } = await fixture();
    await symlink(join(root, "seed-policy.md"), join(root, "linked-policy.md"));

    expect((await verifyExecutionFreezeBundle(root)).errors).toContain(
      "symbolic links are not allowed in a freeze bundle: linked-policy.md",
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
