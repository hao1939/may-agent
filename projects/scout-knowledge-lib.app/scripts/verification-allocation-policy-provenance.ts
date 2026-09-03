import { createHash } from "node:crypto";
import {
  isCanonicalRelativeEvidenceName,
  readDescriptorSafeLocalEvidence,
} from "./descriptor-safe-local-evidence";

export type IdentityRobustPolicyEvidenceManifest = {
  schema: "scout.verification-allocation-policy-evidence/v1";
  evidenceClass: "caller-supplied-policy-provenance";
  policySha256: string;
  evidenceReference: string;
  decisionOwner: string;
  decisionRevision: string;
  observedAt: string;
  decisionRecordArtifact: string;
  decisionRecordSha256: string;
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

export type IdentityRobustLocalPolicyEvidenceBinding =
  IdentityRobustPolicyEvidenceBinding & {
    decisionRecordSha256: string;
    decisionRecordByteLength: number;
    decisionRecordEvidenceStatus: "local-byte-match-unverified" | "";
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
    "decisionRecordArtifact",
    "decisionRecordSha256",
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
    !isCanonicalRelativeEvidenceName(candidate.decisionRecordArtifact) ||
    typeof candidate.decisionRecordSha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(candidate.decisionRecordSha256) ||
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

export async function bindIdentityRobustPolicyEvidenceFromLocalRecord(
  expectedPolicySha256: string,
  expectedEvidenceReference: string,
  candidate: unknown,
  evidenceRoot: string,
): Promise<IdentityRobustLocalPolicyEvidenceBinding> {
  const structural = bindIdentityRobustPolicyEvidence(
    expectedPolicySha256,
    expectedEvidenceReference,
    candidate,
  );
  if (!structural.ok) {
    return {
      ...structural,
      decisionRecordSha256: "",
      decisionRecordByteLength: 0,
      decisionRecordEvidenceStatus: "",
    };
  }
  const manifest = candidate as IdentityRobustPolicyEvidenceManifest;
  const localEvidence = await readDescriptorSafeLocalEvidence(
    evidenceRoot,
    manifest.decisionRecordArtifact,
    manifest.decisionRecordSha256,
  );
  return {
    ...structural,
    ok: localEvidence.ok,
    errors: localEvidence.errors,
    decisionRecordSha256: localEvidence.sha256,
    decisionRecordByteLength: localEvidence.byteLength,
    decisionRecordEvidenceStatus: localEvidence.evidenceStatus,
    scopeLimit:
      "The manifest and one descriptor-safe local byte read are bound to the exact policy. This proves local integrity for that read, not authorship, authority, independence, timestamp validity, or substantive correctness.",
  };
}
