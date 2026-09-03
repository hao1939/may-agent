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
    decisionRecordContentStatus: "local-content-match-unverified" | "";
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

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (record(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function decisionRecordMatches(
  candidate: unknown,
  expectedPolicyCandidate: unknown,
  manifest: IdentityRobustPolicyEvidenceManifest,
): boolean {
  if (!record(candidate)) return false;
  const independentEvidenceStatus = manifest.independentEvidenceStatus;
  const expectedKeys = [
    "schema",
    "decisionId",
    "decisionOwner",
    "decisionRevision",
    "observedAt",
    "policy",
    "rationale",
    "independentEvidenceStatus",
    ...(independentEvidenceStatus === "provided-unverified"
      ? ["independentEvidenceReference"]
      : []),
    "scopeLimit",
  ].sort();
  return (
    JSON.stringify(Object.keys(candidate).sort()) ===
      JSON.stringify(expectedKeys) &&
    candidate.schema === "scout.verification-allocation-policy-decision/v1" &&
    nonempty(candidate.decisionId) &&
    manifest.evidenceReference === `decision-record:${candidate.decisionId}` &&
    candidate.decisionOwner === manifest.decisionOwner &&
    candidate.decisionRevision === manifest.decisionRevision &&
    candidate.observedAt === manifest.observedAt &&
    canonicalJson(candidate.policy) ===
      canonicalJson(expectedPolicyCandidate) &&
    candidate.independentEvidenceStatus === independentEvidenceStatus &&
    (independentEvidenceStatus !== "provided-unverified" ||
      candidate.independentEvidenceReference ===
        manifest.independentEvidenceReference) &&
    nonempty(candidate.rationale) &&
    nonempty(candidate.scopeLimit)
  );
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
  expectedPolicyCandidate: unknown,
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
      decisionRecordContentStatus: "",
    };
  }
  const manifest = candidate as IdentityRobustPolicyEvidenceManifest;
  const localEvidence = await readDescriptorSafeLocalEvidence(
    evidenceRoot,
    manifest.decisionRecordArtifact,
    manifest.decisionRecordSha256,
  );
  if (!localEvidence.ok) {
    return {
      ...structural,
      ok: false,
      errors: localEvidence.errors,
      decisionRecordSha256: localEvidence.sha256,
      decisionRecordByteLength: localEvidence.byteLength,
      decisionRecordEvidenceStatus: localEvidence.evidenceStatus,
      decisionRecordContentStatus: "",
      scopeLimit: localEvidence.scopeLimit,
    };
  }
  let decisionRecordCandidate: unknown;
  try {
    decisionRecordCandidate = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(localEvidence.bytes!),
    );
  } catch {
    return {
      ...structural,
      ok: false,
      errors: ["local decision record must contain valid UTF-8 JSON"],
      decisionRecordSha256: localEvidence.sha256,
      decisionRecordByteLength: localEvidence.byteLength,
      decisionRecordEvidenceStatus: localEvidence.evidenceStatus,
      decisionRecordContentStatus: "",
      scopeLimit:
        "The local bytes match their declared hash but do not form a valid decision record. No authorship, authority, independence, timestamp validity, or substantive correctness is established.",
    };
  }
  if (
    !decisionRecordMatches(
      decisionRecordCandidate,
      expectedPolicyCandidate,
      manifest,
    )
  ) {
    return {
      ...structural,
      ok: false,
      errors: [
        "local decision record does not match the provenance manifest and policy",
      ],
      decisionRecordSha256: localEvidence.sha256,
      decisionRecordByteLength: localEvidence.byteLength,
      decisionRecordEvidenceStatus: localEvidence.evidenceStatus,
      decisionRecordContentStatus: "",
      scopeLimit:
        "The local bytes match their declared hash but their content does not match the expected policy and manifest. No authorship, authority, independence, timestamp validity, or substantive correctness is established.",
    };
  }
  return {
    ...structural,
    ok: true,
    errors: [],
    decisionRecordSha256: localEvidence.sha256,
    decisionRecordByteLength: localEvidence.byteLength,
    decisionRecordEvidenceStatus: localEvidence.evidenceStatus,
    decisionRecordContentStatus: "local-content-match-unverified",
    scopeLimit:
      "The manifest, one descriptor-safe local byte read, and the record's policy and provenance content agree. This proves local consistency for that read, not authorship, authority, independence, timestamp validity, or substantive correctness.",
  };
}
