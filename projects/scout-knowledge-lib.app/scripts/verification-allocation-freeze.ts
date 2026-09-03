import { createHash } from "node:crypto";
import {
  type FactorialSchedule,
  verifyFactorialSchedule,
} from "./verification-allocation-factorial";

type ArtifactBytes = string | Uint8Array;

type FreezeModel = {
  requestedId: string;
  resolvedId: string;
  resolutionKind: "dated-snapshot" | "content-addressed";
  resolutionEvidenceArtifact: string;
};

type FreezeArtifact = {
  name: string;
  sha256: string;
};

type FreezeManifest = {
  schema: "scout.verification-allocation-freeze/v1";
  evidenceClass: "offline-execution-preparation";
  providerCallsAuthorized: false;
  results: [];
  models: FreezeModel[];
  seedPolicy: {
    namespace: "scout.verification-allocation/v1";
    algorithm: string;
    policyArtifact: string;
    seedIds: string[];
  };
  schedule: {
    artifact: string;
    sha256: string;
    schema: "scout.verification-allocation-schedule/v1";
    modelIds: string[];
    seedIds: string[];
    cellsPerModelSeed: 32;
    episodeCount: number;
  };
  artifacts: FreezeArtifact[];
  externalRegistration: {
    status: "verified";
    url: string;
    identifier: string;
    depositTimestampUtc: string;
    artifactName: string;
    artifactSha256: string;
    manifestArtifact: string;
    manifestSha256: string;
    proofArtifact: string;
  };
};

export type FreezeVerificationResult = {
  ok: boolean;
  errors: string[];
  artifactCount: number;
  modelCount: number;
  seedCount: number;
  episodeCount: number;
  externalRegistrationEvidenceStatus: "local-byte-match-unverified" | "";
  policyScope: FreezePolicyScope | null;
  providerCallsAuthorized: false;
};

export type FreezePolicyScope = {
  schema: "scout.verification-allocation-freeze-policy-scope/v1";
  protocolReference: string;
  modelScopeReference: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every(isString)) return null;
  return value;
}

function sameStrings(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function uniqueStrings(values: string[]): boolean {
  return new Set(values).size === values.length;
}

export function freezeArtifactSha256(value: ArtifactBytes): string {
  return createHash("sha256").update(value).digest("hex");
}

function derivePolicyScope(
  manifest: FreezeManifest,
  artifacts: Map<string, FreezeArtifact>,
  resolvedModelIds: string[],
  seedIds: string[],
  episodeCount: number,
): FreezePolicyScope {
  const protocolSha256 = freezeArtifactSha256(
    JSON.stringify({
      schema: "scout.verification-allocation-protocol-scope/v1",
      scheduleSchema: manifest.schedule.schema,
      cellsPerModelSeed: manifest.schedule.cellsPerModelSeed,
      seedPolicyNamespace: manifest.seedPolicy.namespace,
      seedPolicyAlgorithm: manifest.seedPolicy.algorithm,
      seedPolicySha256: artifacts.get(manifest.seedPolicy.policyArtifact)!
        .sha256,
      seedIds,
      episodeCount,
      scheduleSha256: manifest.schedule.sha256,
      executionArtifactName: manifest.externalRegistration.artifactName,
      executionArtifactSha256: artifacts.get(
        manifest.externalRegistration.artifactName,
      )!.sha256,
    }),
  );
  const modelScopeSha256 = freezeArtifactSha256(
    JSON.stringify({
      schema: "scout.verification-allocation-model-scope/v1",
      models: manifest.models.map((model) => ({
        requestedId: model.requestedId,
        resolvedId: model.resolvedId,
        resolutionKind: model.resolutionKind,
        resolutionEvidenceSha256: artifacts.get(
          model.resolutionEvidenceArtifact,
        )!.sha256,
      })),
      resolvedModelIds,
    }),
  );
  return {
    schema: "scout.verification-allocation-freeze-policy-scope/v1",
    protocolReference: `freeze-protocol-sha256:${protocolSha256}`,
    modelScopeReference: `freeze-model-scope-sha256:${modelScopeSha256}`,
  };
}

function parseManifest(
  value: unknown,
  errors: string[],
): FreezeManifest | null {
  if (!isRecord(value)) {
    errors.push("manifest must be an object");
    return null;
  }
  if (value.schema !== "scout.verification-allocation-freeze/v1") {
    errors.push("manifest schema changed");
  }
  if (
    value.evidenceClass !== "offline-execution-preparation" ||
    value.providerCallsAuthorized !== false ||
    !Array.isArray(value.results) ||
    value.results.length !== 0
  ) {
    errors.push(
      "manifest must remain offline preparation with provider calls denied and empty results",
    );
  }
  return value as unknown as FreezeManifest;
}

function validateArtifacts(
  manifest: FreezeManifest,
  artifactContents: Record<string, ArtifactBytes>,
  errors: string[],
): Map<string, FreezeArtifact> {
  const artifacts = Array.isArray(manifest.artifacts) ? manifest.artifacts : [];
  if (artifacts.length === 0) errors.push("artifacts must not be empty");

  const byName = new Map<string, FreezeArtifact>();
  for (const [index, artifact] of artifacts.entries()) {
    if (
      !isRecord(artifact) ||
      !isString(artifact.name) ||
      !isSha256(artifact.sha256)
    ) {
      errors.push(`artifacts[${index}] is malformed`);
      continue;
    }
    if (byName.has(artifact.name)) {
      errors.push(`artifact ${artifact.name} is declared more than once`);
      continue;
    }
    byName.set(artifact.name, artifact as FreezeArtifact);
    const content = artifactContents[artifact.name];
    if (content === undefined) {
      errors.push(`artifact ${artifact.name} has no supplied bytes`);
    } else if (freezeArtifactSha256(content) !== artifact.sha256) {
      errors.push(`artifact ${artifact.name} digest mismatch`);
    }
  }

  for (const name of Object.keys(artifactContents)) {
    if (!byName.has(name)) errors.push(`undeclared artifact bytes: ${name}`);
  }
  return byName;
}

function validateModels(
  manifest: FreezeManifest,
  artifacts: Map<string, FreezeArtifact>,
  errors: string[],
): string[] {
  const models = Array.isArray(manifest.models) ? manifest.models : [];
  if (models.length === 0) errors.push("models must not be empty");
  const requestedIds: string[] = [];
  const resolvedIds: string[] = [];
  for (const [index, model] of models.entries()) {
    if (!isRecord(model)) {
      errors.push(`models[${index}] is malformed`);
      continue;
    }
    if (!isString(model.requestedId) || !isString(model.resolvedId)) {
      errors.push(`models[${index}] must name requested and resolved IDs`);
      continue;
    }
    requestedIds.push(model.requestedId);
    resolvedIds.push(model.resolvedId);
    if (
      model.resolutionKind !== "dated-snapshot" &&
      model.resolutionKind !== "content-addressed"
    ) {
      errors.push(`models[${index}] is not an immutable model resolution`);
    }
    if (
      !isString(model.resolutionEvidenceArtifact) ||
      !artifacts.has(model.resolutionEvidenceArtifact)
    ) {
      errors.push(`models[${index}] has no bound resolution evidence`);
    }
  }
  if (!uniqueStrings(requestedIds)) {
    errors.push("requested model IDs must be unique");
  }
  if (!uniqueStrings(resolvedIds)) {
    errors.push("resolved model IDs must be unique");
  }
  return resolvedIds;
}

function validateSeedPolicy(
  manifest: FreezeManifest,
  artifacts: Map<string, FreezeArtifact>,
  errors: string[],
): string[] {
  const policy = manifest.seedPolicy;
  if (!isRecord(policy)) {
    errors.push("seed policy is missing");
    return [];
  }
  if (policy.namespace !== "scout.verification-allocation/v1") {
    errors.push("seed policy namespace is not Scout-specific");
  }
  if (!isString(policy.algorithm)) {
    errors.push("seed policy algorithm is missing");
  }
  if (
    !isString(policy.policyArtifact) ||
    !artifacts.has(policy.policyArtifact)
  ) {
    errors.push("seed policy has no bound policy artifact");
  }
  const seedIds = stringArray(policy.seedIds);
  if (!seedIds || seedIds.length === 0 || !uniqueStrings(seedIds)) {
    errors.push("seed IDs must be unique and non-empty");
    return seedIds ?? [];
  }
  return seedIds;
}

function validateSchedule(
  manifest: FreezeManifest,
  artifactContents: Record<string, ArtifactBytes>,
  modelIds: string[],
  seedIds: string[],
  errors: string[],
): number {
  const schedule = manifest.schedule;
  if (!isRecord(schedule)) {
    errors.push("schedule metadata is missing");
    return 0;
  }
  if (
    schedule.schema !== "scout.verification-allocation-schedule/v1" ||
    schedule.cellsPerModelSeed !== 32
  ) {
    errors.push("schedule does not describe the 32-cell Scout factorial");
  }
  const scheduledModels = stringArray(schedule.modelIds) ?? [];
  const scheduledSeeds = stringArray(schedule.seedIds) ?? [];
  if (!sameStrings(scheduledModels, modelIds)) {
    errors.push("schedule model IDs do not match immutable resolutions");
  }
  if (!sameStrings(scheduledSeeds, seedIds)) {
    errors.push("schedule seed IDs do not match the seed policy");
  }
  const expectedEpisodeCount = modelIds.length * seedIds.length * 32;
  if (
    !Number.isInteger(schedule.episodeCount) ||
    schedule.episodeCount !== expectedEpisodeCount
  ) {
    errors.push(
      `schedule episode count must be ${expectedEpisodeCount}, found ${String(schedule.episodeCount)}`,
    );
  }
  if (!isString(schedule.artifact) || !isSha256(schedule.sha256)) {
    errors.push("schedule artifact binding is malformed");
    return Number.isInteger(schedule.episodeCount) ? schedule.episodeCount : 0;
  }
  const bytes = artifactContents[schedule.artifact];
  if (bytes === undefined || freezeArtifactSha256(bytes) !== schedule.sha256) {
    errors.push("schedule artifact digest does not match its binding");
    return Number.isInteger(schedule.episodeCount) ? schedule.episodeCount : 0;
  }
  try {
    const raw =
      typeof bytes === "string" ? bytes : new TextDecoder().decode(bytes);
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) throw new Error("not an object");
    const parsedModels = stringArray(parsed.models) ?? [];
    const parsedSeeds = stringArray(parsed.seeds) ?? [];
    const parsedEpisodes = Array.isArray(parsed.episodes)
      ? parsed.episodes
      : [];
    if (
      parsed.schema !== schedule.schema ||
      parsed.providerCallsAuthorized !== false ||
      !Array.isArray(parsed.results) ||
      parsed.results.length !== 0 ||
      !sameStrings(parsedModels, scheduledModels) ||
      !sameStrings(parsedSeeds, scheduledSeeds) ||
      parsedEpisodes.length !== schedule.episodeCount
    ) {
      errors.push("schedule bytes do not match the declared offline schedule");
    }
    const factorial = verifyFactorialSchedule(parsed as FactorialSchedule);
    if (!factorial.ok) {
      errors.push(
        ...factorial.errors.map(
          (error) => `schedule factorial verification failed: ${error}`,
        ),
      );
    }
  } catch {
    errors.push("schedule artifact is not valid verifiable JSON");
  }
  return Number.isInteger(schedule.episodeCount) ? schedule.episodeCount : 0;
}

function validateExternalRegistration(
  manifest: FreezeManifest,
  artifacts: Map<string, FreezeArtifact>,
  artifactContents: Record<string, ArtifactBytes>,
  errors: string[],
): void {
  const registration = manifest.externalRegistration;
  if (!isRecord(registration) || registration.status !== "verified") {
    errors.push("external registration is not verified");
    return;
  }
  if (
    !isString(registration.url) ||
    !registration.url.startsWith("https://") ||
    !isString(registration.identifier) ||
    !isString(registration.depositTimestampUtc) ||
    !registration.depositTimestampUtc.endsWith("Z") ||
    !Number.isFinite(Date.parse(registration.depositTimestampUtc))
  ) {
    errors.push("external registration identity or timestamp is malformed");
  }
  const deposited = artifacts.get(String(registration.artifactName));
  if (
    !deposited ||
    !isSha256(registration.artifactSha256) ||
    deposited.sha256 !== registration.artifactSha256
  ) {
    errors.push("external registration artifact is not byte-bound");
  }
  const manifestArtifact = artifacts.get(String(registration.manifestArtifact));
  if (
    !manifestArtifact ||
    !isSha256(registration.manifestSha256) ||
    manifestArtifact.sha256 !== registration.manifestSha256
  ) {
    errors.push("external registration manifest is not byte-bound");
  }
  const checksumBytes = artifactContents[String(registration.manifestArtifact)];
  if (checksumBytes !== undefined) {
    let checksumText = "";
    try {
      checksumText =
        typeof checksumBytes === "string"
          ? checksumBytes
          : new TextDecoder("utf-8", { fatal: true }).decode(checksumBytes);
    } catch {
      // The stable error below covers undecodable and structurally invalid
      // checksum manifests without exposing arbitrary artifact contents.
    }
    const matchingChecksums = checksumText
      .split("\n")
      .map((line) => line.replace(/\r$/, ""))
      .flatMap((line) => {
        const match = line.match(/^([0-9a-f]{64}) [ *](.+)$/);
        return match && match[2] === registration.artifactName
          ? [match[1]]
          : [];
      });
    if (
      matchingChecksums.length !== 1 ||
      matchingChecksums[0] !== registration.artifactSha256
    ) {
      errors.push(
        "external registration checksum manifest does not bind its artifact",
      );
    }
  }
  if (!artifacts.has(String(registration.proofArtifact))) {
    errors.push("external registration proof artifact is missing");
  }
}

/**
 * Validate an offline freeze bundle without making network or provider calls.
 * This proves byte bindings and declared relationships only. It does not prove
 * that a provider resolution, external URL, timestamp proof, or signature is
 * authentic, and it never grants call or spending authority.
 */
export function verifyExecutionFreezeManifest(
  value: unknown,
  artifactContents: Record<string, ArtifactBytes>,
): FreezeVerificationResult {
  const errors: string[] = [];
  const manifest = parseManifest(value, errors);
  if (!manifest) {
    return {
      ok: false,
      errors,
      artifactCount: 0,
      modelCount: 0,
      seedCount: 0,
      episodeCount: 0,
      externalRegistrationEvidenceStatus: "",
      policyScope: null,
      providerCallsAuthorized: false,
    };
  }
  const artifacts = validateArtifacts(manifest, artifactContents, errors);
  const modelIds = validateModels(manifest, artifacts, errors);
  const seedIds = validateSeedPolicy(manifest, artifacts, errors);
  const episodeCount = validateSchedule(
    manifest,
    artifactContents,
    modelIds,
    seedIds,
    errors,
  );
  const errorCountBeforeRegistration = errors.length;
  validateExternalRegistration(manifest, artifacts, artifactContents, errors);
  return {
    ok: errors.length === 0,
    errors,
    artifactCount: artifacts.size,
    modelCount: modelIds.length,
    seedCount: seedIds.length,
    episodeCount,
    externalRegistrationEvidenceStatus:
      errors.length === errorCountBeforeRegistration
        ? "local-byte-match-unverified"
        : "",
    policyScope:
      errors.length === 0
        ? derivePolicyScope(
            manifest,
            artifacts,
            modelIds,
            seedIds,
            episodeCount,
          )
        : null,
    providerCallsAuthorized: false,
  };
}
