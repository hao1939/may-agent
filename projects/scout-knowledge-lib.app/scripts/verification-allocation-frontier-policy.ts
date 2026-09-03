import { createHash } from "node:crypto";
import {
  bindIdentityRobustPolicyEvidence,
  bindIdentityRobustPolicyEvidenceFromLocalManifest,
  bindIdentityRobustPolicyEvidenceFromLocalRecord,
} from "./verification-allocation-policy-provenance";

export type IdentityRobustFrontierPoint = {
  runBlockCount: number;
  episodeCount: number;
  allocation: number[];
  uniformDriftBuffer: number;
};

export type IdentityRobustFrontierPolicy = {
  schema: "scout.verification-allocation-frontier-policy/v1";
  evidenceClass: "caller-supplied-operating-policy";
  selectionBasis: "minimum-uniform-drift-reserve" | "maximum-episode-count";
  minimumUniformDriftReserve?: number;
  maximumEpisodeCount?: number;
  evidenceReference: string;
};

export type IdentityRobustFrontierSelection = {
  ok: boolean;
  policySha256: string;
  evidenceManifestSha256: string;
  policyEvidenceStatus: "caller-supplied-unverified" | "";
  selected: IdentityRobustFrontierPoint | null;
  errors: string[];
  scopeLimit: string;
};

export type IdentityRobustLocalFrontierSelection =
  IdentityRobustFrontierSelection & {
    decisionRecordSha256: string;
    decisionRecordByteLength: number;
    decisionRecordEvidenceStatus: "local-byte-match-unverified" | "";
    decisionRecordContentStatus: "local-content-match-unverified" | "";
  };

export type IdentityRobustLocalManifestFrontierSelection =
  IdentityRobustLocalFrontierSelection & {
    manifestArtifactSha256: string;
    manifestArtifactByteLength: number;
    manifestArtifactEvidenceStatus: "local-byte-match-unverified" | "";
    manifestArtifactContentStatus: "local-content-match-unverified" | "";
  };

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parsePolicy(candidate: unknown): IdentityRobustFrontierPolicy | null {
  if (!record(candidate)) return null;
  const sharedKeys = [
    "schema",
    "evidenceClass",
    "selectionBasis",
    "evidenceReference",
  ];
  const basis = candidate.selectionBasis;
  const basisKey =
    basis === "minimum-uniform-drift-reserve"
      ? "minimumUniformDriftReserve"
      : basis === "maximum-episode-count"
        ? "maximumEpisodeCount"
        : "";
  const expectedKeys = [...sharedKeys, basisKey].sort();
  if (
    !basisKey ||
    JSON.stringify(Object.keys(candidate).sort()) !==
      JSON.stringify(expectedKeys) ||
    candidate.schema !== "scout.verification-allocation-frontier-policy/v1" ||
    candidate.evidenceClass !== "caller-supplied-operating-policy" ||
    typeof candidate.evidenceReference !== "string" ||
    !candidate.evidenceReference.trim()
  ) {
    return null;
  }
  if (
    basis === "minimum-uniform-drift-reserve" &&
    (typeof candidate.minimumUniformDriftReserve !== "number" ||
      !Number.isFinite(candidate.minimumUniformDriftReserve) ||
      candidate.minimumUniformDriftReserve < 0 ||
      candidate.minimumUniformDriftReserve > 1)
  ) {
    return null;
  }
  if (
    basis === "maximum-episode-count" &&
    (!Number.isSafeInteger(candidate.maximumEpisodeCount) ||
      (candidate.maximumEpisodeCount as number) <= 0)
  ) {
    return null;
  }
  return candidate as IdentityRobustFrontierPolicy;
}

export function hashIdentityRobustFrontierPolicy(candidate: unknown): string {
  const policy = parsePolicy(candidate);
  if (!policy) return "";
  const threshold =
    policy.selectionBasis === "minimum-uniform-drift-reserve"
      ? { minimumUniformDriftReserve: policy.minimumUniformDriftReserve }
      : { maximumEpisodeCount: policy.maximumEpisodeCount };
  return createHash("sha256")
    .update(
      JSON.stringify({
        schema: policy.schema,
        evidenceClass: policy.evidenceClass,
        selectionBasis: policy.selectionBasis,
        ...threshold,
        evidenceReference: policy.evidenceReference,
      }),
    )
    .digest("hex");
}

export function isIdentityRobustFrontier(
  candidate: unknown,
): candidate is IdentityRobustFrontierPoint[] {
  if (!Array.isArray(candidate) || candidate.length === 0) return false;
  let priorBlocks = -1;
  let priorEpisodes = -1;
  let priorReserve = Number.NEGATIVE_INFINITY;
  for (const point of candidate) {
    const runBlockCount = record(point) ? point.runBlockCount : undefined;
    const episodeCount = record(point) ? point.episodeCount : undefined;
    const allocation = record(point) ? point.allocation : undefined;
    const uniformDriftBuffer = record(point)
      ? point.uniformDriftBuffer
      : undefined;
    if (
      !record(point) ||
      !Number.isSafeInteger(runBlockCount) ||
      (runBlockCount as number) <= priorBlocks ||
      !Number.isSafeInteger(episodeCount) ||
      (episodeCount as number) <= priorEpisodes ||
      !Array.isArray(allocation) ||
      allocation.length === 0 ||
      allocation.some((count) => !Number.isSafeInteger(count) || count <= 0) ||
      allocation.reduce((sum, count) => sum + count, 0) !== runBlockCount ||
      episodeCount !== (runBlockCount as number) * 32 ||
      typeof uniformDriftBuffer !== "number" ||
      !Number.isFinite(uniformDriftBuffer) ||
      uniformDriftBuffer <= priorReserve
    ) {
      return false;
    }
    priorBlocks = runBlockCount as number;
    priorEpisodes = episodeCount as number;
    priorReserve = uniformDriftBuffer;
  }
  return true;
}

export function selectIdentityRobustFrontierPoint(
  frontierCandidate: unknown,
  policyCandidate: unknown,
  evidenceManifestCandidate: unknown = null,
  verifiedPolicyScopeCandidate: unknown = null,
): IdentityRobustFrontierSelection {
  const scopeLimit =
    "Selection is conditional on a caller-supplied policy and provenance manifest whose fields are recorded but not independently verified. It does not authenticate the owner, timestamp, revision, references, real drift, marginal estimates, dependence, provider behavior, or operating cost.";
  if (!isIdentityRobustFrontier(frontierCandidate)) {
    return {
      ok: false,
      policySha256: "",
      evidenceManifestSha256: "",
      policyEvidenceStatus: "",
      selected: null,
      errors: ["identity-robust frontier is invalid"],
      scopeLimit,
    };
  }
  const policy = parsePolicy(policyCandidate);
  if (!policy) {
    return {
      ok: false,
      policySha256: "",
      evidenceManifestSha256: "",
      policyEvidenceStatus: "",
      selected: null,
      errors: [
        "exactly one explicit frontier policy with evidence is required",
      ],
      scopeLimit,
    };
  }
  const policySha256 = hashIdentityRobustFrontierPolicy(policy);
  const evidenceBinding = bindIdentityRobustPolicyEvidence(
    policySha256,
    policy.evidenceReference,
    policy,
    evidenceManifestCandidate,
    verifiedPolicyScopeCandidate,
  );
  if (!evidenceBinding.ok) {
    return {
      ok: false,
      policySha256,
      evidenceManifestSha256: "",
      policyEvidenceStatus: "",
      selected: null,
      errors: evidenceBinding.errors,
      scopeLimit,
    };
  }
  let selected: IdentityRobustFrontierPoint | undefined;
  if (policy.selectionBasis === "minimum-uniform-drift-reserve") {
    selected = frontierCandidate.find(
      (point) => point.uniformDriftBuffer >= policy.minimumUniformDriftReserve!,
    );
  } else {
    for (let index = frontierCandidate.length - 1; index >= 0; index -= 1) {
      const point = frontierCandidate[index]!;
      if (point.episodeCount <= policy.maximumEpisodeCount!) {
        selected = point;
        break;
      }
    }
  }
  return {
    ok: Boolean(selected),
    policySha256,
    evidenceManifestSha256: evidenceBinding.manifestSha256,
    policyEvidenceStatus: "caller-supplied-unverified",
    selected: selected ?? null,
    errors: selected
      ? []
      : ["no frontier point satisfies the explicit operating policy"],
    scopeLimit,
  };
}

export async function selectIdentityRobustFrontierPointFromLocalRecord(
  frontierCandidate: unknown,
  policyCandidate: unknown,
  evidenceManifestCandidate: unknown,
  evidenceRoot: string,
  verifiedPolicyScopeCandidate: unknown = null,
): Promise<IdentityRobustLocalFrontierSelection> {
  const selection = selectIdentityRobustFrontierPoint(
    frontierCandidate,
    policyCandidate,
    evidenceManifestCandidate,
    verifiedPolicyScopeCandidate,
  );
  if (!selection.ok) {
    return {
      ...selection,
      decisionRecordSha256: "",
      decisionRecordByteLength: 0,
      decisionRecordEvidenceStatus: "",
      decisionRecordContentStatus: "",
    };
  }

  const policy = parsePolicy(policyCandidate)!;
  const localBinding = await bindIdentityRobustPolicyEvidenceFromLocalRecord(
    selection.policySha256,
    policy.evidenceReference,
    policy,
    evidenceManifestCandidate,
    evidenceRoot,
    verifiedPolicyScopeCandidate,
  );
  if (!localBinding.ok) {
    return {
      ...selection,
      ok: false,
      selected: null,
      errors: localBinding.errors,
      decisionRecordSha256: localBinding.decisionRecordSha256,
      decisionRecordByteLength: localBinding.decisionRecordByteLength,
      decisionRecordEvidenceStatus: localBinding.decisionRecordEvidenceStatus,
      decisionRecordContentStatus: localBinding.decisionRecordContentStatus,
      scopeLimit: localBinding.scopeLimit,
    };
  }
  return {
    ...selection,
    decisionRecordSha256: localBinding.decisionRecordSha256,
    decisionRecordByteLength: localBinding.decisionRecordByteLength,
    decisionRecordEvidenceStatus: localBinding.decisionRecordEvidenceStatus,
    decisionRecordContentStatus: localBinding.decisionRecordContentStatus,
    scopeLimit: localBinding.scopeLimit,
  };
}

export async function selectIdentityRobustFrontierPointFromLocalManifest(
  frontierCandidate: unknown,
  policyCandidate: unknown,
  evidenceRoot: string,
  manifestArtifact: string,
  manifestArtifactSha256: string,
  verifiedPolicyScopeCandidate: unknown = null,
): Promise<IdentityRobustLocalManifestFrontierSelection> {
  const emptyLocal = {
    evidenceManifestSha256: "",
    policyEvidenceStatus: "" as const,
    selected: null,
    decisionRecordSha256: "",
    decisionRecordByteLength: 0,
    decisionRecordEvidenceStatus: "" as const,
    decisionRecordContentStatus: "" as const,
    manifestArtifactSha256: "",
    manifestArtifactByteLength: 0,
    manifestArtifactEvidenceStatus: "" as const,
    manifestArtifactContentStatus: "" as const,
  };
  const scopeLimit =
    "Selection requires descriptor-safe byte and content matches for a local manifest and its local decision record. Those integrity checks do not authenticate the owner, timestamp, revision, references, real drift, marginal estimates, dependence, provider behavior, or operating cost.";
  if (!isIdentityRobustFrontier(frontierCandidate)) {
    return {
      ok: false,
      policySha256: "",
      ...emptyLocal,
      errors: ["identity-robust frontier is invalid"],
      scopeLimit,
    };
  }
  const policy = parsePolicy(policyCandidate);
  if (!policy) {
    return {
      ok: false,
      policySha256: "",
      ...emptyLocal,
      errors: [
        "exactly one explicit frontier policy with evidence is required",
      ],
      scopeLimit,
    };
  }
  const policySha256 = hashIdentityRobustFrontierPolicy(policy);
  const binding = await bindIdentityRobustPolicyEvidenceFromLocalManifest(
    policySha256,
    policy.evidenceReference,
    policy,
    evidenceRoot,
    manifestArtifact,
    manifestArtifactSha256,
    verifiedPolicyScopeCandidate,
  );
  if (!binding.ok) {
    return {
      ok: false,
      policySha256,
      evidenceManifestSha256: binding.manifestSha256,
      policyEvidenceStatus: "",
      selected: null,
      errors: binding.errors,
      decisionRecordSha256: binding.decisionRecordSha256,
      decisionRecordByteLength: binding.decisionRecordByteLength,
      decisionRecordEvidenceStatus: binding.decisionRecordEvidenceStatus,
      decisionRecordContentStatus: binding.decisionRecordContentStatus,
      manifestArtifactSha256: binding.manifestArtifactSha256,
      manifestArtifactByteLength: binding.manifestArtifactByteLength,
      manifestArtifactEvidenceStatus: binding.manifestArtifactEvidenceStatus,
      manifestArtifactContentStatus: binding.manifestArtifactContentStatus,
      scopeLimit: binding.scopeLimit,
    };
  }

  let selected: IdentityRobustFrontierPoint | undefined;
  if (policy.selectionBasis === "minimum-uniform-drift-reserve") {
    selected = frontierCandidate.find(
      (point) => point.uniformDriftBuffer >= policy.minimumUniformDriftReserve!,
    );
  } else {
    for (let index = frontierCandidate.length - 1; index >= 0; index -= 1) {
      const point = frontierCandidate[index]!;
      if (point.episodeCount <= policy.maximumEpisodeCount!) {
        selected = point;
        break;
      }
    }
  }
  return {
    ok: Boolean(selected),
    policySha256,
    evidenceManifestSha256: binding.manifestSha256,
    policyEvidenceStatus: binding.evidenceStatus,
    selected: selected ?? null,
    errors: selected
      ? []
      : ["no frontier point satisfies the explicit operating policy"],
    decisionRecordSha256: binding.decisionRecordSha256,
    decisionRecordByteLength: binding.decisionRecordByteLength,
    decisionRecordEvidenceStatus: binding.decisionRecordEvidenceStatus,
    decisionRecordContentStatus: binding.decisionRecordContentStatus,
    manifestArtifactSha256: binding.manifestArtifactSha256,
    manifestArtifactByteLength: binding.manifestArtifactByteLength,
    manifestArtifactEvidenceStatus: binding.manifestArtifactEvidenceStatus,
    manifestArtifactContentStatus: binding.manifestArtifactContentStatus,
    scopeLimit: binding.scopeLimit,
  };
}
