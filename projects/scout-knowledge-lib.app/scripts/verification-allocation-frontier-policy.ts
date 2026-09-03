import { createHash } from "node:crypto";

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
  policyEvidenceStatus: "caller-supplied-unverified" | "";
  selected: IdentityRobustFrontierPoint | null;
  errors: string[];
  scopeLimit: string;
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

function validFrontier(
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
): IdentityRobustFrontierSelection {
  const scopeLimit =
    "Selection is conditional on a caller-supplied policy whose evidence reference is recorded but not independently verified. It does not validate real drift, marginal estimates, dependence, provider behavior, or operating cost.";
  if (!validFrontier(frontierCandidate)) {
    return {
      ok: false,
      policySha256: "",
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
      policyEvidenceStatus: "",
      selected: null,
      errors: [
        "exactly one explicit frontier policy with evidence is required",
      ],
      scopeLimit,
    };
  }
  const policySha256 = createHash("sha256")
    .update(JSON.stringify(policy))
    .digest("hex");
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
    policyEvidenceStatus: "caller-supplied-unverified",
    selected: selected ?? null,
    errors: selected
      ? []
      : ["no frontier point satisfies the explicit operating policy"],
    scopeLimit,
  };
}
