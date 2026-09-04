import { createHash } from "node:crypto";
import { readDescriptorSafeLocalEvidence } from "./descriptor-safe-local-evidence";
import {
  hasDuplicateJsonObjectKeys,
  hasExcessiveJsonNesting,
} from "./json-object-key-exactness";
import {
  isIdentityRobustFrontier,
  type IdentityRobustFrontierPoint,
} from "./verification-allocation-frontier-policy";

export type IdentityRobustFrontierSnapshot = {
  schema: "scout.verification-allocation-frontier-snapshot/v1";
  evidenceClass: "local-exact-frontier-computation";
  generatorReference: "verification-allocation-robust-frontier/v1";
  rowSha256: string;
  resultSha256: string;
  frontierSha256: string;
  frontier: IdentityRobustFrontierPoint[];
  providerCallsAuthorized: false;
};

export type IdentityRobustFrontierSnapshotVerification = {
  ok: boolean;
  snapshot: IdentityRobustFrontierSnapshot | null;
  errors: string[];
  providerCallsAuthorized: false;
  scopeLimit: string;
};

export type IdentityRobustFrontierSnapshotExpectation = {
  rowSha256: string;
  resultSha256: string;
  frontierSha256: string;
  frontierCount: number;
};

export function identityRobustFrontierSnapshotReference(
  snapshot: IdentityRobustFrontierSnapshotExpectation,
): string {
  return `frontier-snapshot-sha256:${createHash("sha256")
    .update(
      JSON.stringify([
        "scout.verification-allocation-frontier-snapshot-identity/v1",
        snapshot.rowSha256,
        snapshot.resultSha256,
        snapshot.frontierSha256,
        snapshot.frontierCount,
      ]),
    )
    .digest("hex")}`;
}

export const RETAINED_IDENTITY_ROBUST_FRONTIER_EXPECTATION: IdentityRobustFrontierSnapshotExpectation =
  Object.freeze({
    rowSha256:
      "6fac7f99c1159798c211016ad2ec0cbd464c7c95ae56cf324a6000028dd38252",
    resultSha256:
      "383a699f69ef92bdc1f5edd0941d03ba4e411cdfe22adf2f4b4e07257c2b8fff",
    frontierSha256:
      "067201a66252a39d1deb6a6189783137921b6610ac8b2d35acbea38d5b4530ef",
    frontierCount: 508,
  });

export type IdentityRobustLocalFrontierSnapshotVerification =
  IdentityRobustFrontierSnapshotVerification & {
    snapshotByteSha256: string;
    snapshotByteLength: number;
    snapshotEvidenceStatus: "local-byte-match-unverified" | "";
  };

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const scopeLimit =
  "A snapshot verifies an exact local frontier representation and one descriptor-safe byte read. It does not prove the generator revision, row or result computation, authorship, authority, freshness, policy approval, real drift, cost, or provider behavior.";

export function createIdentityRobustFrontierSnapshot(
  frontierCandidate: unknown,
  rowSha256: string,
  resultSha256: string,
): IdentityRobustFrontierSnapshot {
  if (!isIdentityRobustFrontier(frontierCandidate)) {
    throw new Error("identity-robust frontier is invalid");
  }
  if (!/^[0-9a-f]{64}$/.test(rowSha256)) {
    throw new Error("row SHA-256 is invalid");
  }
  if (!/^[0-9a-f]{64}$/.test(resultSha256)) {
    throw new Error("result SHA-256 is invalid");
  }
  return {
    schema: "scout.verification-allocation-frontier-snapshot/v1",
    evidenceClass: "local-exact-frontier-computation",
    generatorReference: "verification-allocation-robust-frontier/v1",
    rowSha256,
    resultSha256,
    frontierSha256: sha256(frontierCandidate),
    frontier: frontierCandidate,
    providerCallsAuthorized: false,
  };
}

export function verifyIdentityRobustFrontierSnapshot(
  candidate: unknown,
  expected?: IdentityRobustFrontierSnapshotExpectation,
): IdentityRobustFrontierSnapshotVerification {
  const expectedKeys = [
    "schema",
    "evidenceClass",
    "generatorReference",
    "rowSha256",
    "resultSha256",
    "frontierSha256",
    "frontier",
    "providerCallsAuthorized",
  ].sort();
  if (
    !record(candidate) ||
    JSON.stringify(Object.keys(candidate).sort()) !==
      JSON.stringify(expectedKeys) ||
    candidate.schema !== "scout.verification-allocation-frontier-snapshot/v1" ||
    candidate.evidenceClass !== "local-exact-frontier-computation" ||
    candidate.generatorReference !==
      "verification-allocation-robust-frontier/v1" ||
    !/^[0-9a-f]{64}$/.test(String(candidate.rowSha256)) ||
    !/^[0-9a-f]{64}$/.test(String(candidate.resultSha256)) ||
    !/^[0-9a-f]{64}$/.test(String(candidate.frontierSha256)) ||
    candidate.providerCallsAuthorized !== false ||
    !isIdentityRobustFrontier(candidate.frontier)
  ) {
    return {
      ok: false,
      snapshot: null,
      errors: ["an exact offline frontier snapshot is required"],
      providerCallsAuthorized: false,
      scopeLimit,
    };
  }
  if (sha256(candidate.frontier) !== candidate.frontierSha256) {
    return {
      ok: false,
      snapshot: null,
      errors: ["frontier snapshot points do not match their SHA-256"],
      providerCallsAuthorized: false,
      scopeLimit,
    };
  }
  if (
    expected &&
    (candidate.rowSha256 !== expected.rowSha256 ||
      candidate.resultSha256 !== expected.resultSha256 ||
      candidate.frontierSha256 !== expected.frontierSha256 ||
      candidate.frontier.length !== expected.frontierCount)
  ) {
    return {
      ok: false,
      snapshot: null,
      errors: ["frontier snapshot does not match the expected computation"],
      providerCallsAuthorized: false,
      scopeLimit,
    };
  }
  return {
    ok: true,
    snapshot: candidate as IdentityRobustFrontierSnapshot,
    errors: [],
    providerCallsAuthorized: false,
    scopeLimit,
  };
}

export async function loadIdentityRobustFrontierSnapshot(
  snapshotRoot: string,
  snapshotArtifact: string,
  expectedSnapshotByteSha256: string,
  expected: IdentityRobustFrontierSnapshotExpectation,
): Promise<IdentityRobustLocalFrontierSnapshotVerification> {
  const localEvidence = await readDescriptorSafeLocalEvidence(
    snapshotRoot,
    snapshotArtifact,
    expectedSnapshotByteSha256,
  );
  if (!localEvidence.ok) {
    return {
      ok: false,
      snapshot: null,
      errors: localEvidence.errors,
      providerCallsAuthorized: false,
      snapshotByteSha256: localEvidence.sha256,
      snapshotByteLength: localEvidence.byteLength,
      snapshotEvidenceStatus: localEvidence.evidenceStatus,
      scopeLimit,
    };
  }
  let candidate: unknown;
  let snapshotText: string;
  try {
    snapshotText = new TextDecoder("utf-8", { fatal: true }).decode(
      localEvidence.bytes!,
    );
    if (hasExcessiveJsonNesting(snapshotText)) {
      return {
        ok: false,
        snapshot: null,
        errors: ["frontier snapshot exceeds the supported JSON nesting limit"],
        providerCallsAuthorized: false,
        snapshotByteSha256: localEvidence.sha256,
        snapshotByteLength: localEvidence.byteLength,
        snapshotEvidenceStatus: localEvidence.evidenceStatus,
        scopeLimit,
      };
    }
    candidate = JSON.parse(snapshotText);
  } catch {
    return {
      ok: false,
      snapshot: null,
      errors: ["frontier snapshot must contain valid UTF-8 JSON"],
      providerCallsAuthorized: false,
      snapshotByteSha256: localEvidence.sha256,
      snapshotByteLength: localEvidence.byteLength,
      snapshotEvidenceStatus: localEvidence.evidenceStatus,
      scopeLimit,
    };
  }
  if (hasDuplicateJsonObjectKeys(snapshotText)) {
    return {
      ok: false,
      snapshot: null,
      errors: ["frontier snapshot contains duplicate JSON object keys"],
      providerCallsAuthorized: false,
      snapshotByteSha256: localEvidence.sha256,
      snapshotByteLength: localEvidence.byteLength,
      snapshotEvidenceStatus: localEvidence.evidenceStatus,
      scopeLimit,
    };
  }
  const verification = verifyIdentityRobustFrontierSnapshot(
    candidate,
    expected,
  );
  return {
    ...verification,
    snapshotByteSha256: localEvidence.sha256,
    snapshotByteLength: localEvidence.byteLength,
    snapshotEvidenceStatus: localEvidence.evidenceStatus,
  };
}
