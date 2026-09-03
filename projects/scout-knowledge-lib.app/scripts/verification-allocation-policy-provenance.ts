import { createHash } from "node:crypto";

export type IdentityRobustPolicyEvidenceManifest = {
  schema: "scout.verification-allocation-policy-evidence/v1";
  evidenceClass: "caller-supplied-policy-provenance";
  policySha256: string;
  evidenceReference: string;
  decisionOwner: string;
  decisionRevision: string;
  observedAt: string;
  independentEvidenceStatus: "not-provided" | "provided-unverified";
  independentEvidenceReference?: string;
};

export type IdentityRobustPolicyEvidenceBinding = {
  ok: boolean;
  manifestSha256: string;
  evidenceStatus: "caller-supplied-unverified" | "";
  errors: string[];
  scopeLimit: string;
};

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonempty(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 500 &&
    Boolean(value.trim()) &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function exactUtcTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

export function bindIdentityRobustPolicyEvidence(
  expectedPolicySha256: string,
  expectedEvidenceReference: string,
  candidate: unknown,
): IdentityRobustPolicyEvidenceBinding {
  const scopeLimit =
    "The manifest binds caller-supplied provenance fields to an exact policy hash. It does not authenticate the owner, timestamp, revision, reference, independent evidence, cost, drift estimate, or provider behavior.";
  const independentEvidenceStatus = record(candidate)
    ? candidate.independentEvidenceStatus
    : undefined;
  const expectedKeys = [
    "schema",
    "evidenceClass",
    "policySha256",
    "evidenceReference",
    "decisionOwner",
    "decisionRevision",
    "observedAt",
    "independentEvidenceStatus",
    ...(independentEvidenceStatus === "provided-unverified"
      ? ["independentEvidenceReference"]
      : []),
  ].sort();
  if (
    !record(candidate) ||
    JSON.stringify(Object.keys(candidate).sort()) !==
      JSON.stringify(expectedKeys) ||
    candidate.schema !== "scout.verification-allocation-policy-evidence/v1" ||
    candidate.evidenceClass !== "caller-supplied-policy-provenance" ||
    !/^[0-9a-f]{64}$/.test(expectedPolicySha256) ||
    candidate.policySha256 !== expectedPolicySha256 ||
    !nonempty(expectedEvidenceReference) ||
    candidate.evidenceReference !== expectedEvidenceReference ||
    !nonempty(candidate.decisionOwner) ||
    !nonempty(candidate.decisionRevision) ||
    !exactUtcTimestamp(candidate.observedAt) ||
    (independentEvidenceStatus !== "not-provided" &&
      independentEvidenceStatus !== "provided-unverified") ||
    (independentEvidenceStatus === "provided-unverified" &&
      !nonempty(candidate.independentEvidenceReference))
  ) {
    return {
      ok: false,
      manifestSha256: "",
      evidenceStatus: "",
      errors: [
        "an exact caller-supplied policy provenance manifest is required",
      ],
      scopeLimit,
    };
  }
  return {
    ok: true,
    manifestSha256: createHash("sha256")
      .update(JSON.stringify(candidate))
      .digest("hex"),
    evidenceStatus: "caller-supplied-unverified",
    errors: [],
    scopeLimit,
  };
}
